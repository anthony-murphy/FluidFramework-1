/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/**
 * Schema serialization and deserialization utilities.
 *
 * This module provides types and functions for encoding and decoding schema definitions
 * to/from a JSON-compatible format suitable for persistence in `.attributes` blobs.
 */

import {
	FieldKind,
	NodeKind,
	type NodeSchema,
	type ObjectNodeSchema,
	type ArrayNodeSchema,
	type MapNodeSchema,
	type LeafNodeSchema,
	type FieldSchema,
	type LeafKind,
	isObjectSchema,
	isArraySchema,
	isMapSchema,
	isLeafSchema,
} from "../core/index.js";

// #region Encoded Schema Types

/**
 * Encoded schema format (JSON-compatible).
 *
 * @remarks
 * This format is designed to be:
 * - **Self-describing**: Can decode without external information
 * - **Deterministic**: Same schema always produces same encoding
 * - **Compact**: Reasonable size for `.attributes` blob
 * - **Extensible**: Version field for future changes
 */
export interface EncodedSchema {
	/**
	 * Format version for forward compatibility.
	 * @remarks
	 * Currently only version 1 is supported.
	 */
	readonly version: 1;

	/**
	 * The root schema definition.
	 */
	readonly root: EncodedNodeSchema;

	/**
	 * All referenced schemas by identifier (for deduplication).
	 * @remarks
	 * When a schema is referenced multiple times, it appears once in definitions
	 * and is referenced by its identifier string elsewhere.
	 */
	readonly definitions?: Record<string, EncodedNodeSchema>;
}

/**
 * Union of all encoded node schema types.
 */
export type EncodedNodeSchema =
	| EncodedObjectSchema
	| EncodedMapSchema
	| EncodedArraySchema
	| EncodedLeafSchema;

/**
 * Encoded representation of an object node schema.
 */
export interface EncodedObjectSchema {
	/** Discriminant for object schemas. */
	readonly kind: "object";

	/** The unique identifier for this schema. */
	readonly identifier: string;

	/** The fields defined on this object, keyed by field name. */
	readonly fields: Record<string, EncodedFieldSchema>;
}

/**
 * Encoded representation of a map node schema.
 */
export interface EncodedMapSchema {
	/** Discriminant for map schemas. */
	readonly kind: "map";

	/** The unique identifier for this schema. */
	readonly identifier: string;

	/**
	 * The schema for values in the map.
	 * @remarks
	 * Can be an inline schema or a string reference to a schema in definitions.
	 */
	readonly allowedTypes: readonly (EncodedNodeSchema | string)[];
}

/**
 * Encoded representation of an array node schema.
 */
export interface EncodedArraySchema {
	/** Discriminant for array schemas. */
	readonly kind: "array";

	/** The unique identifier for this schema. */
	readonly identifier: string;

	/**
	 * The schema for items in the array.
	 * @remarks
	 * Can be an inline schema or a string reference to a schema in definitions.
	 */
	readonly allowedTypes: readonly (EncodedNodeSchema | string)[];
}

/**
 * Encoded representation of a leaf node schema.
 */
export interface EncodedLeafSchema {
	/** Discriminant for leaf schemas. */
	readonly kind: "leaf";

	/** The unique identifier for this schema. */
	readonly identifier: string;

	/** The kind of primitive value this leaf holds. */
	readonly leafKind: LeafKind;
}

/**
 * Encoded representation of a field schema.
 */
export interface EncodedFieldSchema {
	/**
	 * The kind of field (required or optional).
	 */
	readonly kind: "required" | "optional";

	/**
	 * The allowed types for values in this field.
	 * @remarks
	 * Each element can be an inline schema or a string reference to a schema in definitions.
	 */
	readonly allowedTypes: readonly (EncodedNodeSchema | string)[];
}

// #endregion

// #region Simple Schema Types (for decode output)

/**
 * A simple, plain-object representation of a node schema.
 *
 * @remarks
 * This is the output format of {@link decodeSchema}. It provides a
 * class-free representation of the schema that can be used for
 * validation, comparison, or further processing.
 */
export type SimpleNodeSchema =
	| SimpleObjectNodeSchema
	| SimpleArrayNodeSchema
	| SimpleMapNodeSchema
	| SimpleLeafNodeSchema;

/**
 * Simple representation of an object node schema.
 */
export interface SimpleObjectNodeSchema {
	readonly kind: NodeKind.Object;
	readonly identifier: string;
	readonly fields: Record<string, SimpleFieldSchema>;
}

