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

import { NodeKind, type FieldSchema } from "../core/index.js";

/**
 * Symbol used to identify schema classes.
 * @alpha @legacy
 */
export const isSchemaClass = Symbol("isSchemaClass");

/**
 * Static properties that all schema classes have.
 * @alpha @legacy
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
 * @alpha @legacy
 */
export interface SchemaFieldsBrand<TFields> {
	readonly __schemaFields?: TFields;
}

/**
 * A constructor type for schema classes.
 *
 * @typeParam TFields - The field definitions type, used for type inference.
 *
 * @alpha @legacy
 */
export interface SchemaClassConstructor<TFields = unknown> extends SchemaClassStatics {
	/**
	 * Type information for inference.
	 * @remarks
	 * This property stores the original field definitions with their type information.
	 *
	 * This property name aligns with `@fluidframework/tree` (SharedTree) for API consistency.
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
 * @internal
 */
export function isSchemaClassConstructor(value: unknown): value is SchemaClassConstructor {
	return (
		typeof value === "function" &&
		isSchemaClass in value &&
		(value as unknown as SchemaClassStatics)[isSchemaClass] === true
	);
}

/**
 * Creates a schema class with the given identifier and fields.
 *
 * @param identifier - The unique identifier for this schema
 * @param fields - The field definitions for this schema (runtime representation)
 * @param info - The original field definitions with type information (for TypeScript inference)
 * @returns A class that can be subclassed for custom methods
 *
 * @internal
 */
export function createSchemaClass<TFields>(
	identifier: string,
	fields: Readonly<Record<string, FieldSchema>>,
	info: TFields,
): SchemaClassConstructor & { readonly info: TFields } {
	// Create the class dynamically using an anonymous class.
	// This avoids eslint's no-extraneous-class error since the class has
	// static properties added after creation.
	// eslint-disable-next-line @typescript-eslint/no-extraneous-class
	const SchemaClass = class {} as unknown as SchemaClassConstructor & {
		readonly info: TFields;
	};

	// Define static properties
	Object.defineProperties(SchemaClass, {
		identifier: {
			value: identifier,
			writable: false,
			enumerable: true,
			configurable: false,
		},
		kind: {
			value: NodeKind.Object,
			writable: false,
			enumerable: true,
			configurable: false,
		},
		fields: {
			value: fields,
			writable: false,
			enumerable: true,
			configurable: false,
		},
		info: {
			value: info,
			writable: false,
			enumerable: true,
			configurable: false,
		},
		[isSchemaClass]: {
			value: true,
			writable: false,
			enumerable: false,
			configurable: false,
		},
	});

	// Freeze the fields object
	Object.freeze(fields);

	return SchemaClass;
}
