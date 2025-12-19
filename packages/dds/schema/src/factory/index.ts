/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/**
 * Schema factory for creating schema definitions.
 *
 * This module provides a factory class for creating type-safe schema definitions
 * that can be used across Fluid Framework DDSes.
 */

export {
	type TypedLeafNodeSchema,
	stringSchema,
	numberSchema,
	booleanSchema,
	nullSchema,
	handleSchema,
} from "./leafSchemas.js";

export {
	type ScopedSchemaName,
	type FieldProps,
	type TypedFieldSchema,
	type TypedObjectNodeSchema,
	type TypedMapNodeSchema,
	type ImplicitAllowedTypes,
	type ImplicitFieldSchema,
	type ObjectSchemaFields,
	type NodeFromSchema,
	SchemaFactory,
} from "./schemaFactory.js";
