/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/**
 * Factory function for creating schematized views.
 *
 * @remarks
 * This module provides a high-level factory function that simplifies the creation
 * of schema views for DDSes. It handles schema type dispatch and proxy creation,
 * reducing boilerplate code in DDS implementations.
 */

import type { RootSchema, ObjectNodeSchema, MapNodeSchema } from "../core/index.js";
import { isObjectSchema, isMapSchema } from "../core/index.js";
import type { ISchemaStorage, ISchemaPersistence } from "../storage/index.js";
import type { NodeFromSchema, InferValueSchema } from "../types/index.js";
import type { SchemaCompatibilityStatus } from "../serialization/index.js";

import { SchematizedObjectView } from "./objectView.js";
import { SchematizedMapView } from "./mapView.js";
import { createObjectViewProxy, createMapViewProxy } from "./proxy.js";
import type { SchemaView } from "./proxyTypes.js";
import { normalizeViewConfig, type SchemaViewConfiguration } from "./configuration.js";

// #region View Options

/**
 * Options for creating a schematized view.
 *
 * @internal
 */
export interface CreateViewOptions {
	/**
	 * Whether to create a proxy wrapper around the view.
	 *
	 * @remarks
	 * When true (default), returns a proxy that provides property access for object schemas
	 * or Map-like access for map schemas. When false, returns the raw view instance.
	 *
	 * @defaultValue true
	 */
	useProxy?: boolean;
}

// #endregion

// #region Object View Result

/**
 * Result type for object schema views.
 *
 * @internal
 */
export interface ObjectViewResult<TSchema extends ObjectNodeSchema> {
	/**
	 * The typed data root providing property access to schema fields.
	 */
	root: NodeFromSchema<TSchema>;

	/**
	 * Whether this view has been disposed.
	 */
	readonly disposed: boolean;

	/**
	 * The schema compatibility status.
	 */
	readonly compatibility: SchemaCompatibilityStatus;

	/**
	 * Initialize the storage by persisting the schema.
	 *
	 * @remarks
	 * Setting data is a separate concern - use the `root` property after initializing.
	 */
	initialize(): void;

	/**
	 * Upgrade the stored schema to this view's schema.
	 */
	upgradeSchema(): void;

	/**
	 * Dispose this view and release resources.
	 */
	dispose(): void;
}

// #endregion

// #region Map View Result

/**
 * Result type for map schema views.
 *
 * @internal
 */
export interface MapViewResult<TSchema extends MapNodeSchema> {
	/**
	 * The typed Map root providing map operations on schema data.
	 */
	root: Map<string, InferValueSchema<TSchema>>;

	/**
	 * Whether this view has been disposed.
	 */
	readonly disposed: boolean;

	/**
	 * The schema compatibility status.
	 */
	readonly compatibility: SchemaCompatibilityStatus;

	/**
	 * Initialize the storage by persisting the schema.
	 *
	 * @remarks
	 * Setting data is a separate concern - use the `root` property after initializing.
	 */
	initialize(): void;

	/**
	 * Upgrade the stored schema to this view's schema.
	 */
	upgradeSchema(): void;

	/**
	 * Dispose this view and release resources.
	 */
	dispose(): void;
}

// #endregion

// #region Create View Functions

/**
 * Create a schematized view for an object schema.
 *
 * @param storage - The storage to read from and write to
 * @param schemaOrConfig - The object schema or configuration object
 * @param persistence - Optional persistence layer for schema storage
 * @param options - Optional view creation options
 * @returns A proxied view with property access through root
 *
 * @example
 * ```typescript
 * const sf = new SchemaFactory("myApp");
 * const UserSchema = sf.object("User", {
 *   name: sf.string,
 *   age: sf.optional(sf.number),
 * });
 *
 * // With schema directly
 * const view = createSchematizedObjectView(storage, UserSchema, persistence);
 *
 * // With configuration object
 * const view = createSchematizedObjectView(storage, {
 *   schema: UserSchema,
 *   enableSchemaValidation: true,
 * }, persistence);
 *
 * // Property access through root
 * view.root.name = "Alice";
 * console.log(view.root.name); // "Alice"
 *
 * // View methods
 * view.initialize();  // Persist schema
 * view.root = { name: "Bob", age: 30 };  // Set content
 * console.log(view.compatibility.canView); // true
 * ```
 *
 * @internal
 */
