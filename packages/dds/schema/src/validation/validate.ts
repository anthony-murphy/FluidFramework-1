/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/**
 * Schema validation utilities.
 *
 * This module provides runtime validation of data against schema definitions.
 * It is used to ensure that data conforms to the expected structure before
 * storing it in a DDS.
 */

import type { IFluidHandle } from "@fluidframework/core-interfaces";

import {
	type NodeSchema,
	type LeafNodeSchema,
	type ObjectNodeSchema,
	type MapNodeSchema,
	type FieldSchema,
	FieldKind,
	isLeafSchema,
	isObjectSchema,
	isMapSchema,
} from "../core/index.js";
import {
	stringSchema,
	numberSchema,
	booleanSchema,
	nullSchema,
	handleSchema,
} from "../factory/index.js";

// #region Validation Result Types

/**
 * A single validation error.
 *
 * @internal
 */
export interface ValidationError {
	/**
	 * The path to the invalid value (e.g., "address.city").
	 */
	readonly path: string;

	/**
	 * A human-readable description of the error.
	 */
	readonly message: string;

	/**
	 * The expected type or value.
	 */
	readonly expected: string;

	/**
	 * The actual type or value encountered.
	 */
	readonly actual: string;
}

/**
 * Result of validating data against a schema.
 *
 * @internal
 */
export interface ValidationResult {
	/**
	 * True if the data is valid according to the schema.
	 */
	readonly valid: boolean;

	/**
	 * List of validation errors. Empty if valid is true.
	 */
	readonly errors: readonly ValidationError[];
}

// #endregion

// #region Schema Registry

/**
 * A map from schema identifiers to their schema definitions.
 * Used to look up schemas by identifier during validation.
 *
 * @internal
 */
export type SchemaRegistry = ReadonlyMap<string, NodeSchema>;

/**
 * Builds a schema registry from a root schema by collecting all referenced schemas.
 *
 * @param rootSchema - The root schema to start from
 * @returns A map of schema identifiers to schemas
 *
 * @internal
 */
export function buildSchemaRegistry(rootSchema: NodeSchema): SchemaRegistry {
	const registry = new Map<string, NodeSchema>();

	function collectSchemas(schema: NodeSchema): void {
		if (registry.has(schema.identifier)) {
			return; // Already collected
		}

		registry.set(schema.identifier, schema);

		if (isObjectSchema(schema)) {
			for (const fieldSchema of Object.values(schema.fields)) {
				for (const allowedType of fieldSchema.allowedTypes) {
					const referencedSchema = findSchemaByIdentifier(allowedType);
					if (referencedSchema !== undefined) {
						collectSchemas(referencedSchema);
					}
				}
			}
		} else if (isMapSchema(schema)) {
			for (const allowedType of schema.allowedTypes) {
				const referencedSchema = findSchemaByIdentifier(allowedType);
				if (referencedSchema !== undefined) {
					collectSchemas(referencedSchema);
				}
			}
		}
	}

	// Add built-in leaf schemas
	registry.set(stringSchema.identifier, stringSchema);
	registry.set(numberSchema.identifier, numberSchema);
	registry.set(booleanSchema.identifier, booleanSchema);
	registry.set(nullSchema.identifier, nullSchema);
	registry.set(handleSchema.identifier, handleSchema);

	collectSchemas(rootSchema);
	return registry;
}

/**
 * Find a schema by its identifier from built-in schemas.
 */
function findSchemaByIdentifier(identifier: string): NodeSchema | undefined {
	switch (identifier) {
		case stringSchema.identifier: {
			return stringSchema;
		}
		case numberSchema.identifier: {
			return numberSchema;
		}
		case booleanSchema.identifier: {
			return booleanSchema;
		}
		case nullSchema.identifier: {
			return nullSchema;
		}
		case handleSchema.identifier: {
			return handleSchema;
		}
		default: {
			return undefined;
		}
	}
}

// #endregion

// #region Type Checking

/**
 * Checks if a value is an IFluidHandle.
 *
 * @param value - The value to check
 * @returns True if the value is an IFluidHandle
 */
function isFluidHandle(value: unknown): value is IFluidHandle {
	return (
		typeof value === "object" &&
		value !== null &&
		"get" in value &&
		typeof (value as IFluidHandle).get === "function"
	);
}

/**
 * Gets a human-readable type name for a value.
 */
function getTypeName(value: unknown): string {
	if (value === null) {
		return "null";
	}
	if (Array.isArray(value)) {
		return "array";
	}
	if (isFluidHandle(value)) {
		return "handle";
	}
	return typeof value;
}

// #endregion

// #region Validation Functions

/**
 * Validate data against a schema.
 *
 * @param schema - The schema to validate against
 * @param data - The data to validate
 * @param registry - Optional schema registry for resolving type references
 * @returns A ValidationResult indicating whether the data is valid
 *
 * @example
 * ```typescript
 * const sf = new SchemaFactory("myApp");
 * const UserSchema = sf.object("User", {
 *   name: sf.string,
 *   age: sf.optional(sf.number),
 * });
 *
 * const result = validateData(UserSchema, { name: "Alice", age: 30 });
 * if (result.valid) {
 *   console.log("Data is valid!");
 * } else {
 *   console.log("Errors:", result.errors);
 * }
 * ```
 *
 * @internal
 */
