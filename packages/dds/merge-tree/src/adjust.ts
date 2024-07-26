/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { isObject } from "@fluidframework/core-utils/internal";

import type { MapLike } from "./index.js";

/**
 * @alpha
 * @legacy
 */
export interface AdjustParams {
	value: number;
	min?: number;
	max?: number;
}

export interface AdjustValue {
	remoteValue: number;
	// localValue: number;
	pendingValues: AdjustParams[];
}

export interface AdjustOp {
	type: "adjust";
	pos1: number;
	pos2: number;
	props: MapLike<AdjustParams>;
}

export function isAdjustableValue(value: unknown): value is AdjustValue {
	return (
		isObject(value) &&
		"remoteValue" in value &&
		typeof value.remoteValue === "number" &&
		"pendingValues" in value &&
		Array.isArray(value.pendingValues)
	);
}

export function toAdjustableValue(value: unknown): AdjustValue {
	if (isAdjustableValue(value)) {
		return value;
	}
	if (typeof value === "number") {
		return {
			remoteValue: value,
			// localValue: value,
			pendingValues: [],
		};
	}
	return {
		remoteValue: 0, // localValue: 0,
		pendingValues: [],
	};
}

export function incrementAdjust(op: AdjustParams, currentValue: AdjustValue): AdjustValue {
	const { remoteValue, pendingValues } = currentValue;
	pendingValues.push({ ...op });
	// const localValue = computeValue(remoteValue, ...pendingValues);
	return {
		remoteValue, // localValue,
		pendingValues,
	};
}

export function processAdjust(
	op: AdjustParams,
	local: boolean,
	currentValue: AdjustValue,
): AdjustValue {
	const { remoteValue: oldRemoteValue, pendingValues } = currentValue;

	if (local) {
		pendingValues.shift();
	}
	const remoteValue = computeValue(oldRemoteValue, op);

	// const localValue = computeValue(remoteValue, ...pendingValues);

	return {
		remoteValue, // localValue,
		pendingValues,
	};
}

export function computeValue(value: number, ...ops: AdjustParams[]): number {
	let newValue = value;
	for (const op of ops) {
		newValue += op.value;
		if (op.max) {
			newValue = Math.max(newValue, op.max);
		}
		if (op.min) {
			newValue = Math.min(newValue, op.min);
		}
	}
	return newValue;
}
