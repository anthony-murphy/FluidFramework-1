/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { assert } from "@fluidframework/core-utils/internal";

import { computeValue, type AdjustParams } from "./adjust.js";
import { UnassignedSequenceNumber, UniversalSequenceNumber } from "./constants.js";
import { IMergeTreeAnnotateMsg } from "./ops.js";
import { MapLike, PropertySet, createMap } from "./properties.js";

import type { ISegment } from "./index.js";

/**
 * @legacy
 * @alpha
 */
export enum PropertiesRollback {
	/**
	 * Not in a rollback
	 */
	None,

	/**
	 * Rollback
	 */
	Rollback,
}

export function handleProperties(
	op: { props?: PropertySet; adjust?: MapLike<AdjustParams> },
	seg: ISegment,
	seq?: number,
	collaborating: boolean = false,
	rollback: PropertiesRollback = PropertiesRollback.None,
): PropertySet {
	seg.propertyManager ??= new InternalPropertiesManager();
	assert(
		seg.propertyManager instanceof InternalPropertiesManager,
		"must be InternalPropertiesManager",
	);

	return seg.propertyManager.handleProperties(op, seg, seq, collaborating, rollback);
}

export function ackProperties(op: IMergeTreeAnnotateMsg, seg: ISegment): void {
	assert(
		seg.propertyManager instanceof InternalPropertiesManager,
		"must be InternalPropertiesManager",
	);

	return seg.propertyManager.ack(seg.properties!, op);
}

/**
 * @legacy
 * @alpha
 * @deprecated This will be removed in a future release
 */
export class PropertiesManager {
	private pendingKeyUpdateCount: MapLike<number> | undefined;

	public ackPendingProperties(annotateOp: IMergeTreeAnnotateMsg): void {
		this.decrementPendingCounts(annotateOp.props);
	}

	private decrementPendingCounts(props: PropertySet): void {
		for (const [key, value] of Object.entries(props)) {
			if (value !== undefined && this.pendingKeyUpdateCount?.[key] !== undefined) {
				assert(
					// TODO Non null asserting, why is this not null?
					this.pendingKeyUpdateCount[key]! > 0,
					0x05c /* "Trying to update more annotate props than do exist!" */,
				);
				this.pendingKeyUpdateCount[key]--;
				if (this.pendingKeyUpdateCount?.[key] === 0) {
					// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
					delete this.pendingKeyUpdateCount[key];
				}
			}
		}
	}

	public addProperties(
		oldProps: PropertySet,
		newProps: PropertySet,
		seq?: number,
		collaborating: boolean = false,
		rollback: PropertiesRollback = PropertiesRollback.None,
	): PropertySet {
		this.pendingKeyUpdateCount ??= createMap<number>();

		// Clean up counts for rolled back edits before modifying oldProps
		if (collaborating && rollback === PropertiesRollback.Rollback) {
			this.decrementPendingCounts(newProps);
		}

		const shouldModifyKey = (key: string): boolean => {
			if (
				seq === UnassignedSequenceNumber ||
				seq === UniversalSequenceNumber ||
				this.pendingKeyUpdateCount?.[key] === undefined
			) {
				return true;
			}
			return false;
		};

		const deltas: PropertySet = {};

		for (const [key, newValue] of Object.entries(newProps)) {
			if (newValue === undefined) {
				continue;
			}

			if (collaborating) {
				if (seq === UnassignedSequenceNumber) {
					if (this.pendingKeyUpdateCount?.[key] === undefined) {
						this.pendingKeyUpdateCount[key] = 0;
					}
					this.pendingKeyUpdateCount[key]++;
				} else if (!shouldModifyKey(key)) {
					continue;
				}
			}

			const previousValue: unknown = oldProps[key];
			// The delta should be null if undefined, as that's how we encode delete
			// eslint-disable-next-line unicorn/no-null
			deltas[key] = previousValue === undefined ? null : previousValue;
			if (newValue === null) {
				// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
				delete oldProps[key];
			} else {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				oldProps[key] = newValue;
			}
		}

		return deltas;
	}

