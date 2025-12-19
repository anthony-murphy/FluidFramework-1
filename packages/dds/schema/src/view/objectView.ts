/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/**
 * SchematizedObjectView - typed view over object data in schema storage.
 */

import type { IDisposable } from "@fluidframework/core-interfaces";
import { UsageError } from "@fluidframework/telemetry-utils/internal";

import type { NodeSchema, ObjectNodeSchema, FieldSchema } from "../core/index.js";
import { FieldKind, isObjectSchema, isMapSchema } from "../core/index.js";
import type { ISchemaStorage, ISchemaPersistence, StorageResult } from "../storage/index.js";
import type { NodeFromSchema } from "../types/index.js";
import {
	encodeSchema,
	checkSchemaCompatibility,
	type SchemaCompatibilityStatus,
} from "../serialization/index.js";
import { validateData } from "../validation/index.js";

import { SchemaValidationError } from "./errors.js";
import { SchematizedMapView } from "./mapView.js";

/**
 * Options for configuring a {@link SchematizedObjectView}.
 *
 * @internal
 */
export interface SchematizedObjectViewOptions {
	/**
	 * Enable runtime validation on every property set operation.
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
 * // Initialize (persist schema) and set data
 * view.initialize();
 * view.setFieldValue("name", "Alice");
 * view.setFieldValue("age", 30);
 *
 * // Access fields
 * const name = view.getFieldValue("name"); // "Alice"
 * view.setFieldValue("age", 31);
 * ```
 *
 * @internal
 */
export class SchematizedObjectView<TSchema extends ObjectNodeSchema> implements IDisposable {
	private readonly enableSchemaValidation: boolean;
	private readonly ignoreStoredSchema: readonly string[] | undefined;
	private _disposed = false;
	private readonly rootProxy: NodeFromSchema<TSchema>;

	/**
	 * Error message thrown when accessing a disposed view.
	 */
	private static readonly disposedErrorMessage = "Accessed a disposed SchemaView.";

	/**
	 * Creates a new SchematizedObjectView.
	 *
	 * @param storage - The storage to read from and write to
	 * @param schema - The object schema defining the structure
	 * @param persistence - Optional persistence layer for schema storage
	 * @param options - Optional configuration options
	 */
	public constructor(
		private readonly storage: ISchemaStorage,
		private readonly schema: TSchema,
		private readonly persistence?: ISchemaPersistence,
		options?: SchematizedObjectViewOptions,
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
	 *
	 * @returns The compatibility status
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
	 * Setting data is a separate concern - use the `root` property or `setFieldValue()` after initializing.
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
	 * Creates the root proxy for typed property access to schema fields.
	 */
	private createRootProxy(): NodeFromSchema<TSchema> {
		const schema = this.schema;
		const getFieldValue = (prop: string): unknown => this.getFieldValue(prop);
		const setFieldValue = (prop: string, value: unknown): void =>
			this.setFieldValue(prop, value);
		const hasField = (prop: string): boolean => this.hasField(prop);
		const isDisposed = (): boolean => this.disposed;
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
		return new Proxy({} as NodeFromSchema<TSchema>, {
			get(_target, prop) {
				if (isDisposed()) {
					throw new UsageError(SchematizedObjectView.disposedErrorMessage);
				}
				if (typeof prop === "string" && prop in schema.fields) {
					return getFieldValue(prop);
				}
				return undefined;
			},
			set(_target, prop, value) {
				if (isDisposed()) {
					throw new UsageError(SchematizedObjectView.disposedErrorMessage);
				}
				if (typeof prop === "string" && prop in schema.fields) {
					setFieldValue(prop, value);
					return true;
				}
				return false;
			},
			has(_target, prop) {
				// Check if the field has a value (like hasField), not just if it's in the schema
				if (typeof prop === "string" && prop in schema.fields) {
					return hasField(prop);
				}
				return false;
			},
			ownKeys() {
				return Object.keys(schema.fields);
			},
			getOwnPropertyDescriptor(_target, prop) {
				if (typeof prop === "string" && prop in schema.fields) {
					return { enumerable: true, configurable: true };
				}
				return undefined;
			},
		});
	}

	/**
	 * The typed data root providing property access to schema fields.
	 *
	 * @remarks
	 * Access fields directly through this property:
	 * ```ts
	 * view.root.name = "Alice";
	 * console.log(view.root.age);
	 * ```
	 */
	public get root(): NodeFromSchema<TSchema> {
		this.ensureNotDisposed();
		return this.rootProxy;
	}

	/**
	 * Get a field value by name.
	 *
	 * @param fieldName - The name of the field to get
	 * @returns The field value, or undefined for optional fields that are not set
	 * @throws UsageError if the field does not exist in the schema
	 * @throws SchemaValidationError if a required field is missing
	 */
	public getFieldValue<K extends keyof TSchema["fields"] & string>(fieldName: K): unknown {
		this.ensureNotDisposed();
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
	 * @throws SchemaValidationError if the value fails validation (when enableSchemaValidation is true)
	 */
	public setFieldValue<K extends keyof TSchema["fields"] & string>(
		fieldName: K,
		value: unknown,
	): void {
		this.ensureNotDisposed();
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

		// Get the node schema for storage operations
		const nodeSchema = this.getFieldNodeSchema(fieldSchema);

		// Validate only if schema validation is enabled
		if (this.enableSchemaValidation) {
			const validation = validateData(nodeSchema, value);
			if (!validation.valid) {
				throw new SchemaValidationError(
					`Invalid value for field "${fieldName}"`,
					validation.errors,
				);
			}
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
		this.ensureNotDisposed();
		return this.storage.hasField(fieldName);
	}

	/**
	 * Get a dummy node schema from a field schema for storage operations.
	 * This is a simplification - in a full implementation, we'd look up the actual schema.
	 */
	private getFieldNodeSchema(fieldSchema: FieldSchema): NodeSchema {
		// For now, return a minimal schema for storage operations
		// The storage layer doesn't actually use the schema for much
		const schema: NodeSchema = {
			identifier: fieldSchema.allowedTypes[0] ?? "unknown",
			kind: 3, // NodeKind.Leaf as default
		};
		return schema;
	}

	/**
	 * Unwrap a storage result to get the actual value or nested view.
	 */
	private unwrapStorageResult(result: StorageResult, nodeSchema: NodeSchema): unknown {
		switch (result.type) {
			case "value": {
				return result.value;
			}
			case "storage": {
				// Nested storage - wrap in appropriate view
				if (isObjectSchema(nodeSchema)) {
					return new SchematizedObjectView(result.storage, nodeSchema);
				} else if (isMapSchema(nodeSchema)) {
					return new SchematizedMapView(result.storage, nodeSchema);
				}
				// Should not happen for leaf schemas
				return result.storage;
			}
			default: {
				// Exhaustive check - all result types handled above
				return undefined;
			}
		}
	}
}
