/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/**
 * SchematizedMapView - typed Map-like view over schema storage.
 */

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
 * // Initialize with data
 * view.initialize(new Map([["key1", "value1"]]));
 *
 * // Map operations
 * view.set("key2", "value2");
 * const value = view.get("key1"); // "value1"
 * ```
 *
 * @legacy
 * @alpha
 */
export class SchematizedMapView<TSchema extends MapNodeSchema>
	implements Iterable<[string, InferValueSchema<TSchema>]>
{
	/**
	 * Creates a new SchematizedMapView.
	 *
	 * @param storage - The storage to read from and write to
	 * @param schema - The map schema defining the value type
	 * @param persistence - Optional persistence layer for schema storage
	 */
	public constructor(
		private readonly storage: ISchemaStorage,
		private readonly schema: TSchema,
		private readonly persistence?: ISchemaPersistence,
	) {}

	/**
	 * Gets the schema compatibility status between the stored schema and this view's schema.
	 */
	public get compatibility(): SchemaCompatibilityStatus {
		const stored = this.persistence?.getPersistedSchema();
		return checkSchemaCompatibility(stored, this.schema);
	}

	/**
	 * Gets the schema this view is based on.
	 */
	public get nodeSchema(): TSchema {
		return this.schema;
	}

	/**
	 * Initialize the storage with schema and initial content.
	 *
	 * @param content - The initial map content
	 * @throws UsageError if a schema is already stored
	 * @throws SchemaValidationError if any value fails validation
	 */
	public initialize(content: Map<string, InferValueSchema<TSchema>>): void {
		const compat = this.compatibility;
		if (!compat.canInitialize) {
			throw new UsageError("Cannot initialize - schema already stored");
		}

		// Get the value schema for validation
		const valueSchema = this.getValueNodeSchema();

		// Validate all content
		for (const [key, value] of content) {
			const validation = validateData(valueSchema, value);
			if (!validation.valid) {
				throw new SchemaValidationError(`Invalid value for key "${key}"`, validation.errors);
			}
		}

		// Store schema
		if (this.persistence !== undefined) {
			this.persistence.setPersistedSchema(encodeSchema(this.schema));
		}

		// Set all values
		for (const [key, value] of content) {
			this.storage.setField(key, valueSchema, value);
		}
	}

	/**
	 * Upgrade the stored schema to this view's schema.
	 *
	 * @throws UsageError if schemas are not compatible for upgrade
	 */
	public upgradeSchema(): void {
		const compat = this.compatibility;
		if (!compat.canUpgrade) {
			throw new UsageError("Cannot upgrade - schemas incompatible");
		}
		if (this.persistence !== undefined) {
			this.persistence.upgradePersistedSchema(encodeSchema(this.schema));
		}
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
	 * @throws SchemaValidationError if the value fails validation
	 */
	public set(key: string, value: InferValueSchema<TSchema>): this {
		this.ensureCanView();
		const valueSchema = this.getValueNodeSchema();

		const validation = validateData(valueSchema, value);
		if (!validation.valid) {
			throw new SchemaValidationError(`Invalid value for key "${key}"`, validation.errors);
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
	 * Ensure the view can be used (schema is compatible).
	 */
	private ensureCanView(): void {
		if (!this.compatibility.canView) {
			throw new UsageError(
				"Cannot use view - schema incompatible. Check view.compatibility first.",
			);
		}
	}
}