	public copyTo(
		oldProps: PropertySet,
		newProps: PropertySet | undefined,
		newManager: PropertiesManager,
	): PropertySet | undefined {
		if (oldProps) {
			// eslint-disable-next-line no-param-reassign
			newProps ??= createMap<unknown>();
			if (!newManager) {
				throw new Error("Must provide new PropertyManager");
			}
			for (const key of Object.keys(oldProps)) {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				newProps[key] = oldProps[key];
			}
			newManager.pendingKeyUpdateCount = createMap<number>();
			for (const key of Object.keys(this.pendingKeyUpdateCount!)) {
				// TODO Non null asserting, why is this not null?
				newManager.pendingKeyUpdateCount[key] = this.pendingKeyUpdateCount![key]!;
			}
		}
		return newProps;
	}

	/**
	 * Determines if all of the defined properties in a given property set are pending.
	 */
	public hasPendingProperties(props: PropertySet): boolean {
		for (const [key, value] of Object.entries(props)) {
			if (value !== undefined && this.pendingKeyUpdateCount?.[key] === undefined) {
				return false;
			}
		}
		return true;
	}

	public hasPendingProperty(key: string): boolean {
		return (this.pendingKeyUpdateCount?.[key] ?? 0) > 0;
	}
}

/**
 * create a new class that is not exported. once PropertiesManager is removed from exports,
 * these classes can be merge back together
 */
export class InternalPropertiesManager extends PropertiesManager {
	public handleProperties(
		op: { props?: MapLike<unknown>; adjust?: MapLike<AdjustParams> },
		seg: ISegment,
		seq?: number,
		collaborating: boolean = false,
		rollback: PropertiesRollback = PropertiesRollback.None,
	): MapLike<unknown> {
		const properties = (seg.properties ??= createMap<unknown>());

		const { props, adjust } = op;

		// order matters in this function. we first apply props, then adjustments
		// the returned delta supersede the adjusts with the props, so
		// a revert goes back to the original value.
		const propsDeltas = props
			? this.addProperties(properties, props, seq, collaborating, rollback)
			: {};

		const adjustDeltas = adjust
			? this.adjustProperties(properties, adjust, seq, collaborating)
			: {};

		return { adjustDeltas, propsDeltas };
	}

	private pendingAdjustments:
		| MapLike<{ consensus: number; pending: AdjustParams[] } | undefined>
		| undefined;

	private adjustProperties(
		oldProps: MapLike<unknown>,
		newProps: MapLike<AdjustParams>,
		seq?: number,
		collaborating: boolean = false,
	): MapLike<unknown> {
		const deltas: MapLike<unknown> = {};
		const local = collaborating && seq === UnassignedSequenceNumber;
		for (const [key, value] of Object.entries(newProps)) {
			this.adjustProperty(oldProps, key, value, local, deltas);
		}
		return deltas;
	}

	private adjustProperty(
		oldProps: MapLike<unknown>,
		key: string,
		value: AdjustParams,
		local: boolean,
		deltas: MapLike<unknown>,
	): void {
		// preserve the preceding value
		const oldRaw = (deltas[key] = oldProps[key]);
		const old = typeof oldRaw === "number" ? oldRaw : 0;

		if (local) {
			const adjustments = (this.pendingAdjustments ??= {});
			const adjusts = (adjustments[key] ??= { consensus: old, pending: [] });
			adjusts.pending.push(value);
			oldProps[key] = computeValue(adjusts.consensus, ...adjusts.pending);
		} else {
			const adjusts = this.pendingAdjustments?.[key];
			if (adjusts === undefined) {
				// not pending changes, so no need to update the adjustments
				oldProps[key] = computeValue(old, value);
			} else {
				// there are pending changes, so update the baseline remote value
				// and then compute the current value
				adjusts.consensus = computeValue(adjusts.consensus, value);
				oldProps[key] = computeValue(adjusts.consensus, ...adjusts.pending);
			}
		}
	}

	public ack(oldProps: MapLike<unknown>, annotateOp: IMergeTreeAnnotateMsg): void {
		super.ackPendingProperties(annotateOp);

		const { adjust } = annotateOp;
		if (adjust) {
			for (const [key, value] of Object.entries(adjust)) {
				const adjusts = this.pendingAdjustments?.[key];
				assert(adjusts !== undefined, "local should have adjusts");
				// unshift the pending adjust
				adjusts.pending.unshift();
				// re-apply the adjust as acked
				this.adjustProperty(oldProps, key, value, false, {});
				if (adjusts.pending.length === 0) {
					this.pendingAdjustments![key] = undefined;
				}
			}
		}
	}
}
