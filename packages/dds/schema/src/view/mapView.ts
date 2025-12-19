/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/**
 * SchematizedMapView - typed Map-like view over schema storage.
 *
 * @remarks
 * Following SharedTree's pattern, the class uses a single type parameter for the
 * value schema, and derives the value type from it. Map operations are implemented
 * as direct class methods rather than a complex proxy.
 */

import type { IDisposable } from "@fluidframework/core-interfaces";
import { UsageError } from "@fluidframework/telemetry-utils/internal";

import type { NodeSchema } from "../core/index.js";
import { isObjectSchema } from "../core/index.js";
import type { ISchemaStorage, ISchemaPersistence } from "../storage/index.js";
import {
	encodeSchema,
	checkSchemaCompatibility,
	type SchemaCompatibilityStatus,
} from "../serialization/index.js";
import { validateData } from "../validation/index.js";
import type { TypedMapNodeSchema } from "../factory/index.js";

import { SchemaValidationError } from "./errors.js";
import { SchematizedObjectView } from "./objectView.js";

/**
 * Options for configuring a {@link SchematizedMapView}.
 *
 * @internal
 */
export interface SchematizedMapViewOptions {
	/**
	 * Enable runtime validation on every set operation.
	 *
	 * @remarks
	 * When true, every set operation will validate the data against the schema
	 * before storing it.
	 *
	 * @defaultValue false
	 */
	enableSchemaValidation?: boolean;

	/**
	 * List of stored schema identifiers to ignore during validation.
	 *
	 * @remarks
	 * This is an unsafe escape hatch for development/migration scenarios.
	 * When the stored schema's identifier matches one in this list,
	 * it will be ignored and the view will act as if no schema was stored.
	 */
	ignoreStoredSchema?: readonly string[];
}

/**
 * A view that provides Map-like typed access to data stored in {@link ISchemaStorage}.
 *
 * @remarks
 * This class wraps an {@link ISchemaStorage} and provides typed Map-like operations
 * based on a {@link MapNodeSchema}. It handles validation and schema compatibility.
 *
 * Following SharedTree's pattern, the class uses the value schema type as its primary
 * type parameter, making it easier for TypeScript to infer the correct value types.
 *
 * @typeParam TValueSchema - The schema type for map values (e.g., sf.string, sf.number, or an object schema)
 *
 * @example
 * ```typescript
 * const sf = new SchemaFactory("myApp");
 * const ConfigMap = sf.map("Config", sf.string);
 *
 * const view = new SchematizedMapView(storage, ConfigMap, persistence);
 *
 * // Initialize (persist schema) and set data
 * view.initialize();
 * view.set("key1", "value1");
 *
 * // Map operations
 * view.set("key2", "value2");
 * const value = view.get("key1"); // type: string
 * ```
 *
 * @internal
 */
