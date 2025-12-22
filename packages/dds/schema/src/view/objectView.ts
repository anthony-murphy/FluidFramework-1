/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/**
 * SchematizedObjectView - typed view over object data in schema storage.
 */

import { UsageError } from "@fluidframework/telemetry-utils/internal";

import type { NodeSchema, ObjectNodeSchema, FieldSchema } from "../core/index.js";
import { FieldKind, isObjectSchema, isMapSchema } from "../core/index.js";
import {
	isSchemaClassConstructor,
	type TypedObjectNodeSchema,
	type TypedMapNodeSchema,
} from "../factory/index.js";
import type { ISchemaStorage, ISchemaPersistence, StorageResult } from "../storage/index.js";
import type { NodeFromSchema } from "../types/index.js";
import { validateData } from "../validation/index.js";

import { BaseSchematizedView, type SchematizedViewOptions } from "./baseView.js";
import { SchemaValidationError } from "./errors.js";
import { SchematizedMapView } from "./mapView.js";

/**
 * Options for configuring a {@link SchematizedObjectView}.
 *
 * @alpha
 */
export type SchematizedObjectViewOptions = SchematizedViewOptions;

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
 * view.root.name = "Alice";
 * view.root.age = 30;
 *
 * // Access fields
 * const name = view.root.name; // "Alice"
 * view.root.age = 31;
 * ```
 *
 * @alpha
 */
export class SchematizedObjectView<
	TSchema extends ObjectNodeSchema,
> extends BaseSchematizedView<TSchema> {
	private readonly rootProxy: NodeFromSchema<TSchema>;

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
		schema: TSchema,
		persistence?: ISchemaPersistence,
		options?: SchematizedObjectViewOptions,
	) {
		super(schema, persistence, options);
		this.rootProxy = this.createRootProxy();
	}

	/**
	 * Creates the root proxy for typed property access to schema fields.
	 *
	 * @remarks
	 * The proxy handler accesses storage directly for optimal performance,
	 * avoiding the overhead of method calls for field access.
	 */
	private createRootProxy(): NodeFromSchema<TSchema> {
		// Capture references to avoid `this` aliasing in proxy handlers
		const schema = this.schema;
		const storage = this.storage;
		const ensureNotDisposed = (): void => this.ensureNotDisposed();
		const enableValidation = this.enableSchemaValidation;
		const getFieldNodeSchema = (fieldSchema: FieldSchema): NodeSchema =>
			this.getFieldNodeSchema(fieldSchema);
		const unwrapStorageResult = (result: StorageResult, nodeSchema: NodeSchema): unknown =>
			this.unwrapStorageResult(result, nodeSchema);

		// If the schema is a class (created with sf.object()), use its prototype as the target.
		// This enables custom methods and getters on schema subclasses to work via Reflect.
		// For plain object schemas, use an empty object.
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		const target: object = isSchemaClassConstructor(schema)
			? Object.create(schema.prototype)
			: {};
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
		return new Proxy(target, {
			get(proxyTarget, prop, receiver): unknown {
				ensureNotDisposed();
				if (typeof prop === "string" && prop in schema.fields) {
					// Access storage directly for schema fields
					const fieldSchema = schema.fields[prop];
					if (fieldSchema === undefined) {
						return undefined;
					}
					const nodeSchema = getFieldNodeSchema(fieldSchema);
					const result = storage.getField(prop, nodeSchema);

					if (result === undefined) {
						if (fieldSchema.kind === FieldKind.Required) {
							throw new SchemaValidationError(`Required field "${prop}" is missing`);
						}
						return undefined;
					}

					return unwrapStorageResult(result, nodeSchema);
				}
				// Reflect fallback for non-schema properties (enables custom methods/getters when target has prototype)
				// eslint-disable-next-line @typescript-eslint/no-unsafe-return
				return Reflect.get(proxyTarget, prop, receiver);
			},
			set(proxyTarget, prop, value, _receiver) {
				ensureNotDisposed();
				if (typeof prop === "string" && prop in schema.fields) {
					// Access storage directly for schema fields
					const fieldSchema = schema.fields[prop];
					if (fieldSchema === undefined) {
						return false;
					}

					// Handle undefined for optional fields
					if (value === undefined) {
						if (fieldSchema.kind === FieldKind.Optional) {
							storage.deleteField(prop);
							return true;
						}
						throw new UsageError(`Cannot set required field "${prop}" to undefined`);
					}

					const nodeSchema = getFieldNodeSchema(fieldSchema);

					// Validate only if schema validation is enabled
					if (enableValidation) {
						const validation = validateData(nodeSchema, value);
						if (!validation.valid) {
							throw new SchemaValidationError(
								`Invalid value for field "${prop}"`,
								validation.errors,
							);
						}
					}

					storage.setField(prop, nodeSchema, value);
					return true;
				}
				// Don't allow setting unknown properties on schema-backed objects
				// This matches the original behavior and prevents accidental property pollution
				return false;
			},
			has(proxyTarget, prop) {
				// Check if the field has a value (like hasField), not just if it's in the schema
				if (typeof prop === "string" && prop in schema.fields) {
					return storage.hasField(prop);
				}
				return Reflect.has(proxyTarget, prop);
			},
			ownKeys(proxyTarget) {
				return [
					...Object.keys(schema.fields),
					...Reflect.ownKeys(proxyTarget).filter(
						(k) => typeof k !== "string" || !(k in schema.fields),
					),
				];
			},
			getOwnPropertyDescriptor(proxyTarget, prop) {
				if (typeof prop === "string" && prop in schema.fields) {
					return { enumerable: true, configurable: true, writable: true };
				}
				return Reflect.getOwnPropertyDescriptor(proxyTarget, prop);
			},
			deleteProperty(proxyTarget, prop) {
				if (typeof prop === "string" && prop in schema.fields) {
					// For schema fields, setting to undefined clears optional fields
					// For required fields, we cannot delete
					const fieldSchema = schema.fields[prop];
					if (fieldSchema !== undefined && fieldSchema.kind === FieldKind.Optional) {
						storage.deleteField(prop);
						return true;
					}
					return false; // Cannot delete required fields
				}
				return Reflect.deleteProperty(proxyTarget, prop);
			},
		}) as NodeFromSchema<TSchema>;
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
					return new SchematizedObjectView(
						result.storage,
						nodeSchema as TypedObjectNodeSchema,
					);
				} else if (isMapSchema(nodeSchema)) {
					return new SchematizedMapView(result.storage, nodeSchema as TypedMapNodeSchema);
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
