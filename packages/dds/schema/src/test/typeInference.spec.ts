/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/* eslint-disable unicorn/no-null */

/**
 * Type inference tests for the schema package.
 *
 * These tests verify that the type inference utilities correctly derive
 * TypeScript types from schema definitions. Many of these are compile-time
 * tests that verify types are correctly inferred - if this file compiles,
 * the type inference is working correctly.
 */

import { strict as assert } from "node:assert";

import type { IFluidHandle } from "@fluidframework/core-interfaces";

import {
	SchemaFactory,
	stringSchema,
	numberSchema,
	booleanSchema,
	nullSchema,
	handleSchema,
} from "../factory/index.js";
import type { NodeFromSchema, InferValueSchema, ValueFromLeafSchema } from "../types/index.js";

// Helper type to check if two types are exactly equal
type Equals<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

// Helper to assert type equality at compile time
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function assertTypeEquals<T extends true>(): void {}

describe("Type Inference", () => {
	describe("ValueFromLeafSchema", () => {
		it("infers string type from stringSchema", () => {
			type Result = ValueFromLeafSchema<typeof stringSchema>;
			// Compile-time check
			assertTypeEquals<Equals<Result, string>>();
			// Runtime verification that the type is usable
			const value: Result = "hello";
			assert.equal(value, "hello");
		});

		it("infers number type from numberSchema", () => {
			type Result = ValueFromLeafSchema<typeof numberSchema>;
			assertTypeEquals<Equals<Result, number>>();
			const value: Result = 42;
			assert.equal(value, 42);
		});

		it("infers boolean type from booleanSchema", () => {
			type Result = ValueFromLeafSchema<typeof booleanSchema>;
			assertTypeEquals<Equals<Result, boolean>>();
			const value: Result = true;
			assert.equal(value, true);
		});

		it("infers null type from nullSchema", () => {
			type Result = ValueFromLeafSchema<typeof nullSchema>;
			// eslint-disable-next-line @rushstack/no-new-null
			assertTypeEquals<Equals<Result, null>>();
			// eslint-disable-next-line @rushstack/no-new-null
			const value: Result = null;
			assert.equal(value, null);
		});

		it("infers IFluidHandle type from handleSchema", () => {
			type Result = ValueFromLeafSchema<typeof handleSchema>;
			assertTypeEquals<Equals<Result, IFluidHandle>>();
			// Can't easily create a handle at runtime, but type check is sufficient
		});
	});

	describe("NodeFromSchema for leaf schemas", () => {
		it("infers string from stringSchema", () => {
			type Result = NodeFromSchema<typeof stringSchema>;
			assertTypeEquals<Equals<Result, string>>();
			const value: Result = "test";
			assert.equal(value, "test");
		});

		it("infers number from numberSchema", () => {
			type Result = NodeFromSchema<typeof numberSchema>;
			assertTypeEquals<Equals<Result, number>>();
			const value: Result = 123;
			assert.equal(value, 123);
		});

		it("infers boolean from booleanSchema", () => {
			type Result = NodeFromSchema<typeof booleanSchema>;
			assertTypeEquals<Equals<Result, boolean>>();
			const value: Result = false;
			assert.equal(value, false);
		});

		it("infers null from nullSchema", () => {
			type Result = NodeFromSchema<typeof nullSchema>;
			// eslint-disable-next-line @rushstack/no-new-null
			assertTypeEquals<Equals<Result, null>>();
			// eslint-disable-next-line @rushstack/no-new-null
			const value: Result = null;
			assert.equal(value, null);
		});
	});

	describe("NodeFromSchema for object schemas", () => {
		const sf = new SchemaFactory("test");

		it("infers correct object type with required fields", () => {
			const PersonSchema = sf.object("Person", {
				name: sf.string,
				age: sf.number,
			});

			type Person = NodeFromSchema<typeof PersonSchema>;

			// Verify the type is correct at compile time
			const person: Person = {
				name: "Alice",
				age: 30,
			};

			assert.equal(person.name, "Alice");
			assert.equal(person.age, 30);
		});

		it("infers correct object type with optional fields", () => {
			const UserSchema = sf.object("User", {
				id: sf.number,
				email: sf.optional(sf.string),
			});

			type User = NodeFromSchema<typeof UserSchema>;

			// Should allow omitting optional field
			const user1: User = { id: 1 };
			assert.equal(user1.id, 1);
			assert.equal(user1.email, undefined);

			// Should allow providing optional field
			const user2: User = { id: 2, email: "test@example.com" };
			assert.equal(user2.id, 2);
			assert.equal(user2.email, "test@example.com");
		});

		it("infers correct object type with mixed fields", () => {
			const ProfileSchema = sf.object("Profile", {
				username: sf.string,
				displayName: sf.optional(sf.string),
				age: sf.number,
				bio: sf.optional(sf.string),
			});

			type Profile = NodeFromSchema<typeof ProfileSchema>;

			const profile: Profile = {
				username: "johndoe",
				age: 25,
				// displayName and bio are optional
			};

			assert.equal(profile.username, "johndoe");
			assert.equal(profile.age, 25);
			assert.equal(profile.displayName, undefined);
		});

		it("infers correct type for nested objects", () => {
			const AddressSchema = sf.object("Address", {
				street: sf.string,
				city: sf.string,
			});

			const PersonWithAddressSchema = sf.object("PersonWithAddress", {
				name: sf.string,
				address: AddressSchema,
			});

			type PersonWithAddress = NodeFromSchema<typeof PersonWithAddressSchema>;

			const person: PersonWithAddress = {
				name: "Bob",
				address: {
					street: "123 Main St",
					city: "Seattle",
				},
			};

			assert.equal(person.name, "Bob");
			assert.equal(person.address.street, "123 Main St");
			assert.equal(person.address.city, "Seattle");
		});

		it("infers correct type for empty object", () => {
			const EmptySchema = sf.object("Empty", {});

			type Empty = NodeFromSchema<typeof EmptySchema>;

			const empty: Empty = {};
			assert.deepEqual(empty, {});
		});
	});

	describe("NodeFromSchema for map schemas", () => {
		const sf = new SchemaFactory("test");

		it("infers value type for map with string values", () => {
			const StringMapSchema = sf.map("StringMap", sf.string);

			type StringMapValue = NodeFromSchema<typeof StringMapSchema>;

			// NodeFromSchema for maps returns the value type, not Map<string, T>
			// This is because the map node itself has operations, but the values
			// are what get typed
			const value: StringMapValue = "hello";
			assert.equal(value, "hello");
		});

		it("infers value type for map with object values", () => {
			const ItemSchema = sf.object("Item", {
				name: sf.string,
				quantity: sf.number,
			});
			const ItemMapSchema = sf.map("Items", ItemSchema);

			type ItemMapValue = NodeFromSchema<typeof ItemMapSchema>;

			// The inferred type is the object type (value type), not Map
			const item: ItemMapValue = { name: "Widget", quantity: 10 };

			assert.equal(item.name, "Widget");
			assert.equal(item.quantity, 10);
		});
	});

	describe("InferValueSchema", () => {
		const sf = new SchemaFactory("test");

		it("extracts value schema from map schema", () => {
			const StringMapSchema = sf.map("StringMap", sf.string);

			type ValueSchema = InferValueSchema<typeof StringMapSchema>;
			assertTypeEquals<Equals<ValueSchema, typeof sf.string>>();

			assert.ok(true);
		});

		it("extracts object value schema from map schema", () => {
			const ItemSchema = sf.object("Item", { name: sf.string });
			const ItemMapSchema = sf.map("Items", ItemSchema);

			type ValueSchema = InferValueSchema<typeof ItemMapSchema>;
			assertTypeEquals<Equals<ValueSchema, typeof ItemSchema>>();

			assert.ok(true);
		});

		it("returns never for non-map schemas", () => {
			type LeafValue = InferValueSchema<typeof sf.string>;
			assertTypeEquals<Equals<LeafValue, never>>();

			const ObjectSchema = sf.object("Obj", { x: sf.number });
			type ObjValue = InferValueSchema<typeof ObjectSchema>;
			assertTypeEquals<Equals<ObjValue, never>>();

			assert.ok(true);
		});
	});
});
