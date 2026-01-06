/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import type { FieldKind } from "./fieldKind.js";
import type { NodeKind } from "./nodeKind.js";

/**
 * The kind of value stored in a leaf node.
 *
 * @remarks
 * These correspond to the primitive types that can be stored as leaf values
 * in a tree. The `handle` type represents Fluid handles for referencing
 * other Fluid objects.
 * @alpha @legacy
 */
export type LeafKind = "string" | "number" | "boolean" | "null" | "handle";

/**
 * Base interface for all node schemas.
 *
 * @remarks
 * All node schemas must have a unique identifier and a kind that indicates
 * what type of node the schema describes.
 * @alpha @legacy
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
 * @alpha @legacy
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

	/**
	 * Whether this object schema represents a const (immutable) value.
	 *
	 * @remarks
	 * When `true`, instances of this schema are treated as immutable value objects.
	 * All properties (including nested objects) become readonly, and the entire
	 * object must be replaced rather than mutating individual properties.
	 *
	 * This is similar to TypeScript's `as const` assertion - the object and all
	 * its nested structures are deeply readonly.
	 *
	 * Use {@link SchemaFactory.constObject} to create const object schemas.
	 *
	 * @defaultValue `false`
	 */
	readonly const?: boolean;
}

/**
 * Schema for an array node.
 *
 * @remarks
 * Array nodes store children in an ordered sequence. All children must
 * conform to the allowed types specified in the schema.
 * @internal
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
 * @alpha @legacy
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
 * @alpha @legacy
 */
export interface LeafNodeSchema extends NodeSchema {
	readonly kind: typeof NodeKind.Leaf;

	/**
	 * The kind of primitive value this leaf holds.
	 */
	readonly leafKind: LeafKind;
}

/**
 * Schema for a field in an object node.
 *
 * @remarks
 * Fields define the structure of object nodes by specifying what values
 * can be stored under each property name.
 * @alpha @legacy
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

	/**
	 * Optional properties for the field.
	 *
	 * @remarks
	 * Props can include storage key overrides and metadata.
	 */
	readonly props?: {
		/**
		 * Storage key override.
		 *
		 * @remarks
		 * If specified, this key is used for storage instead of the field name.
		 */
		readonly key?: string;
		/**
		 * Metadata for the field.
		 */
		readonly metadata?: {
			readonly description?: string;
			readonly custom?: unknown;
		};
	};
}

/**
 * Union of all concrete node schema types.
 *
 * @remarks
 * This type is useful when you need to handle any kind of node schema
 * and want exhaustive type checking.
 * @internal
 */
export type AnyNodeSchema =
	| ObjectNodeSchema
	| ArrayNodeSchema
	| MapNodeSchema
	| LeafNodeSchema;

/**
 * Schema types that can be used as root schemas for DDS views.
 *
 * @remarks
 * Root schemas are the valid schema types that can be passed to
 * DDS view methods like `viewWith`. Currently, only object and map
 * schemas are supported as root schemas.
 * @alpha @legacy
 */
export type RootSchema = ObjectNodeSchema | MapNodeSchema;
