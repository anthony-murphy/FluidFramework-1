/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/**
 * SchematizedObjectView - typed view over object data in schema storage.
 */

import { UsageError } from "@fluidframework/telemetry-utils/internal";

import type { NodeSchema, ObjectNodeSchema } from "../core/index.js";
import { FieldKind, NodeKind, isObjectSchema, isMapSchema } from "../core/index.js";
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

// ============================================================================
// Field Accessor Interface and Implementations
// ============================================================================

/**
 * Schema-agnostic interface for accessing field values.
 * Abstracts away whether we're at root level (direct storage) or nested (read-modify-write).
 */
interface IFieldAccessor {
	get(key: string): unknown;
	set(key: string, value: unknown): void;
	has(key: string): boolean;
	delete(key: string): void;
}

/**
 * Field accessor that wraps ISchemaStorage for direct root-level access.
 */
class RootFieldAccessor implements IFieldAccessor {
	private static readonly genericSchema: NodeSchema = {
		identifier: "value",
		kind: NodeKind.Leaf,
	};

	public constructor(private readonly storage: ISchemaStorage) {}

	public get(key: string): StorageResult | undefined {
		return this.storage.getField(key, RootFieldAccessor.genericSchema);
	}

	public set(key: string, value: unknown): void {
		this.storage.setField(key, RootFieldAccessor.genericSchema, value);
	}

	public has(key: string): boolean {
		return this.storage.hasField(key);
	}

	public delete(key: string): void {
		this.storage.deleteField(key);
	}
}

// ============================================================================
// Schema Proxy Factory
// ============================================================================

/**
 * Options for createSchemaProxy.
 */
interface SchemaProxyOptions {
	enableValidation: boolean;
	ensureNotDisposed: () => void;
}

/**
 * Gets the nested schema for a field from the schema's info property.
 */
function getNestedSchemaFromInfo(
	schema: ObjectNodeSchema,
	prop: string,
): NodeSchema | undefined {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
	const schemaInfo = (schema as any).info;
	if (schemaInfo === undefined) {
		return undefined;
	}
	// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
	const fieldInfo = schemaInfo[prop];
	if (fieldInfo === undefined) {
		return undefined;
	}

	// TypedFieldSchema with info property
	// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
	if (typeof fieldInfo === "object" && fieldInfo !== null && "info" in fieldInfo) {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		return fieldInfo.info as NodeSchema | undefined;
	}

	// Direct schema object
	if (typeof fieldInfo === "object" && fieldInfo !== null && "kind" in fieldInfo) {
		return fieldInfo as NodeSchema;
	}

	// Schema class constructor
	if (typeof fieldInfo === "function" && "kind" in fieldInfo) {
		return fieldInfo as unknown as NodeSchema;
	}

	return undefined;
}

/**
 * Gets the storage key for a field.
 * Uses props.key if specified, otherwise returns the property name.
 */
function getStorageKey(schema: ObjectNodeSchema, prop: string): string {
	const fieldSchema = schema.fields[prop];
	// Access props.key with explicit typing to avoid any-type issues
	const props = fieldSchema?.props as { key?: string } | undefined;
	return props?.key ?? prop;
}

/**
 * Creates a proxy that provides typed access to fields through an accessor.
 * All schema logic (validation, required/optional, nested wrapping) lives here.
 */
