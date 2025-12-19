/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/**
 * Core schema types and enums for the standalone schema package.
 *
 * These types are extracted and adapted from the Tree DDS schema system
 * to provide a self-contained schema definition layer that can be used
 * independently of the Tree DDS implementation.
 */

export { FieldKind } from "./fieldKind.js";
export { NodeKind } from "./nodeKind.js";
export type {
	LeafKind,
	NodeSchema,
	ObjectNodeSchema,
	ArrayNodeSchema,
	MapNodeSchema,
	LeafNodeSchema,
	FieldSchema,
	AnyNodeSchema,
	RootSchema,
} from "./nodeSchema.js";
export { isObjectSchema, isArraySchema, isMapSchema, isLeafSchema } from "./typeGuards.js";
