/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/**
 * Configuration types for schema views.
 *
 * @remarks
 * This module provides configuration interfaces and utilities for creating
 * schematized views. It supports both direct schema input and configuration
 * objects for more advanced use cases.
 */

import type { RootSchema } from "../core/index.js";

/**
 * Configuration for creating a schematized view.
 *
 * @remarks
 * This interface allows passing additional options when creating a view,
 * following the pattern used by Tree's `viewWith` method. You can either
 * pass a schema directly or use this configuration object for more control.
 *
 * @example
 * ```typescript
 * // Full configuration object
 * const view = map.viewWith({
 *   schema: PersonSchema,
 *   enableSchemaValidation: true,
 * });
 *
 * // Shorthand - just the schema (defaults apply)
 * const view = map.viewWith(PersonSchema);
 * ```
 *
 * @typeParam TSchema - The root schema type
 * @legacy
 * @alpha
 */
export interface SchemaViewConfiguration<TSchema extends RootSchema> {
	/**
	 * The schema to use for the view.
	 *
	 * @remarks
	 * This defines the structure that the view expects the data to conform to.
	 */
	readonly schema: TSchema;

	/**
	 * Enable runtime validation on every property set operation.
	 *
	 * @remarks
	 * When true, every set operation will validate the data against the schema
	 * before storing it. This provides additional safety but has performance
	 * overhead.
	 *
	 * When false, validation is only performed during `initialize()` calls.
	 *
	 * @defaultValue false
	 */
	readonly enableSchemaValidation?: boolean;

	/**
	 * List of stored schema identifiers to ignore during validation.
	 *
	 * @remarks
	 * This is an unsafe escape hatch for development/migration scenarios.
	 * When the stored schema's identifier matches one in this list,
	 * it will be ignored and the view will act as if no schema was stored.
	 *
	 * Use with caution - existing data may not match the new schema!
	 *
	 * @example
	 * ```ts
	 * const view = map.viewWith({
	 *   schema: SchemaV2,
	 *   ignoreStoredSchema: ["com.example.myapp.SchemaV1"]
	 * });
	 * ```
	 */
	readonly ignoreStoredSchema?: readonly string[];
}

/**
 * Checks if the input is a {@link SchemaViewConfiguration} object.
 *
 * @param schemaOrConfig - Either a schema or a configuration object
 * @returns True if the input is a configuration object with a `schema` property
 *
 * @internal
 */
export function isSchemaViewConfiguration<TSchema extends RootSchema>(
	schemaOrConfig: TSchema | SchemaViewConfiguration<TSchema>,
): schemaOrConfig is SchemaViewConfiguration<TSchema> {
	return (
		typeof schemaOrConfig === "object" &&
		schemaOrConfig !== null &&
		"schema" in schemaOrConfig &&
		typeof schemaOrConfig.schema === "object"
	);
}

/**
 * Normalized configuration type with defaults applied.
 *
 * @remarks
 * This type represents the configuration after normalization, where optional
 * properties have been replaced with their default values. Unlike `Required`,
 * `ignoreStoredSchema` remains optional since its default is `undefined`.
 *
 * @internal
 */
export interface NormalizedViewConfig<TSchema extends RootSchema> {
	readonly schema: TSchema;
	readonly enableSchemaValidation: boolean;
	readonly ignoreStoredSchema: readonly string[] | undefined;
}

/**
 * Normalizes a schema or configuration object into a full configuration.
 *
 * @remarks
 * This helper function allows `viewWith` to accept either a schema directly
 * or a full configuration object, normalizing both to a consistent format.
 *
 * @param schemaOrConfig - Either a schema or a configuration object
 * @returns A normalized configuration object with defaults applied
 *
 * @example
 * ```typescript
 * // These both produce the same result:
 * const config1 = normalizeViewConfig(PersonSchema);
 * const config2 = normalizeViewConfig({ schema: PersonSchema });
 *
 * // Both produce:
 * // { schema: PersonSchema, enableSchemaValidation: false }
 * ```
 *
 * @internal
 */
export function normalizeViewConfig<TSchema extends RootSchema>(
	schemaOrConfig: TSchema | SchemaViewConfiguration<TSchema>,
): NormalizedViewConfig<TSchema> {
	if (isSchemaViewConfiguration(schemaOrConfig)) {
		return {
			schema: schemaOrConfig.schema,
			enableSchemaValidation: schemaOrConfig.enableSchemaValidation ?? false,
			ignoreStoredSchema: schemaOrConfig.ignoreStoredSchema,
		};
	}

	// Input is a raw schema
	return {
		schema: schemaOrConfig,
		enableSchemaValidation: false,
		ignoreStoredSchema: undefined,
	};
}