function createSchemaProxy<TSchema extends ObjectNodeSchema>(
	schema: TSchema,
	accessor: IFieldAccessor,
	options: SchemaProxyOptions,
): NodeFromSchema<TSchema> {
	const { enableValidation, ensureNotDisposed } = options;

	// Use schema class prototype as target if available (enables custom methods)
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	const target: object = isSchemaClassConstructor(schema)
		? Object.create(schema.prototype)
		: {};

	return new Proxy(target, {
		get(proxyTarget, prop, receiver): unknown {
			ensureNotDisposed();

			if (typeof prop !== "string" || !(prop in schema.fields)) {
				return Reflect.get(proxyTarget, prop, receiver);
			}

			const fieldSchema = schema.fields[prop];
			if (fieldSchema === undefined) {
				return undefined;
			}

			const storageKey = getStorageKey(schema, prop);
			const result = accessor.get(storageKey);

			// Handle StorageResult from RootFieldAccessor
			if (result !== null && typeof result === "object" && "type" in result) {
				const storageResult = result as StorageResult;
				return unwrapStorageResult(storageResult, schema, prop, storageKey, accessor, options);
			}

			// Handle undefined values
			if (result === undefined) {
				if (fieldSchema.kind === FieldKind.Required) {
					throw new SchemaValidationError(`Required field "${prop}" is missing`);
				}
				return undefined;
			}

			// Return nested objects directly.
			// Note: The type system marks nested objects as readonly, but at runtime
			// mutations are still possible. This is intentional - type-level enforcement
			// is sufficient to guide users toward the correct pattern of replacing
			// whole nested values rather than mutating properties.
			return result;
		},

		set(proxyTarget, prop, value): boolean {
			ensureNotDisposed();

			if (typeof prop !== "string" || !(prop in schema.fields)) {
				return false;
			}

			const fieldSchema = schema.fields[prop];
			if (fieldSchema === undefined) {
				return false;
			}

			const storageKey = getStorageKey(schema, prop);

			// Handle undefined for optional fields
			if (value === undefined) {
				if (fieldSchema.kind === FieldKind.Optional) {
					accessor.delete(storageKey);
					return true;
				}
				throw new UsageError(`Cannot set required field "${prop}" to undefined`);
			}

			// Validate if enabled
			if (enableValidation) {
				const nodeSchema: NodeSchema = {
					identifier: fieldSchema.allowedTypes[0] ?? "unknown",
					kind: NodeKind.Leaf,
				};
				const validation = validateData(nodeSchema, value);
				if (!validation.valid) {
					throw new SchemaValidationError(
						`Invalid value for field "${prop}"`,
						validation.errors,
					);
				}
			}

			accessor.set(storageKey, value);
			return true;
		},

		has(proxyTarget, prop): boolean {
			if (typeof prop === "string" && prop in schema.fields) {
				const storageKey = getStorageKey(schema, prop);
				return accessor.has(storageKey);
			}
			return Reflect.has(proxyTarget, prop);
		},

		deleteProperty(proxyTarget, prop): boolean {
			if (typeof prop === "string" && prop in schema.fields) {
				const fieldSchema = schema.fields[prop];
				if (fieldSchema?.kind === FieldKind.Optional) {
					const storageKey = getStorageKey(schema, prop);
					accessor.delete(storageKey);
					return true;
				}
				return false;
			}
			return Reflect.deleteProperty(proxyTarget, prop);
		},

		ownKeys(proxyTarget): (string | symbol)[] {
			return [
				...Object.keys(schema.fields),
				...Reflect.ownKeys(proxyTarget).filter(
					(k) => typeof k !== "string" || !(k in schema.fields),
				),
			];
		},

		getOwnPropertyDescriptor(proxyTarget, prop): PropertyDescriptor | undefined {
			if (typeof prop === "string" && prop in schema.fields) {
				return { enumerable: true, configurable: true, writable: true };
			}
			return Reflect.getOwnPropertyDescriptor(proxyTarget, prop);
		},
	}) as NodeFromSchema<TSchema>;
}

/**
 * Unwrap a StorageResult to get the value or create nested views.
 */
function unwrapStorageResult(
	result: StorageResult,
	schema: ObjectNodeSchema,
	prop: string,
	storageKey: string,
	accessor: IFieldAccessor,
	options: SchemaProxyOptions,
): unknown {
	const fieldSchema = schema.fields[prop];

	switch (result.type) {
		case "value": {
			const value = result.value;

			if (value === undefined) {
				if (fieldSchema?.kind === FieldKind.Required) {
					throw new SchemaValidationError(`Required field "${prop}" is missing`);
				}
				return undefined;
			}

			// Return nested objects directly.
			// Note: The type system marks nested objects as readonly, but at runtime
			// mutations are still possible. This is intentional - type-level enforcement
			// is sufficient to guide users toward the correct pattern.
			return value;
		}
		case "storage": {
			// Nested storage - wrap in appropriate view
			const nestedSchema = getNestedSchemaFromInfo(schema, prop);
			if (nestedSchema !== undefined && isObjectSchema(nestedSchema)) {
				return new SchematizedObjectView(
					result.storage,
					nestedSchema as TypedObjectNodeSchema,
				);
			} else if (nestedSchema !== undefined && isMapSchema(nestedSchema)) {
				return new SchematizedMapView(result.storage, nestedSchema as TypedMapNodeSchema);
			}
			return result.storage;
		}
		default: {
			return undefined;
		}
	}
}

// ============================================================================
// SchematizedObjectView
// ============================================================================

/**
 * Options for configuring a {@link SchematizedObjectView}.
 *
 * @internal
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
 * @internal
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
		storage: ISchemaStorage,
		schema: TSchema,
		persistence?: ISchemaPersistence,
		options?: SchematizedObjectViewOptions,
	) {
		super(schema, persistence, options);
		const accessor = new RootFieldAccessor(storage);
		this.rootProxy = createSchemaProxy(schema, accessor, {
			enableValidation: this.enableSchemaValidation,
			ensureNotDisposed: () => this.ensureNotDisposed(),
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
}
