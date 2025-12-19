/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/**
 * Schema view and projection utilities.
 *
 * This module provides typed views over schema storage, enabling
 * type-safe access to data that conforms to a schema definition.
 */

// Re-export UsageError for use by consumers of this module
export { UsageError } from "@fluidframework/telemetry-utils/internal";

import {
	type NodeSchema,
	type ObjectNodeSchema,
	type MapNodeSchema,
	type FieldSchema,
	FieldKind,
	isObjectSchema,
	isMapSchema,
} from "../core/index.js";
import {
	type ISchemaStorage,
	type ISchemaPersistence,
	type StorageResult,
} from "../storage/index.js";
import {
	encodeSchema,
	checkSchemaCompatibility,
	type SchemaCompatibilityStatus,
} from "../serialization/index.js";
import { validateData, type ValidationError } from "../validation/index.js";
import type { NodeFromSchema, InferValueSchema } from "../types/index.js";

// #region Error Types

/**
 * Error thrown when data fails schema validation.
 */
export class SchemaValidationError extends Error {
	/**
	 * The validation errors that caused this exception.
	 */
	public readonly errors: readonly ValidationError[];

	public constructor(message: string, errors: readonly ValidationError[] = []) {
		super(
			errors.length > 0
				? `${message}: ${errors.map((e) => `${e.path}: ${e.message}`).join(", ")}`
				: message,
		);
		this.name = "SchemaValidationError";
		this.errors = errors;
	}
}

// #endregion

// #region SchematizedObjectView

/**
 * A view that provides typed access to object data stored in {@link ISchemaStorage}.
 *
 * @remarks
 * This class wraps an {@link ISchemaStorage} and provides typed access based on
 * an {@link ObjectNodeSchema}. It handles validation, schema compatibility checking,
 * and navigation to nested objects.
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
 * const view = new SchematizedObjectView(storage, UserSchema, persistence);
 *
 * // Initialize with data
 * view.initialize({ name: "Alice", age: 30 });
 *
 * // Access fields
 * const name = view.getFieldValue("name"); // "Alice"
 * view.setFieldValue("age", 31);
 * ```
 */
export class SchematizedObjectView<TSchema extends ObjectNodeSchema> {
	/**
	 * Creates a new SchematizedObjectView.
	 *
	 * @param storage - The storage to read from and write to
	 * @param schema - The object schema defining the structure
	 * @param persistence - Optional persistence layer for schema storage
	 */
	public constructor(
		private readonly storage: ISchemaStorage,
		private readonly schema: TSchema,
		private readonly persistence?: ISchemaPersistence,
	) {}

