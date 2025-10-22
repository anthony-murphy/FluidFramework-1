/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { strict } from "node:assert";

import {
	isObject,
	isPromiseLike,
	propIsValue,
	propExists,
	hasProp,
	propInstanceOf,
	ObjectValidator,
} from "../typesGuards.js";

describe("typesGuards", () => {
	describe("isObject", () => {
		it("should return true for objects", () => {
			strict.strictEqual(isObject({}), true);
			strict.strictEqual(isObject({ a: 1 }), true);
			strict.strictEqual(isObject([]), true);
			strict.strictEqual(isObject(new Date()), true);
			strict.strictEqual(isObject(new Error("test")), true);
		});

		it("should return false for null", () => {
			strict.strictEqual(isObject(undefined), false);
		});

		it("should return false for primitives", () => {
			strict.strictEqual(isObject(undefined), false);
			strict.strictEqual(isObject("string"), false);
			strict.strictEqual(isObject(42), false);
			strict.strictEqual(isObject(true), false);
			strict.strictEqual(isObject(false), false);
			strict.strictEqual(isObject(Symbol("test")), false);
		});

		it("should return false for functions", () => {
			strict.strictEqual(
				isObject(() => {}),
				false,
			);
			const namedFunction = function namedFn(): void {};
			strict.strictEqual(isObject(namedFunction), false);
		});
	});

	describe("isPromiseLike", () => {
		it("should return true for Promise instances", () => {
			strict.strictEqual(isPromiseLike(Promise.resolve()), true);
			strict.strictEqual(
				isPromiseLike(Promise.reject(new Error("test")).catch(() => {})),
				true,
			);
		});

		it("should return true for thenable objects", () => {
			// Test objects that implement thenable interface for Promise compatibility
			// eslint-disable-next-line @typescript-eslint/ban-types, unicorn/no-thenable
			const thenable: object = { then: (): void => {} };
			strict.strictEqual(isPromiseLike(thenable), true);

			// eslint-disable-next-line @typescript-eslint/ban-types, unicorn/no-thenable
			const thenable2: object = { then(): void {} };
			strict.strictEqual(isPromiseLike(thenable2), true);
		});

		it("should return false for objects without then method", () => {
			strict.strictEqual(isPromiseLike({}), false);
			// Test objects with invalid then properties
			// eslint-disable-next-line @typescript-eslint/ban-types, unicorn/no-thenable
			const invalidThenable1: object = { then: "not a function" };
			strict.strictEqual(isPromiseLike(invalidThenable1), false);
			// eslint-disable-next-line @typescript-eslint/ban-types, unicorn/no-thenable
			const invalidThenable2: object = { then: 42 };
			strict.strictEqual(isPromiseLike(invalidThenable2), false);
		});

		it("should return false for non-objects", () => {
			strict.strictEqual(isPromiseLike(undefined), false);
			strict.strictEqual(isPromiseLike(undefined), false);
			strict.strictEqual(isPromiseLike("string"), false);
			strict.strictEqual(isPromiseLike(42), false);
		});
	});

	describe("propExists", () => {
		it("should return true when property exists", () => {
			const obj = { a: 1, b: "test", c: undefined };
			strict.strictEqual(propExists(obj, "a"), true);
			strict.strictEqual(propExists(obj, "b"), true);
			strict.strictEqual(propExists(obj, "c"), true);
		});

		it("should return false when property does not exist", () => {
			const obj = { a: 1 };
			strict.strictEqual(propExists(obj, "b"), false);
			strict.strictEqual(propExists(obj, "nonexistent"), false);
		});

		it("should work with symbol properties", () => {
			const sym = Symbol("test");
			const obj = { [sym]: "value" };
			strict.strictEqual(propExists(obj, sym), true);
		});

		it("should work with numeric properties", () => {
			const obj = { 0: "zero", 42: "forty-two" };
			strict.strictEqual(propExists(obj, 0), true);
			strict.strictEqual(propExists(obj, 42), true);
			strict.strictEqual(propExists(obj, 1), false);
		});

		it("should return false for non-objects", () => {
			strict.strictEqual(propExists(undefined, "prop"), false);
			strict.strictEqual(propExists(undefined, "prop"), false);
			strict.strictEqual(propExists("string", "prop"), false);
			strict.strictEqual(propExists(42, "prop"), false);
		});
	});

	describe("propIsValue", () => {
		it("should return true when property has the expected value", () => {
			const obj = { a: 1, b: "test", c: true, d: undefined };
			strict.strictEqual(propIsValue(obj, "a", 1), true);
			strict.strictEqual(propIsValue(obj, "b", "test"), true);
			strict.strictEqual(propIsValue(obj, "c", true), true);
			strict.strictEqual(propIsValue(obj, "d", undefined), true);
		});

		it("should return false when property has different value", () => {
			const obj = { a: 1, b: "test" };
			strict.strictEqual(propIsValue(obj, "a", 2), false);
			strict.strictEqual(propIsValue(obj, "b", "other"), false);
		});

		it("should return false when property does not exist", () => {
			const obj = { a: 1 };
			strict.strictEqual(propIsValue(obj, "b", "anything"), false);
		});

		it("should return false for non-objects", () => {
			strict.strictEqual(propIsValue(undefined, "prop", "value"), false);
			strict.strictEqual(propIsValue("string", "prop", "value"), false);
		});

		it("should work with reference equality", () => {
			const ref = {};
			const obj = { prop: ref };
			strict.strictEqual(propIsValue(obj, "prop", ref), true);
			strict.strictEqual(propIsValue(obj, "prop", {}), false);
		});
	});

	describe("hasProp", () => {
		it("should return true for correct string properties", () => {
			const obj = { name: "test", empty: "" };
			strict.strictEqual(hasProp(obj, "name", "string"), true);
			strict.strictEqual(hasProp(obj, "empty", "string"), true);
		});

		it("should return true for correct number properties", () => {
			const obj = { count: 42, zero: 0, negative: -1 };
			strict.strictEqual(hasProp(obj, "count", "number"), true);
			strict.strictEqual(hasProp(obj, "zero", "number"), true);
			strict.strictEqual(hasProp(obj, "negative", "number"), true);
		});

		it("should return true for correct boolean properties", () => {
			const obj = { flag: true, disabled: false };
			strict.strictEqual(hasProp(obj, "flag", "boolean"), true);
			strict.strictEqual(hasProp(obj, "disabled", "boolean"), true);
		});

		it("should return true for correct object properties", () => {
			const obj = { nested: {}, date: new Date() };
			strict.strictEqual(hasProp(obj, "nested", "object"), true);
			strict.strictEqual(hasProp(obj, "date", "object"), true);
		});

		it("should return true for correct array properties", () => {
			const obj = { items: [], numbers: [1, 2, 3] };
			strict.strictEqual(hasProp(obj, "items", "array"), true);
			strict.strictEqual(hasProp(obj, "numbers", "array"), true);
		});

		it("should return false for wrong types", () => {
			const obj = { str: "test", num: 42, bool: true, arr: [], obj: {} };
			strict.strictEqual(hasProp(obj, "str", "number"), false);
			strict.strictEqual(hasProp(obj, "num", "string"), false);
			strict.strictEqual(hasProp(obj, "bool", "object"), false);
			strict.strictEqual(hasProp(obj, "arr", "string"), false); // Array is not a string
			strict.strictEqual(hasProp(obj, "obj", "array"), false);
		});

		it("should return false when property does not exist", () => {
			const obj = { a: 1 };
			strict.strictEqual(hasProp(obj, "b", "string"), false);
		});

		it("should return false for non-objects", () => {
			strict.strictEqual(hasProp(undefined, "prop", "string"), false);
			strict.strictEqual(hasProp("string", "prop", "string"), false);
		});

		it("should handle undefined values correctly", () => {
			const obj = { undefinedValue: undefined };
			strict.strictEqual(hasProp(obj, "undefinedValue", "object"), false);
			strict.strictEqual(hasProp(obj, "undefinedValue", "string"), false);
		});
	});

	describe("propInstanceOf", () => {
		it("should return true for correct instances", () => {
			const obj = {
				date: new Date(),
				error: new Error("test error"),
				array: [],
				regex: /test/,
			};
			strict.strictEqual(propInstanceOf(obj, "date", Date), true);
			strict.strictEqual(propInstanceOf(obj, "error", Error), true);
			strict.strictEqual(propInstanceOf(obj, "array", Array), true);
			strict.strictEqual(propInstanceOf(obj, "regex", RegExp), true);
		});

		it("should return false for wrong instances", () => {
			const obj = { date: new Date(), str: "test" };
			strict.strictEqual(propInstanceOf(obj, "date", Error), false);
			strict.strictEqual(propInstanceOf(obj, "str", Date), false);
		});

		it("should return false when property does not exist", () => {
			const obj = { a: 1 };
			strict.strictEqual(propInstanceOf(obj, "b", Date), false);
		});

		it("should return false for non-objects", () => {
			strict.strictEqual(propInstanceOf(undefined, "prop", Date), false);
			strict.strictEqual(propInstanceOf("string", "prop", Date), false);
		});

		it("should work with custom classes", () => {
			class CustomClass {
				public value = "test";
			}
			const instance = new CustomClass();
			const obj = { custom: instance, other: {} };

			strict.strictEqual(propInstanceOf(obj, "custom", CustomClass), true);
			strict.strictEqual(propInstanceOf(obj, "other", CustomClass), false);
		});
	});

	describe("ObjectValidator", () => {
		describe("from", () => {
			it("should return ObjectValidator for objects", () => {
				const validator = ObjectValidator.from({});
				strict(validator !== undefined);
				strict(validator instanceof ObjectValidator);
			});

			it("should return undefined for non-objects", () => {
				strict.strictEqual(ObjectValidator.from(undefined), undefined);
				strict.strictEqual(ObjectValidator.from("string"), undefined);
				strict.strictEqual(ObjectValidator.from(42), undefined);
				strict.strictEqual(ObjectValidator.from(undefined), undefined);
			});
		});

		describe("propIsValue", () => {
			it("should return validator when property matches value", () => {
				interface TestType {
					type: string;
					count: number;
				}

				const obj = { type: "test", count: 42 };
				const validator = ObjectValidator.from<TestType>(obj);
				strict(validator !== undefined);

				const result1 = validator.propIsValue("type", "test");
				strict(result1 !== undefined);
				strict(result1 instanceof ObjectValidator);

				const result2 = result1.propIsValue("count", 42);
				strict(result2 !== undefined);
			});

			it("should return undefined when property does not match value", () => {
				interface TestType {
					type: string;
				}

				const obj = { type: "test" };
				const validator = ObjectValidator.from<TestType>(obj);
				strict(validator !== undefined);

				const result = validator.propIsValue("type", "other");
				strict.strictEqual(result, undefined);
			});

			it("should return undefined when property does not exist", () => {
				interface TestType {
					a: number;
					b: string;
				}

				const obj = { a: 1 };
				const validator = ObjectValidator.from<TestType>(obj);
				strict(validator !== undefined);

				const result = validator.propIsValue("b", "anything");
				strict.strictEqual(result, undefined);
			});
		});

		describe("hasProp", () => {
			it("should return validator when property has correct type", () => {
				interface TestType {
					name: string;
					count: number;
					active: boolean;
				}

				const obj = { name: "test", count: 42, active: true };
				const validator = ObjectValidator.from<TestType>(obj);
				strict(validator !== undefined);

				const result1 = validator.hasProp("name", "string");
				strict(result1 !== undefined);

				const result2 = result1.hasProp("count", "number");
				strict(result2 !== undefined);

				const result3 = result2.hasProp("active", "boolean");
				strict(result3 !== undefined);
			});

			it("should return undefined when property has wrong type", () => {
				interface TestType {
					name: string;
				}

				const obj = { name: "test" };
				const validator = ObjectValidator.from<TestType>(obj);
				strict(validator !== undefined);

				const result = validator.hasProp("name", "number");
				strict.strictEqual(result, undefined);
			});

			it("should work with arrays", () => {
				interface TestType {
					items: unknown[];
				}

				const obj = { items: [1, 2, 3] };
				const validator = ObjectValidator.from<TestType>(obj);
				strict(validator !== undefined);

				const result = validator.hasProp("items", "array");
				strict(result !== undefined);
			});
		});

		describe("propInstanceOf", () => {
			it("should return validator when property is instance of class", () => {
				interface TestType {
					date: Date;
					error: Error;
				}

				const obj = { date: new Date(), error: new Error("test") };
				const validator = ObjectValidator.from<TestType>(obj);
				strict(validator !== undefined);

				const result1 = validator.propInstanceOf("date", Date);
				strict(result1 !== undefined);

				const result2 = result1.propInstanceOf("error", Error);
				strict(result2 !== undefined);
			});

			it("should return undefined when property is not instance of class", () => {
				interface TestType {
					value: unknown;
				}

				const obj = { value: "string value" };
				const validator = ObjectValidator.from<TestType>(obj);
				strict(validator !== undefined);

				const result = validator.propInstanceOf("value", Date);
				strict.strictEqual(result, undefined);
			});
		});

		describe("unsafeCast", () => {
			it("should return validator without validation", () => {
				interface TestType {
					anything: string;
				}

				const obj = { anything: "value" };
				const validator = ObjectValidator.from<TestType>(obj);
				strict(validator !== undefined);

				// First validate a property to get into the validated state
				const validatedValidator = validator.propIsValue("anything", "value");
				strict(validatedValidator !== undefined);

				const result = validatedValidator.unsafeCast("anything");
				strict(result !== undefined);
				strict(result instanceof ObjectValidator);
				strict.strictEqual(result.obj, obj);
			});
		});

		describe("chaining", () => {
			it("should allow complex validation chains", () => {
				interface ExpectedType {
					type: "user";
					id: number;
					name: string;
					active: boolean;
					metadata: object;
					tags: string[];
				}

				const validObj = {
					type: "user" as const,
					id: 123,
					name: "John",
					active: true,
					metadata: { role: "admin" },
					tags: ["vip", "active"],
				};

				const validator = ObjectValidator.from<ExpectedType>(validObj);
				strict(validator !== undefined);

				const result = validator
					.propIsValue("type", "user")
					?.hasProp("id", "number")
					?.hasProp("name", "string")
					?.hasProp("active", "boolean")
					?.hasProp("metadata", "object")
					?.hasProp("tags", "array");

				strict(result !== undefined);
				strict.strictEqual(result.obj, validObj);
			});

			it("should break chain on first validation failure", () => {
				interface ExpectedType {
					type: "user";
					id: number;
				}

				const invalidObj = {
					type: "admin" as const, // wrong value
					id: 123,
				};

				const validator = ObjectValidator.from<ExpectedType>(invalidObj);
				strict(validator !== undefined);

				const result = validator
					.propIsValue("type", "user") // this will fail
					?.hasProp("id", "number");

				strict.strictEqual(result, undefined);
			});
		});

		describe("obj property access", () => {
			it("should provide access to the original object", () => {
				const originalObj = { test: "value" };
				const validator = ObjectValidator.from(originalObj);
				strict(validator !== undefined);
				strict.strictEqual(validator.obj, originalObj);
			});
		});
	});
});
