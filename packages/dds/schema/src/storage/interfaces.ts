/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/**
 * Storage interfaces for DDSes implementing schema-based data access.
 *
 * This module defines the interfaces that DDSes implement to provide schema-aware
 * storage capabilities. The {@link ISchemaStorage} interface provides unified data
 * access, while {@link ISchemaPersistence} handles schema persistence for Modality 2.
 */

import type { NodeSchema } from "../core/index.js";
import type { EncodedSchema } from "../serialization/index.js";

// #region Storage Result Types

/**
 * Result of getting a field from storage.
 *
 * @remarks
 * The DDS decides whether each field is a value or nested storage based on
 * the field's schema and the DDS's capabilities.
 *
 * - **value**: The field contains a primitive value or a JSON-serializable object
 * - **storage**: The field contains nested storage that can be navigated further
 *
 * @alpha @legacy
 */
export type StorageResult =
	| {
			/**
			 * Indicates the result is a direct value.
			 */
			readonly type: "value";

			/**
			 * The value stored in the field.
			 */
			readonly value: unknown;
	  }
	| {
			/**
			 * Indicates the result is nested storage.
			 */
			readonly type: "storage";

			/**
			 * The nested storage interface for further navigation.
			 */
			readonly storage: ISchemaStorage;
	  };

// #endregion

// #region Storage Interface

/**
 * Unified storage interface that all DDSes implement for schema-based data access.
 *
 * @remarks
 * This interface provides a common abstraction for accessing data in DDSes
 * that support schema-based validation. The DDS controls how nested schemas
 * are handled via the {@link ISchemaStorage.getField} method.
 *
 * **Behavior by DDS type:**
 * - **Flat DDSes (SharedMap)**: Always returns `{ type: "value" }` for all fields
 * - **Hierarchical DDSes (SharedDirectory)**: Returns `{ type: "storage" }` for nested objects
 *
 * @example
 * ```typescript
 * // Using storage to read a field
 * const result = storage.getField("name", nameSchema);
 * if (result?.type === "value") {
 *   console.log("Name:", result.value);
 * }
 *
 * // Using storage to navigate nested objects
 * const addressResult = storage.getField("address", addressSchema);
 * if (addressResult?.type === "storage") {
 *   const cityResult = addressResult.storage.getField("city", citySchema);
 * }
 * ```
 *
 * @alpha @legacy
 */
export interface ISchemaStorage {
	/**
	 * Get a field, with the DDS deciding how to handle it based on schema.
	 *
	 * @param key - The field key to retrieve
	 * @param fieldSchema - The schema for this field (so DDS knows if it's nested)
	 * @returns Value for leaf schemas, nested storage for object/map schemas, or undefined if not present
	 *
	 * @remarks
	 * The DDS implementation uses the provided schema to determine the appropriate
	 * return type. For leaf schemas, the DDS returns the value directly. For object
	 * or map schemas, hierarchical DDSes may return nested storage for navigation.
	 */
	getField(key: string, fieldSchema: NodeSchema): StorageResult | undefined;

	/**
	 * Set a field value.
	 *
	 * @param key - The field key to set
	 * @param fieldSchema - The schema for this field
	 * @param value - The value to set. For nested schemas, this is the full object.
	 *
	 * @remarks
	 * The DDS decides whether to store the value as JSON or create nested storage
	 * based on the schema and the DDS's capabilities.
	 */
	setField(key: string, fieldSchema: NodeSchema, value: unknown): void;

	/**
	 * Delete a field.
	 *
	 * @param key - The field key to delete
	 * @returns `true` if the field existed and was deleted, `false` otherwise
	 */
	deleteField(key: string): boolean;

	/**
	 * Check if a field exists.
	 *
	 * @param key - The field key to check
	 * @returns `true` if the field exists, `false` otherwise
	 */
	hasField(key: string): boolean;

	/**
	 * Iterate over keys in the storage.
	 *
	 * @returns An iterator over the keys in the storage
	 *
	 * @remarks
	 * This method is optional and is primarily used for {@link MapNodeSchema} implementations
	 * where the set of keys is not known ahead of time.
	 */
	keys?(): IterableIterator<string>;

	/**
	 * The number of entries in the storage.
	 *
	 * @remarks
	 * This property is optional and is primarily used for {@link MapNodeSchema} implementations
	 * to determine the number of entries without iterating.
	 */
	readonly size?: number;
}

// #endregion

// #region Persistence Interface

/**
 * Schema persistence interface for Modality 2.
 *
 * @remarks
 * DDSes implement this interface to store and retrieve schema from their
 * persistence layer (typically the `.attributes` blob). This enables:
 *
 * - **Schema discovery**: Clients can discover the schema of existing documents
 * - **Schema validation**: Operations can be validated against the persisted schema
 * - **Schema evolution**: Schemas can be upgraded over time with compatibility checks
 *
 * @example
 * ```typescript
 * // Check for existing schema
 * const existing = persistence.getPersistedSchema();
 * if (existing === undefined) {
 *   // First time - store the schema
 *   persistence.setPersistedSchema(encodedSchema);
 * } else {
 *   // Check compatibility and potentially upgrade
 *   const status = checkSchemaCompatibility(existing, newSchema);
 *   if (status === SchemaCompatibilityStatus.Compatible) {
 *     persistence.upgradePersistedSchema(newSchema);
 *   }
 * }
 * ```
 *
 * @alpha @legacy
 */
export interface ISchemaPersistence {
	/**
	 * Get the currently stored schema, or undefined if none.
	 *
	 * @returns The encoded schema if one is stored, undefined otherwise
	 */
	getPersistedSchema(): EncodedSchema | undefined;

	/**
	 * Store a schema for the first time.
	 *
	 * @param schema - The encoded schema to store
	 * @throws Error if a schema is already stored
	 *
	 * @remarks
	 * This method should only be called when no schema is currently stored.
	 * To update an existing schema, use {@link ISchemaPersistence.upgradePersistedSchema}.
	 */
	setPersistedSchema(schema: EncodedSchema): void;

	/**
	 * Upgrade an existing schema to a new version.
	 *
	 * @param schema - The new encoded schema
	 * @throws Error if the upgrade is invalid (e.g., breaking compatibility)
	 *
	 * @remarks
	 * The implementation should validate that the new schema is compatible
	 * with the existing schema before applying the upgrade.
	 */
	upgradePersistedSchema(schema: EncodedSchema): void;
}

// #endregion
