/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import type { IFluidHandle } from "@fluidframework/core-interfaces";

import { NodeKind, type LeafNodeSchema, type LeafKind } from "../core/index.js";

/**
 * A typed leaf node schema that preserves the TypeScript type of the value.
 *
 * @typeParam TIdentifier - The unique identifier for this schema.
 * @typeParam TLeafKind - The kind of leaf value (string, number, boolean, null, handle).
 * @typeParam TValue - The TypeScript type of the value stored in this leaf.
 *
 * @remarks
 * This extends the base LeafNodeSchema with additional type information
 * needed for type inference.
 * @legacy
 * @alpha
 */
export interface TypedLeafNodeSchema<
	TIdentifier extends string = string,
	TLeafKind extends LeafKind = LeafKind,
	TValue = unknown,
> extends LeafNodeSchema {
	readonly identifier: TIdentifier;
	readonly kind: typeof NodeKind.Leaf;
	readonly leafKind: TLeafKind;
	/**
	 * Phantom property used for type inference only.
	 * @remarks
	 * This property does not exist at runtime. It is used to preserve
	 * the TypeScript type associated with this leaf schema.
	 */
	readonly _typeInfo?: {
		readonly value: TValue;
	};
}

/**
 * Built-in leaf schema for string values.
 * @legacy
 * @alpha
 */
export const stringSchema: TypedLeafNodeSchema<
	"com.fluidframework.leaf.string",
	"string",
	string
> = {
	identifier: "com.fluidframework.leaf.string",
	kind: NodeKind.Leaf,
	leafKind: "string",
};

/**
 * Built-in leaf schema for number values.
 * @legacy
 * @alpha
 */
export const numberSchema: TypedLeafNodeSchema<
	"com.fluidframework.leaf.number",
	"number",
	number
> = {
	identifier: "com.fluidframework.leaf.number",
	kind: NodeKind.Leaf,
	leafKind: "number",
};

/**
 * Built-in leaf schema for boolean values.
 * @legacy
 * @alpha
 */
export const booleanSchema: TypedLeafNodeSchema<
	"com.fluidframework.leaf.boolean",
	"boolean",
	boolean
> = {
	identifier: "com.fluidframework.leaf.boolean",
	kind: NodeKind.Leaf,
	leafKind: "boolean",
};

/**
 * Built-in leaf schema for null values.
 * @legacy
 * @alpha
 */
// eslint-disable-next-line @rushstack/no-new-null
export const nullSchema: TypedLeafNodeSchema<"com.fluidframework.leaf.null", "null", null> = {
	identifier: "com.fluidframework.leaf.null",
	kind: NodeKind.Leaf,
	leafKind: "null",
};

/**
 * Built-in leaf schema for Fluid handle values.
 * @legacy
 * @alpha
 */
export const handleSchema: TypedLeafNodeSchema<
	"com.fluidframework.leaf.handle",
	"handle",
	IFluidHandle
> = {
	identifier: "com.fluidframework.leaf.handle",
	kind: NodeKind.Leaf,
	leafKind: "handle",
};