	/**
	 * Gets the schema compatibility status between the stored schema and this view's schema.
	 *
	 * @returns The compatibility status
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
	 * @param content - The initial content to store
	 * @throws UsageError if a schema is already stored
	 * @throws SchemaValidationError if content is invalid
	 */
	public initialize(content: NodeFromSchema<TSchema>): void {
		const compat = this.compatibility;
		if (!compat.canInitialize) {
			throw new UsageError("Cannot initialize - schema already stored");
		}

		// Validate content
		const validation = validateData(this.schema, content);
		if (!validation.valid) {
			throw new SchemaValidationError("Invalid initial content", validation.errors);
		}

		// Store schema
		if (this.persistence !== undefined) {
			this.persistence.setPersistedSchema(encodeSchema(this.schema));
		}

		// Set all fields
		for (const [fieldName, fieldSchema] of Object.entries(this.schema.fields)) {
			const value = (content as Record<string, unknown>)[fieldName];
			if (value !== undefined) {
				this.storage.setField(fieldName, this.getFieldNodeSchema(fieldSchema), value);
			}
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
	 * Get a field value by name.
	 *
	 * @param fieldName - The name of the field to get
	 * @returns The field value, or undefined for optional fields that are not set
	 * @throws UsageError if the field does not exist in the schema
	 * @throws SchemaValidationError if a required field is missing
	 */
	public getFieldValue<K extends keyof TSchema["fields"] & string>(
		fieldName: K,
	): unknown | undefined {
		const fieldSchema = this.schema.fields[fieldName];
		if (fieldSchema === undefined) {
			throw new UsageError(`Unknown field: ${fieldName}`);
		}

		const nodeSchema = this.getFieldNodeSchema(fieldSchema);
		const result = this.storage.getField(fieldName, nodeSchema);

		if (result === undefined) {
			if (fieldSchema.kind === FieldKind.Required) {
				throw new SchemaValidationError(`Required field "${fieldName}" is missing`);
			}
			return undefined;
		}

		return this.unwrapStorageResult(result, nodeSchema);
	}

	/**
	 * Set a field value by name.
	 *
	 * @param fieldName - The name of the field to set
	 * @param value - The value to set. Use undefined to clear optional fields.
	 * @throws UsageError if the field does not exist or if trying to set a required field to undefined
	 * @throws SchemaValidationError if the value fails validation
	 */
	public setFieldValue<K extends keyof TSchema["fields"] & string>(
		fieldName: K,
		value: unknown,
	): void {
		const fieldSchema = this.schema.fields[fieldName];
		if (fieldSchema === undefined) {
			throw new UsageError(`Unknown field: ${fieldName}`);
		}

		// Handle undefined for optional fields
		if (value === undefined) {
			if (fieldSchema.kind === FieldKind.Optional) {
				this.storage.deleteField(fieldName);
				return;
			}
			throw new UsageError(`Cannot set required field "${fieldName}" to undefined`);
		}

		// Get the node schema for validation
		const nodeSchema = this.getFieldNodeSchema(fieldSchema);

		// Validate
		const validation = validateData(nodeSchema, value);
		if (!validation.valid) {
			throw new SchemaValidationError(
				`Invalid value for field "${fieldName}"`,
				validation.errors,
			);
		}

		this.storage.setField(fieldName, nodeSchema, value);
	}

	/**
	 * Check if a field has a value.
	 *
	 * @param fieldName - The name of the field to check
	 * @returns True if the field has a value
	 */
	public hasField(fieldName: string): boolean {
		return this.storage.hasField(fieldName);
	}

	/**
	 * Get a dummy node schema from a field schema for storage operations.
	 * This is a simplification - in a full implementation, we'd look up the actual schema.
	 */
	private getFieldNodeSchema(fieldSchema: FieldSchema): NodeSchema {
		// For now, return a minimal schema for storage operations
		// The storage layer doesn't actually use the schema for much
		return {
			identifier: fieldSchema.allowedTypes[0] ?? "unknown",
			kind: 3, // NodeKind.Leaf as default
		} as NodeSchema;
	}

	/**
	 * Unwrap a storage result to get the actual value or nested view.
	 */
	private unwrapStorageResult(result: StorageResult, nodeSchema: NodeSchema): unknown {
		switch (result.type) {
			case "value":
				return result.value;
			case "storage":
				// Nested storage - wrap in appropriate view
				if (isObjectSchema(nodeSchema)) {
					return new SchematizedObjectView(result.storage, nodeSchema);
				} else if (isMapSchema(nodeSchema)) {
					return new SchematizedMapView(result.storage, nodeSchema);
				}
				// Should not happen for leaf schemas
				return result.storage;
		}
	}
}

// #endregion

// #region SchematizedMapView

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
			case "value":
				return result.value as InferValueSchema<TSchema>;
			case "storage":
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
		return {
			identifier: this.schema.allowedTypes[0] ?? "unknown",
			kind: 3, // NodeKind.Leaf as default
		} as NodeSchema;
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

// #endregion

// #region Proxy Creation

/**
 * Create a Proxy that provides property access to a {@link SchematizedObjectView}.
 *
 * @remarks
 * This function creates a JavaScript Proxy that enables property-style access
 * to the fields defined in the schema. It combines data access with view methods.
 *
 * @param view - The view to wrap
 * @param schema - The schema defining available fields
 * @returns A proxy providing property access
 *
 * @example
 * ```typescript
 * const view = new SchematizedObjectView(storage, UserSchema);
 * const proxy = createObjectViewProxy(view, UserSchema);
 *
 * // Property access
 * proxy.name = "Alice";
 * console.log(proxy.name); // "Alice"
 *
 * // View methods still available
 * console.log(proxy.compatibility);
 * ```
 */
export function createObjectViewProxy<TSchema extends ObjectNodeSchema>(
	view: SchematizedObjectView<TSchema>,
	schema: TSchema,
): NodeFromSchema<TSchema> & {
	compatibility: SchemaCompatibilityStatus;
	initialize: (content: NodeFromSchema<TSchema>) => void;
	upgradeSchema: () => void;
} {
	return new Proxy({} as NodeFromSchema<TSchema>, {
		get(target, prop) {
			if (prop === "compatibility") {
				return view.compatibility;
			}
			if (prop === "initialize") {
				return view.initialize.bind(view);
			}
			if (prop === "upgradeSchema") {
				return view.upgradeSchema.bind(view);
			}
			if (typeof prop === "string" && prop in schema.fields) {
				return view.getFieldValue(prop);
			}
			return undefined;
		},
		set(target, prop, value) {
			if (typeof prop === "string" && prop in schema.fields) {
				view.setFieldValue(prop, value);
				return true;
			}
			return false;
		},
		has(target, prop) {
			return typeof prop === "string" && prop in schema.fields;
		},
		ownKeys() {
			return Object.keys(schema.fields);
		},
		getOwnPropertyDescriptor(target, prop) {
			if (typeof prop === "string" && prop in schema.fields) {
				return { enumerable: true, configurable: true };
			}
			return undefined;
		},
	}) as NodeFromSchema<TSchema> & {
		compatibility: SchemaCompatibilityStatus;
		initialize: (content: NodeFromSchema<TSchema>) => void;
		upgradeSchema: () => void;
	};
}

// #endregion