/**
 * Simple representation of an array node schema.
 */
export interface SimpleArrayNodeSchema {
	readonly kind: NodeKind.Array;
	readonly identifier: string;
	readonly allowedTypes: readonly string[];
}

/**
 * Simple representation of a map node schema.
 */
export interface SimpleMapNodeSchema {
	readonly kind: NodeKind.Map;
	readonly identifier: string;
	readonly allowedTypes: readonly string[];
}

/**
 * Simple representation of a leaf node schema.
 */
export interface SimpleLeafNodeSchema {
	readonly kind: NodeKind.Leaf;
	readonly identifier: string;
	readonly leafKind: LeafKind;
}

/**
 * Simple representation of a field schema.
 */
export interface SimpleFieldSchema {
	readonly kind: FieldKind;
	readonly allowedTypes: readonly string[];
}

/**
 * Result of decoding an encoded schema.
 *
 * @remarks
 * Contains the root schema and all definitions needed to resolve
 * schema references.
 */
export interface DecodedSchema {
	/**
	 * The root schema definition.
	 */
	readonly root: SimpleNodeSchema;

	/**
	 * All schema definitions by identifier.
	 */
	readonly definitions: ReadonlyMap<string, SimpleNodeSchema>;
}

// #endregion

// #region Encoding Implementation

/**
 * Context used during encoding to track visited schemas and collect definitions.
 */
interface EncodeContext {
	/** Schemas that have been visited (by identifier). */
	readonly visited: Set<string>;

	/** Collected definitions for schemas that need to be deduplicated. */
	readonly definitions: Map<string, EncodedNodeSchema>;

