/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/**
 * Adapter utilities for creating schema storage and persistence from DDS primitives.
 *
 * @remarks
 * These adapters simplify the integration of DDSes with the schema system by providing
 * reusable implementations that convert common DDS interfaces to schema storage interfaces.
 */

import type { NodeSchema } from "../core/index.js";
import type { EncodedSchema } from "../serialization/index.js";

import type { ISchemaStorage, ISchemaPersistence, StorageResult } from "./interfaces.js";

// #region MapLike Interface

/**
 * A minimal Map-like interface that DDSes can implement.
 *
 * @remarks
 * This interface represents the common operations available on map-like DDSes
 * such as SharedMap, SharedDirectory (at root level), etc. DDSes that provide
 * these operations can use {@link createFlatStorageAdapter} to create an
 * {@link ISchemaStorage} implementation.
 *
 * @example
 * ```typescript
 * // SharedMap naturally implements MapLikeStorage
 * const sharedMap: SharedMap = ...;
 * const storage = createFlatStorageAdapter(sharedMap);
 * ```
 *
 * @internal
 */
export interface MapLikeStorage {
	/**
	 * Get a value by key.
	 *
	 * @param key - The key to look up
	 * @returns The value, or undefined if not found
	 */
	get(key: string): unknown;

	/**
	 * Set a value by key.
	 *
	 * @param key - The key to set
	 * @param value - The value to store
	 */
	set(key: string, value: unknown): void;

	/**
	 * Delete a value by key.
	 *
	 * @param key - The key to delete
	 * @returns True if the key existed and was deleted
	 */
	delete(key: string): boolean;

	/**
	 * Check if a key exists.
	 *
	 * @param key - The key to check
	 * @returns True if the key exists
	 */
	has(key: string): boolean;

	/**
	 * Iterate over keys.
	 *
	 * @returns An iterator over the keys
	 */
	keys(): IterableIterator<string>;

	/**
	 * The number of entries.
	 */
	readonly size: number;
}

// #endregion

// #region Flat Storage Adapter

/**
 * Creates an {@link ISchemaStorage} adapter for flat map-like DDSes.
 *
 * @remarks
 * This adapter is designed for DDSes that store values directly without
 * hierarchical nesting (like SharedMap). All values are returned as
 * `{ type: "value" }` results, never as nested storage.
 *
 * @param source - The map-like DDS to adapt
 * @returns An ISchemaStorage implementation
 *
 * @example
 * ```typescript
 * const sharedMap: SharedMap = ...;
 * const storage = createFlatStorageAdapter(sharedMap);
 *
 * // Now usable with SchematizedObjectView or SchematizedMapView
 * const view = new SchematizedObjectView(storage, schema, persistence);
 * ```
 *
 * @internal
 */
export function createFlatStorageAdapter(source: MapLikeStorage): ISchemaStorage {
	return {
		getField(key: string, _fieldSchema: NodeSchema): StorageResult | undefined {
			const value = source.get(key);
			if (value === undefined && !source.has(key)) {
				return undefined;
			}
			return { type: "value", value };
		},

		setField(key: string, _fieldSchema: NodeSchema, value: unknown): void {
			source.set(key, value);
		},

		deleteField(key: string): boolean {
			return source.delete(key);
		},

		hasField(key: string): boolean {
			return source.has(key);
		},

		keys(): IterableIterator<string> {
			return source.keys();
		},

		get size(): number {
			return source.size;
		},
	};
}

// #endregion

// #region Schema Field Interface

/**
 * A simple interface for reading and writing a single schema value.
 *
 * @remarks
 * DDSes can implement this interface to provide schema persistence.
 * Typically backed by the DDS's attributes blob or a special key.
 *
 * @example
 * ```typescript
 * // Using SharedMap's attributes for schema storage
 * const schemaField: SchemaField = {
 *   get: () => {
 *     const attr = sharedMap.attributes;
 *     return attr?.schema as EncodedSchema | undefined;
 *   },
 *   set: (schema) => {
 *     sharedMap.updateAttributes({ schema });
 *   },
 * };
 * ```
 *
 * @internal
 */
export interface SchemaField {
	/**
	 * Get the current schema value.
	 *
	 * @returns The encoded schema if one is stored, undefined otherwise
	 */
	get(): EncodedSchema | undefined;

	/**
	 * Set the schema value.
	 *
	 * @param schema - The encoded schema to store
	 */
	set(schema: EncodedSchema): void;
}

// #endregion

// #region Persistence Adapter

/**
 * Creates an {@link ISchemaPersistence} adapter from a {@link SchemaField}.
 *
 * @remarks
 * This adapter converts a simple get/set field interface into the full
 * persistence interface needed by the schema views. It handles the
 * initialization vs upgrade distinction.
 *
 * @param field - The field to use for schema storage
 * @returns An ISchemaPersistence implementation
 *
 * @example
 * ```typescript
 * // Create persistence from a schema field
 * const persistence = createPersistenceAdapter({
 *   get: () => sharedMap.attributes?.schema,
 *   set: (schema) => sharedMap.updateAttributes({ schema }),
 * });
 *
 * // Use with a view
 * const view = new SchematizedObjectView(storage, schema, persistence);
 * ```
 *
 * @internal
 */
export function createPersistenceAdapter(field: SchemaField): ISchemaPersistence {
	return {
		getPersistedSchema(): EncodedSchema | undefined {
			return field.get();
		},

		setPersistedSchema(schema: EncodedSchema): void {
			if (field.get() !== undefined) {
				throw new Error("Schema already stored. Use upgradePersistedSchema to update.");
			}
			field.set(schema);
		},

		upgradePersistedSchema(schema: EncodedSchema): void {
			// Note: Compatibility checking should be done by the caller
			// before calling this method
			field.set(schema);
		},
	};
}

// #endregion
