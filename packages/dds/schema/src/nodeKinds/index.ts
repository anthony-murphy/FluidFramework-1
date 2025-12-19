/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/**
 * Node kind implementations and utilities.
 *
 * @remarks
 * This module re-exports node kind types and utilities from the core module.
 * It is primarily kept for organizational purposes.
 */

export {
	NodeKind,
	FieldKind,
	isObjectSchema,
	isArraySchema,
	isMapSchema,
	isLeafSchema,
} from "../core/index.js";

export type {
	NodeSchema,
	ObjectNodeSchema,
	ArrayNodeSchema,
	MapNodeSchema,
	LeafNodeSchema,
	FieldSchema,
} from "../core/index.js";
