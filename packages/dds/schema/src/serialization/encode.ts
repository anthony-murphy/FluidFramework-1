/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/**
 * Schema encoding - converts runtime schemas to JSON-compatible format.
 */

import {
	FieldKind,
	type NodeSchema,
	type ObjectNodeSchema,
	type ArrayNodeSchema,
	type MapNodeSchema,
	type LeafNodeSchema,
	type FieldSchema,
	isObjectSchema,
	isArraySchema,
	isMapSchema,
	isLeafSchema,
} from "../core/index.js";

import type {
	EncodedSchema,
	EncodedNodeSchema,
	EncodedObjectSchema,
	EncodedArraySchema,
	EncodedMapSchema,
	EncodedLeafSchema,
	EncodedFieldSchema,
} from "./format.js";

/**
 * Context used during encoding to track visited schemas and collect definitions.
 */
interface EncodeContext {
	/**
	 * Schemas that have been visited (by identifier).
	 */
	readonly visited: Set<string>;

	/**
	 * Collected definitions for schemas that need to be deduplicated.
	 */
	readonly definitions: Map<string, EncodedNodeSchema>;

	/**
	 * Schema registry for resolving identifier references.
	 */
	readonly schemaRegistry: ReadonlyMap<string, NodeSchema>;
}

/**
 * Encodes a NodeSchema into a JSON-compatible format.
 *
 * @param schema - The schema to encode.
 * @param schemaRegistry - Optional registry of all schemas by identifier for resolving references.
 * @returns The encoded schema in a self-describing, JSON-compatible format.
 *
 * @remarks
 * The encoding is:
 * - **Deterministic**: Field keys are sorted alphabetically for consistent output.
 * - **Deduplicated**: Schemas referenced multiple times appear once in definitions.
 * - **Self-describing**: Includes all information needed for decoding.
 *
 * @example
 * ```typescript
 * const sf = new SchemaFactory("myApp");
 * const UserSchema = sf.object("User", {
 *   name: sf.string,
 *   age: sf.optional(sf.number),
 * });
 *
 * const encoded = encodeSchema(UserSchema);
 * // {
 * //   version: 1,
 * //   root: {
 * //     kind: "object",
 * //     identifier: "myApp.User",
 * //     fields: {
 * //       name: { kind: "required", allowedTypes: [{ kind: "leaf", identifier: "com.fluidframework.leaf.string", leafKind: "string" }] },
 * //       age: { kind: "optional", allowedTypes: [{ kind: "leaf", identifier: "com.fluidframework.leaf.number", leafKind: "number" }] }
 * //     }
 * //   }
 * // }
 * ```
 * @internal
 */
export function encodeSchema(
	schema: NodeSchema,
	schemaRegistry?: ReadonlyMap<string, NodeSchema>,
): EncodedSchema {
	const context: EncodeContext = {
		visited: new Set(),
		definitions: new Map(),
		schemaRegistry: schemaRegistry ?? new Map(),
	};

	const root = encodeNodeSchema(schema, context, true);

	// Build definitions object if there are any
	const definitions: Record<string, EncodedNodeSchema> | undefined =
		context.definitions.size > 0 ? {} : undefined;

	if (definitions !== undefined) {
		// Sort keys for deterministic output
		const sortedKeys = [...context.definitions.keys()].sort();
		for (const key of sortedKeys) {
			const value = context.definitions.get(key);
			if (value !== undefined) {
				definitions[key] = value;
			}
		}
	}

	return {
		version: 1,
		root,
		...(definitions === undefined ? {} : { definitions }),
	};
}

/**
 * Encodes a single node schema.
 */
function encodeNodeSchema(
	schema: NodeSchema,
	context: EncodeContext,
	isRoot: boolean,
): EncodedNodeSchema {
	// Check if we've already visited this schema (for deduplication)
	if (!isRoot && context.visited.has(schema.identifier)) {
		// This schema is already in definitions, return a reference
		// Note: The caller will handle the reference conversion
		return encodeNodeSchemaInline(schema, context);
	}

	context.visited.add(schema.identifier);
	return encodeNodeSchemaInline(schema, context);
}

