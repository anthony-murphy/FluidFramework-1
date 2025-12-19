/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { strict as assert } from "node:assert";

import {
	FieldKind,
	NodeKind,
	SchemaFactory,
	isObjectSchema,
	isArraySchema,
	isMapSchema,
	isLeafSchema,
} from "../index.js";
import type {
	ObjectNodeSchema,
	ArrayNodeSchema,
	MapNodeSchema,
	LeafNodeSchema,
	NodeFromSchema,
} from "../index.js";

describe("Schema", () => {
	describe("SchemaFactory", () => {
		it("can be instantiated with a scope", () => {
			const factory = new SchemaFactory("test.scope");
			assert.equal(factory.scope, "test.scope");
		});

		it("provides leaf type schemas", () => {
			const sf = new SchemaFactory("test");
			assert.equal(sf.string.identifier, "com.fluidframework.leaf.string");
			assert.equal(sf.string.kind, NodeKind.Leaf);
			assert.equal(sf.string.leafKind, "string");

			assert.equal(sf.number.identifier, "com.fluidframework.leaf.number");
			assert.equal(sf.number.kind, NodeKind.Leaf);
			assert.equal(sf.number.leafKind, "number");

			assert.equal(sf.boolean.identifier, "com.fluidframework.leaf.boolean");
			assert.equal(sf.boolean.kind, NodeKind.Leaf);
			assert.equal(sf.boolean.leafKind, "boolean");

			assert.equal(sf.null.identifier, "com.fluidframework.leaf.null");
			assert.equal(sf.null.kind, NodeKind.Leaf);
			assert.equal(sf.null.leafKind, "null");

			assert.equal(sf.handle.identifier, "com.fluidframework.leaf.handle");
			assert.equal(sf.handle.kind, NodeKind.Leaf);
			assert.equal(sf.handle.leafKind, "handle");
		});

		it("creates object schemas with scoped identifiers", () => {
			const sf = new SchemaFactory("myApp");
			const UserSchema = sf.object("User", {
				name: sf.string,
				age: sf.number,
			});

			assert.equal(UserSchema.identifier, "myApp.User");
			assert.equal(UserSchema.kind, NodeKind.Object);
			assert.deepEqual(Object.keys(UserSchema.fields), ["name", "age"]);
			assert.equal(UserSchema.fields["name"]?.kind, FieldKind.Required);
			assert.equal(UserSchema.fields["age"]?.kind, FieldKind.Required);
		});

		it("creates object schemas with optional fields", () => {
			const sf = new SchemaFactory("myApp");
			const UserSchema = sf.object("User", {
				name: sf.string,
				email: sf.optional(sf.string),
			});

			assert.equal(UserSchema.fields["name"]?.kind, FieldKind.Required);
			assert.equal(UserSchema.fields["email"]?.kind, FieldKind.Optional);
		});

		it("creates object schemas with explicit required fields", () => {
			const sf = new SchemaFactory("myApp");
			const UserSchema = sf.object("User", {
				name: sf.required(sf.string),
			});

			assert.equal(UserSchema.fields["name"]?.kind, FieldKind.Required);
		});

		it("creates map schemas with scoped identifiers", () => {
			const sf = new SchemaFactory("myApp");
			const StringMapSchema = sf.map("StringMap", sf.string);

			assert.equal(StringMapSchema.identifier, "myApp.StringMap");
			assert.equal(StringMapSchema.kind, NodeKind.Map);
			assert.deepEqual(StringMapSchema.allowedTypes, ["com.fluidframework.leaf.string"]);
		});

		it("creates map schemas with object values", () => {
			const sf = new SchemaFactory("myApp");
			const UserSchema = sf.object("User", { name: sf.string });
			const UserMapSchema = sf.map("Users", UserSchema);

			assert.equal(UserMapSchema.identifier, "myApp.Users");
			assert.equal(UserMapSchema.kind, NodeKind.Map);
			assert.deepEqual(UserMapSchema.allowedTypes, ["myApp.User"]);
		});
	});

	describe("NodeKind", () => {
		it("has expected values", () => {
			assert.equal(NodeKind.Map, 0);
			assert.equal(NodeKind.Array, 1);
			assert.equal(NodeKind.Object, 2);
			assert.equal(NodeKind.Leaf, 3);
		});
	});

	describe("FieldKind", () => {
		it("has expected values", () => {
			assert.equal(FieldKind.Required, 0);
			assert.equal(FieldKind.Optional, 1);
		});
	});

	describe("Type guards", () => {
		const objectSchema: ObjectNodeSchema = {
			kind: NodeKind.Object,
			identifier: "test.Object",
			fields: {},
		};

		const arraySchema: ArrayNodeSchema = {
			kind: NodeKind.Array,
			identifier: "test.Array",
			allowedTypes: ["test.Item"],
		};

		const mapSchema: MapNodeSchema = {
			kind: NodeKind.Map,
			identifier: "test.Map",
			allowedTypes: ["test.Value"],
		};

		const leafSchema: LeafNodeSchema = {
			kind: NodeKind.Leaf,
			identifier: "test.Leaf",
			leafKind: "string",
		};

		it("isObjectSchema works correctly", () => {
			assert.equal(isObjectSchema(objectSchema), true);
			assert.equal(isObjectSchema(arraySchema), false);
			assert.equal(isObjectSchema(mapSchema), false);
			assert.equal(isObjectSchema(leafSchema), false);
		});

		it("isArraySchema works correctly", () => {
			assert.equal(isArraySchema(objectSchema), false);
			assert.equal(isArraySchema(arraySchema), true);
			assert.equal(isArraySchema(mapSchema), false);
			assert.equal(isArraySchema(leafSchema), false);
		});

		it("isMapSchema works correctly", () => {
			assert.equal(isMapSchema(objectSchema), false);
			assert.equal(isMapSchema(arraySchema), false);
			assert.equal(isMapSchema(mapSchema), true);
			assert.equal(isMapSchema(leafSchema), false);
		});

		it("isLeafSchema works correctly", () => {
			assert.equal(isLeafSchema(objectSchema), false);
			assert.equal(isLeafSchema(arraySchema), false);
			assert.equal(isLeafSchema(mapSchema), false);
			assert.equal(isLeafSchema(leafSchema), true);
		});
	});
});

// Type-level tests to verify NodeFromSchema inference works correctly
// These don't run at runtime, they just need to compile without errors
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function typeTests(): void {
	// This function is never called - it just needs to type check

	// Test leaf type inference
	type StringType = NodeFromSchema<typeof import("../index.js").stringSchema>;
	type NumberType = NodeFromSchema<typeof import("../index.js").numberSchema>;
	type BooleanType = NodeFromSchema<typeof import("../index.js").booleanSchema>;
	type NullType = NodeFromSchema<typeof import("../index.js").nullSchema>;

	// Verify the types are correct by assigning values
	const _s: StringType = "hello";
	const _n: NumberType = 42;
	const _b: BooleanType = true;
	// eslint-disable-next-line @rushstack/no-new-null
	const _null: NullType = null;

	// Suppress unused variable warnings
	void _s;
	void _n;
	void _b;
	void _null;
}
