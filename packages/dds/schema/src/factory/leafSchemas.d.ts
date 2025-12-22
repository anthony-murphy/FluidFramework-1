/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */
import type { IFluidHandle } from "@fluidframework/core-interfaces";
import type { LeafNodeSchema, LeafKind } from "../core/index.js";
import type { NodeKind } from "../core/index.js";
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
export declare const stringSchema: TypedLeafNodeSchema<
	"com.fluidframework.leaf.string",
	"string",
	string
>;
/**
 * Built-in leaf schema for number values.
 * @legacy
 * @alpha
 */
export declare const numberSchema: TypedLeafNodeSchema<
	"com.fluidframework.leaf.number",
	"number",
	number
>;
/**
 * Built-in leaf schema for boolean values.
 * @legacy
 * @alpha
 */
export declare const booleanSchema: TypedLeafNodeSchema<
	"com.fluidframework.leaf.boolean",
	"boolean",
	boolean
>;
/**
 * Built-in leaf schema for null values.
 * @legacy
 * @alpha
 */
export declare const nullSchema: TypedLeafNodeSchema<
	"com.fluidframework.leaf.null",
	"null",
	// eslint-disable-next-line @rushstack/no-new-null -- This schema represents the null literal type
	null
>;
/**
 * Built-in leaf schema for Fluid handle values.
 * @legacy
 * @alpha
 */
export declare const handleSchema: TypedLeafNodeSchema<
	"com.fluidframework.leaf.handle",
	"handle",
	IFluidHandle
>;
