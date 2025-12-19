/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/**
 * Schema factory for creating schema definitions.
 *
 * This module provides a factory class for creating type-safe schema definitions
 * that can be used across Fluid Framework DDSes.
 */

import type { IFluidHandle } from "@fluidframework/core-interfaces";

import {
	FieldKind,
	NodeKind,
	type FieldSchema,
	type MapNodeSchema,
	type ObjectNodeSchema,
	type LeafKind,
} from "../core/index.js";

import {
	type TypedLeafNodeSchema,
	stringSchema,
	numberSchema,
	booleanSchema,
	nullSchema,
	handleSchema,
} from "./leafSchemas.js";

// Re-export TypedLeafNodeSchema from leafSchemas
export type { TypedLeafNodeSchema } from "./leafSchemas.js";

// #region Scoped Schema Name

/**
 * The name of a schema produced by {@link SchemaFactory}, including its scope prefix.
 *
 * @remarks
 * The scope is prepended to the schema name with a "." separator.
 * @legacy
 * @alpha
 */
export type ScopedSchemaName<
	TScope extends string,
	TName extends string | number,
> = `${TScope}.${TName}`;

// #endregion

// #region Typed Schema Interfaces

/**
 * A typed field schema that preserves the allowed types and field kind.
 *
 * @typeParam TKind - The kind of field (Required or Optional).
 * @typeParam TAllowedTypes - The schema(s) allowed as values in this field.
 *
 * @remarks
 * This extends the base FieldSchema with additional type information
 * needed for type inference.
 * @legacy
 * @alpha
 */
export interface TypedFieldSchema<
	TKind extends FieldKind = FieldKind,
	TAllowedTypes extends ImplicitAllowedTypes = ImplicitAllowedTypes,
> extends FieldSchema {
	readonly kind: TKind;
	/**
	 * Phantom property used for type inference only.
	 * @remarks
	 * This property does not exist at runtime. It is used to preserve
	 * the allowed types associated with this field schema.
	 */
	readonly _typeInfo?: {
		readonly allowedTypes: TAllowedTypes;
	};
}

/**
 * A typed object node schema that preserves the field structure.
 *
 * @typeParam TIdentifier - The unique identifier for this schema.
 * @typeParam TFields - A record type mapping field names to their schemas.
 *
 * @remarks
 * This extends the base ObjectNodeSchema with additional type information
 * needed for type inference.
 * @legacy
 * @alpha
 */
export interface TypedObjectNodeSchema<
	TIdentifier extends string = string,
	TFields extends ObjectSchemaFields = ObjectSchemaFields,
> extends ObjectNodeSchema {
	readonly identifier: TIdentifier;
	readonly kind: typeof NodeKind.Object;
	/**
	 * Phantom property used for type inference only.
	 * @remarks
	 * This property does not exist at runtime. It is used to preserve
	 * the field structure associated with this object schema.
	 */
	readonly _typeInfo?: {
		readonly fields: TFields;
	};
}

/**
 * A typed map node schema that preserves the value schema type.
 *
 * @typeParam TIdentifier - The unique identifier for this schema.
 * @typeParam TValueSchema - The schema for values stored in the map.
 *
 * @remarks
 * This extends the base MapNodeSchema with additional type information
 * needed for type inference.
 * @legacy
 * @alpha
 */
export interface TypedMapNodeSchema<
	TIdentifier extends string = string,
	TValueSchema extends ImplicitAllowedTypes = ImplicitAllowedTypes,
> extends MapNodeSchema {
	readonly identifier: TIdentifier;
	readonly kind: typeof NodeKind.Map;
	/**
	 * Phantom property used for type inference only.
	 * @remarks
	 * This property does not exist at runtime. It is used to preserve
	 * the value schema associated with this map schema.
	 */
	readonly _typeInfo?: {
		readonly valueSchema: TValueSchema;
	};
}

// #endregion

// #region Implicit Types

/**
 * Types that can be implicitly used as allowed types in a field.
 *
 * @remarks
 * This includes individual typed leaf schemas, typed object schemas, typed map schemas,
 * or an array of such types for union fields.
 * @legacy
 * @alpha
 */
