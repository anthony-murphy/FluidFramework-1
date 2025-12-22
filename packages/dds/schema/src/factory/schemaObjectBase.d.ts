/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */
/**
 * Base class for schema-backed object nodes.
 *
 * This module provides the base class that all object schemas extend,
 * enabling custom methods and getters on schema classes.
 */
import type { FieldSchema } from "../core/index.js";
import type { NodeKind } from "../core/index.js";
/**
 * Symbol used to identify schema classes.
 * @alpha
 */
export declare const isSchemaClass: unique symbol;
/**
 * Static properties that all schema classes have.
 * @alpha
 */
export interface SchemaClassStatics {
	/**
	 * The unique identifier for this schema.
	 */
	readonly identifier: string;
	/**
	 * The kind of node this schema represents.
	 */
	readonly kind: typeof NodeKind.Object;
	/**
	 * The field definitions for this schema.
	 */
	readonly fields: Readonly<Record<string, FieldSchema>>;
	/**
	 * Symbol to identify this as a schema class.
	 */
	readonly [isSchemaClass]: true;
}
/**
 * Phantom type brand for schema field information.
 * This is used to carry type information through class inheritance.
 * @alpha
 */
export interface SchemaFieldsBrand<TFields> {
	readonly __schemaFields?: TFields;
}
/**
 * A constructor type for schema classes.
 *
 * @typeParam TFields - The field definitions type, used for type inference.
 *
 * @alpha
 */
export interface SchemaClassConstructor<TFields = unknown> extends SchemaClassStatics {
	/**
	 * Type information for inference.
	 * @remarks
	 * This property stores the original field definitions with their type information.
	 */
	readonly info: TFields;
	/**
	 * Schema classes have a protected constructor - instances are created by the view.
	 * The return type includes a phantom brand that carries field type information.
	 */
	new (): object & SchemaFieldsBrand<TFields>;
	/**
	 * The prototype of the schema class.
	 */
	readonly prototype: object;
}
/**
 * Check if a value is a schema class constructor.
 * @alpha
 */
export declare function isSchemaClassConstructor(
	value: unknown,
): value is SchemaClassConstructor;
/**
 * Creates a schema class with the given identifier and fields.
 *
 * @param identifier - The unique identifier for this schema
 * @param fields - The field definitions for this schema (runtime representation)
 * @param info - The original field definitions with type information (for TypeScript inference)
 * @returns A class that can be subclassed for custom methods
 *
 * @alpha
 */
export declare function createSchemaClass<TFields>(
	identifier: string,
	fields: Readonly<Record<string, FieldSchema>>,
	info: TFields,
): SchemaClassConstructor & {
	readonly info: TFields;
};
