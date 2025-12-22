/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/**
 * Factory for creating `viewWith` methods for DDSes.
 *
 * This module provides a single function that DDS authors call to get a fully-typed
 * `viewWith` method. The library handles all the complexity: overloads, type guards,
 * view class instantiation, etc.
 */

import { isObjectSchema, isMapSchema } from "../core/index.js";
import type { ISchemaStorage, ISchemaPersistence } from "../storage/index.js";
import type { TypedObjectNodeSchema, TypedMapNodeSchema } from "../factory/index.js";
import type { InferMapValueType } from "../types/index.js";
import { SchematizedObjectView, SchematizedMapView } from "../view/index.js";

/**
 * Interface for storage that supports schema views.
 *
 * @remarks
 * DDSes implement this interface to provide storage and persistence for schema views.
 * This is the only interface DDS authors need to implement.
 *
 * @internal
 */
export interface IViewableStorage {
	/**
	 * Get the storage adapter for reading/writing data.
	 */
	getSchemaStorage(): ISchemaStorage;

	/**
	 * Get the persistence adapter for schema storage.
	 */
	getSchemaPersistence(): ISchemaPersistence;
}

/**
 * Creates a `viewWith` function for a DDS.
 *
 * @remarks
 * This is the main integration point for DDS authors. Call this once with your
 * storage implementation, and you get back a fully-typed `viewWith` function
 * that handles all the complexity of overloads, type guards, and view instantiation.
 *
 * The returned function has overloads for object and map schemas, providing
 * full type inference for consumers.
 *
 * @param storage - The DDS implementing IViewableStorage
 * @returns A `viewWith` function to expose on your DDS
 *
 * @example
 * ```typescript
 * import { createViewWith, type IViewableStorage } from "@fluidframework/schema";
 *
 * class SharedMap extends SharedObject implements IViewableStorage {
 *   // Implement the storage interface (see ISchemaStorage, ISchemaPersistence)
 *   getSchemaStorage(): ISchemaStorage { ... }
 *   getSchemaPersistence(): ISchemaPersistence { ... }
 *
 *   // Create viewWith - that's it! No overloads, no type guards needed.
 *   public viewWith = createViewWith(this);
 * }
 *
 * // Consumer usage:
 * const view = map.viewWith(UserSchema);
 * view.root.name = "Alice";  // Fully typed!
 * ```
 *
 * @internal
 */
export function createViewWith(storage: IViewableStorage): {
	<TSchema extends TypedObjectNodeSchema>(schema: TSchema): SchematizedObjectView<TSchema>;
	<TSchema extends TypedMapNodeSchema>(
		schema: TSchema,
	): SchematizedMapView<InferMapValueType<TSchema>>;
} {
	return ((schema: TypedObjectNodeSchema | TypedMapNodeSchema) => {
		const schemaStorage = storage.getSchemaStorage();
		const persistence = storage.getSchemaPersistence();

		if (isObjectSchema(schema)) {
			return new SchematizedObjectView(schemaStorage, schema, persistence);
		}
		if (isMapSchema(schema)) {
			return new SchematizedMapView(schemaStorage, schema, persistence);
		}
		throw new Error("Schema must be an ObjectNodeSchema or MapNodeSchema");
	}) as ReturnType<typeof createViewWith>;
}
