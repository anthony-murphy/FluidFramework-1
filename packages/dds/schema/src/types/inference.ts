/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/**
 * Type inference utilities for deriving TypeScript types from schema definitions.
 *
 * @remarks
 * This module provides utility types that allow extracting plain TypeScript types
 * from schema definitions created with {@link SchemaFactory}. These utilities
 * enable compile-time type safety when working with schema-defined data structures.
 */

import type { IFluidHandle } from "@fluidframework/core-interfaces";

import type { FieldKind, NodeKind } from "../core/index.js";
import type {
	TypedLeafNodeSchema,
	TypedFieldSchema,
	TypedObjectNodeSchema,
	TypedMapNodeSchema,
	ImplicitAllowedTypes,
	ImplicitFieldSchema,
	ObjectSchemaFields,
} from "../factory/index.js";

// #region Core Type Inference Utilities

/**
 * Extracts the TypeScript value type from a typed leaf node schema.
 *
 * @typeParam T - A typed leaf node schema.
 *
 * @remarks
 * This utility type extracts the primitive TypeScript type (string, number,
 * boolean, null, or IFluidHandle) from a leaf schema definition.
 *
 * @example
 * ```typescript
 * import { stringSchema, numberSchema } from "@fluidframework/schema";
 *
 * // Infers: string
 * type StringValue = ValueFromLeafSchema<typeof stringSchema>;
 *
 * // Infers: number
 * type NumberValue = ValueFromLeafSchema<typeof numberSchema>;
 * ```
 * @legacy
 * @alpha
 */
export type ValueFromLeafSchema<T extends TypedLeafNodeSchema> = T extends TypedLeafNodeSchema<
	string,
	"string",
	infer TValue
>
	? TValue
	: T extends TypedLeafNodeSchema<string, "number", infer TValue>
		? TValue
		: T extends TypedLeafNodeSchema<string, "boolean", infer TValue>
			? TValue
			: T extends TypedLeafNodeSchema<string, "null", infer TValue>
				? TValue
				: T extends TypedLeafNodeSchema<string, "handle", infer TValue>
					? TValue
					: never;

/**
 * Normalizes an implicit field schema to extract its field kind and allowed types.
 *
 * @typeParam T - An implicit field schema type.
 *
 * @remarks
 * This utility normalizes both explicit TypedFieldSchema and implicit allowed types
 * (which are treated as required fields) into a consistent structure.
 *
 * @legacy
 * @alpha
 */
export type NormalizeFieldSchema<T extends ImplicitFieldSchema> = T extends TypedFieldSchema<
	infer TKind,
	infer TAllowedTypes
>
	? { kind: TKind; allowedTypes: TAllowedTypes }
	: { kind: typeof FieldKind.Required; allowedTypes: T };

/**
 * Extracts the TypeScript type from an implicit allowed types specification.
 *
 * @typeParam T - An implicit allowed types specification.
 *
 * @remarks
 * This handles single schemas, union schemas (arrays), and all node kinds
 * (leaf, object, map) to produce the corresponding TypeScript type.
 *
 * @legacy
 * @alpha
 */
export type TypeFromImplicitAllowedTypes<T extends ImplicitAllowedTypes> =
	T extends TypedLeafNodeSchema
		? ValueFromLeafSchema<T>
		: T extends TypedObjectNodeSchema<string, infer TFields>
			? ObjectFromFields<TFields>
			: T extends TypedMapNodeSchema<string, infer TValueSchema>
				? TypeFromImplicitAllowedTypes<TValueSchema>
				: T extends readonly (infer U)[]
					? U extends TypedLeafNodeSchema | TypedObjectNodeSchema | TypedMapNodeSchema
						? TypeFromImplicitAllowedTypes<U>
						: never
					: never;

/**
 * Extracts the TypeScript type for a field based on its schema.
 *
 * @typeParam T - An implicit field schema type.
 *
 * @remarks
 * This handles both required and optional fields, adding `undefined` to the
 * type union for optional fields.
 *
 * @legacy
 * @alpha
 */
export type TypeFromField<T extends ImplicitFieldSchema> = NormalizeFieldSchema<T> extends {
	kind: infer K;
	allowedTypes: infer A;
}
	? A extends ImplicitAllowedTypes
		? K extends typeof FieldKind.Optional
			? TypeFromImplicitAllowedTypes<A> | undefined
			: TypeFromImplicitAllowedTypes<A>
		: never
	: never;

/**
 * Constructs an object type from a record of field schemas.
 *
 * @typeParam TFields - A record mapping field names to their schemas.
 *
 * @remarks
 * This type utility separates required and optional fields to produce
 * a properly typed object interface where optional fields are marked
 * with `?` in the resulting type. The `-readonly` modifier ensures
 * properties are mutable, allowing assignment like `view.root.name = "Alice"`.
 *
 * @legacy
 * @alpha
 */
