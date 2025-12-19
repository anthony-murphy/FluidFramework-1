/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/**
 * SchematizedMapView - typed Map-like view over schema storage.
 */

import type { IDisposable } from "@fluidframework/core-interfaces";
import { UsageError } from "@fluidframework/telemetry-utils/internal";

import type { NodeSchema, MapNodeSchema } from "../core/index.js";
import { isObjectSchema } from "../core/index.js";
import type { ISchemaStorage, ISchemaPersistence } from "../storage/index.js";
import {
	encodeSchema,
	checkSchemaCompatibility,
	type SchemaCompatibilityStatus,
} from "../serialization/index.js";
import { validateData } from "../validation/index.js";
import type { InferValueSchema } from "../types/index.js";

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
 * @typeParam TSchema - The map node schema type
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
 * const value = view.get("key1"); // "value1"
 * ```
 *
 * @internal
 */
export class SchematizedMapView<TSchema extends MapNodeSchema>
	implements Iterable<[string, InferValueSchema<TSchema>]>, IDisposable
{
	private readonly enableSchemaValidation: boolean;
	private readonly ignoreStoredSchema: readonly string[] | undefined;
	private _disposed = false;
	private readonly rootProxy: Map<string, InferValueSchema<TSchema>>;

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
		private readonly schema: TSchema,
		private readonly persistence?: ISchemaPersistence,
		options?: SchematizedMapViewOptions,
	) {
		this.enableSchemaValidation = options?.enableSchemaValidation ?? false;
		this.ignoreStoredSchema = options?.ignoreStoredSchema;
		this.rootProxy = this.createRootProxy();
	}

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
			throw new UsageError("Accessed a disposed SchemaView.");
		}
	}

	/**
	 * Gets the schema compatibility status between the stored schema and this view's schema.
	 */
	public get compatibility(): SchemaCompatibilityStatus {
		const stored = this.persistence?.getPersistedSchema();

		// Check if stored schema should be ignored
		if (
			stored !== undefined &&
			this.ignoreStoredSchema?.includes(stored.root.identifier) === true
		) {
			// Act as if no schema is stored
			return checkSchemaCompatibility(undefined, this.schema);
		}

		return checkSchemaCompatibility(stored, this.schema);
	}

	/**
	 * Gets the schema this view is based on.
	 */
	public get nodeSchema(): TSchema {
		return this.schema;
	}

	/**
	 * Initialize the storage by persisting the schema.
	 *
	 * @remarks
	 * This method persists the schema to enable cross-client enforcement.
	 * Setting data is a separate concern - use the `root` property or `set()` after initializing.
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
	public upgradeSchema(): void {
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
	 * Creates the root Map proxy for typed map operations.
	 */
	private createRootProxy(): Map<string, InferValueSchema<TSchema>> {
		// Capture references to avoid `this` aliasing in proxy handlers
		const isDisposed = (): boolean => this.disposed;
		const getVal = (key: string): InferValueSchema<TSchema> | undefined => this.get(key);
		const setVal = (key: string, value: InferValueSchema<TSchema>): this =>
			this.set(key, value);
		const hasKey = (key: string): boolean => this.has(key);
		const deleteKey = (key: string): boolean => this.delete(key);
		const clearAll = (): void => this.clear();
		const getKeys = (): IterableIterator<string> => this.keys();
		const getValues = (): IterableIterator<InferValueSchema<TSchema>> => this.values();
		const getEntries = (): IterableIterator<[string, InferValueSchema<TSchema>]> =>
			this.entries();
		const getSize = (): number => this.size;
		const getIterator = (): IterableIterator<[string, InferValueSchema<TSchema>]> =>
			this[Symbol.iterator]();

		// Use object type for the target to enable Reflect fallback
		const target: object = {};
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
		const proxy = new Proxy(target, {
			get(proxyTarget, prop, receiver): unknown {
				if (isDisposed()) {
					throw new UsageError(SchematizedMapView.disposedErrorMessage);
				}
				// Map methods
				if (prop === "get") {
					return (key: string) => getVal(key);
				}
				if (prop === "set") {
					return (key: string, value: InferValueSchema<TSchema>) => {
						setVal(key, value);
						return proxy; // Return proxy for chaining like Map
					};
				}
				if (prop === "has") {
					return (key: string) => hasKey(key);
				}
				if (prop === "delete") {
					return (key: string) => deleteKey(key);
				}
				if (prop === "clear") {
					return () => clearAll();
				}
				if (prop === "keys") {
					return () => getKeys();
				}
				if (prop === "values") {
					return () => getValues();
				}
				if (prop === "entries") {
					return () => getEntries();
				}
				if (prop === "forEach") {
					return (
						callback: (
							value: InferValueSchema<TSchema>,
							key: string,
							map: Map<string, InferValueSchema<TSchema>>,
						) => void,
						thisArg?: unknown,
					) => {
						for (const [key, value] of getIterator()) {
							callback.call(thisArg, value, key, proxy);
						}
					};
				}
				if (prop === "size") {
					return getSize();
				}
				if (prop === Symbol.iterator) {
					return () => getIterator();
				}
				if (prop === Symbol.toStringTag) {
					return "Map";
				}
				// Reflect fallback for non-Map properties
				// eslint-disable-next-line @typescript-eslint/no-unsafe-return
				return Reflect.get(proxyTarget, prop, receiver);
			},
			has(proxyTarget, prop) {
				const mapProps = [
					"get",
					"set",
					"has",
					"delete",
					"clear",
					"keys",
					"values",
					"entries",
					"forEach",
					"size",
					Symbol.iterator,
					Symbol.toStringTag,
				];
				if (mapProps.includes(prop)) {
					return true;
				}
				return Reflect.has(proxyTarget, prop);
			},
		}) as Map<string, InferValueSchema<TSchema>>;
		return proxy;
	}

	/**
	 * The typed Map root providing map operations on schema data.
	 *
	 * @remarks
	 * Use Map operations through this property:
	 * ```ts
	 * view.root.set("key", "value");
	 * console.log(view.root.get("key"));
	 * ```
	 */
	public get root(): Map<string, InferValueSchema<TSchema>> {
		this.ensureNotDisposed();
		return this.rootProxy;
	}

	/**
	 * Get a value by key.
	 *
	 * @param key - The key to look up
	 * @returns The value, or undefined if not found
	 */
	public get(key: string): InferValueSchema<TSchema> | undefined {
		this.ensureCanView();
		const valueSchema = this.getValueNodeSchema();
		const result = this.storage.getField(key, valueSchema);

		if (result === undefined) {
			return undefined;
		}

		switch (result.type) {
			case "value": {
				return result.value as InferValueSchema<TSchema>;
			}
			case "storage": {
				// Wrap nested storage if needed
				if (isObjectSchema(valueSchema)) {
					return new SchematizedObjectView(
						result.storage,
						valueSchema,
					) as unknown as InferValueSchema<TSchema>;
				}
				// Unexpected for leaf schemas
				return result.storage as unknown as InferValueSchema<TSchema>;
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
	public set(key: string, value: InferValueSchema<TSchema>): this {
		this.ensureCanView();
		const valueSchema = this.getValueNodeSchema();

		// Validate only if schema validation is enabled
		if (this.enableSchemaValidation) {
			const validation = validateData(valueSchema, value);
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
	 * Iterate over keys.
	 */
	public keys(): IterableIterator<string> {
		this.ensureCanView();
		return this.storage.keys?.() ?? [][Symbol.iterator]();
	}

	/**
	 * Iterate over values.
	 */
	public *values(): IterableIterator<InferValueSchema<TSchema>> {
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
	public *entries(): IterableIterator<[string, InferValueSchema<TSchema>]> {
		for (const key of this.keys()) {
			const value = this.get(key);
			if (value !== undefined) {
				yield [key, value];
			}
		}
	}

	/**
	 * Iterate over entries.
	 */
	public [Symbol.iterator](): IterableIterator<[string, InferValueSchema<TSchema>]> {
		return this.entries();
	}

	/**
	 * Execute a callback for each entry.
	 *
	 * @param callback - The callback to execute
	 * @param thisArg - Optional this argument for the callback
	 */
	public forEach(
		callback: (value: InferValueSchema<TSchema>, key: string, map: this) => void,
		thisArg?: unknown,
	): void {
		for (const [key, value] of this) {
			callback.call(thisArg, value, key, this);
		}
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

	/**
	 * Get a dummy node schema for value operations.
	 */
	private getValueNodeSchema(): NodeSchema {
		// Return a minimal schema for storage operations
		const schema: NodeSchema = {
			identifier: this.schema.allowedTypes[0] ?? "unknown",
			kind: 3, // NodeKind.Leaf as default
		};
		return schema;
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
}
