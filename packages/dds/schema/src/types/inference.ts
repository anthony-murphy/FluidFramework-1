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

import type { FieldKind } from "../core/index.js";
import type {
	TypedLeafNodeSchema,
	TypedFieldSchema,
	TypedObjectNodeSchema,
	TypedConstObjectNodeSchema,
	TypedMapNodeSchema,
	ImplicitAllowedTypes,
	ImplicitFieldSchema,
	ObjectSchemaFields,
	SchemaClassConstructor,
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
 * @alpha @legacy
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
 * @alpha @legacy
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
 * For const object schemas ({@link TypedConstObjectNodeSchema}), this produces
 * a deeply readonly type using {@link ReadonlyObjectFromFields}. Regular object
 * schemas produce mutable types using {@link ObjectFromFields}.
 *
 * @alpha @legacy
 */
export type TypeFromImplicitAllowedTypes<T extends ImplicitAllowedTypes> =
	T extends TypedLeafNodeSchema
		? ValueFromLeafSchema<T>
		: T extends TypedConstObjectNodeSchema<string, infer TFields>
			? ReadonlyObjectFromFields<TFields>
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
 * Extracts the TypeScript type from an implicit allowed types specification,
 * always producing a readonly (deeply immutable) type.
 *
 * @typeParam T - An implicit allowed types specification.
 *
 * @remarks
 * This is similar to {@link TypeFromImplicitAllowedTypes} but always produces
 * readonly types, regardless of whether the schema was defined with
 * `sf.object()` or `sf.constObject()`. This is used by
 * {@link ReadonlyObjectFromFields} to ensure deep immutability.
 *
 * @alpha @legacy
 */
export type ReadonlyTypeFromImplicitAllowedTypes<T extends ImplicitAllowedTypes> =
	T extends TypedLeafNodeSchema
		? ValueFromLeafSchema<T>
		: T extends TypedObjectNodeSchema<string, infer TFields>
			? ReadonlyObjectFromFields<TFields>
			: T extends TypedMapNodeSchema<string, infer TValueSchema>
				? ReadonlyTypeFromImplicitAllowedTypes<TValueSchema>
				: T extends readonly (infer U)[]
					? U extends TypedLeafNodeSchema | TypedObjectNodeSchema | TypedMapNodeSchema
						? ReadonlyTypeFromImplicitAllowedTypes<U>
						: never
					: never;

/**
 * Extracts the TypeScript type for a field, always producing a readonly type.
 *
 * @typeParam T - An implicit field schema type.
 *
 * @remarks
 * This is used by {@link ReadonlyObjectFromFields} to ensure that nested
 * object fields are also readonly, providing deep immutability for constObject schemas.
 *
 * @alpha @legacy
 */
export type ReadonlyTypeFromField<T extends ImplicitFieldSchema> =
	NormalizeFieldSchema<T> extends {
		kind: infer K;
		allowedTypes: infer A;
	}
		? A extends ImplicitAllowedTypes
			? K extends typeof FieldKind.Optional
				? ReadonlyTypeFromImplicitAllowedTypes<A> | undefined
				: ReadonlyTypeFromImplicitAllowedTypes<A>
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
 * @alpha @legacy
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
 * Constructs a deeply readonly object type from a record of field schemas.
 *
 * @typeParam TFields - A record mapping field names to their schemas.
 *
 * @remarks
 * This type produces objects where all properties are readonly. It is used
 * for nested object values in flat storage DDSes like SharedMap, where
 * modifying nested properties requires replacing the entire parent object.
 *
 * Users must replace entire nested objects rather than mutating individual
 * fields, which accurately reflects the underlying storage semantics:
 *
 * ```typescript
 * // ❌ Not allowed - nested properties are readonly
 * view.root.address.city = "Seattle";
 *
 * // ✅ Allowed - replace the entire nested object
 * view.root.address = { ...view.root.address, city: "Seattle" };
 * ```
 *
 * @alpha @legacy
 */
export type ReadonlyObjectFromFields<TFields extends ObjectSchemaFields> = {
	readonly [K in keyof TFields as NormalizeFieldSchema<
		TFields[K]
	>["kind"] extends typeof FieldKind.Required
		? K
		: never]: ReadonlyTypeFromField<TFields[K]>;
} & {
	readonly [K in keyof TFields as NormalizeFieldSchema<
		TFields[K]
	>["kind"] extends typeof FieldKind.Optional
		? K
		: never]?: ReadonlyTypeFromField<TFields[K]>;
};

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
 * @alpha @legacy
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
	: T extends TypedConstObjectNodeSchema<string, infer TFields>
		? ReadonlyObjectFromFields<TFields>
		: T extends TypedObjectNodeSchema<string, infer TFields>
			? ObjectFromFields<TFields>
			: T extends TypedMapNodeSchema<string, infer TValueSchema>
				? TypeFromImplicitAllowedTypes<TValueSchema>
				: T extends SchemaClassConstructor<infer TFields extends ObjectSchemaFields>
					? ObjectFromFields<TFields>
					: // Extract from the info property (for class inheritance support)
						T extends { readonly info: infer TFields }
						? TFields extends ObjectSchemaFields
							? ObjectFromFields<TFields>
							: never
						: never;

// #endregion

// #region Field and Value Schema Extraction

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
 * @internal
 */
export type InferValueSchema<T> = T extends TypedMapNodeSchema<string, infer TValueSchema>
	? TValueSchema
	: never;

/**
 * Extracts the TypeScript value type from a {@link TypedMapNodeSchema}.
 *
 * @typeParam T - A typed map node schema.
 *
 * @remarks
 * Unlike {@link InferValueSchema} which returns the schema type, this utility
 * returns the actual TypeScript type that values in the map will have at runtime.
 *
 * @example
 * ```typescript
 * const sf = new SchemaFactory("myApp");
 *
 * const UserSchema = sf.object("User", { name: sf.string });
 * const UsersMap = sf.map("Users", UserSchema);
 *
 * // Extracts the actual value type (not the schema)
 * type ValueType = InferMapValueType<typeof UsersMap>;
 * // Results in: { name: string }
 *
 * const StringMap = sf.map("Config", sf.string);
 * type StringValueType = InferMapValueType<typeof StringMap>;
 * // Results in: string
 * ```
 * @legacy
 * @alpha
 */
export type InferMapValueType<T> = T extends TypedMapNodeSchema<string, infer TValueSchema>
	? TValueSchema extends ImplicitAllowedTypes
		? TypeFromImplicitAllowedTypes<TValueSchema>
		: never
	: never;

// #endregion
