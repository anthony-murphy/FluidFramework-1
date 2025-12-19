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
 * @alpha
 */
export const isSchemaClass = Symbol("isSchemaClass");

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
 * A constructor type for schema classes.
 * @alpha
 */
export interface SchemaClassConstructor extends SchemaClassStatics {
	/**
	 * Schema classes have a protected constructor - instances are created by the view.
	 */
	new (): object;

	/**
	 * The prototype of the schema class.
	 */
	readonly prototype: object;
}

/**
 * Check if a value is a schema class constructor.
 * @alpha
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
 * @param fields - The field definitions for this schema
 * @returns A class that can be subclassed for custom methods
 *
 * @alpha
 */
export function createSchemaClass(
	identifier: string,
	fields: Readonly<Record<string, FieldSchema>>,
): SchemaClassConstructor {
	// Create the class dynamically using an anonymous class.
	// This avoids eslint's no-extraneous-class error since the class has
	// static properties added after creation.
	// eslint-disable-next-line @typescript-eslint/no-extraneous-class
	const SchemaClass = class {} as unknown as SchemaClassConstructor;

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
