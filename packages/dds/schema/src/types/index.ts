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
	InferValueSchema,
	InferMapValueType,
	ObjectFromFields,
	ReadonlyObjectFromFields,
	ReadonlyTypeFromField,
	ReadonlyTypeFromImplicitAllowedTypes,
	TypeFromImplicitAllowedTypes,
	NormalizeFieldSchema,
	TypeFromField,
} from "./inference.js";
