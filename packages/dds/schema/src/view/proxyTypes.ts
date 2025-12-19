/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/**
 * User-facing types for schematized data access.
 *
 * These types represent what users get when they call `viewWith()` on a DDS.
 * They provide typed property/Map access plus schema lifecycle methods.
 */

import type { IDisposable } from "@fluidframework/core-interfaces";

import type { ObjectNodeSchema, MapNodeSchema, RootSchema } from "../core/index.js";
import type { SchemaCompatibilityStatus } from "../serialization/index.js";
import type { NodeFromSchema, InferValueSchema } from "../types/index.js";

/**
 * A typed object view returned by DDSes for object schemas.
 *
 * @remarks
 * This type represents a schematized view over object data in a DDS.
 * It provides:
 * - Typed property access through the `root` property
 * - Schema compatibility checking via `compatibility`
 * - Initialization via `initialize()`
 * - Schema upgrade via `upgradeSchema()`
 *
 * The view separates metadata/methods from data access:
 * - `view.root` - The typed data proxy (read/write)
 * - `view.compatibility` - Schema status
 * - `view.initialize()` - Persist schema
 * - `view.dispose()` - Cleanup
 *
 * @typeParam TSchema - The object node schema type
 *
 * @example
 * ```typescript
 * const sf = new SchemaFactory("myApp");
 * const UserSchema = sf.object("User", {
 *   name: sf.string,
 *   age: sf.optional(sf.number),
 * });
 *
 * // Get typed view from DDS
 * const view = map.viewWith(UserSchema);
 *
 * // Initialize if needed (persists schema)
 * if (view.compatibility.canInitialize) {
 *   view.initialize();
 * }
 *
 * // Property access through root - fully typed!
 * view.root.name = "Alice";
 * view.root.age = 30;
 * console.log(view.root.age); // number | undefined
 * ```
 *
 * @legacy
 * @alpha
 */
export type ObjectView<TSchema extends ObjectNodeSchema> = IDisposable & {
	/**
	 * The typed data root providing property access to schema fields.
	 *
	 * @remarks
	 * Reading returns the current field values.
	 * Individual fields can be modified through the proxy (e.g., `view.root.name = "Alice"`).
	 */
	readonly root: NodeFromSchema<TSchema>;

	/**
	 * Whether this view has been disposed.
	 */
	readonly disposed: boolean;

	/**
	 * Schema compatibility status for this view.
	 */
	readonly compatibility: SchemaCompatibilityStatus;

	/**
	 * Initialize the storage by persisting the schema.
	 *
	 * @remarks
	 * This method persists the schema to enable cross-client enforcement.
	 * Setting data is a separate concern - use the `root` property after initializing.
	 * Calling `initialize()` is optional - only call when you want schema persistence.
	 *
	 * @throws If schema is already stored
	 */
	initialize: () => void;

	/**
	 * Upgrade the stored schema to this view's schema.
	 *
	 * @throws If schemas are not compatible for upgrade
	 */
	upgradeSchema: () => void;
};

/**
 * A typed Map view returned by DDSes for map schemas.
 *
 * @remarks
 * This type represents a schematized view over map data in a DDS.
 * It provides:
 * - Standard Map interface through the `root` property
 * - Schema compatibility checking via `compatibility`
 * - Initialization via `initialize()`
 * - Schema upgrade via `upgradeSchema()`
 *
 * The view separates metadata/methods from data access:
 * - `view.root` - The typed Map proxy (read/write)
 * - `view.compatibility` - Schema status
 * - `view.initialize()` - Persist schema
 * - `view.dispose()` - Cleanup
 *
 * @typeParam TSchema - The map node schema type
 *
 * @example
 * ```typescript
 * const sf = new SchemaFactory("myApp");
 * const ConfigSchema = sf.map("Config", sf.string);
 *
 * // Get typed view from DDS
 * const view = map.viewWith(ConfigSchema);
 *
 * // Initialize if needed (persists schema)
 * if (view.compatibility.canInitialize) {
 *   view.initialize();
 * }
 *
 * // Map operations through root - fully typed!
 * view.root.set("setting1", "value1");
 * view.root.set("setting2", "value2");
 * const value = view.root.get("setting1"); // string | undefined
 *
 * for (const [key, val] of view.root) {
 *   console.log(key, val);
 * }
 * ```
 *
 * @legacy
 * @alpha
 */
export type MapView<TSchema extends MapNodeSchema> = IDisposable & {
	/**
	 * The typed Map root providing map operations on schema data.
	 *
	 * @remarks
	 * Provides standard Map interface with typed values.
	 * Use Map methods like `set()`, `delete()`, `clear()` to modify data.
	 */
	readonly root: Map<string, InferValueSchema<TSchema>>;

	/**
	 * Whether this view has been disposed.
	 */
	readonly disposed: boolean;

	/**
	 * Schema compatibility status for this view.
	 */
	readonly compatibility: SchemaCompatibilityStatus;

	/**
	 * Initialize the storage by persisting the schema.
	 *
	 * @remarks
	 * This method persists the schema to enable cross-client enforcement.
	 * Setting data is a separate concern - use the `root` property after initializing.
	 * Calling `initialize()` is optional - only call when you want schema persistence.
	 *
	 * @throws If schema is already stored
	 */
	initialize: () => void;

	/**
	 * Upgrade the stored schema to this view's schema.
	 *
	 * @throws If schemas are not compatible for upgrade
	 */
	upgradeSchema: () => void;
};

/**
 * Maps a root schema type to its corresponding user-facing view type.
 *
 * @remarks
 * This utility type is used by DDSes to provide the correct typed view
 * based on the schema passed to view methods like `viewWith`.
 *
 * - For {@link ObjectNodeSchema}: Returns a {@link ObjectView}
 * - For {@link MapNodeSchema}: Returns a {@link MapView}
 *
 * @typeParam TSchema - The root schema type
 *
 * @example
 * ```typescript
 * // Usage in a DDS interface
 * viewWith<TSchema extends RootSchema>(schema: TSchema): SchematizedView<TSchema>;
 * ```
 *
 * @legacy
 * @alpha
 */
export type SchemaView<TSchema extends RootSchema> = TSchema extends ObjectNodeSchema
	? ObjectView<TSchema>
	: TSchema extends MapNodeSchema
		? MapView<TSchema>
		: never;

/**
 * Alias for {@link SchemaView} for use in DDS interfaces.
 *
 * @remarks
 * This type alias is provided for naming consistency with the `viewWith` pattern.
 * DDSes typically use `viewWith<TSchema>(schema: TSchema): SchematizedView<TSchema>`.
 *
 * @typeParam TSchema - The root schema type
 *
 * @legacy
 * @alpha
 */
export type SchematizedView<TSchema extends RootSchema> = SchemaView<TSchema>;
