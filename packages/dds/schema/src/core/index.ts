/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/**
 * Core schema types and enums for the standalone schema package.
 *
 * These types are extracted and adapted from the Tree DDS schema system
 * to provide a self-contained schema definition layer that can be used
 * independently of the Tree DDS implementation.
 */

// #region Enums

/**
 * Kind of a field on an object node.
 *
 * @remarks
 * This is a simplified version of the Tree DDS FieldKind that excludes
 * Tree-specific field kinds like `Identifier`.
 */
export const FieldKind = {
	/**
	 * A field which must always be filled.
	 * @remarks
	 * Only allows exactly one child.
	 */
	Required: 0,

	/**
	 * A field which can be empty or filled.
	 * @remarks
	 * Allows 0 or one child.
	 */
	Optional: 1,
} as const;

/**
 * Kind of a field on an object node.
 *
 * @remarks
 * This is a simplified version of the Tree DDS FieldKind that excludes
 * Tree-specific field kinds like `Identifier`.
 */
export type FieldKind = (typeof FieldKind)[keyof typeof FieldKind];

/**
 * The kind of tree node.
 *
 * @remarks
 * More kinds may be added over time, so do not assume this is an exhaustive set.
 */
export const NodeKind = {
	/**
	 * A node which serves as a map, storing children under string keys.
	 */
	Map: 0,

	/**
	 * A node which serves as an array, storing children in an ordered sequence.
	 */
	Array: 1,

	/**
	 * A node which stores a heterogeneous collection of children in named fields.
	 * @remarks
	 * Each field gets its own schema.
	 */
	Object: 2,

	/**
	 * A node which stores a single leaf value.
	 */
	Leaf: 3,
} as const;

/**
 * The kind of tree node.
 *
 * @remarks
 * More kinds may be added over time, so do not assume this is an exhaustive set.
 */
export type NodeKind = (typeof NodeKind)[keyof typeof NodeKind];

// #endregion

// #region Leaf Types

/**
 * The kind of value stored in a leaf node.
 *
 * @remarks
 * These correspond to the primitive types that can be stored as leaf values
 * in a tree. The `handle` type represents Fluid handles for referencing
 * other Fluid objects.
 */
export type LeafKind = "string" | "number" | "boolean" | "null" | "handle";

// #endregion

// #region Node Schema Interfaces

/**
 * Base interface for all node schemas.
 *
 * @remarks
 * All node schemas must have a unique identifier and a kind that indicates
 * what type of node the schema describes.
 */
export interface NodeSchema {
	/**
	 * The unique identifier for this schema.
	 *
	 * @remarks
	 * Identifiers should be globally unique within a schema definition.
	 * By convention, identifiers often use reverse domain notation
	 * (e.g., "com.example.MyType").
	 */
	readonly identifier: string;

	/**
	 * The kind of node this schema describes.
	 */
	readonly kind: NodeKind;
}

/**
 * Schema for an object node with named fields.
 *
 * @remarks
 * Object nodes store a heterogeneous collection of children in named fields.
 * Each field has its own schema that defines what values it can contain.
 */
export interface ObjectNodeSchema extends NodeSchema {
	readonly kind: typeof NodeKind.Object;

	/**
	 * The fields defined on this object, keyed by field name.
	 *
	 * @remarks
	 * The keys are the property names that will be used to access the fields
	 * on instances of this object node.
	 */
	readonly fields: Record<string, FieldSchema>;
}

/**
 * Schema for an array node.
 *
 * @remarks
 * Array nodes store children in an ordered sequence. All children must
 * conform to the allowed types specified in the schema.
 */
export interface ArrayNodeSchema extends NodeSchema {
	readonly kind: typeof NodeKind.Array;

	/**
	 * The allowed types for elements in this array.
	 *
	 * @remarks
	 * Each element in the array must be an instance of one of the allowed types.
	 */
	readonly allowedTypes: readonly string[];
}

/**
 * Schema for a map node with string keys.
 *
 * @remarks
 * Map nodes store children under string keys. All values must conform
 * to the allowed types specified in the schema.
 */
export interface MapNodeSchema extends NodeSchema {
	readonly kind: typeof NodeKind.Map;

	/**
	 * The allowed types for values in this map.
	 *
	 * @remarks
	 * Each value in the map must be an instance of one of the allowed types.
	 */
	readonly allowedTypes: readonly string[];
}

/**
 * Schema for a leaf node containing a primitive value.
 *
 * @remarks
 * Leaf nodes are terminal nodes that store a single primitive value.
 * They cannot have children.
 */
export interface LeafNodeSchema extends NodeSchema {
	readonly kind: typeof NodeKind.Leaf;

	/**
	 * The kind of primitive value this leaf holds.
	 */
	readonly leafKind: LeafKind;
}

// #endregion

// #region Field Schema

/**
 * Schema for a field in an object node.
 *
 * @remarks
 * Fields define the structure of object nodes by specifying what values
 * can be stored under each property name.
 */
export interface FieldSchema {
	/**
	 * The kind of field (required or optional).
	 */
	readonly kind: FieldKind;

	/**
	 * The allowed types for values in this field.
	 *
	 * @remarks
	 * The value in the field must be an instance of one of the allowed types,
	 * referenced by their schema identifiers.
	 */
	readonly allowedTypes: readonly string[];
}

// #endregion

// #region Type Guards

/**
 * Checks if a schema is an {@link ObjectNodeSchema}.
 *
 * @param schema - The schema to check.
 * @returns `true` if the schema is an ObjectNodeSchema, `false` otherwise.
 */
export function isObjectSchema(schema: NodeSchema): schema is ObjectNodeSchema {
	return schema.kind === NodeKind.Object;
}

/**
 * Checks if a schema is an {@link ArrayNodeSchema}.
 *
 * @param schema - The schema to check.
 * @returns `true` if the schema is an ArrayNodeSchema, `false` otherwise.
 */
export function isArraySchema(schema: NodeSchema): schema is ArrayNodeSchema {
	return schema.kind === NodeKind.Array;
}

/**
 * Checks if a schema is a {@link MapNodeSchema}.
 *
 * @param schema - The schema to check.
 * @returns `true` if the schema is a MapNodeSchema, `false` otherwise.
 */
export function isMapSchema(schema: NodeSchema): schema is MapNodeSchema {
	return schema.kind === NodeKind.Map;
}

/**
 * Checks if a schema is a {@link LeafNodeSchema}.
 *
 * @param schema - The schema to check.
 * @returns `true` if the schema is a LeafNodeSchema, `false` otherwise.
 */
export function isLeafSchema(schema: NodeSchema): schema is LeafNodeSchema {
	return schema.kind === NodeKind.Leaf;
}

// #endregion

// #region Union Types

/**
 * Union of all concrete node schema types.
 *
 * @remarks
 * This type is useful when you need to handle any kind of node schema
 * and want exhaustive type checking.
 */
export type AnyNodeSchema =
	| ObjectNodeSchema
	| ArrayNodeSchema
	| MapNodeSchema
	| LeafNodeSchema;

// #endregion
