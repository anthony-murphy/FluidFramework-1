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
import type { TypedConstObjectNodeSchema } from "../factory/index.js";
import type { SchemaCompatibilityStatus } from "../serialization/index.js";
import type {
	NodeFromSchema,
	InferMapValueType,
	ReadonlyObjectFromFields,
} from "../types/index.js";

/**
 * Computes the root data type for a given schema.
 *
 * @remarks
 * - For {@link ObjectNodeSchema}: Returns the typed object with properties.
 * For const schemas ({@link TypedConstObjectNodeSchema}), returns readonly properties.
 *
 * - For {@link MapNodeSchema}: Returns a Map with typed values
 *
 * @typeParam TSchema - The root schema type
 *
 * @alpha @legacy
 */
export type RootFromSchema<TSchema extends RootSchema> =
	TSchema extends TypedConstObjectNodeSchema<string, infer TFields>
		? ReadonlyObjectFromFields<TFields>
		: TSchema extends ObjectNodeSchema
			? NodeFromSchema<TSchema>
			: TSchema extends MapNodeSchema
				? Map<string, InferMapValueType<TSchema>>
				: never;

/**
 * Base view interface without the schema-dependent root type.
 * Used to avoid type instantiation issues when generic return types are used
 * in DDS interfaces.
 * @legacy
 * @alpha
 */
export interface SchematizedViewBase extends IDisposable {
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
}

/**
 * A typed view returned by DDSes for root schemas.
 *
 * @remarks
 * This type represents a schematized view over data in a DDS.
 * It provides:
 * - Typed data access through the `root` property
 * - Schema compatibility checking via `compatibility`
 * - Initialization via `initialize()`
 * - Schema upgrade via `upgradeSchema()`
 *
 * The view separates metadata/methods from data access:
 * - `view.root` - The typed data (object properties or Map)
 * - `view.compatibility` - Schema status
 * - `view.initialize()` - Persist schema
 * - `view.dispose()` - Cleanup
 *
 * @typeParam TSchema - The root schema type (ObjectNodeSchema or MapNodeSchema)
 *
 * @example
 * ```typescript
 * const sf = new SchemaFactory("myApp");
 *
 * // Object schema example
 * const UserSchema = sf.object("User", {
 *   name: sf.string,
 *   age: sf.optional(sf.number),
 * });
 * const view = map.viewWith(UserSchema);
 * view.root.name = "Alice"; // Typed property access
 *
 * // Map schema example
 * const ConfigSchema = sf.map("Config", sf.string);
 * const configView = map.viewWith(ConfigSchema);
 * configView.root.set("key", "value"); // Typed Map operations
 * ```
 *
 * @legacy
 * @alpha
 */
export type SchematizedView<TSchema extends RootSchema> = SchematizedViewBase & {
	/**
	 * The typed data root.
	 *
	 * @remarks
	 * For object schemas, this provides typed property access.
	 * For map schemas, this provides a typed Map interface.
	 */
	readonly root: RootFromSchema<TSchema>;
};

/**
 * Alias for backward compatibility.
 * @deprecated Use {@link SchematizedView} instead.
 * @internal
 */
export type SchemaView<TSchema extends RootSchema> = SchematizedView<TSchema>;

/**
 * A typed object view returned by DDSes for object schemas.
 *
 * @remarks
 * This type represents a schematized view over object data in a DDS.
 * It is a specialized version of {@link SchematizedView} for object schemas.
 *
 * @typeParam TSchema - The object node schema type
 *
 * @legacy
 * @alpha
 */
export type ObjectView<TSchema extends ObjectNodeSchema> = SchematizedView<TSchema>;

/**
 * A typed Map view returned by DDSes for map schemas.
 *
 * @remarks
 * This type represents a schematized view over map data in a DDS.
 * It is a specialized version of {@link SchematizedView} for map schemas.
 *
 * @typeParam TSchema - The map node schema type
 *
 * @legacy
 * @alpha
 */
export type MapView<TSchema extends MapNodeSchema> = SchematizedView<TSchema>;