export type ObjectFromFields<TFields extends ObjectSchemaFields> = {
	-readonly [K in keyof TFields as NormalizeFieldSchema<
		TFields[K]
	>["kind"] extends typeof FieldKind.Required
		? K
		: never]: TypeFromField<TFields[K]>;
} & {
	-readonly [K in keyof TFields as NormalizeFieldSchema<
		TFields[K]
	>["kind"] extends typeof FieldKind.Optional
		? K
		: never]?: TypeFromField<TFields[K]>;
};

// #endregion

// #region Primary Type Inference

/**
 * Infers the TypeScript type that a node of the given schema would have.
 *
 * @typeParam T - The schema type to infer a node type from.
 *
 * @remarks
 * This is the primary utility type for getting TypeScript types from schema definitions.
 * It handles all node kinds:
 * - {@link TypedLeafNodeSchema} → primitive type (string, number, boolean, null, IFluidHandle)
 * - {@link TypedObjectNodeSchema} → object type with properly typed fields
 * - {@link TypedMapNodeSchema} → the value type for map operations
 *
 * @example
 * ```typescript
 * const sf = new SchemaFactory("myApp");
 *
 * const UserSchema = sf.object("User", {
 *   name: sf.string,
 *   age: sf.number,
 *   email: sf.optional(sf.string),
 * });
 *
 * // Infers: { name: string; age: number; email?: string | undefined }
 * type User = NodeFromSchema<typeof UserSchema>;
 *
 * const ConfigMap = sf.map("Config", sf.string);
 *
 * // Infers: string (the value type)
 * type ConfigValue = NodeFromSchema<typeof ConfigMap>;
 * ```
 * @legacy
 * @alpha
 */
export type NodeFromSchema<T> = T extends TypedLeafNodeSchema
	? ValueFromLeafSchema<T>
	: T extends TypedObjectNodeSchema<string, infer TFields>
		? ObjectFromFields<TFields>
		: T extends TypedMapNodeSchema<string, infer TValueSchema>
			? TypeFromImplicitAllowedTypes<TValueSchema>
			: never;

// #endregion

// #region Field and Value Schema Extraction

/**
 * Extracts the fields type from a {@link TypedObjectNodeSchema}.
 *
 * @typeParam T - A typed object node schema.
 *
 * @remarks
 * This utility extracts the raw fields record from an object schema,
 * which can be useful for schema composition or inspection.
 *
 * @example
 * ```typescript
 * const sf = new SchemaFactory("myApp");
 *
 * const UserSchema = sf.object("User", {
 *   name: sf.string,
 *   age: sf.number,
 * });
 *
 * // Extracts the fields definition type
 * type UserFields = InferFields<typeof UserSchema>;
 * // Results in: { name: typeof sf.string; age: typeof sf.number }
 * ```
 * @legacy
 * @alpha
 */
export type InferFields<T> = T extends TypedObjectNodeSchema<string, infer TFields>
	? TFields
	: never;

/**
 * Extracts the value schema from a {@link TypedMapNodeSchema}.
 *
 * @typeParam T - A typed map node schema.
 *
 * @remarks
 * This utility extracts the schema type used for values in a map,
 * which can be useful for schema composition or creating related types.
 *
 * @example
 * ```typescript
 * const sf = new SchemaFactory("myApp");
 *
 * const UserSchema = sf.object("User", { name: sf.string });
 * const UsersMap = sf.map("Users", UserSchema);
 *
 * // Extracts the value schema
 * type ValueSchema = InferValueSchema<typeof UsersMap>;
 * // Results in: typeof UserSchema
 * ```
 * @legacy
 * @alpha
 */
export type InferValueSchema<T> = T extends TypedMapNodeSchema<string, infer TValueSchema>
	? TValueSchema
	: never;

/**
 * Extracts the allowed types from a {@link TypedFieldSchema}.
 *
 * @typeParam T - A typed field schema.
 *
 * @remarks
 * This utility extracts the allowed types from a field schema,
 * useful for understanding what values a field can contain.
 *
 * @example
 * ```typescript
 * const sf = new SchemaFactory("myApp");
 *
 * const optionalString = sf.optional(sf.string);
 *
 * // Extracts the allowed types
 * type AllowedTypes = InferAllowedTypes<typeof optionalString>;
 * // Results in: typeof sf.string
 * ```
 * @legacy
 * @alpha
 */
export type InferAllowedTypes<T> = T extends TypedFieldSchema<FieldKind, infer TAllowedTypes>
	? TAllowedTypes
	: never;

/**
 * Extracts the field kind from a {@link TypedFieldSchema}.
 *
 * @typeParam T - A typed field schema.
 *
 * @remarks
 * This utility extracts whether a field is required or optional.
 *
 * @example
 * ```typescript
 * const sf = new SchemaFactory("myApp");
 *
 * const optionalString = sf.optional(sf.string);
 *
 * // Extracts the field kind
 * type Kind = InferFieldKind<typeof optionalString>;
 * // Results in: FieldKind.Optional
 * ```
 * @legacy
 * @alpha
 */
export type InferFieldKind<T> = T extends TypedFieldSchema<infer TKind>
	? TKind
	: typeof FieldKind.Required;

