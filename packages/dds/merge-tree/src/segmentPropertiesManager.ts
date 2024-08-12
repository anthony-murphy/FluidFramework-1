/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { assert } from "@fluidframework/core-utils/internal";

import { computeValue, type AdjustParams, type PendingChanges } from "./adjust.js";
import { DoublyLinkedList } from "./collections/index.js";
import { UnassignedSequenceNumber, UniversalSequenceNumber } from "./constants.js";
import { IMergeTreeAnnotateMsg } from "./ops.js";
import { MapLike, PropertySet, clone, createMap, extend } from "./properties.js";

import type { ISegment } from "./index.js";

/**
 * @legacy
 * @alpha
 *
 * @deprecated - This enum should not be used externally and will be removed in a subsequent release.
 *
 * @privateRemarks This enum should be made internal after the deprecation period
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
 *
 * @deprecated - This class should not be used externally and will be removed in a subsequent release.
 *
 * @privateRemarks This class should be made internal after the deprecation period
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
			extend(newProps, oldProps);

			if (this.pendingKeyUpdateCount) {
				newManager.pendingKeyUpdateCount = clone(this.pendingKeyUpdateCount);
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
		const deltas = createMap();
		for (const [key, value] of [
			...Object.entries(op.props ?? {})
				.map<[string, { raw: unknown }]>(([k, raw]) => [k, { raw }])
				.filter(([_, v]) => v.raw !== undefined),
			...Object.entries(op.adjust ?? {}),
		]) {
			// eslint-disable-next-line unicorn/no-null
			deltas[key] = properties[key] ?? null;
			if (seq === UnassignedSequenceNumber && collaborating) {
				const adjustments = (this.pending ??= {});
				const pending: PendingChanges = (adjustments[key] ??= {
					consensus: properties[key],
					changes: new DoublyLinkedList(),
				});
				pending.changes.push(value);
				properties[key] = computeValue(
					pending.consensus,
					pending.changes.map((n) => n.data),
				);
			} else {
				const pending = this.pending?.[key];
				if (pending === undefined) {
					// not pending changes, so no need to update the adjustments
					properties[key] = computeValue(properties[key], [value]);
				} else {
					// there are pending changes, so update the baseline remote value
					// and then compute the current value
					pending.consensus = computeValue(pending.consensus, [value]);
					properties[key] = computeValue(
						pending.consensus,
						pending.changes.map((n) => n.data),
					);
				}
			}
			if (properties[key] === null) {
				// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
				delete properties[key];
			}
		}
		return deltas;
	}

	private pending: MapLike<PendingChanges | undefined> | undefined;

	public ack(
		oldProps: MapLike<unknown>,
		op: { props?: MapLike<unknown>; adjust?: MapLike<AdjustParams> },
	): void {
		for (const [key, value] of [
			...Object.entries(op.props ?? {})
				.map<[string, { raw: unknown }]>(([k, raw]) => [k, { raw }])
				.filter(([_, v]) => v.raw !== undefined),
			...Object.entries(op.adjust ?? {}),
		]) {
			const pending = this.pending?.[key];
			assert(pending !== undefined, "must have pending to ack");
			pending.changes.shift();
			if (pending.changes.length === 0) {
				delete this.pending?.[key];
				if (Object.keys(this.pending ?? {}).length === 0) {
					this.pending = undefined;
				}
			} else {
				pending.consensus = computeValue(pending.consensus, [value]);
			}
		}
	}

	public override copyTo(
		oldProps: PropertySet,
		newProps: PropertySet | undefined,
		newManager: PropertiesManager,
	): PropertySet | undefined {
		assert(newManager instanceof InternalPropertiesManager, "must be internal");
		if (this.pending !== undefined) {
			for (const [key, value] of Object.entries(this.pending)) {
				if (value !== undefined) {
					const { consensus, changes } = value;
					const pending = (newManager.pending ??= {});
					pending[key] = {
						consensus,
						changes: new DoublyLinkedList(changes.map((n) => n.data)),
					};
				}
			}
		}
		return { ...oldProps };
	}

	public override hasPendingProperties(props: PropertySet): boolean {
		for (const [key, value] of Object.entries(props)) {
			if (value !== undefined && this.pending?.[key] === undefined) {
				return false;
			}
		}
		return true;
	}
	public override hasPendingProperty(key: string): boolean {
		return this.pending?.[key] !== undefined;
	}
}