/**
 * Encodes a node schema without checking for deduplication.
 */
function encodeNodeSchemaInline(
	schema: NodeSchema,
	context: EncodeContext,
): EncodedNodeSchema {
	if (isLeafSchema(schema)) {
		return encodeLeafSchema(schema);
	} else if (isObjectSchema(schema)) {
		return encodeObjectSchema(schema, context);
	} else if (isArraySchema(schema)) {
		return encodeArraySchema(schema, context);
	} else if (isMapSchema(schema)) {
		return encodeMapSchema(schema, context);
	}

	// Exhaustive check - should never reach here
	throw new Error(`Unknown schema kind: ${schema.kind}`);
}

/**
 * Encodes a leaf node schema.
 */
function encodeLeafSchema(schema: LeafNodeSchema): EncodedLeafSchema {
	return {
		kind: "leaf",
		identifier: schema.identifier,
		leafKind: schema.leafKind,
	};
}

/**
 * Encodes an object node schema.
 */
function encodeObjectSchema(
	schema: ObjectNodeSchema,
	context: EncodeContext,
): EncodedObjectSchema {
	const fields: Record<string, EncodedFieldSchema> = {};

	// Sort field keys for deterministic output
	const sortedFieldNames = Object.keys(schema.fields).sort();
	for (const fieldName of sortedFieldNames) {
		const fieldSchema = schema.fields[fieldName];
		if (fieldSchema !== undefined) {
			fields[fieldName] = encodeFieldSchema(fieldSchema, context);
		}
	}

	return {
		kind: "object",
		identifier: schema.identifier,
		fields,
	};
}

/**
 * Encodes an array node schema.
 */
function encodeArraySchema(
	schema: ArrayNodeSchema,
	context: EncodeContext,
): EncodedArraySchema {
	return {
		kind: "array",
		identifier: schema.identifier,
		allowedTypes: encodeAllowedTypes(schema.allowedTypes, context),
	};
}

/**
 * Encodes a map node schema.
 */
function encodeMapSchema(schema: MapNodeSchema, context: EncodeContext): EncodedMapSchema {
	return {
		kind: "map",
		identifier: schema.identifier,
		allowedTypes: encodeAllowedTypes(schema.allowedTypes, context),
	};
}

/**
 * Encodes a field schema.
 */
function encodeFieldSchema(schema: FieldSchema, context: EncodeContext): EncodedFieldSchema {
	return {
		kind: schema.kind === FieldKind.Required ? "required" : "optional",
		allowedTypes: encodeAllowedTypes(schema.allowedTypes, context),
	};
}

/**
 * Encodes allowed types for a field, array, or map.
 *
 * @remarks
 * For now, this returns string references since the schema types are stored as identifiers.
 * In a full implementation with a schema registry, this could inline leaf schemas and
 * reference complex schemas.
 */
function encodeAllowedTypes(
	allowedTypes: readonly string[],
	context: EncodeContext,
): readonly (EncodedNodeSchema | string)[] {
	// Sort for deterministic output
	const sorted = [...allowedTypes].sort();

	return sorted.map((identifier) => {
		// Try to resolve the schema from the registry
		const schema = context.schemaRegistry.get(identifier);
		if (schema !== undefined) {
			// If it's a leaf schema, inline it for readability
			if (isLeafSchema(schema)) {
				return encodeLeafSchema(schema);
			}
			// For non-leaf schemas, check if we should add to definitions
			if (!context.visited.has(identifier)) {
				context.visited.add(identifier);
				context.definitions.set(identifier, encodeNodeSchemaInline(schema, context));
			}
		}
		// Return as string reference
		return identifier;
	});
}
