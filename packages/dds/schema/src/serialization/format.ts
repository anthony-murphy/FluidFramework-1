/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/**
 * Encoded schema format types for JSON serialization.
 */

import type { LeafKind } from "../core/index.js";

/**
 * Encoded schema format (JSON-compatible).
 *
 * @remarks
 * This format is designed to be:
 * - **Self-describing**: Can decode without external information
 * - **Deterministic**: Same schema always produces same encoding
 * - **Compact**: Reasonable size for `.attributes` blob
 * - **Extensible**: Version field for future changes
 * @legacy
 * @alpha
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
 * @legacy
 * @alpha
 */
export type EncodedNodeSchema =
	| EncodedObjectSchema
	| EncodedMapSchema
	| EncodedArraySchema
	| EncodedLeafSchema;

/**
 * Encoded representation of an object node schema.
 * @legacy
 * @alpha
 */
export interface EncodedObjectSchema {
	/**
	 * Discriminant for object schemas.
	 */
	readonly kind: "object";

	/**
	 * The unique identifier for this schema.
	 */
	readonly identifier: string;

	/**
	 * The fields defined on this object, keyed by field name.
	 */
	readonly fields: Record<string, EncodedFieldSchema>;
}

/**
 * Encoded representation of a map node schema.
 * @legacy
 * @alpha
 */
export interface EncodedMapSchema {
	/**
	 * Discriminant for map schemas.
	 */
	readonly kind: "map";

	/**
	 * The unique identifier for this schema.
	 */
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
 * @legacy
 * @alpha
 */
export interface EncodedArraySchema {
	/**
	 * Discriminant for array schemas.
	 */
	readonly kind: "array";

	/**
	 * The unique identifier for this schema.
	 */
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
 * @legacy
 * @alpha
 */
export interface EncodedLeafSchema {
	/**
	 * Discriminant for leaf schemas.
	 */
	readonly kind: "leaf";

	/**
	 * The unique identifier for this schema.
	 */
	readonly identifier: string;

	/**
	 * The kind of primitive value this leaf holds.
	 */
	readonly leafKind: LeafKind;
}

/**
 * Encoded representation of a field schema.
 * @legacy
 * @alpha
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

import type { FieldKind, NodeKind } from "../core/index.js";

/**
 * A simple, plain-object representation of a node schema.
 *
 * @remarks
 * This is the output format of {@link decodeSchema}. It provides a
 * class-free representation of the schema that can be used for
 * validation, comparison, or further processing.
 * @legacy
 * @alpha
 */
export type SimpleNodeSchema =
	| SimpleObjectNodeSchema
	| SimpleArrayNodeSchema
	| SimpleMapNodeSchema
	| SimpleLeafNodeSchema;

/**
 * Simple representation of an object node schema.
 * @legacy
 * @alpha
 */
export interface SimpleObjectNodeSchema {
	readonly kind: typeof NodeKind.Object;
	readonly identifier: string;
	readonly fields: Record<string, SimpleFieldSchema>;
}

/**
 * Simple representation of an array node schema.
 * @legacy
 * @alpha
 */
export interface SimpleArrayNodeSchema {
	readonly kind: typeof NodeKind.Array;
	readonly identifier: string;
	readonly allowedTypes: readonly string[];
}

/**
 * Simple representation of a map node schema.
 * @legacy
 * @alpha
 */
export interface SimpleMapNodeSchema {
	readonly kind: typeof NodeKind.Map;
	readonly identifier: string;
	readonly allowedTypes: readonly string[];
}

/**
 * Simple representation of a leaf node schema.
 * @legacy
 * @alpha
 */
export interface SimpleLeafNodeSchema {
	readonly kind: typeof NodeKind.Leaf;
	readonly identifier: string;
	readonly leafKind: LeafKind;
}

/**
 * Simple representation of a field schema.
 * @legacy
 * @alpha
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
 * @legacy
 * @alpha
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