export function validateData(
	schema: NodeSchema,
	data: unknown,
	registry?: SchemaRegistry,
): ValidationResult {
	const errors: ValidationError[] = [];
	const effectiveRegistry = registry ?? buildSchemaRegistry(schema);
	validateNode(schema, data, "", errors, effectiveRegistry);
	return { valid: errors.length === 0, errors };
}

/**
 * Validates a node against its schema.
 */
function validateNode(
	schema: NodeSchema,
	data: unknown,
	path: string,
	errors: ValidationError[],
	registry: SchemaRegistry,
): void {
	if (isLeafSchema(schema)) {
		validateLeaf(schema, data, path, errors);
	} else if (isObjectSchema(schema)) {
		validateObject(schema, data, path, errors, registry);
	} else if (isMapSchema(schema)) {
		validateMap(schema, data, path, errors, registry);
	}
}

/**
 * Validates a leaf value against a leaf schema.
 */
function validateLeaf(
	schema: LeafNodeSchema,
	data: unknown,
	path: string,
	errors: ValidationError[],
): void {
	const actualType = getTypeName(data);

	switch (schema.leafKind) {
		case "string": {
			if (typeof data !== "string") {
				errors.push({
					path,
					message: "Expected string",
					expected: "string",
					actual: actualType,
				});
			}
			break;
		}
		case "number": {
			if (typeof data !== "number") {
				errors.push({
					path,
					message: "Expected number",
					expected: "number",
					actual: actualType,
				});
			}
			break;
		}
		case "boolean": {
			if (typeof data !== "boolean") {
				errors.push({
					path,
					message: "Expected boolean",
					expected: "boolean",
					actual: actualType,
				});
			}
			break;
		}
		case "null": {
			if (data !== null) {
				errors.push({
					path,
					message: "Expected null",
					expected: "null",
					actual: actualType,
				});
			}
			break;
		}
		case "handle": {
			if (!isFluidHandle(data)) {
				errors.push({
					path,
					message: "Expected IFluidHandle",
					expected: "handle",
					actual: actualType,
				});
			}
			break;
		}
		default: {
			// Exhaustive check - all leaf kinds handled above
			break;
		}
	}
}

/**
 * Validates an object against an object schema.
 */
function validateObject(
	schema: ObjectNodeSchema,
	data: unknown,
	path: string,
	errors: ValidationError[],
	registry: SchemaRegistry,
): void {
	if (typeof data !== "object" || data === null || Array.isArray(data)) {
		errors.push({
			path,
			message: "Expected object",
			expected: "object",
			actual: getTypeName(data),
		});
		return;
	}

	const obj = data as Record<string, unknown>;

	// Check each field defined in the schema
	for (const [fieldName, fieldSchema] of Object.entries(schema.fields)) {
		const fieldPath = path === "" ? fieldName : `${path}.${fieldName}`;
		const value = obj[fieldName];

		validateField(fieldSchema, value, fieldPath, errors, registry);
	}

	// Check for extra fields not in schema (strict validation)
	for (const key of Object.keys(obj)) {
		if (!(key in schema.fields)) {
			const fieldPath = path === "" ? key : `${path}.${key}`;
			errors.push({
				path: fieldPath,
				message: "Unknown field",
				expected: "none",
				actual: "present",
			});
		}
	}
}

/**
 * Validates a field value against a field schema.
 */
function validateField(
	fieldSchema: FieldSchema,
	value: unknown,
	path: string,
	errors: ValidationError[],
	registry: SchemaRegistry,
): void {
	// Handle undefined/missing values
	if (value === undefined) {
		if (fieldSchema.kind === FieldKind.Required) {
			errors.push({
				path,
				message: "Required field is missing",
				expected: "value",
				actual: "undefined",
			});
		}
		return;
	}

	// Validate the value against allowed types
	validateAgainstAllowedTypes(fieldSchema.allowedTypes, value, path, errors, registry);
}

/**
 * Validates a value against a set of allowed type identifiers.
 */
function validateAgainstAllowedTypes(
	allowedTypes: readonly string[],
	value: unknown,
	path: string,
	errors: ValidationError[],
	registry: SchemaRegistry,
): void {
	// Try each allowed type
	for (const typeIdentifier of allowedTypes) {
		const typeSchema = registry.get(typeIdentifier);
		if (typeSchema === undefined) {
			// Unknown type - this is a schema configuration error
			continue;
		}

		// Try to validate against this type
		const typeErrors: ValidationError[] = [];
		validateNode(typeSchema, value, path, typeErrors, registry);

		if (typeErrors.length === 0) {
			// Value is valid for this type
			return;
		}
	}

	// Value doesn't match any allowed type
	errors.push({
		path,
		message: `Value does not match any allowed type`,
		expected: allowedTypes.join(" | "),
		actual: getTypeName(value),
	});
}

/**
 * Validates a map value against a map schema.
 */
function validateMap(
	schema: MapNodeSchema,
	data: unknown,
	path: string,
	errors: ValidationError[],
	registry: SchemaRegistry,
): void {
	// Map schema can validate plain objects with string keys
	if (typeof data !== "object" || data === null || Array.isArray(data)) {
		errors.push({
			path,
			message: "Expected object (map)",
			expected: "object",
			actual: getTypeName(data),
		});
		return;
	}

	const obj = data as Record<string, unknown>;

	// Validate each entry
	for (const [key, value] of Object.entries(obj)) {
		const entryPath = path === "" ? key : `${path}.${key}`;
		validateAgainstAllowedTypes(schema.allowedTypes, value, entryPath, errors, registry);
	}
}

// #endregion
