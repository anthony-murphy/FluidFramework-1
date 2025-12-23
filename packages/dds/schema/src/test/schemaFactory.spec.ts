/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/* eslint-disable @typescript-eslint/no-shadow */

import { strict as assert } from "node:assert";

import { FieldKind, NodeKind } from "../core/index.js";
import {
	SchemaFactory,
	stringSchema,
	numberSchema,
	booleanSchema,
	nullSchema,
	handleSchema,
} from "../factory/index.js";

describe("SchemaFactory", () => {
	describe("constructor", () => {
		it("can be instantiated with a simple scope", () => {
			const sf = new SchemaFactory("test");
			assert.equal(sf.scope, "test");
		});

		it("can be instantiated with a dotted scope", () => {
			const sf = new SchemaFactory("com.example.myapp");
			assert.equal(sf.scope, "com.example.myapp");
		});

		it("can be instantiated with an empty scope", () => {
			const sf = new SchemaFactory("");
			assert.equal(sf.scope, "");
		});
	});

	describe("leaf schemas", () => {
		const sf = new SchemaFactory("test");

		it("creates string schema with correct properties", () => {
			assert.equal(sf.string.kind, NodeKind.Leaf);
			assert.equal(sf.string.leafKind, "string");
			assert.equal(sf.string.identifier, "com.fluidframework.leaf.string");
		});

		it("creates number schema with correct properties", () => {
			assert.equal(sf.number.kind, NodeKind.Leaf);
			assert.equal(sf.number.leafKind, "number");
			assert.equal(sf.number.identifier, "com.fluidframework.leaf.number");
		});

		it("creates boolean schema with correct properties", () => {
			assert.equal(sf.boolean.kind, NodeKind.Leaf);
			assert.equal(sf.boolean.leafKind, "boolean");
			assert.equal(sf.boolean.identifier, "com.fluidframework.leaf.boolean");
		});

		it("creates null schema with correct properties", () => {
			assert.equal(sf.null.kind, NodeKind.Leaf);
			assert.equal(sf.null.leafKind, "null");
			assert.equal(sf.null.identifier, "com.fluidframework.leaf.null");
		});

		it("creates handle schema with correct properties", () => {
			assert.equal(sf.handle.kind, NodeKind.Leaf);
			assert.equal(sf.handle.leafKind, "handle");
			assert.equal(sf.handle.identifier, "com.fluidframework.leaf.handle");
		});

		it("returns same instances for leaf schemas across factories", () => {
			const sf1 = new SchemaFactory("scope1");
			const sf2 = new SchemaFactory("scope2");

			// Leaf schemas should be shared singletons
			assert.strictEqual(sf1.string, sf2.string);
			assert.strictEqual(sf1.number, sf2.number);
			assert.strictEqual(sf1.boolean, sf2.boolean);
			assert.strictEqual(sf1.null, sf2.null);
			assert.strictEqual(sf1.handle, sf2.handle);
		});

		it("returns same instances as exported schemas", () => {
			const sf = new SchemaFactory("test");

			assert.strictEqual(sf.string, stringSchema);
			assert.strictEqual(sf.number, numberSchema);
			assert.strictEqual(sf.boolean, booleanSchema);
			assert.strictEqual(sf.null, nullSchema);
			assert.strictEqual(sf.handle, handleSchema);
		});
	});

	describe("object schemas", () => {
		it("creates object with required fields", () => {
			const sf = new SchemaFactory("test");
			const schema = sf.object("Person", {
				name: sf.string,
				age: sf.number,
			});

			assert.equal(schema.kind, NodeKind.Object);
			assert.equal(schema.identifier, "test.Person");
			assert.deepEqual(Object.keys(schema.fields).sort(), ["age", "name"]);
		});

		it("sets field kind to Required for direct schema references", () => {
			const sf = new SchemaFactory("test");
			const schema = sf.object("Person", {
				name: sf.string,
				age: sf.number,
				active: sf.boolean,
			});

			assert.equal(schema.fields.name?.kind, FieldKind.Required);
			assert.equal(schema.fields.age?.kind, FieldKind.Required);
			assert.equal(schema.fields.active?.kind, FieldKind.Required);
		});

		it("creates object with optional fields", () => {
			const sf = new SchemaFactory("test");
			const schema = sf.object("Person", {
				name: sf.string,
				nickname: sf.optional(sf.string),
			});

			assert.equal(schema.fields.name?.kind, FieldKind.Required);
			assert.equal(schema.fields.nickname?.kind, FieldKind.Optional);
		});

		it("creates object with explicit required fields", () => {
			const sf = new SchemaFactory("test");
			const schema = sf.object("Person", {
				name: sf.required(sf.string),
			});

			assert.equal(schema.fields.name?.kind, FieldKind.Required);
		});

		it("creates object with mixed required and optional fields", () => {
			const sf = new SchemaFactory("test");
			const schema = sf.object("Person", {
				id: sf.number,
				name: sf.string,
				email: sf.optional(sf.string),
				phone: sf.optional(sf.string),
				active: sf.required(sf.boolean),
			});

			assert.equal(schema.fields.id?.kind, FieldKind.Required);
			assert.equal(schema.fields.name?.kind, FieldKind.Required);
			assert.equal(schema.fields.email?.kind, FieldKind.Optional);
			assert.equal(schema.fields.phone?.kind, FieldKind.Optional);
			assert.equal(schema.fields.active?.kind, FieldKind.Required);
		});

		it("creates object with no fields", () => {
			const sf = new SchemaFactory("test");
			const schema = sf.object("Empty", {});

			assert.equal(schema.kind, NodeKind.Object);
			assert.equal(schema.identifier, "test.Empty");
			assert.deepEqual(schema.fields, {});
		});

		it("sets correct allowedTypes for fields", () => {
			const sf = new SchemaFactory("test");
			const schema = sf.object("Person", {
				name: sf.string,
				age: sf.number,
			});

			assert.deepEqual(schema.fields.name?.allowedTypes, ["com.fluidframework.leaf.string"]);
			assert.deepEqual(schema.fields.age?.allowedTypes, ["com.fluidframework.leaf.number"]);
		});

		it("creates nested object schemas", () => {
			const sf = new SchemaFactory("test");
			const AddressSchema = sf.object("Address", {
				street: sf.string,
				city: sf.string,
			});
			const PersonSchema = sf.object("Person", {
				name: sf.string,
				address: AddressSchema,
			});

			assert.equal(PersonSchema.identifier, "test.Person");
			assert.equal(PersonSchema.fields.address?.kind, FieldKind.Required);
			assert.deepEqual(PersonSchema.fields.address?.allowedTypes, ["test.Address"]);
		});

		it("scopes identifiers correctly with different scopes", () => {
			const sf1 = new SchemaFactory("com.example");
			const sf2 = new SchemaFactory("org.acme");

			const schema1 = sf1.object("User", { name: sf1.string });
			const schema2 = sf2.object("User", { name: sf2.string });

			assert.equal(schema1.identifier, "com.example.User");
			assert.equal(schema2.identifier, "org.acme.User");
		});
	});

	describe("map schemas", () => {
		it("creates map with leaf value schema", () => {
			const sf = new SchemaFactory("test");
			const schema = sf.map("StringMap", sf.string);

			assert.equal(schema.kind, NodeKind.Map);
			assert.equal(schema.identifier, "test.StringMap");
			assert.deepEqual(schema.allowedTypes, ["com.fluidframework.leaf.string"]);
		});

		it("creates map with number value schema", () => {
			const sf = new SchemaFactory("test");
			const schema = sf.map("NumberMap", sf.number);

			assert.equal(schema.kind, NodeKind.Map);
			assert.equal(schema.identifier, "test.NumberMap");
			assert.deepEqual(schema.allowedTypes, ["com.fluidframework.leaf.number"]);
		});

		it("creates map with object value schema", () => {
			const sf = new SchemaFactory("test");
			const UserSchema = sf.object("User", { name: sf.string });
			const schema = sf.map("Users", UserSchema);

			assert.equal(schema.kind, NodeKind.Map);
			assert.equal(schema.identifier, "test.Users");
			assert.deepEqual(schema.allowedTypes, ["test.User"]);
		});

		it("creates map with nested map value schema", () => {
			const sf = new SchemaFactory("test");
			const InnerMap = sf.map("InnerMap", sf.string);
			const OuterMap = sf.map("OuterMap", InnerMap);

			assert.equal(OuterMap.kind, NodeKind.Map);
			assert.equal(OuterMap.identifier, "test.OuterMap");
			assert.deepEqual(OuterMap.allowedTypes, ["test.InnerMap"]);
		});

		it("scopes identifiers correctly", () => {
			const sf = new SchemaFactory("com.example.myapp");
			const schema = sf.map("Config", sf.string);

			assert.equal(schema.identifier, "com.example.myapp.Config");
		});
	});

	describe("optional field schema", () => {
		it("creates optional field with correct kind", () => {
			const sf = new SchemaFactory("test");
			const optionalString = sf.optional(sf.string);

			assert.equal(optionalString.kind, FieldKind.Optional);
		});

		it("creates optional field with correct allowedTypes for leaf", () => {
			const sf = new SchemaFactory("test");
			const optionalString = sf.optional(sf.string);

			assert.deepEqual(optionalString.allowedTypes, ["com.fluidframework.leaf.string"]);
		});

		it("creates optional field with correct allowedTypes for object", () => {
			const sf = new SchemaFactory("test");
			const UserSchema = sf.object("User", { name: sf.string });
			const optionalUser = sf.optional(UserSchema);

			assert.equal(optionalUser.kind, FieldKind.Optional);
			assert.deepEqual(optionalUser.allowedTypes, ["test.User"]);
		});
	});

	describe("required field schema", () => {
		it("creates required field with correct kind", () => {
			const sf = new SchemaFactory("test");
			const requiredString = sf.required(sf.string);

			assert.equal(requiredString.kind, FieldKind.Required);
		});

		it("creates required field with correct allowedTypes", () => {
			const sf = new SchemaFactory("test");
			const requiredString = sf.required(sf.string);

			assert.deepEqual(requiredString.allowedTypes, ["com.fluidframework.leaf.string"]);
		});

		it("produces same result as implicit required field", () => {
			const sf = new SchemaFactory("test");
			const implicit = sf.object("Implicit", { name: sf.string });
			const explicit = sf.object("Explicit", { name: sf.required(sf.string) });

			assert.equal(implicit.fields.name?.kind, explicit.fields.name?.kind);
			assert.deepEqual(implicit.fields.name?.allowedTypes, explicit.fields.name?.allowedTypes);
		});
	});

	describe("FieldProps", () => {
		describe("key storage override", () => {
			it("stores key in optional field props", () => {
				const sf = new SchemaFactory("test");
				const optionalField = sf.optional(sf.string, { key: "stored_key" });

				assert.deepEqual(optionalField.props, { key: "stored_key" });
			});

			it("stores key in required field props", () => {
				const sf = new SchemaFactory("test");
				const requiredField = sf.required(sf.string, { key: "stored_key" });

				assert.deepEqual(requiredField.props, { key: "stored_key" });
			});

			it("schema field has props with key", () => {
				const sf = new SchemaFactory("test");
				const schema = sf.object("Document", {
					title: sf.required(sf.string, { key: "doc_title" }),
					author: sf.optional(sf.string, { key: "doc_author" }),
				});

				// Props are preserved on the field schema
				assert.equal(schema.fields.title?.props?.key, "doc_title");
				assert.equal(schema.fields.author?.props?.key, "doc_author");
			});
		});

		describe("metadata", () => {
			it("stores metadata with description in optional field", () => {
				const sf = new SchemaFactory("test");
				const optionalField = sf.optional(sf.string, {
					metadata: { description: "User email address" },
				});

				assert.deepEqual(optionalField.props, {
					metadata: { description: "User email address" },
				});
			});

			it("stores metadata with description in required field", () => {
				const sf = new SchemaFactory("test");
				const requiredField = sf.required(sf.string, {
					metadata: { description: "User name" },
				});

				assert.deepEqual(requiredField.props, {
					metadata: { description: "User name" },
				});
			});

			it("stores metadata with custom data", () => {
				const sf = new SchemaFactory("test");
				const field = sf.optional(sf.number, {
					metadata: { custom: { min: 0, max: 100 } },
				});

				assert.deepEqual(field.props?.metadata?.custom, { min: 0, max: 100 });
			});

			it("stores both description and custom metadata", () => {
				const sf = new SchemaFactory("test");
				const field = sf.optional(sf.string, {
					metadata: {
						description: "Config value",
						custom: { deprecated: true },
					},
				});

				assert.equal(field.props?.metadata?.description, "Config value");
				assert.deepEqual(field.props?.metadata?.custom, { deprecated: true });
			});
		});

		describe("combined key and metadata", () => {
			it("stores both key and metadata", () => {
				const sf = new SchemaFactory("test");
				const field = sf.optional(sf.string, {
					key: "user_email",
					metadata: { description: "User email address" },
				});

				assert.equal(field.props?.key, "user_email");
				assert.equal(field.props?.metadata?.description, "User email address");
			});

			it("schema preserves combined props", () => {
				const sf = new SchemaFactory("test");
				const schema = sf.object("User", {
					email: sf.optional(sf.string, {
						key: "email_addr",
						metadata: { description: "Primary email" },
					}),
				});

				const fieldProps = schema.fields.email?.props;
				assert.equal(fieldProps?.key, "email_addr");
				assert.equal(fieldProps?.metadata?.description, "Primary email");
			});
		});

		describe("no props", () => {
			it("optional field without props has undefined props", () => {
				const sf = new SchemaFactory("test");
				const field = sf.optional(sf.string);

				assert.equal(field.props, undefined);
			});

			it("required field without props has undefined props", () => {
				const sf = new SchemaFactory("test");
				const field = sf.required(sf.string);

				assert.equal(field.props, undefined);
			});
		});
	});
});
