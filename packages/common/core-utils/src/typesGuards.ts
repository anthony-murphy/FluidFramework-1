/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/**
 * Determines if an arbitrary  value is an object
 * @param value - The value to check to see if it is an object
 * @returns True if the passed value is an object
 *
 * @internal
 */
export const isObject = (value: unknown): value is object =>
	typeof value === "object" && value !== null;

/**
 * Determines if an arbitrary value is a promise
 * @param value - The value to check to see if it is a promise
 * @returns True if the passed value is a promise
 *
 * @internal
 */
export const isPromiseLike = (value: unknown): value is PromiseLike<unknown> =>
	isObject(value) && "then" in value && typeof value.then === "function";

/**
 * A mapping interface that associates string literal types with their corresponding TypeScript types.
 * Used for type checking and validation in type guard functions.
 *
 * @internal
 */
export interface StringToType {
	"string": string;
	"number": number;
	"object": object;
	"array": unknown[];
	"boolean": boolean;
}

/**
 * Type guard that checks if an unknown value is an object with a specific property that equals a specific value.
 * @param thing - The value to check
 * @param prop - The property name to check for
 * @param value - The expected value of the property
 * @returns True if the value is an object with the specified property that equals the specified value
 *
 * @internal
 */
export function propIsValue<P extends string | number | symbol, V>(
	thing: unknown,
	prop: P,
	value: V,
): thing is Record<P, V> {
	return propExists(thing, prop) && thing[prop] === value;
}

/**
 * Type guard that checks if an unknown value is an object and has a specific property.
 * @param thing - The value to check
 * @param prop - The property name to check for
 * @returns True if the value is an object with the specified property
 *
 * @internal
 */
export function propExists<P extends string | number | symbol>(
	thing: unknown,
	prop: P,
): thing is Record<P, unknown> {
	return isObject(thing) && prop in thing;
}

/**
 * Type guard that checks if an unknown value is an object with a specific property of a specific type.
 * @param thing - The value to check
 * @param prop - The property name to check for
 * @param type - The expected type of the property (string literal from StringToType keys)
 * @returns True if the value is an object with the specified property of the specified type
 *
 * @internal
 */
export function hasProp<P extends string | number | symbol, T extends keyof StringToType>(
	thing: unknown,
	prop: P,
	type: T,
): thing is Record<P, StringToType[T]> {
	return (
		propExists(thing, prop) &&
		(type === "array" ? Array.isArray(thing[prop]) : typeof thing[prop] === type)
	);
}

/**
 * Type guard that checks if an unknown value is an object with a specific property that is an instance of a specific class.
 * @param thing - The value to check
 * @param prop - The property name to check for
 * @param type - The constructor function/class to check instanceof against
 * @returns True if the value is an object with the specified property that is an instance of the specified type
 *
 * @internal
 */
export function propInstanceOf<P extends string | number | symbol, T>(
	thing: unknown,
	prop: P,
	type: new (...args: any[]) => T,
): thing is Record<P, T> {
	return propExists(thing, prop) && thing[prop] instanceof type;
}

/**
 * A utility class for validating object properties in a fluent manner.
 * Provides chainable methods to validate that an unknown object has specific properties with expected types or values.
 *
 * @typeParam T - The expected shape of the object being validated
 * @typeParam B - The current validated shape of the object (starts as unknown, gets refined with each validation)
 *
 * @internal
 */
export class ObjectValidator<T, B> {
	/**
	 * Creates an ObjectValidator instance if the provided value is an object.
	 * @param obj - The unknown value to validate
	 * @returns An ObjectValidator instance if the value is an object, undefined otherwise
	 */
	public static from<T>(obj: unknown): ObjectValidator<T, unknown> | undefined {
		if (isObject(obj)) {
			return new ObjectValidator(obj);
		}
		return undefined;
	}

	private constructor(public readonly obj: B) {}

	/**
	 * Validates that a property exists and equals a specific value.
	 * @param prop - The property name to check
	 * @param value - The expected value of the property
	 * @returns A new ObjectValidator with refined type if validation succeeds, undefined otherwise
	 */
	public propIsValue<P extends keyof T>(
		prop: P,
		value: T[P],
	): ObjectValidator<T, B & Record<P, T[P]>> | undefined {
		if (propIsValue(this.obj, prop, value)) {
			return this as ObjectValidator<T, B & Record<P, T[P]>>;
		}
		return undefined;
	}

	/**
	 * Validates that a property exists and has a specific type, using the validated runtime type in the result.
	 *
	 * **Strong validation**: This method validates the runtime type and uses that exact type in the result type.
	 * Use this when you want the TypeScript type to reflect the validated runtime type, potentially narrowing
	 * from a union type to a specific type.
	 *
	 * @param prop - The property name to check
	 * @param type - The expected runtime type of the property
	 * @returns A new ObjectValidator with refined type if validation succeeds, undefined otherwise
	 */
	public hasProp<P extends Exclude<keyof T, keyof B>, I extends keyof StringToType>(
		prop: P,
		type: I,
	): ObjectValidator<T, B & Record<P, I>> | undefined {
		if (hasProp(this.obj, prop, type)) {
			return this as ObjectValidator<T, B & Record<P, I>>;
		}
		return undefined;
	}

	/**
	 * Validates that a property exists and is an instance of a specific class.
	 * @param prop - The property name to check
	 * @param type - The constructor function/class to check instanceof against
	 * @returns A new ObjectValidator with refined type if validation succeeds, undefined otherwise
	 */
	public propInstanceOf<P extends Exclude<keyof T, keyof B>>(
		prop: P,
		type: new (...args: any[]) => T[P],
	): ObjectValidator<T, B & Record<P, T[P]>> | undefined {
		if (propInstanceOf(this.obj, prop, type)) {
			return this as ObjectValidator<T, B & Record<P, T[P]>>;
		}
		return undefined;
	}

	/**
	 * Performs an unsafe cast of a property type without runtime validation.
	 * This method assumes the property has the correct type without checking it.
	 * Use with caution as it bypasses type safety.
	 *
	 * @param _prop - The property name to cast (parameter is not used but required for type inference)
	 * @returns A new ObjectValidator with the property type cast to the expected type
	 */
	public unsafeCast<P extends keyof B & keyof T>(
		_prop: P,
	): ObjectValidator<T, B & Record<P, T[P]>> {
		return this as ObjectValidator<T, B & Record<P, T[P]>>;
	}
}
