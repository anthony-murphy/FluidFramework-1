/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/**
 * Shared schema system for Fluid Framework DDSes.
 *
 * @remarks This library provides a schema definition system that can be shared across
 * different Fluid Framework distributed data structures (DDSes).
 *
 * @packageDocumentation
 */

export {
	SchemaFactory,
	stringSchema,
	numberSchema,
	booleanSchema,
	nullSchema,
	handleSchema,
} from "./factory/index.js";
export type {
	ScopedSchemaName,
	TypedLeafNodeSchema,
	TypedFieldSchema,
	TypedObjectNodeSchema,
	TypedMapNodeSchema,
	ImplicitAllowedTypes,
	ImplicitFieldSchema,
	ObjectSchemaFields,
} from "./factory/index.js";
export {
	FieldKind,
	NodeKind,
	isObjectSchema,
	isArraySchema,
	isMapSchema,
	isLeafSchema,
} from "./core/index.js";
export type {
	NodeSchema,
	ObjectNodeSchema,
	ArrayNodeSchema,
	MapNodeSchema,
	LeafNodeSchema,
	FieldSchema,
	LeafKind,
	AnyNodeSchema,
} from "./core/index.js";
export type {
	// Primary type inference
	NodeFromSchema,
	ValueFromLeafSchema,
	ReadonlyNodeFromSchema,
	// Field and value extraction
	InferFields,
	InferValueSchema,
	InferAllowedTypes,
	InferFieldKind,
	// Immutability utilities
	DeepReadonly,
	// Type-level schema guards
	IsLeafSchema,
	IsObjectSchema,
	IsMapSchema,
	SchemaKind,
	// Union utilities
	UnionFromSchemas,
} from "./types/index.js";

// Serialization
export { encodeSchema, decodeSchema, checkSchemaCompatibility } from "./serialization/index.js";
export type {
	// Encoded schema types
	EncodedSchema,
	EncodedNodeSchema,
	EncodedObjectSchema,
	EncodedMapSchema,
	EncodedArraySchema,
	EncodedLeafSchema,
	EncodedFieldSchema,
	// Simple schema types (decode output)
	SimpleNodeSchema,
	SimpleObjectNodeSchema,
	SimpleArrayNodeSchema,
	SimpleMapNodeSchema,
	SimpleLeafNodeSchema,
	SimpleFieldSchema,
	DecodedSchema,
	// Compatibility checking
	SchemaCompatibilityStatus,
} from "./serialization/index.js";

// Storage
export { MockStorage, MockPersistence } from "./storage/index.js";
export type { StorageResult, ISchemaStorage, ISchemaPersistence } from "./storage/index.js";

