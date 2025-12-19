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
import type { SchematizedView } from "./proxyTypes.js";

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
export type ObjectViewResult<TSchema extends ObjectNodeSchema> = NodeFromSchema<TSchema> & {
	/**
	 * The schema compatibility status.
	 */
	readonly compatibility: SchemaCompatibilityStatus;

	/**
	 * Initialize the storage with schema and initial content.
	 *
	 * @param content - The initial content to store
	 */
	initialize(content: NodeFromSchema<TSchema>): void;

	/**
	 * Upgrade the stored schema to this view's schema.
	 */
	upgradeSchema(): void;
};

// #endregion

// #region Map View Result

/**
 * Result type for map schema views.
 *
 * @internal
 */
export type MapViewResult<TSchema extends MapNodeSchema> = Map<
	string,
	InferValueSchema<TSchema>
> & {
	/**
	 * The schema compatibility status.
	 */
	readonly compatibility: SchemaCompatibilityStatus;

	/**
	 * Initialize the storage with schema and initial content.
	 *
	 * @param content - The initial map content
	 */
	initialize(content: Map<string, InferValueSchema<TSchema>>): void;

	/**
	 * Upgrade the stored schema to this view's schema.
	 */
	upgradeSchema(): void;
};

// #endregion

// #region Create View Functions

/**
 * Create a schematized view for an object schema.
 *
 * @param storage - The storage to read from and write to
 * @param schema - The object schema defining the structure
 * @param persistence - Optional persistence layer for schema storage
 * @param options - Optional view creation options
 * @returns A proxied view with property access
 *
 * @example
 * ```typescript
 * const sf = new SchemaFactory("myApp");
 * const UserSchema = sf.object("User", {
 *   name: sf.string,
 *   age: sf.optional(sf.number),
 * });
 *
 * const view = createSchematizedObjectView(storage, UserSchema, persistence);
 *
 * // Property access
 * view.name = "Alice";
 * console.log(view.name); // "Alice"
 *
 * // View methods
 * view.initialize({ name: "Bob", age: 30 });
 * console.log(view.compatibility.canView); // true
 * ```
 *
 * @internal
 */
export function createSchematizedObjectView<TSchema extends ObjectNodeSchema>(
	storage: ISchemaStorage,
	schema: TSchema,
	persistence?: ISchemaPersistence,
	_options?: CreateViewOptions,
): ObjectViewResult<TSchema> {
	const view = new SchematizedObjectView(storage, schema, persistence);
	return createObjectViewProxy(view, schema) as ObjectViewResult<TSchema>;
}

/**
 * Create a schematized view for a map schema.
 *
 * @param storage - The storage to read from and write to
 * @param schema - The map schema defining the value type
 * @param persistence - Optional persistence layer for schema storage
 * @param options - Optional view creation options
 * @returns A proxied view with Map-like access
 *
 * @example
 * ```typescript
 * const sf = new SchemaFactory("myApp");
 * const ConfigMap = sf.map("Config", sf.string);
 *
 * const view = createSchematizedMapView(storage, ConfigMap, persistence);
 *
 * // Map operations
 * view.set("key1", "value1");
 * console.log(view.get("key1")); // "value1"
 *
 * // View methods
 * view.initialize(new Map([["a", "1"]]));
 * ```
 *
 * @internal
 */
export function createSchematizedMapView<TSchema extends MapNodeSchema>(
	storage: ISchemaStorage,
	schema: TSchema,
	persistence?: ISchemaPersistence,
	_options?: CreateViewOptions,
): MapViewResult<TSchema> {
	const view = new SchematizedMapView(storage, schema, persistence);
	return createMapViewProxy(view, schema) as MapViewResult<TSchema>;
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
 * @param schema - The root schema (object or map)
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
 * ```
 *
 * @internal
 */
export function createSchematizedView<TSchema extends RootSchema>(
	storage: ISchemaStorage,
	schema: TSchema,
	persistence?: ISchemaPersistence,
	options?: CreateViewOptions,
): SchematizedView<TSchema> {
	if (isObjectSchema(schema)) {
		const view = new SchematizedObjectView(storage, schema, persistence);
		return createObjectViewProxy(view, schema) as unknown as SchematizedView<TSchema>;
	}

	if (isMapSchema(schema)) {
		const view = new SchematizedMapView(storage, schema, persistence);
		return createMapViewProxy(view, schema) as unknown as SchematizedView<TSchema>;
	}

	// For leaf schemas, we can't create a view directly
	// This should be unreachable for valid RootSchema inputs (object or map)
	throw new Error(
		`Cannot create view for schema type. Expected object or map schema, got kind: ${(schema as { kind?: unknown }).kind}`,
	);
}

// #endregion
