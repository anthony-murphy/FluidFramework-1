/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */
/**
 * Type inference utilities for deriving TypeScript types from schema definitions.
 *
 * @remarks
 * This module provides utility types that allow extracting plain TypeScript types
 * from schema definitions created with {@link SchemaFactory}. These utilities
 * enable compile-time type safety when working with schema-defined data structures.
 */
export type {
	ValueFromLeafSchema,
	NodeFromSchema,
	InferFields,
	InferValueSchema,
	InferMapValueType,
	InferAllowedTypes,
	InferFieldKind,
	ObjectFromFields,
	TypeFromImplicitAllowedTypes,
	NormalizeFieldSchema,
	TypeFromField,
	DeepReadonly,
	ReadonlyNodeFromSchema,
	IsLeafSchema,
	IsObjectSchema,
	IsMapSchema,
	SchemaKind,
	UnionFromSchemas,
} from "./inference.js";