// #endregion

// #region Immutability Utilities

/**
 * Makes all properties of a type recursively readonly.
 *
 * @typeParam T - The type to make deeply readonly.
 *
 * @remarks
 * This utility recursively applies `readonly` to all properties at all
 * levels of nesting. It handles objects, arrays, Maps, Sets, and primitives.
 *
 * @example
 * ```typescript
 * interface User {
 *   name: string;
 *   address: {
 *     city: string;
 *     zip: number;
 *   };
 *   tags: string[];
 * }
 *
 * type ReadonlyUser = DeepReadonly<User>;
 * // Results in:
 * // {
 * //   readonly name: string;
 * //   readonly address: {
 * //     readonly city: string;
 * //     readonly zip: number;
 * //   };
 * //   readonly tags: readonly string[];
 * // }
 * ```
 * @legacy
 * @alpha
 */
export type DeepReadonly<T> = T extends IFluidHandle
	? T
	: T extends Map<infer K, infer V>
		? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>
		: T extends Set<infer U>
			? ReadonlySet<DeepReadonly<U>>
			: T extends readonly (infer U)[]
				? readonly DeepReadonly<U>[]
				: T extends object
					? { readonly [P in keyof T]: DeepReadonly<T[P]> }
					: T;

/**
 * Infers a deeply readonly TypeScript type from a schema.
 *
 * @typeParam T - The schema type to infer a readonly node type from.
 *
 * @remarks
 * This combines {@link NodeFromSchema} with {@link DeepReadonly} to produce
 * an immutable version of the inferred type. This is useful when you want
 * to ensure data cannot be modified after retrieval.
 *
 * @example
 * ```typescript
 * const sf = new SchemaFactory("myApp");
 *
 * const UserSchema = sf.object("User", {
 *   name: sf.string,
 *   address: sf.object("Address", {
 *     city: sf.string,
 *   }),
 * });
 *
 * // Infers a deeply readonly type
 * type ReadonlyUser = ReadonlyNodeFromSchema<typeof UserSchema>;
 * // Results in:
 * // {
 * //   readonly name: string;
 * //   readonly address: {
 * //     readonly city: string;
 * //   };
 * // }
 * ```
 * @legacy
 * @alpha
 */
export type ReadonlyNodeFromSchema<T> = DeepReadonly<NodeFromSchema<T>>;

// #endregion

// #region Schema Type Guards (Type-Level)

/**
 * Checks at the type level if a schema is a leaf schema.
 *
 * @typeParam T - The schema type to check.
 *
 * @remarks
 * This is a type-level utility that evaluates to `true` if the schema
 * is a {@link TypedLeafNodeSchema}, `false` otherwise.
 * @legacy
 * @alpha
 */
export type IsLeafSchema<T> = T extends TypedLeafNodeSchema ? true : false;

/**
 * Checks at the type level if a schema is an object schema.
 *
 * @typeParam T - The schema type to check.
 *
 * @remarks
 * This is a type-level utility that evaluates to `true` if the schema
 * is a {@link TypedObjectNodeSchema}, `false` otherwise.
 * @legacy
 * @alpha
 */
export type IsObjectSchema<T> = T extends TypedObjectNodeSchema ? true : false;

/**
 * Checks at the type level if a schema is a map schema.
 *
 * @typeParam T - The schema type to check.
 *
 * @remarks
 * This is a type-level utility that evaluates to `true` if the schema
 * is a {@link TypedMapNodeSchema}, `false` otherwise.
 * @legacy
 * @alpha
 */
export type IsMapSchema<T> = T extends TypedMapNodeSchema ? true : false;

/**
 * Gets the node kind from a schema type.
 *
 * @typeParam T - The schema type to get the kind from.
 *
 * @remarks
 * This extracts the node kind from a typed schema at the type level.
 * @legacy
 * @alpha
 */
export type SchemaKind<T> = T extends TypedLeafNodeSchema
	? typeof NodeKind.Leaf
	: T extends TypedObjectNodeSchema
		? typeof NodeKind.Object
		: T extends TypedMapNodeSchema
			? typeof NodeKind.Map
			: never;

// #endregion

// #region Union Type Utilities

/**
 * Creates a union type from an array of schemas.
 *
 * @typeParam T - A readonly array of schema types.
 *
 * @remarks
 * This utility is useful when working with union fields that allow
 * multiple different node types.
 *
 * @example
 * ```typescript
 * const sf = new SchemaFactory("myApp");
 *
 * const schemas = [sf.string, sf.number, sf.boolean] as const;
 *
 * // Infers: string | number | boolean
 * type UnionType = UnionFromSchemas<typeof schemas>;
 * ```
 * @legacy
 * @alpha
 */
export type UnionFromSchemas<T extends readonly unknown[]> = T extends readonly (infer U)[]
	? U extends TypedLeafNodeSchema | TypedObjectNodeSchema | TypedMapNodeSchema
		? NodeFromSchema<U>
		: never
	: never;

// #endregion