export type ImplicitAllowedTypes =
	| TypedLeafNodeSchema
	| TypedObjectNodeSchema
	| TypedMapNodeSchema
	| readonly (TypedLeafNodeSchema | TypedObjectNodeSchema | TypedMapNodeSchema)[];

/**
 * Types that can be implicitly used as a field schema.
 *
 * @remarks
 * A field can be specified either as a {@link TypedFieldSchema} or as an
 * {@link ImplicitAllowedTypes}, in which case it is treated as a required field.
 * @legacy
 * @alpha
 */
export type ImplicitFieldSchema = TypedFieldSchema | ImplicitAllowedTypes;

/**
 * A record of field names to their implicit field schemas.
 * @legacy
 * @alpha
 */
export type ObjectSchemaFields = Record<string, ImplicitFieldSchema>;

// #endregion

// #region Type Inference Utilities

/**
 * Extracts the TypeScript value type from a typed leaf node schema.
 */
type ValueFromLeafSchema<T extends TypedLeafNodeSchema> = T extends TypedLeafNodeSchema<
	string,
	LeafKind,
	infer TValue
>
	? TValue
	: never;

/**
 * Extracts the TypeScript type from an implicit allowed types specification.
 */
type TypeFromImplicitAllowedTypes<T extends ImplicitAllowedTypes> =
	T extends TypedLeafNodeSchema
		? ValueFromLeafSchema<T>
		: T extends TypedObjectNodeSchema<string, infer TFields>
			? ObjectFromFields<TFields>
			: T extends TypedMapNodeSchema<string, infer TValueSchema>
				? Map<string, TypeFromImplicitAllowedTypes<TValueSchema>>
				: T extends readonly (infer U)[]
					? U extends TypedLeafNodeSchema | TypedObjectNodeSchema | TypedMapNodeSchema
						? TypeFromImplicitAllowedTypes<U>
						: never
					: never;

/**
 * Normalizes an implicit field schema to extract its field kind and allowed types.
 */
type NormalizeFieldSchema<T extends ImplicitFieldSchema> = T extends TypedFieldSchema<
	infer TKind,
	infer TAllowedTypes
>
	? { kind: TKind; allowedTypes: TAllowedTypes }
	: { kind: typeof FieldKind.Required; allowedTypes: T };

/**
 * Extracts the TypeScript type for a field based on its schema.
 */
