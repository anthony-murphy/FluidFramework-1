/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/**
 * Schema serialization and deserialization utilities.
 *
 * This module provides types and functions for encoding and decoding schema definitions
 * to/from a JSON-compatible format suitable for persistence in `.attributes` blobs.
 */

export type {
	EncodedSchema,
	EncodedNodeSchema,
	EncodedObjectSchema,
	EncodedMapSchema,
	EncodedArraySchema,
	EncodedLeafSchema,
	EncodedFieldSchema,
	SimpleNodeSchema,
	SimpleObjectNodeSchema,
	SimpleArrayNodeSchema,
	SimpleMapNodeSchema,
	SimpleLeafNodeSchema,
	SimpleFieldSchema,
	DecodedSchema,
} from "./format.js";

export { encodeSchema } from "./encode.js";

export { decodeSchema } from "./decode.js";

export { type SchemaCompatibilityStatus, checkSchemaCompatibility } from "./compatibility.js";