	/** Schema registry for resolving identifier references. */
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
		...(definitions !== undefined ? { definitions } : {}),
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
function encodeNodeSchemaInline(schema: NodeSchema, context: EncodeContext): EncodedNodeSchema {
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
	throw new Error(`Unknown schema kind: ${(schema as NodeSchema).kind}`);
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
function encodeObjectSchema(schema: ObjectNodeSchema, context: EncodeContext): EncodedObjectSchema {
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
function encodeArraySchema(schema: ArrayNodeSchema, context: EncodeContext): EncodedArraySchema {
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

// #endregion

// #region Decoding Implementation

/**
 * Decodes an encoded schema back into a simple schema representation.
 *
 * @param encoded - The encoded schema to decode.
 * @returns A decoded schema containing the root and all definitions.
 *
 * @remarks
 * The decoded schema uses plain objects (not class instances) that implement
 * the core schema interfaces. This makes the result easy to work with for
 * validation, comparison, or serialization.
 *
 * @example
 * ```typescript
 * const encoded: EncodedSchema = {
 *   version: 1,
 *   root: {
 *     kind: "object",
 *     identifier: "myApp.User",
 *     fields: {
 *       name: { kind: "required", allowedTypes: [{ kind: "leaf", identifier: "com.fluidframework.leaf.string", leafKind: "string" }] }
 *     }
 *   }
 * };
 *
 * const decoded = decodeSchema(encoded);
 * // decoded.root is a SimpleObjectNodeSchema
 * // decoded.definitions contains all referenced schemas
 * ```
 */
export function decodeSchema(encoded: EncodedSchema): DecodedSchema {
	if (encoded.version !== 1) {
		throw new Error(`Unsupported schema version: ${encoded.version}`);
	}

	const definitions = new Map<string, SimpleNodeSchema>();

	// First, decode all definitions
	if (encoded.definitions !== undefined) {
		for (const [identifier, encodedNode] of Object.entries(encoded.definitions)) {
			definitions.set(identifier, decodeNodeSchema(encodedNode, definitions));
		}
	}

	// Decode the root schema
	const root = decodeNodeSchema(encoded.root, definitions);

	// Add the root to definitions if it has an identifier and isn't already there
	if (!definitions.has(root.identifier)) {
		definitions.set(root.identifier, root);
	}

	return { root, definitions };
}

/**
 * Decodes a single encoded node schema.
 */
function decodeNodeSchema(
	encoded: EncodedNodeSchema,
	definitions: Map<string, SimpleNodeSchema>,
): SimpleNodeSchema {
	switch (encoded.kind) {
		case "leaf":
			return decodeLeafSchema(encoded);
		case "object":
			return decodeObjectSchema(encoded, definitions);
		case "array":
			return decodeArraySchema(encoded, definitions);
		case "map":
			return decodeMapSchema(encoded, definitions);
		default:
			throw new Error(`Unknown encoded schema kind: ${(encoded as EncodedNodeSchema).kind}`);
	}
}

/**
 * Decodes a leaf schema.
 */
function decodeLeafSchema(encoded: EncodedLeafSchema): SimpleLeafNodeSchema {
	return {
		kind: NodeKind.Leaf,
		identifier: encoded.identifier,
		leafKind: encoded.leafKind,
	};
}

/**
 * Decodes an object schema.
 */
function decodeObjectSchema(
	encoded: EncodedObjectSchema,
	definitions: Map<string, SimpleNodeSchema>,
): SimpleObjectNodeSchema {
	const fields: Record<string, SimpleFieldSchema> = {};

	for (const [fieldName, encodedField] of Object.entries(encoded.fields)) {
		fields[fieldName] = decodeFieldSchema(encodedField, definitions);
	}

	return {
		kind: NodeKind.Object,
		identifier: encoded.identifier,
		fields,
	};
}

/**
 * Decodes an array schema.
 */
function decodeArraySchema(
	encoded: EncodedArraySchema,
	definitions: Map<string, SimpleNodeSchema>,
): SimpleArrayNodeSchema {
	return {
		kind: NodeKind.Array,
		identifier: encoded.identifier,
		allowedTypes: decodeAllowedTypes(encoded.allowedTypes, definitions),
	};
}

/**
 * Decodes a map schema.
 */
function decodeMapSchema(
	encoded: EncodedMapSchema,
	definitions: Map<string, SimpleNodeSchema>,
): SimpleMapNodeSchema {
	return {
		kind: NodeKind.Map,
		identifier: encoded.identifier,
		allowedTypes: decodeAllowedTypes(encoded.allowedTypes, definitions),
	};
}

/**
 * Decodes a field schema.
 */
function decodeFieldSchema(
	encoded: EncodedFieldSchema,
	definitions: Map<string, SimpleNodeSchema>,
): SimpleFieldSchema {
	return {
		kind: encoded.kind === "required" ? FieldKind.Required : FieldKind.Optional,
		allowedTypes: decodeAllowedTypes(encoded.allowedTypes, definitions),
	};
}

/**
 * Decodes allowed types from encoded format.
 *
 * @remarks
 * Each allowed type can be either:
 * - A string reference to a schema identifier
 * - An inline encoded schema
 *
 * This function extracts identifiers from both forms.
 */
function decodeAllowedTypes(
	allowedTypes: readonly (EncodedNodeSchema | string)[],
	definitions: Map<string, SimpleNodeSchema>,
): readonly string[] {
	return allowedTypes.map((typeOrRef) => {
		if (typeof typeOrRef === "string") {
			return typeOrRef;
		}
		// It's an inline schema - decode it and add to definitions if needed
		const decoded = decodeNodeSchema(typeOrRef, definitions);
		if (!definitions.has(decoded.identifier)) {
			definitions.set(decoded.identifier, decoded);
		}
		return decoded.identifier;
	});
}

// #endregion

// #region Schema Compatibility

/**
 * Result of checking compatibility between stored and view schemas.
 *
 * @remarks
 * This interface describes the compatibility status between a stored schema
 * (from persistence) and a view schema (requested by the application).
 */
export interface SchemaCompatibilityStatus {
	/**
	 * True if schemas are functionally identical.
	 *
	 * @remarks
	 * This means both schemas have the exact same structure, including
	 * all fields, field kinds (required/optional), and types.
	 */
	isEquivalent: boolean;

	/**
	 * True if the view can read all stored data.
	 *
	 * @remarks
	 * The view can read data if:
	 * - For ObjectNodeSchema: Stored has all required fields that view expects
	 * - For MapNodeSchema: Value types are compatible
	 * - For LeafNodeSchema: Same leaf kind
	 */
	canView: boolean;

	/**
	 * True if stored schema can be upgraded to view schema.
	 *
	 * @remarks
	 * Upgrade is possible when:
	 * - For ObjectNodeSchema: View only adds optional fields (no removing, no type changes)
	 * - For MapNodeSchema: View value type is superset of stored
	 * - For LeafNodeSchema: Same leaf kind
	 */
	canUpgrade: boolean;

	/**
	 * True if no stored schema exists yet.
	 *
	 * @remarks
	 * When there is no stored schema, the view schema can be used to initialize storage.
	 */
	canInitialize: boolean;
}

/**
 * Check compatibility between stored schema and view schema.
 *
 * @param stored - The encoded schema from storage (or undefined if none exists)
 * @param view - The view schema being requested
 * @returns Compatibility status describing what operations are allowed
 *
 * @remarks
 * This function determines what operations are safe when the stored schema
 * differs from the view schema. The compatibility rules ensure data integrity:
 *
 * - **canInitialize**: True only when no stored schema exists
 * - **canView**: True if the view can safely read all stored data
 * - **canUpgrade**: True if the stored schema can be safely upgraded to match view
 * - **isEquivalent**: True if schemas are structurally identical
 *
 * @example
 * ```typescript
 * const sf = new SchemaFactory("myApp");
 * const UserV1 = sf.object("User", { name: sf.string });
 * const UserV2 = sf.object("User", { name: sf.string, email: sf.optional(sf.string) });
 *
 * const storedSchema = encodeSchema(UserV1);
 * const status = checkSchemaCompatibility(storedSchema, UserV2);
 *
 * // status.canUpgrade is true (only added optional field)
 * // status.canView is false (view expects email which stored doesn't have)
 * // status.isEquivalent is false (schemas differ)
 * ```
 */
export function checkSchemaCompatibility(
	stored: EncodedSchema | undefined,
	view: NodeSchema,
): SchemaCompatibilityStatus {
	// If no stored schema, we can initialize with the view schema
	if (stored === undefined) {
		return {
			isEquivalent: false,
			canView: false,
			canUpgrade: false,
			canInitialize: true,
		};
	}

	// Encode the view schema for comparison
	const encodedView = encodeSchema(view);

	// Decode both schemas to SimpleNodeSchema for comparison
	const decodedStored = decodeSchema(stored);
	const decodedView = decodeSchema(encodedView);

	// Check structural equality for isEquivalent
	const isEquivalent = areSimpleSchemasEqual(
		decodedStored.root,
		decodedView.root,
		decodedStored.definitions,
		decodedView.definitions,
	);

	// Check if view can read stored data
	const canView = canViewStoredData(
		decodedStored.root,
		decodedView.root,
		decodedStored.definitions,
		decodedView.definitions,
	);

	// Check if stored can be upgraded to view
	const canUpgrade = canUpgradeSchema(
		decodedStored.root,
		decodedView.root,
		decodedStored.definitions,
		decodedView.definitions,
	);

	return {
		isEquivalent,
		canView,
		canUpgrade,
		canInitialize: false,
	};
}

/**
 * Check if two simple schemas are structurally equal.
 */
function areSimpleSchemasEqual(
	stored: SimpleNodeSchema,
	view: SimpleNodeSchema,
	storedDefs: ReadonlyMap<string, SimpleNodeSchema>,
	viewDefs: ReadonlyMap<string, SimpleNodeSchema>,
): boolean {
	// Different kinds are never equal
	if (stored.kind !== view.kind) {
		return false;
	}

	switch (stored.kind) {
		case NodeKind.Leaf: {
			const viewLeaf = view as SimpleLeafNodeSchema;
			return stored.leafKind === viewLeaf.leafKind;
		}
		case NodeKind.Object: {
			const viewObject = view as SimpleObjectNodeSchema;
			return areObjectSchemasEqual(stored, viewObject, storedDefs, viewDefs);
		}
		case NodeKind.Map: {
			const viewMap = view as SimpleMapNodeSchema;
			return areAllowedTypesEqual(stored.allowedTypes, viewMap.allowedTypes, storedDefs, viewDefs);
		}
		case NodeKind.Array: {
			const viewArray = view as SimpleArrayNodeSchema;
			return areAllowedTypesEqual(
				stored.allowedTypes,
				viewArray.allowedTypes,
				storedDefs,
				viewDefs,
			);
		}
		default:
			return false;
	}
}

/**
 * Check if two object schemas are structurally equal.
 */
function areObjectSchemasEqual(
	stored: SimpleObjectNodeSchema,
	view: SimpleObjectNodeSchema,
	storedDefs: ReadonlyMap<string, SimpleNodeSchema>,
	viewDefs: ReadonlyMap<string, SimpleNodeSchema>,
): boolean {
	const storedFieldNames = Object.keys(stored.fields).sort();
	const viewFieldNames = Object.keys(view.fields).sort();

	// Must have same fields
	if (storedFieldNames.length !== viewFieldNames.length) {
		return false;
	}

	for (let i = 0; i < storedFieldNames.length; i++) {
		if (storedFieldNames[i] !== viewFieldNames[i]) {
			return false;
		}
	}

	// Check each field
	for (const fieldName of storedFieldNames) {
		const storedField = stored.fields[fieldName];
		const viewField = view.fields[fieldName];

		if (storedField === undefined || viewField === undefined) {
			return false;
		}

		// Field kind must match
		if (storedField.kind !== viewField.kind) {
			return false;
		}

		// Allowed types must match
		if (!areAllowedTypesEqual(storedField.allowedTypes, viewField.allowedTypes, storedDefs, viewDefs)) {
			return false;
		}
	}

	return true;
}

/**
 * Check if two allowed type lists are equal.
 */
function areAllowedTypesEqual(
	stored: readonly string[],
	view: readonly string[],
	storedDefs: ReadonlyMap<string, SimpleNodeSchema>,
	viewDefs: ReadonlyMap<string, SimpleNodeSchema>,
): boolean {
	if (stored.length !== view.length) {
		return false;
	}

	const sortedStored = [...stored].sort();
	const sortedView = [...view].sort();

	for (let i = 0; i < sortedStored.length; i++) {
		const storedId = sortedStored[i];
		const viewId = sortedView[i];

		if (storedId === undefined || viewId === undefined) {
			return false;
		}

		// If identifiers match directly, they're equal
		if (storedId === viewId) {
			continue;
		}

		// Otherwise, look up in definitions and compare structurally
		const storedSchema = storedDefs.get(storedId);
		const viewSchema = viewDefs.get(viewId);

		if (storedSchema === undefined || viewSchema === undefined) {
			return false;
		}

		if (!areSimpleSchemasEqual(storedSchema, viewSchema, storedDefs, viewDefs)) {
			return false;
		}
	}

	return true;
}

/**
 * Check if the view schema can read data stored with the stored schema.
 *
 * @remarks
 * The view can read stored data if:
 * - For leaf: Same leaf kind
 * - For object: Stored has all required fields that view expects (with compatible types)
 * - For map/array: Value types are compatible (stored types are subset of view types)
 */
function canViewStoredData(
	stored: SimpleNodeSchema,
	view: SimpleNodeSchema,
	storedDefs: ReadonlyMap<string, SimpleNodeSchema>,
	viewDefs: ReadonlyMap<string, SimpleNodeSchema>,
): boolean {
	// Different kinds cannot be viewed
	if (stored.kind !== view.kind) {
		return false;
	}

	switch (stored.kind) {
		case NodeKind.Leaf: {
			const viewLeaf = view as SimpleLeafNodeSchema;
			// Leaf schemas must have the same kind
			return stored.leafKind === viewLeaf.leafKind;
		}
		case NodeKind.Object: {
			const viewObject = view as SimpleObjectNodeSchema;
			return canViewObjectData(stored, viewObject, storedDefs, viewDefs);
		}
		case NodeKind.Map: {
			const viewMap = view as SimpleMapNodeSchema;
			// View can read stored map if stored value types are subset of view value types
			return areTypesSubset(stored.allowedTypes, viewMap.allowedTypes, storedDefs, viewDefs);
		}
		case NodeKind.Array: {
			const viewArray = view as SimpleArrayNodeSchema;
			// View can read stored array if stored item types are subset of view item types
			return areTypesSubset(stored.allowedTypes, viewArray.allowedTypes, storedDefs, viewDefs);
		}
		default:
			return false;
	}
}

/**
 * Check if view object schema can read stored object data.
 *
 * @remarks
 * View can read stored data if:
 * - All required fields in view exist in stored with compatible types
 * - All optional fields in view either exist in stored with compatible types, or don't exist
 * - Extra fields in stored (not in view) are allowed (view just ignores them)
 */
function canViewObjectData(
	stored: SimpleObjectNodeSchema,
	view: SimpleObjectNodeSchema,
	storedDefs: ReadonlyMap<string, SimpleNodeSchema>,
	viewDefs: ReadonlyMap<string, SimpleNodeSchema>,
): boolean {
	// For each field in view, check if it can be satisfied by stored
	for (const [fieldName, viewField] of Object.entries(view.fields)) {
		const storedField = stored.fields[fieldName];

		if (storedField === undefined) {
			// Field doesn't exist in stored
			if (viewField.kind === FieldKind.Required) {
				// View requires this field but stored doesn't have it
				return false;
			}
			// Optional field not in stored is OK - will be undefined
			continue;
		}

		// Field exists in both - check type compatibility
		// Stored types must be subset of view types for this field
		if (!areTypesSubset(storedField.allowedTypes, viewField.allowedTypes, storedDefs, viewDefs)) {
			return false;
		}
	}

	return true;
}

/**
 * Check if stored schema can be upgraded to view schema.
 *
 * @remarks
 * Upgrade is possible when:
 * - For leaf: Same leaf kind (no upgrade needed)
 * - For object: View only adds optional fields, no removing fields, no type changes
 * - For map/array: View value type is superset of stored
 */
function canUpgradeSchema(
	stored: SimpleNodeSchema,
	view: SimpleNodeSchema,
	storedDefs: ReadonlyMap<string, SimpleNodeSchema>,
	viewDefs: ReadonlyMap<string, SimpleNodeSchema>,
): boolean {
	// Different kinds cannot be upgraded
	if (stored.kind !== view.kind) {
		return false;
	}

	switch (stored.kind) {
		case NodeKind.Leaf: {
			const viewLeaf = view as SimpleLeafNodeSchema;
			// Leaf schemas must have the same kind
			return stored.leafKind === viewLeaf.leafKind;
		}
		case NodeKind.Object: {
			const viewObject = view as SimpleObjectNodeSchema;
			return canUpgradeObjectSchema(stored, viewObject, storedDefs, viewDefs);
		}
		case NodeKind.Map: {
			const viewMap = view as SimpleMapNodeSchema;
			// Can upgrade if stored value types are subset of view value types
			return areTypesSubset(stored.allowedTypes, viewMap.allowedTypes, storedDefs, viewDefs);
		}
		case NodeKind.Array: {
			const viewArray = view as SimpleArrayNodeSchema;
			// Can upgrade if stored item types are subset of view item types
			return areTypesSubset(stored.allowedTypes, viewArray.allowedTypes, storedDefs, viewDefs);
		}
		default:
			return false;
	}
}

/**
 * Check if stored object schema can be upgraded to view object schema.
 *
 * @remarks
 * Upgrade is allowed if:
 * - All stored fields exist in view with compatible types
 * - New fields in view (not in stored) must be optional
 * - Field kind can become more permissive (required -> optional) but not stricter
 */
function canUpgradeObjectSchema(
	stored: SimpleObjectNodeSchema,
	view: SimpleObjectNodeSchema,
	storedDefs: ReadonlyMap<string, SimpleNodeSchema>,
	viewDefs: ReadonlyMap<string, SimpleNodeSchema>,
): boolean {
	// Check that all stored fields exist in view with compatible types
	for (const [fieldName, storedField] of Object.entries(stored.fields)) {
		const viewField = view.fields[fieldName];

		if (viewField === undefined) {
			// Stored field removed in view - not allowed for upgrade
			return false;
		}

		// Check type compatibility - types must be equal or view must be superset
		if (!areTypesSubset(storedField.allowedTypes, viewField.allowedTypes, storedDefs, viewDefs)) {
			return false;
		}

		// Field kind changes: required->optional is OK, optional->required is NOT
		if (storedField.kind === FieldKind.Optional && viewField.kind === FieldKind.Required) {
			return false;
		}
	}

	// Check that new fields in view are optional
	for (const [fieldName, viewField] of Object.entries(view.fields)) {
		const storedField = stored.fields[fieldName];

		if (storedField === undefined) {
			// New field in view
			if (viewField.kind === FieldKind.Required) {
				// Adding a required field is not allowed
				return false;
			}
			// Adding optional fields is allowed
		}
	}

	return true;
}

/**
 * Check if subset types are all contained in superset types.
 *
 * @remarks
 * Returns true if every type in subset has a compatible type in superset.
 * Types are compatible if they have the same identifier or are structurally equal.
 */
function areTypesSubset(
	subset: readonly string[],
	superset: readonly string[],
	subsetDefs: ReadonlyMap<string, SimpleNodeSchema>,
	supersetDefs: ReadonlyMap<string, SimpleNodeSchema>,
): boolean {
	for (const subId of subset) {
		// Check if this type has a compatible type in superset
		const found = superset.some((superId) => {
			if (subId === superId) {
				return true;
			}

			// Look up schemas and compare structurally
			const subSchema = subsetDefs.get(subId);
			const superSchema = supersetDefs.get(superId);

			if (subSchema === undefined || superSchema === undefined) {
				return false;
			}

			return areSimpleSchemasEqual(subSchema, superSchema, subsetDefs, supersetDefs);
		});

		if (!found) {
			return false;
		}
	}

	return true;
}

// #endregion