export class SchematizedMapView<TValue = unknown>
	implements Iterable<[string, TValue]>, IDisposable
{
	private readonly enableSchemaValidation: boolean;
	private readonly ignoreStoredSchema: readonly string[] | undefined;
	private _disposed = false;

	/**
	 * Error message thrown when accessing a disposed view.
	 */
	private static readonly disposedErrorMessage = "Accessed a disposed SchemaView.";

	/**
	 * Creates a new SchematizedMapView.
	 *
	 * @param storage - The storage to read from and write to
	 * @param schema - The map schema defining the value type
	 * @param persistence - Optional persistence layer for schema storage
	 * @param options - Optional configuration options
	 */
	public constructor(
		private readonly storage: ISchemaStorage,
		private readonly schema: TypedMapNodeSchema,
		private readonly persistence?: ISchemaPersistence,
		options?: SchematizedMapViewOptions,
	) {
		this.enableSchemaValidation = options?.enableSchemaValidation ?? false;
		this.ignoreStoredSchema = options?.ignoreStoredSchema;
	}

	// #region root accessor

	/**
	 * The map root providing map operations on schema data.
	 *
	 * @remarks
	 * Returns `this` since the class directly implements the Map-like interface.
	 * This allows the pattern `view.root.get(key)` to work.
	 */
	public get root(): this {
		return this;
	}

	// #endregion

	// #region IDisposable

	/**
	 * Whether this view has been disposed.
	 */
	public get disposed(): boolean {
		return this._disposed;
	}

	/**
	 * Dispose this view, releasing resources.
	 *
	 * @remarks
	 * After disposing, accessing the view will throw an error.
	 */
	public dispose(): void {
		this._disposed = true;
	}

	/**
	 * Throws if this view has been disposed.
	 */
	private ensureNotDisposed(): void {
		if (this._disposed) {
			throw new UsageError(SchematizedMapView.disposedErrorMessage);
		}
	}

	// #endregion

	// #region Schema Compatibility

	/**
	 * Gets the schema compatibility status between the stored schema and this view's schema.
	 */
	public get compatibility(): SchemaCompatibilityStatus {
		const stored = this.persistence?.getPersistedSchema();

		// Check if stored schema should be ignored (escape hatch for migration)
		if (
			stored !== undefined &&
			this.ignoreStoredSchema?.includes(stored.root.identifier) === true
		) {
			// When ignoring stored schema, act as if no schema is stored
			// This allows re-initialization with a new schema
			return { canView: true, canUpgrade: false, isEquivalent: false, canInitialize: true };
		}

		return checkSchemaCompatibility(stored, this.schema);
	}

	/**
	 * Initialize the view, persisting the schema if not already stored.
	 *
	 * @remarks
	 * This method persists the schema to enable cross-client enforcement.
	 * Setting data is a separate concern - use Map methods after initializing.
	 * Calling `initialize()` is optional - only call when you want schema persistence.
	 *
	 * @throws UsageError if a schema is already stored
	 */
	public initialize(): void {
		this.ensureNotDisposed();
		const compat = this.compatibility;
		if (!compat.canInitialize) {
			throw new UsageError("Cannot initialize - schema already stored");
		}

		// Store schema
		if (this.persistence !== undefined) {
			this.persistence.setPersistedSchema(encodeSchema(this.schema));
		}
	}

	/**
	 * Upgrade the stored schema to this view's schema.
	 *
	 * @throws UsageError if schemas are not compatible for upgrade
	 */
	public upgrade(): void {
		this.ensureNotDisposed();
		const compat = this.compatibility;
		if (!compat.canUpgrade) {
			throw new UsageError("Cannot upgrade - schemas incompatible");
		}
		if (this.persistence !== undefined) {
			this.persistence.upgradePersistedSchema(encodeSchema(this.schema));
		}
	}

	/**
	 * Gets the schema for this view.
	 */
	public get nodeSchema(): TypedMapNodeSchema {
		return this.schema;
	}

	/**
	 * Ensure the view can be used (not disposed and schema is compatible).
	 */
	private ensureCanView(): void {
		this.ensureNotDisposed();
		if (!this.compatibility.canView) {
			throw new UsageError(
				"Cannot use view - schema incompatible. Check view.compatibility first.",
			);
		}
	}

	// #endregion

	// #region Map Interface

	/**
	 * Get a value by key.
	 *
	 * @param key - The key to look up
	 * @returns The value, or undefined if not found
	 */
	public get(key: string): TValue | undefined {
		this.ensureCanView();
		const valueSchema = this.getValueNodeSchema();
		const result = this.storage.getField(key, valueSchema);

		if (result === undefined) {
			return undefined;
		}

		switch (result.type) {
			case "value": {
				return result.value as TValue;
			}
			case "storage": {
				// Wrap nested storage if needed
				if (isObjectSchema(valueSchema)) {
					return new SchematizedObjectView(result.storage, valueSchema) as unknown as TValue;
				}
				// Unexpected for leaf schemas
				return result.storage as unknown as TValue;
			}
			default: {
				// Exhaustive check - all result types handled above
				return undefined;
			}
		}
	}

	/**
	 * Set a value by key.
	 *
	 * @param key - The key to set
	 * @param value - The value to store
	 * @returns This view for chaining
	 * @throws SchemaValidationError if the value fails validation (when enableSchemaValidation is true)
	 */
	public set(key: string, value: TValue): this {
		this.ensureCanView();
		const valueSchema = this.getValueNodeSchema();

		// Validate only if schema validation is enabled
		if (this.enableSchemaValidation) {
			// Cast to unknown for validateData which takes unknown
			const validation = validateData(valueSchema, value as unknown);
			if (!validation.valid) {
				throw new SchemaValidationError(`Invalid value for key "${key}"`, validation.errors);
			}
		}

		this.storage.setField(key, valueSchema, value);
		return this;
	}

	/**
	 * Delete a value by key.
	 *
	 * @param key - The key to delete
	 * @returns True if the key existed and was deleted
	 */
	public delete(key: string): boolean {
		this.ensureCanView();
		return this.storage.deleteField(key);
	}

	/**
	 * Check if a key exists.
	 *
	 * @param key - The key to check
	 * @returns True if the key exists
	 */
	public has(key: string): boolean {
		this.ensureCanView();
		return this.storage.hasField(key);
	}

	/**
	 * Get the number of entries in the map.
	 */
	public get size(): number {
		this.ensureCanView();
		return this.storage.size ?? 0;
	}

	/**
	 * Clear all entries.
	 */
	public clear(): void {
		this.ensureCanView();
		for (const key of [...this.keys()]) {
			this.storage.deleteField(key);
		}
	}

	// #endregion

	// #region Iterators

	/**
	 * Iterate over keys.
	 */
	public keys(): IterableIterator<string> {
		this.ensureCanView();
		return this.storage.keys?.() ?? [][Symbol.iterator]();
	}

	/**
	 * Iterate over values.
	 */
	public *values(): IterableIterator<TValue> {
		for (const key of this.keys()) {
			const value = this.get(key);
			if (value !== undefined) {
				yield value;
			}
		}
	}

	/**
	 * Iterate over entries.
	 */
	public *entries(): IterableIterator<[string, TValue]> {
		for (const key of this.keys()) {
			const value = this.get(key);
			if (value !== undefined) {
				yield [key, value];
			}
		}
	}

	/**
	 * Iterate over entries (implements Iterable interface).
	 */
	public [Symbol.iterator](): IterableIterator<[string, TValue]> {
		return this.entries();
	}

	/**
	 * Execute a callback for each entry.
	 *
	 * @param callback - The callback to execute
	 * @param thisArg - Optional this argument for the callback
	 */
	public forEach(
		callback: (value: TValue, key: string, map: this) => void,
		thisArg?: unknown,
	): void {
		for (const [key, value] of this) {
			callback.call(thisArg, value, key, this);
		}
	}

	// #endregion

	// #region Internal Helpers

	/**
	 * Get the node schema for values in this map.
	 */
	private getValueNodeSchema(): NodeSchema {
		// Return a minimal schema for storage operations
		const schema: NodeSchema = {
			identifier: this.schema.allowedTypes[0] ?? "unknown",
			kind: 3, // NodeKind.Leaf as default
		};
		return schema;
	}

	// #endregion
}