type TypeFromField<T extends ImplicitFieldSchema> = NormalizeFieldSchema<T> extends {
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
 * @remarks
 * This type utility separates required and optional fields to produce
 * a properly typed object interface.
 */
type ObjectFromFields<TFields extends ObjectSchemaFields> = {
	[K in keyof TFields as NormalizeFieldSchema<
		TFields[K]
	>["kind"] extends typeof FieldKind.Required
		? K
		: never]: TypeFromField<TFields[K]>;
} & {
	[K in keyof TFields as NormalizeFieldSchema<
		TFields[K]
	>["kind"] extends typeof FieldKind.Optional
		? K
		: never]?: TypeFromField<TFields[K]>;
};

/**
 * Infers the TypeScript type that a node of the given schema would have.
 *
 * @typeParam T - The schema type to infer a node type from.
 *
 * @remarks
 * This utility type is the primary way to get TypeScript types from schema definitions.
 *
 * @example
 * ```typescript
 * const sf = new SchemaFactory("myApp");
 * const UserSchema = sf.object("User", {
 *   name: sf.string,
 *   age: sf.number,
 *   email: sf.optional(sf.string),
 * });
 *
 * // Infers: { name: string; age: number; email?: string }
 * type User = NodeFromSchema<typeof UserSchema>;
 * ```
 */
export type NodeFromSchema<T> = T extends TypedLeafNodeSchema
	? ValueFromLeafSchema<T>
	: T extends TypedObjectNodeSchema<string, infer TFields>
		? ObjectFromFields<TFields>
		: T extends TypedMapNodeSchema<string, infer TValueSchema>
			? Map<string, TypeFromImplicitAllowedTypes<TValueSchema>>
			: never;

// #endregion

// #region Helper Functions

/**
 * Brands a value with a phantom type for type inference.
 *
 * @remarks
 * This function is used to add compile-time type information to schema objects
 * without modifying their runtime structure. The phantom type pattern allows
 * TypeScript to infer rich types from schema definitions while keeping the
 * runtime objects simple.
 *
 * @param value - The runtime value to brand
 * @returns The same value, typed as the branded type
 */
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Intentional phantom type branding pattern for type inference
function brandWithPhantomType<T>(value: unknown): T {
	return value as T;
}

/**
 * Extracts the schema identifier from an implicit allowed type.
 */
function getSchemaIdentifier(
	schema: TypedLeafNodeSchema | TypedObjectNodeSchema | TypedMapNodeSchema,
): string {
	return schema.identifier;
}

/**
 * Normalizes allowed types to an array of schema identifiers.
 */
function normalizeAllowedTypes(allowedTypes: ImplicitAllowedTypes): readonly string[] {
	if (Array.isArray(allowedTypes)) {
		return (
			allowedTypes as readonly (
				| TypedLeafNodeSchema
				| TypedObjectNodeSchema
				| TypedMapNodeSchema
			)[]
		).map((schema) => getSchemaIdentifier(schema));
	}
	return [
		getSchemaIdentifier(
			allowedTypes as TypedLeafNodeSchema | TypedObjectNodeSchema | TypedMapNodeSchema,
		),
	];
}

/**
 * Normalizes an implicit field schema to a FieldSchema object.
 */
function normalizeFieldSchema(fieldSchema: ImplicitFieldSchema): FieldSchema {
	if (isTypedFieldSchema(fieldSchema)) {
		// For TypedFieldSchema, the allowedTypes are already normalized at runtime
		// (set by the optional() and required() methods)
		return {
			kind: fieldSchema.kind,
			allowedTypes: fieldSchema.allowedTypes,
		};
	}
	// Treat as required field with the given allowed types
	return {
		kind: FieldKind.Required,
		allowedTypes: normalizeAllowedTypes(fieldSchema),
	};
}

/**
 * Type guard to check if a value is a TypedFieldSchema.
 */
function isTypedFieldSchema(value: ImplicitFieldSchema): value is TypedFieldSchema {
	return (
		typeof value === "object" &&
		value !== null &&
		"kind" in value &&
		(value.kind === FieldKind.Required || value.kind === FieldKind.Optional) &&
		"allowedTypes" in value
	);
}

// #endregion

// #region SchemaFactory

/**
 * Factory class for creating type-safe schema definitions.
 *
 * @typeParam TScope - The scope string that will prefix all schema identifiers.
 *
 * @remarks
 * SchemaFactory provides methods for defining object, map, and field schemas
 * that can be used to describe the structure of data in Fluid Framework DDSes.
 *
 * All schemas created by a factory instance have identifiers prefixed with the
 * factory's scope. This helps prevent naming collisions when combining schemas
 * from different sources.
 *
 * @example
 * ```typescript
 * const sf = new SchemaFactory("myApp");
 *
 * // Leaf types are accessed as properties
 * sf.string  // TypedLeafNodeSchema for strings
 * sf.number  // TypedLeafNodeSchema for numbers
 *
 * // Object schema creation
 * const UserSchema = sf.object("User", {
 *   name: sf.string,
 *   age: sf.number,
 *   email: sf.optional(sf.string),
 * });
 * // UserSchema.identifier === "myApp.User"
 *
 * // Map schema creation
 * const UserMap = sf.map("Users", UserSchema);
 * // UserMap.identifier === "myApp.Users"
 *
 * // Type inference
 * type User = NodeFromSchema<typeof UserSchema>;
 * // User is { name: string; age: number; email?: string }
 * ```
 * @legacy
 * @alpha
 */
export class SchemaFactory<TScope extends string = string> {
	/**
	 * Creates a new SchemaFactory instance.
	 *
	 * @param scope - A unique scope identifier that will be prefixed to all schema
	 * identifiers created by this factory. Use reverse domain notation
	 * (e.g., "com.example.myapp") to avoid collisions.
	 *
	 * @example
	 * ```typescript
	 * const sf = new SchemaFactory("com.example.myapp");
	 * ```
	 */
	public constructor(
		/**
		 * Prefix appended to the identifiers of all schemas produced by this factory.
		 *
		 * @remarks
		 * Generally each independently developed library should get its own unique scope.
		 * The scope and name are joined with a period to form the schema identifier.
		 * Following this pattern allows a single application to depend on multiple libraries
		 * which define their own schema, and use them together without risk of collisions.
		 *
		 * To avoid collisions between the scopes of libraries, it is recommended that
		 * libraries use {@link https://en.wikipedia.org/wiki/Reverse_domain_name_notation | reverse domain name notation}
		 * or a UUIDv4 for their scope.
		 */
		public readonly scope: TScope,
	) {}

	/**
	 * Schema for string leaf values.
	 *
	 * @remarks
	 * Strings containing unpaired UTF-16 surrogate pair code units may not be
	 * handled correctly due to UTF-8 encoding requirements.
	 */
	public get string(): TypedLeafNodeSchema<
		"com.fluidframework.leaf.string",
		"string",
		string
	> {
		return stringSchema;
	}

	/**
	 * Schema for number leaf values.
	 *
	 * @remarks
	 * Numbers are stored as double-precision 64-bit IEEE 754 values.
	 * NaN and infinities are converted to null, and -0 may be converted to 0.
	 */
	public get number(): TypedLeafNodeSchema<
		"com.fluidframework.leaf.number",
		"number",
		number
	> {
		return numberSchema;
	}

	/**
	 * Schema for boolean leaf values.
	 */
	public get boolean(): TypedLeafNodeSchema<
		"com.fluidframework.leaf.boolean",
		"boolean",
		boolean
	> {
		return booleanSchema;
	}

	/**
	 * Schema for null leaf values.
	 *
	 * @remarks
	 * Consider using optional fields or a named empty object instead of null
	 * when possible, unless interoperating with existing data that uses null.
	 */
	// eslint-disable-next-line @rushstack/no-new-null
	public get null(): TypedLeafNodeSchema<"com.fluidframework.leaf.null", "null", null> {
		return nullSchema;
	}

	/**
	 * Schema for Fluid handle leaf values.
	 *
	 * @remarks
	 * Fluid handles are references to other Fluid objects and are used
	 * for cross-referencing between data structures.
	 */
	public get handle(): TypedLeafNodeSchema<
		"com.fluidframework.leaf.handle",
		"handle",
		IFluidHandle
	> {
		return handleSchema;
	}

	/**
	 * Creates an object node schema with the given name and fields.
	 *
	 * @param name - The name for this schema, which will be combined with the scope
	 * to form the full identifier.
	 * @param fields - A record mapping field names to their schemas.
	 *
	 * @returns A typed object node schema that can be used for type inference.
	 *
	 * @example
	 * ```typescript
	 * const sf = new SchemaFactory("myApp");
	 *
	 * const PersonSchema = sf.object("Person", {
	 *   name: sf.string,
	 *   age: sf.number,
	 *   email: sf.optional(sf.string),
	 * });
	 *
	 * // PersonSchema.identifier === "myApp.Person"
	 * // NodeFromSchema<typeof PersonSchema> === { name: string; age: number; email?: string }
	 * ```
	 */
	public object<const TName extends string, const TFields extends ObjectSchemaFields>(
		name: TName,
		fields: TFields,
	): TypedObjectNodeSchema<ScopedSchemaName<TScope, TName>, TFields> {
		const identifier = `${this.scope}.${name}`;

		// Convert fields to the runtime FieldSchema format
		const normalizedFields: Record<string, FieldSchema> = {};
		for (const [fieldName, fieldSchema] of Object.entries(fields)) {
			normalizedFields[fieldName] = normalizeFieldSchema(fieldSchema);
		}

		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Phantom type pattern for type inference
		return {
			identifier,
			kind: NodeKind.Object,
			fields: normalizedFields,
			// The _typeInfo is a phantom property for type inference only
			// It's typed but not assigned at runtime
		} as TypedObjectNodeSchema<ScopedSchemaName<TScope, TName>, TFields>;
	}

	/**
	 * Creates a map node schema with the given name and value schema.
	 *
	 * @param name - The name for this schema, which will be combined with the scope
	 * to form the full identifier.
	 * @param valueSchema - The schema that values in the map must conform to.
	 *
	 * @returns A typed map node schema that can be used for type inference.
	 *
	 * @example
	 * ```typescript
	 * const sf = new SchemaFactory("myApp");
	 *
	 * // Simple map with string values
	 * const StringMap = sf.map("StringMap", sf.string);
	 *
	 * // Map with object values
	 * const PersonSchema = sf.object("Person", { name: sf.string });
	 * const PeopleMap = sf.map("People", PersonSchema);
	 *
	 * // PeopleMap.identifier === "myApp.People"
	 * ```
	 */
	public map<const TName extends string, const TValueSchema extends ImplicitAllowedTypes>(
		name: TName,
		valueSchema: TValueSchema,
	): TypedMapNodeSchema<ScopedSchemaName<TScope, TName>, TValueSchema> {
		const identifier = `${this.scope}.${name}`;

		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Phantom type pattern for type inference
		return {
			identifier,
			kind: NodeKind.Map,
			allowedTypes: normalizeAllowedTypes(valueSchema),
			// The _typeInfo is a phantom property for type inference only
		} as TypedMapNodeSchema<ScopedSchemaName<TScope, TName>, TValueSchema>;
	}

	/**
	 * Creates an optional field schema.
	 *
	 * @param allowedTypes - The schema(s) that values in this field must conform to.
	 *
	 * @returns A typed field schema marked as optional.
	 *
	 * @remarks
	 * Optional fields may be omitted or set to undefined. When inferring types,
	 * optional fields become optional properties on the resulting object type.
	 *
	 * @example
	 * ```typescript
	 * const sf = new SchemaFactory("myApp");
	 *
	 * const PersonSchema = sf.object("Person", {
	 *   name: sf.string,              // Required field
	 *   nickname: sf.optional(sf.string),  // Optional field
	 * });
	 *
	 * // NodeFromSchema<typeof PersonSchema> === { name: string; nickname?: string }
	 * ```
	 */
	public optional<const T extends ImplicitAllowedTypes>(
		allowedTypes: T,
	): TypedFieldSchema<typeof FieldKind.Optional, T> {
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Phantom type pattern for type inference
		return {
			kind: FieldKind.Optional,
			allowedTypes: normalizeAllowedTypes(allowedTypes),
			// The _typeInfo is a phantom property for type inference only
		} as TypedFieldSchema<typeof FieldKind.Optional, T>;
	}

	/**
	 * Creates a required field schema.
	 *
	 * @param allowedTypes - The schema(s) that values in this field must conform to.
	 *
	 * @returns A typed field schema marked as required.
	 *
	 * @remarks
	 * Fields are required by default when specified as just a schema type (without
	 * wrapping in `required()`). This method is useful when you want to explicitly
	 * mark a field as required for clarity, or when you need the field schema object
	 * for other purposes.
	 *
	 * @example
	 * ```typescript
	 * const sf = new SchemaFactory("myApp");
	 *
	 * // These are equivalent:
	 * const Schema1 = sf.object("S1", { name: sf.string });
	 * const Schema2 = sf.object("S2", { name: sf.required(sf.string) });
	 * ```
	 */
	public required<const T extends ImplicitAllowedTypes>(
		allowedTypes: T,
	): TypedFieldSchema<typeof FieldKind.Required, T> {
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Phantom type pattern for type inference
		return {
			kind: FieldKind.Required,
			allowedTypes: normalizeAllowedTypes(allowedTypes),
			// The _typeInfo is a phantom property for type inference only
		} as TypedFieldSchema<typeof FieldKind.Required, T>;
	}
}

// #endregion
