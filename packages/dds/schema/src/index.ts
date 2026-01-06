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

// =====================================================================
// Schema Factory - main entry point for defining schemas
// =====================================================================
export { SchemaFactory } from "./factory/index.js";
export type {
	TypedLeafNodeSchema,
	TypedFieldSchema,
	TypedObjectNodeSchema,
	TypedConstObjectNodeSchema,
	TypedMapNodeSchema,
	ImplicitAllowedTypes,
	ImplicitFieldSchema,
	ObjectSchemaFields,
	FieldProps,
	ScopedSchemaName,
	SchemaClassConstructor,
	SchemaClassStatics,
	SchemaFieldsBrand,
} from "./factory/index.js";

// Primitive leaf schemas
export {
	stringSchema,
	numberSchema,
	booleanSchema,
	nullSchema,
	handleSchema,
} from "./factory/index.js";

// =====================================================================
// Core schema types
// =====================================================================
export { FieldKind, NodeKind } from "./core/index.js";
export type {
	NodeSchema,
	ObjectNodeSchema,
	MapNodeSchema,
	ArrayNodeSchema,
	LeafNodeSchema,
	FieldSchema,
	LeafKind,
	RootSchema,
	AnyNodeSchema,
} from "./core/index.js";

// =====================================================================
// Type inference
// =====================================================================
export type {
	NodeFromSchema,
	InferMapValueType,
	ValueFromLeafSchema,
	ObjectFromFields,
	ReadonlyObjectFromFields,
	ReadonlyTypeFromField,
	ReadonlyTypeFromImplicitAllowedTypes,
	TypeFromImplicitAllowedTypes,
	NormalizeFieldSchema,
	TypeFromField,
	InferValueSchema,
} from "./types/index.js";

// =====================================================================
// Serialization
// =====================================================================
export type {
	EncodedSchema,
	SchemaCompatibilityStatus,
	EncodedNodeSchema,
	EncodedObjectSchema,
	EncodedMapSchema,
	EncodedArraySchema,
	EncodedLeafSchema,
	EncodedFieldSchema,
} from "./serialization/index.js";

// =====================================================================
// Storage interfaces
// =====================================================================
export type { StorageResult, ISchemaStorage, ISchemaPersistence } from "./storage/index.js";

// =====================================================================
// View types
// =====================================================================
export {
	SchematizedObjectView,
	SchematizedMapView,
	BaseSchematizedView,
	isSchemaValidationError,
} from "./view/index.js";
export type {
	ObjectView,
	MapView,
	SchematizedView,
	SchematizedViewBase,
	SchematizedViewOptions,
	SchematizedObjectViewOptions,
	SchematizedMapViewOptions,
	ISchemaValidationError,
	RootFromSchema,
} from "./view/index.js";

// Validation error type
export type { ValidationError } from "./validation/index.js";

// =====================================================================
// DDS integration
// =====================================================================
export { createViewWith } from "./dds/index.js";
export type { IViewableStorage } from "./dds/index.js";