export function createSchematizedObjectView<TSchema extends ObjectNodeSchema>(
	storage: ISchemaStorage,
	schemaOrConfig: TSchema | SchemaViewConfiguration<TSchema>,
	persistence?: ISchemaPersistence,
	_options?: CreateViewOptions,
): ObjectViewResult<TSchema> {
	const config = normalizeViewConfig(schemaOrConfig);
	const view = new SchematizedObjectView(storage, config.schema, persistence, {
		enableSchemaValidation: config.enableSchemaValidation,
		ignoreStoredSchema: config.ignoreStoredSchema,
	});
	return createObjectViewProxy(view, config.schema) as ObjectViewResult<TSchema>;
}

/**
 * Create a schematized view for a map schema.
 *
 * @param storage - The storage to read from and write to
 * @param schemaOrConfig - The map schema or configuration object
 * @param persistence - Optional persistence layer for schema storage
 * @param options - Optional view creation options
 * @returns A proxied view with Map-like access through root
 *
 * @example
 * ```typescript
 * const sf = new SchemaFactory("myApp");
 * const ConfigMap = sf.map("Config", sf.string);
 *
 * // With schema directly
 * const view = createSchematizedMapView(storage, ConfigMap, persistence);
 *
 * // With configuration object
 * const view = createSchematizedMapView(storage, {
 *   schema: ConfigMap,
 *   enableSchemaValidation: true,
 * }, persistence);
 *
 * // Map operations through root
 * view.root.set("key1", "value1");
 * console.log(view.root.get("key1")); // "value1"
 *
 * // View methods
 * view.initialize();  // Persist schema
 * view.root = new Map([["a", "1"]]);  // Set content
 * ```
 *
 * @internal
 */
export function createSchematizedMapView<TSchema extends MapNodeSchema>(
	storage: ISchemaStorage,
	schemaOrConfig: TSchema | SchemaViewConfiguration<TSchema>,
	persistence?: ISchemaPersistence,
	_options?: CreateViewOptions,
): MapViewResult<TSchema> {
	const config = normalizeViewConfig(schemaOrConfig);
	const view = new SchematizedMapView(storage, config.schema, persistence, {
		enableSchemaValidation: config.enableSchemaValidation,
		ignoreStoredSchema: config.ignoreStoredSchema,
	});
	return createMapViewProxy(view, config.schema) as MapViewResult<TSchema>;
}

/**
 * Create a schematized view for any root schema.
 *
 * @remarks
 * This is the main factory function that handles schema type dispatch automatically.
 * It determines whether the schema is an object or map schema and creates the
 * appropriate view type.
 *
 * @param storage - The storage to read from and write to
 * @param schemaOrConfig - The root schema (object or map) or configuration object
 * @param persistence - Optional persistence layer for schema storage
 * @param options - Optional view creation options
 * @returns A proxied view appropriate for the schema type
 *
 * @example
 * ```typescript
 * // Works with object schemas
 * const userView = createSchematizedView(storage, UserSchema, persistence);
 * userView.name = "Alice"; // Property access
 *
 * // Works with map schemas
 * const configView = createSchematizedView(storage, ConfigMap, persistence);
 * configView.set("key", "value"); // Map-like access
 *
 * // With configuration object
 * const view = createSchematizedView(storage, {
 *   schema: UserSchema,
 *   enableSchemaValidation: true,
 * }, persistence);
 * ```
 *
 * @internal
 */
export function createSchematizedView<TSchema extends RootSchema>(
	storage: ISchemaStorage,
	schemaOrConfig: TSchema | SchemaViewConfiguration<TSchema>,
	persistence?: ISchemaPersistence,
	options?: CreateViewOptions,
): SchemaView<TSchema> {
	const config = normalizeViewConfig(schemaOrConfig);

	if (isObjectSchema(config.schema)) {
		const view = new SchematizedObjectView(storage, config.schema, persistence, {
			enableSchemaValidation: config.enableSchemaValidation,
			ignoreStoredSchema: config.ignoreStoredSchema,
		});
		return createObjectViewProxy(view, config.schema) as unknown as SchemaView<TSchema>;
	}

	if (isMapSchema(config.schema)) {
		const view = new SchematizedMapView(storage, config.schema, persistence, {
			enableSchemaValidation: config.enableSchemaValidation,
			ignoreStoredSchema: config.ignoreStoredSchema,
		});
		return createMapViewProxy(view, config.schema) as unknown as SchemaView<TSchema>;
	}

	// For leaf schemas, we can't create a view directly
	// This should be unreachable for valid RootSchema inputs (object or map)
	throw new Error(
		`Cannot create view for schema type. Expected object or map schema, got kind: ${(config.schema as { kind?: unknown }).kind}`,
	);
}

// #endregion
