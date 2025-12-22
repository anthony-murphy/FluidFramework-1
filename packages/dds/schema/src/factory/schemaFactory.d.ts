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
import type { FieldSchema, MapNodeSchema, ObjectNodeSchema } from "../core/index.js";
import type { FieldKind, NodeKind } from "../core/index.js";
import type { TypedLeafNodeSchema } from "./leafSchemas.js";
import type { SchemaClassConstructor } from "./schemaObjectBase.js";
export type { TypedLeafNodeSchema } from "./leafSchemas.js";
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
/**
 * Properties that can be associated with a field in a schema.
 *
 * @remarks
 * Field props allow specifying additional metadata and configuration for fields,
 * such as a storage key override or descriptive metadata.
 * @legacy
 * @alpha
 */
export interface FieldProps {
	/**
	 * Storage key override.
	 *
	 * @remarks
	 * If specified, this key is used for storage instead of the field name.
	 * This is useful when renaming fields while maintaining backward compatibility
	 * with existing stored data.
	 */
	key?: string;
	/**
	 * Metadata for the field.
	 *
	 * @remarks
	 * Optional metadata that can be used for documentation, tooling, or runtime introspection.
	 */
	metadata?: {
		/**
		 * Human-readable description of the field.
		 */
		description?: string;
		/**
		 * Custom metadata for application-specific purposes.
		 */
		custom?: unknown;
	};
}
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
	 * Optional properties associated with this field.
	 *
	 * @remarks
	 * Props can include storage key overrides and metadata.
	 */
	readonly props?: FieldProps;
	/**
	 * Type information for inference.
	 * @remarks
	 * This property stores the allowed types with type information,
	 * enabling TypeScript to infer the correct type when using this field.
	 */
	readonly info: TAllowedTypes;
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
 *
 * Unlike phantom types, the `info` property is real and inherited when subclassing,
 * allowing `class MySchema extends sf.object(...)` patterns to work correctly.
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
	 * Type information for inference.
	 * @remarks
	 * This property stores the original field definitions with their type information,
	 * enabling TypeScript to infer the correct types when using `NodeFromSchema`.
	 * This is a real property (not phantom) so it's properly inherited by subclasses.
	 */
	readonly info: TFields;
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
 *
 * Unlike phantom types, the `info` property is real and inherited when subclassing,
 * allowing `class MyMap extends sf.map(...)` patterns to work correctly.
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
	 * Type information for inference.
	 * @remarks
	 * This property stores the value schema with type information,
	 * enabling TypeScript to infer the correct value type when using `NodeFromSchema`.
	 * This is a real property (not phantom) so it's properly inherited by subclasses.
	 */
	readonly info: TValueSchema;
}
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
export declare class SchemaFactory<TScope extends string = string> {
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
	public readonly scope: TScope;
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
		scope: TScope,
	);
	/**
	 * Schema for string leaf values.
	 *
	 * @remarks
	 * Strings containing unpaired UTF-16 surrogate pair code units may not be
	 * handled correctly due to UTF-8 encoding requirements.
	 */
	public get string(): TypedLeafNodeSchema<"com.fluidframework.leaf.string", "string", string>;
	/**
	 * Schema for number leaf values.
	 *
	 * @remarks
	 * Numbers are stored as double-precision 64-bit IEEE 754 values.
	 * NaN and infinities are converted to null, and -0 may be converted to 0.
	 */
	public get number(): TypedLeafNodeSchema<"com.fluidframework.leaf.number", "number", number>;
	/**
	 * Schema for boolean leaf values.
	 */
	public get boolean(): TypedLeafNodeSchema<
		"com.fluidframework.leaf.boolean",
		"boolean",
		boolean
	>;
	/**
	 * Schema for null leaf values.
	 *
	 * @remarks
	 * Consider using optional fields or a named empty object instead of null
	 * when possible, unless interoperating with existing data that uses null.
	 */
	// eslint-disable-next-line @rushstack/no-new-null -- This getter returns the null type schema
	public get null(): TypedLeafNodeSchema<"com.fluidframework.leaf.null", "null", null>;
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
	>;
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
	 *
	 * // Custom methods via subclassing:
	 * class Person extends sf.object("Person", { name: sf.string, age: sf.number }) {
	 *   get displayName() {
	 *     return `${this.name} (${this.age})`;
	 *   }
	 * }
	 * ```
	 */
	public object<const TName extends string, const TFields extends ObjectSchemaFields>(
		name: TName,
		fields: TFields,
	): TypedObjectNodeSchema<ScopedSchemaName<TScope, TName>, TFields> &
		SchemaClassConstructor<TFields>;
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
	): TypedMapNodeSchema<ScopedSchemaName<TScope, TName>, TValueSchema>;
	/**
	 * Creates an optional field schema.
	 *
	 * @param allowedTypes - The schema(s) that values in this field must conform to.
	 * @param props - Optional properties for the field, such as storage key override or metadata.
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
	 *   // Field with props:
	 *   email: sf.optional(sf.string, { key: "emailAddress", metadata: { description: "User email" } }),
	 * });
	 *
	 * // NodeFromSchema<typeof PersonSchema> === { name: string; nickname?: string; email?: string }
	 * ```
	 */
	public optional<const T extends ImplicitAllowedTypes>(
		allowedTypes: T,
		props?: FieldProps,
	): TypedFieldSchema<typeof FieldKind.Optional, T>;
	/**
	 * Creates a required field schema.
	 *
	 * @param allowedTypes - The schema(s) that values in this field must conform to.
	 * @param props - Optional properties for the field, such as storage key override or metadata.
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
	 *
	 * // With props:
	 * const Schema3 = sf.object("S3", {
	 *   name: sf.required(sf.string, { key: "userName", metadata: { description: "User name" } }),
	 * });
	 * ```
	 */
	public required<const T extends ImplicitAllowedTypes>(
		allowedTypes: T,
		props?: FieldProps,
	): TypedFieldSchema<typeof FieldKind.Required, T>;
}
