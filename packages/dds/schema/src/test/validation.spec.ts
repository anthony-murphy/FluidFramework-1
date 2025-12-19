/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { strict as assert } from "node:assert";

import {
	SchemaFactory,
	stringSchema,
	numberSchema,
	booleanSchema,
	nullSchema,
} from "../factory/index.js";
import type { NodeSchema } from "../core/index.js";
import { validateData, buildSchemaRegistry } from "../validation/index.js";

describe("Validation", () => {
	const sf = new SchemaFactory("test");

	describe("validateData", () => {
		describe("leaf schemas", () => {
			it("validates string values correctly", () => {
				const result = validateData(sf.string, "hello");
				assert.equal(result.valid, true);
				assert.equal(result.errors.length, 0);
			});

			it("rejects non-string for string schema", () => {
				const result = validateData(sf.string, 42);
				assert.equal(result.valid, false);
				assert.equal(result.errors.length, 1);
				assert.equal(result.errors[0]?.expected, "string");
				assert.equal(result.errors[0]?.actual, "number");
			});

			it("validates number values correctly", () => {
				const result = validateData(sf.number, 42);
				assert.equal(result.valid, true);
				assert.equal(result.errors.length, 0);
			});

			it("validates floating point numbers", () => {
				const result = validateData(sf.number, 3.14159);
				assert.equal(result.valid, true);
			});

			it("rejects non-number for number schema", () => {
				const result = validateData(sf.number, "hello");
				assert.equal(result.valid, false);
				assert.equal(result.errors.length, 1);
				assert.equal(result.errors[0]?.expected, "number");
				assert.equal(result.errors[0]?.actual, "string");
			});

			it("validates boolean values correctly", () => {
				const result = validateData(sf.boolean, true);
				assert.equal(result.valid, true);

				const result2 = validateData(sf.boolean, false);
				assert.equal(result2.valid, true);
			});

			it("rejects non-boolean for boolean schema", () => {
				const result = validateData(sf.boolean, 1);
				assert.equal(result.valid, false);
				assert.equal(result.errors.length, 1);
				assert.equal(result.errors[0]?.expected, "boolean");
				assert.equal(result.errors[0]?.actual, "number");
			});

			it("validates null values correctly", () => {
				const result = validateData(sf.null, null);
				assert.equal(result.valid, true);
			});

			it("rejects non-null for null schema", () => {
				const result = validateData(sf.null, undefined);
				assert.equal(result.valid, false);
				assert.equal(result.errors.length, 1);
				assert.equal(result.errors[0]?.expected, "null");
			});

			it("rejects null for string schema", () => {
				const result = validateData(sf.string, null);
				assert.equal(result.valid, false);
				assert.equal(result.errors[0]?.actual, "null");
			});
		});

		describe("object schemas", () => {
			it("validates simple object with required fields", () => {
				const PersonSchema = sf.object("Person", {
					name: sf.string,
					age: sf.number,
				});

				const result = validateData(PersonSchema, { name: "Alice", age: 30 });
				assert.equal(result.valid, true);
				assert.equal(result.errors.length, 0);
			});

			it("validates object with optional fields present", () => {
				const PersonSchema = sf.object("PersonWithOptional", {
					name: sf.string,
					nickname: sf.optional(sf.string),
				});

				const result = validateData(PersonSchema, { name: "Alice", nickname: "Ali" });
				assert.equal(result.valid, true);
			});

			it("validates object with optional fields absent", () => {
				const PersonSchema = sf.object("PersonOptionalAbsent", {
					name: sf.string,
					nickname: sf.optional(sf.string),
				});

				const result = validateData(PersonSchema, { name: "Alice" });
				assert.equal(result.valid, true);
			});

			it("detects missing required fields", () => {
				const PersonSchema = sf.object("PersonMissing", {
					name: sf.string,
					age: sf.number,
				});

				const result = validateData(PersonSchema, { name: "Alice" });
				assert.equal(result.valid, false);
				assert.equal(result.errors.length, 1);
				assert.equal(result.errors[0]?.path, "age");
				assert.equal(result.errors[0]?.message, "Required field is missing");
			});

			it("detects multiple missing required fields", () => {
				const PersonSchema = sf.object("PersonMultiMissing", {
					name: sf.string,
					age: sf.number,
					email: sf.string,
				});

				const result = validateData(PersonSchema, {});
				assert.equal(result.valid, false);
				assert.equal(result.errors.length, 3);
			});

			it("detects extra unknown fields", () => {
				const PersonSchema = sf.object("PersonExtraFields", {
					name: sf.string,
				});

				const result = validateData(PersonSchema, { name: "Alice", unknownField: "oops" });
				assert.equal(result.valid, false);
				assert.equal(result.errors.length, 1);
				assert.equal(result.errors[0]?.path, "unknownField");
				assert.equal(result.errors[0]?.message, "Unknown field");
			});

			it("detects wrong types for fields", () => {
				const PersonSchema = sf.object("PersonWrongType", {
					name: sf.string,
					age: sf.number,
				});

				const result = validateData(PersonSchema, { name: "Alice", age: "thirty" });
				assert.equal(result.valid, false);
				assert.equal(result.errors.length, 1);
				assert.equal(result.errors[0]?.path, "age");
			});

			it("rejects non-object data", () => {
				const PersonSchema = sf.object("PersonNonObject", {
					name: sf.string,
				});

				const result = validateData(PersonSchema, "not an object");
				assert.equal(result.valid, false);
				assert.equal(result.errors[0]?.message, "Expected object");
			});

			it("rejects array for object schema", () => {
				const PersonSchema = sf.object("PersonNotArray", {
					name: sf.string,
				});

				const result = validateData(PersonSchema, ["Alice"]);
				assert.equal(result.valid, false);
				assert.equal(result.errors[0]?.actual, "array");
			});

			it("rejects null for object schema", () => {
				const PersonSchema = sf.object("PersonNotNull", {
					name: sf.string,
				});

				const result = validateData(PersonSchema, null);
				assert.equal(result.valid, false);
				assert.equal(result.errors[0]?.actual, "null");
			});
		});

		describe("nested object validation", () => {
			// Note: Nested object validation relies on buildSchemaRegistry to collect
			// all referenced schemas. The current implementation only collects built-in
			// schemas (string, number, etc.) and doesn't properly resolve custom object
			// schemas referenced in fields. These tests document the limitation.

			it("validates nested objects when registry is manually built", () => {
				const AddressSchema = sf.object("Address", {
					street: sf.string,
					city: sf.string,
				});
				const PersonSchema = sf.object("PersonWithAddress", {
					name: sf.string,
					address: AddressSchema,
				});

				// Manually build a registry that includes the nested schema
				const registry = new Map<string, NodeSchema>();
				registry.set(PersonSchema.identifier, PersonSchema);
				registry.set(AddressSchema.identifier, AddressSchema);
				registry.set(stringSchema.identifier, stringSchema);

				const result = validateData(
					PersonSchema,
					{
						name: "Alice",
						address: { street: "123 Main St", city: "Springfield" },
					},
					registry,
				);
				assert.equal(result.valid, true);
			});

			it("reports error for nested object with invalid nested field using manual registry", () => {
				const AddressSchema = sf.object("AddressNested", {
					street: sf.string,
					city: sf.string,
				});
				const PersonSchema = sf.object("PersonNestedError", {
					name: sf.string,
					address: AddressSchema,
				});

				// Manually build a registry that includes the nested schema
				const registry = new Map<string, NodeSchema>();
				registry.set(PersonSchema.identifier, PersonSchema);
				registry.set(AddressSchema.identifier, AddressSchema);
				registry.set(stringSchema.identifier, stringSchema);
				registry.set(numberSchema.identifier, numberSchema);

				const result = validateData(
					PersonSchema,
					{
						name: "Alice",
						address: { street: "123 Main St", city: 42 },
					},
					registry,
				);
				assert.equal(result.valid, false);
				assert.equal(result.errors.length, 1);
				// The error path indicates where validation failed
				// The validation happens at the field level (address) because the nested object
				// doesn't match the allowed type after checking its internal structure
				assert.ok(
					result.errors[0]?.path === "address" || result.errors[0]?.path === "address.city",
					`Expected path to be "address" or "address.city", got "${result.errors[0]?.path}"`,
				);
			});
		});

		describe("map schemas", () => {
			it("validates map with string values", () => {
				const ConfigSchema = sf.map("StringConfig", sf.string);

				const result = validateData(ConfigSchema, { key1: "value1", key2: "value2" });
				assert.equal(result.valid, true);
			});

			it("validates map with number values", () => {
				const ScoresSchema = sf.map("NumberConfig", sf.number);

				const result = validateData(ScoresSchema, { player1: 100, player2: 200 });
				assert.equal(result.valid, true);
			});

			it("validates empty map", () => {
				const ConfigSchema = sf.map("EmptyMapConfig", sf.string);

				const result = validateData(ConfigSchema, {});
				assert.equal(result.valid, true);
			});

			it("detects wrong value types in map", () => {
				const ConfigSchema = sf.map("WrongTypeConfig", sf.string);

				const result = validateData(ConfigSchema, { key1: "valid", key2: 42 });
				assert.equal(result.valid, false);
				assert.equal(result.errors.length, 1);
				assert.equal(result.errors[0]?.path, "key2");
			});

			it("rejects non-object for map schema", () => {
				const ConfigSchema = sf.map("NotObjectMap", sf.string);

				const result = validateData(ConfigSchema, "not an object");
				assert.equal(result.valid, false);
				assert.equal(result.errors[0]?.message, "Expected object (map)");
			});

			it("rejects array for map schema", () => {
				const ConfigSchema = sf.map("NotArrayMap", sf.string);

				const result = validateData(ConfigSchema, ["value1", "value2"]);
				assert.equal(result.valid, false);
				assert.equal(result.errors[0]?.actual, "array");
			});
		});
	});

	describe("buildSchemaRegistry", () => {
		it("includes built-in leaf schemas", () => {
			const SimpleSchema = sf.object("Simple", { name: sf.string });
			const registry = buildSchemaRegistry(SimpleSchema);

			assert.equal(registry.has(stringSchema.identifier), true);
			assert.equal(registry.has(numberSchema.identifier), true);
			assert.equal(registry.has(booleanSchema.identifier), true);
			assert.equal(registry.has(nullSchema.identifier), true);
		});

		it("includes the root schema", () => {
			const PersonSchema = sf.object("PersonRegistry", {
				name: sf.string,
				age: sf.number,
			});
			const registry = buildSchemaRegistry(PersonSchema);

			assert.equal(registry.has(PersonSchema.identifier), true);
			assert.strictEqual(registry.get(PersonSchema.identifier), PersonSchema);
		});

		// Note: The current implementation of buildSchemaRegistry only collects
		// built-in schemas via findSchemaByIdentifier. Custom schemas referenced
		// in fields are not automatically collected. These tests document this
		// limitation.

		it("does not collect nested custom object schemas (current limitation)", () => {
			const AddressSchema = sf.object("AddressRegistry", {
				city: sf.string,
			});
			const PersonSchema = sf.object("PersonWithAddressRegistry", {
				name: sf.string,
				address: AddressSchema,
			});
			const registry = buildSchemaRegistry(PersonSchema);

			// The root schema is included
			assert.equal(registry.has(PersonSchema.identifier), true);
			// But the nested AddressSchema is NOT included because findSchemaByIdentifier
			// only returns built-in schemas
			assert.equal(registry.has(AddressSchema.identifier), false);
		});

		it("handles map schemas", () => {
			const MapSchema = sf.map("StringMapRegistry", sf.string);
			const registry = buildSchemaRegistry(MapSchema);

			assert.equal(registry.has(MapSchema.identifier), true);
			assert.equal(registry.has(stringSchema.identifier), true);
		});
	});
});
