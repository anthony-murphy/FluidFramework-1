/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

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

import { FieldKind } from "../core/index.js";
import {
	SchemaFactory,
	stringSchema,
	numberSchema,
	booleanSchema,
	nullSchema,
	handleSchema,
} from "../factory/index.js";
import type {
	NodeFromSchema,
	InferFields,
	InferValueSchema,
	InferAllowedTypes,
	InferFieldKind,
	ValueFromLeafSchema,
	DeepReadonly,
	ReadonlyNodeFromSchema,
	IsLeafSchema,
	IsObjectSchema,
	IsMapSchema,
	SchemaKind,
	UnionFromSchemas,
} from "../types/index.js";
import { NodeKind } from "../core/index.js";

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

	describe("InferFields", () => {
		const sf = new SchemaFactory("test");

		it("extracts fields type from object schema", () => {
			const UserSchema = sf.object("User", {
				name: sf.string,
				age: sf.number,
			});

			type Fields = InferFields<typeof UserSchema>;

			// Verify the fields type includes the expected field schemas
			// This is primarily a compile-time check
			type NameField = Fields["name"];
			type AgeField = Fields["age"];

			// These should be the schema types
			assertTypeEquals<Equals<NameField, typeof sf.string>>();
			assertTypeEquals<Equals<AgeField, typeof sf.number>>();

			assert.ok(true); // Runtime assertion to ensure test runs
		});

		it("returns never for non-object schemas", () => {
			type LeafFields = InferFields<typeof sf.string>;
			assertTypeEquals<Equals<LeafFields, never>>();

			const MapSchema = sf.map("Map", sf.string);
			type MapFields = InferFields<typeof MapSchema>;
			assertTypeEquals<Equals<MapFields, never>>();

			assert.ok(true);
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

	describe("InferAllowedTypes", () => {
		const sf = new SchemaFactory("test");

		it("extracts allowed types from optional field", () => {
			const optionalString = sf.optional(sf.string);

			type Allowed = InferAllowedTypes<typeof optionalString>;
			assertTypeEquals<Equals<Allowed, typeof sf.string>>();

			assert.ok(true);
		});

		it("extracts allowed types from required field", () => {
			const requiredNumber = sf.required(sf.number);

			type Allowed = InferAllowedTypes<typeof requiredNumber>;
			assertTypeEquals<Equals<Allowed, typeof sf.number>>();

			assert.ok(true);
		});
	});

	describe("InferFieldKind", () => {
		const sf = new SchemaFactory("test");

		it("returns Optional for optional fields", () => {
			const optionalField = sf.optional(sf.string);

			type Kind = InferFieldKind<typeof optionalField>;
			assertTypeEquals<Equals<Kind, FieldKind.Optional>>();

			assert.ok(true);
		});

		it("returns Required for required fields", () => {
			const requiredField = sf.required(sf.string);

			type Kind = InferFieldKind<typeof requiredField>;
			assertTypeEquals<Equals<Kind, FieldKind.Required>>();

			assert.ok(true);
		});
	});

	describe("DeepReadonly", () => {
		it("makes object properties readonly", () => {
			interface Mutable {
				name: string;
				age: number;
			}

			type ReadonlyMutable = DeepReadonly<Mutable>;

			const obj: ReadonlyMutable = { name: "test", age: 30 };
			assert.equal(obj.name, "test");
			assert.equal(obj.age, 30);

			// The following would be a compile error:
			// obj.name = "changed"; // Error: Cannot assign to 'name'
		});

		it("makes nested objects deeply readonly", () => {
			interface Nested {
				outer: {
					inner: {
						value: string;
					};
				};
			}

			type ReadonlyNested = DeepReadonly<Nested>;

			const obj: ReadonlyNested = {
				outer: {
					inner: {
						value: "deep",
					},
				},
			};

			assert.equal(obj.outer.inner.value, "deep");
		});

		it("makes arrays readonly", () => {
			interface WithArray {
				items: string[];
			}

			type ReadonlyWithArray = DeepReadonly<WithArray>;

			const obj: ReadonlyWithArray = {
				items: ["a", "b", "c"],
			};

			assert.deepEqual(obj.items, ["a", "b", "c"]);

			// The following would be compile errors:
			// obj.items.push("d"); // Error
			// obj.items[0] = "x"; // Error
		});
	});

	describe("ReadonlyNodeFromSchema", () => {
		const sf = new SchemaFactory("test");

		it("creates deeply readonly type from object schema", () => {
			const PersonSchema = sf.object("Person", {
				name: sf.string,
				age: sf.number,
			});

			type ReadonlyPerson = ReadonlyNodeFromSchema<typeof PersonSchema>;

			const person: ReadonlyPerson = {
				name: "Alice",
				age: 30,
			};

			assert.equal(person.name, "Alice");
			assert.equal(person.age, 30);

			// The following would be a compile error:
			// person.name = "Bob"; // Error: Cannot assign to 'name'
		});
	});

	describe("Type-level schema guards", () => {
		const sf = new SchemaFactory("test");

		it("IsLeafSchema correctly identifies leaf schemas", () => {
			type StringIsLeaf = IsLeafSchema<typeof sf.string>;
			assertTypeEquals<Equals<StringIsLeaf, true>>();

			const ObjSchema = sf.object("Obj", {});
			type ObjIsLeaf = IsLeafSchema<typeof ObjSchema>;
			assertTypeEquals<Equals<ObjIsLeaf, false>>();

			assert.ok(true);
		});

		it("IsObjectSchema correctly identifies object schemas", () => {
			const ObjSchema = sf.object("Obj", { x: sf.number });
			type ObjIsObj = IsObjectSchema<typeof ObjSchema>;
			assertTypeEquals<Equals<ObjIsObj, true>>();

			type StringIsObj = IsObjectSchema<typeof sf.string>;
			assertTypeEquals<Equals<StringIsObj, false>>();

			assert.ok(true);
		});

		it("IsMapSchema correctly identifies map schemas", () => {
			const MapSchema = sf.map("Map", sf.string);
			type MapIsMap = IsMapSchema<typeof MapSchema>;
			assertTypeEquals<Equals<MapIsMap, true>>();

			type StringIsMap = IsMapSchema<typeof sf.string>;
			assertTypeEquals<Equals<StringIsMap, false>>();

			assert.ok(true);
		});
	});

	describe("SchemaKind", () => {
		const sf = new SchemaFactory("test");

		it("extracts correct NodeKind from schemas", () => {
			type LeafKind = SchemaKind<typeof sf.string>;
			assertTypeEquals<Equals<LeafKind, NodeKind.Leaf>>();

			const ObjSchema = sf.object("Obj", {});
			type ObjKind = SchemaKind<typeof ObjSchema>;
			assertTypeEquals<Equals<ObjKind, NodeKind.Object>>();

			const MapSchema = sf.map("Map", sf.string);
			type MapKind = SchemaKind<typeof MapSchema>;
			assertTypeEquals<Equals<MapKind, NodeKind.Map>>();

			assert.ok(true);
		});
	});

	describe("UnionFromSchemas", () => {
		const sf = new SchemaFactory("test");

		it("creates union type from array of leaf schemas", () => {
			const schemas = [sf.string, sf.number, sf.boolean] as const;

			type Union = UnionFromSchemas<typeof schemas>;

			// Union should be string | number | boolean
			const s: Union = "hello";
			const n: Union = 42;
			const b: Union = true;

			assert.equal(s, "hello");
			assert.equal(n, 42);
			assert.equal(b, true);
		});

		it("creates union type from mixed schemas", () => {
			const ObjSchema = sf.object("Obj", { value: sf.number });
			const schemas = [sf.string, ObjSchema] as const;

			type Union = UnionFromSchemas<typeof schemas>;

			const str: Union = "test";
			const obj: Union = { value: 123 };

			assert.equal(str, "test");
			assert.equal((obj as { value: number }).value, 123);
		});
	});
});
