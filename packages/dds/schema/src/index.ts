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
	isSchemaClass,
	isSchemaClassConstructor,
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
	FieldProps,
	SchemaClassConstructor,
	SchemaClassStatics,
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
	RootSchema,
} from "./core/index.js";
export type {
	// Primary type inference
	NodeFromSchema,
	ValueFromLeafSchema,
	ReadonlyNodeFromSchema,
	// Field and value extraction
	InferFields,
	InferValueSchema,
	InferMapValueType,
	InferAllowedTypes,
	InferFieldKind,
	// Helper types used by NodeFromSchema
	ObjectFromFields,
	TypeFromImplicitAllowedTypes,
	NormalizeFieldSchema,
	TypeFromField,
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
export {
	encodeSchema,
	decodeSchema,
	checkSchemaCompatibility,
} from "./serialization/index.js";
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
export type { StorageResult, ISchemaStorage, ISchemaPersistence } from "./storage/index.js";
export type { MapLikeStorage, SchemaField } from "./storage/index.js";
export { createFlatStorageAdapter, createPersistenceAdapter } from "./storage/index.js";

// Validation
export { validateData, buildSchemaRegistry } from "./validation/index.js";
export type {
	ValidationError,
	ValidationResult,
	SchemaRegistry,
} from "./validation/index.js";

// View
export {
	SchematizedObjectView,
	SchematizedMapView,
	SchemaValidationError,
	isSchemaValidationError,
	createSchematizedView,
	createSchematizedObjectView,
	createSchematizedMapView,
	normalizeViewConfig,
} from "./view/index.js";
export type {
	ISchemaValidationError,
	ViewFor,
	ObjectView,
	MapView,
	SchemaView,
	SchematizedView,
	SchematizedViewBase,
	RootFromSchema,
	CreateViewOptions,
	ObjectViewResult,
	MapViewResult,
	SchemaViewConfiguration,
	NormalizedViewConfig,
	SchematizedObjectViewOptions,
	SchematizedMapViewOptions,
} from "./view/index.js";
