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

import type { ObjectNodeSchema, MapNodeSchema, RootSchema } from "../core/index.js";
import type { SchemaCompatibilityStatus } from "../serialization/index.js";
import type { NodeFromSchema, InferValueSchema } from "../types/index.js";

/**
 * A typed object view returned by DDSes for object schemas.
 *
 * @remarks
 * This type represents a schematized view over object data in a DDS.
 * It provides:
 * - Typed property access based on the schema fields
 * - Schema compatibility checking via `compatibility`
 * - Initialization via `initialize()`
 * - Schema upgrade via `upgradeSchema()`
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
 * const user = map.viewWith(UserSchema);
 *
 * // Initialize if needed
 * if (user.compatibility.canInitialize) {
 *   user.initialize({ name: "Alice", age: 30 });
 * }
 *
 * // Property access - fully typed!
 * user.name = "Bob";
 * console.log(user.age); // number | undefined
 * ```
 *
 * @legacy
 * @alpha
 */
export type SchematizedObject<TSchema extends ObjectNodeSchema> = NodeFromSchema<TSchema> & {
	/**
	 * Schema compatibility status for this view.
	 */
	readonly compatibility: SchemaCompatibilityStatus;

	/**
	 * Initialize the storage with schema and initial content.
	 *
	 * @param content - The initial content matching the schema
	 * @throws If schema is already stored or content is invalid
	 */
	initialize: (content: NodeFromSchema<TSchema>) => void;

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
 * - Standard Map interface with typed values
 * - Schema compatibility checking via `compatibility`
 * - Initialization via `initialize()`
 * - Schema upgrade via `upgradeSchema()`
 *
 * @typeParam TSchema - The map node schema type
 *
 * @example
 * ```typescript
 * const sf = new SchemaFactory("myApp");
 * const ConfigSchema = sf.map("Config", sf.string);
 *
 * // Get typed view from DDS
 * const config = map.viewWith(ConfigSchema);
 *
 * // Initialize if needed
 * if (config.compatibility.canInitialize) {
 *   config.initialize(new Map([["setting1", "value1"]]));
 * }
 *
 * // Map operations - fully typed!
 * config.set("setting2", "value2");
 * const value = config.get("setting1"); // string | undefined
 *
 * for (const [key, val] of config) {
 *   console.log(key, val);
 * }
 * ```
 *
 * @legacy
 * @alpha
 */
export type SchematizedMap<TSchema extends MapNodeSchema> = Map<
	string,
	InferValueSchema<TSchema>
> & {
	/**
	 * Schema compatibility status for this view.
	 */
	readonly compatibility: SchemaCompatibilityStatus;

	/**
	 * Initialize the storage with schema and initial content.
	 *
	 * @param content - The initial map content
	 * @throws If schema is already stored or content is invalid
	 */
	initialize: (content: Map<string, InferValueSchema<TSchema>>) => void;

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
 * - For {@link ObjectNodeSchema}: Returns a {@link SchematizedObject}
 * - For {@link MapNodeSchema}: Returns a {@link SchematizedMap}
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
export type SchematizedView<TSchema extends RootSchema> = TSchema extends ObjectNodeSchema
	? SchematizedObject<TSchema>
	: TSchema extends MapNodeSchema
		? SchematizedMap<TSchema>
		: never;
