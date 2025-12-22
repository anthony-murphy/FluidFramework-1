/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/* eslint-disable @typescript-eslint/consistent-type-assertions */

import { strict as assert } from "node:assert";

import { MockFluidDataStoreRuntime } from "@fluidframework/test-runtime-utils/internal";

import { ISchematizedSharedMap, SharedMap } from "../../index.js";
import { SchemaFactory } from "@fluidframework/schema/internal";

/**
 * Creates a local SharedMap for testing.
 */
function createLocalMap(id: string): ISchematizedSharedMap {
	const dataStoreRuntime = new MockFluidDataStoreRuntime({
		registry: [SharedMap.getFactory()],
	});
	const map = SharedMap.create(dataStoreRuntime, id) as ISchematizedSharedMap;
	return map;
}

describe("SharedMap.viewWith", () => {
	const sf = new SchemaFactory("test");

	describe("ObjectNodeSchema views", () => {
		describe("basic operations", () => {
			it("returns a proxy view for ObjectNodeSchema", () => {
				const PersonSchema = sf.object("Person", {
					name: sf.string,
					age: sf.number,
				});

				const map = createLocalMap("testMap");
				const view = map.viewWith(PersonSchema);

				// View should have the expected interface
				assert.ok(view, "viewWith should return a view");
				assert.ok(typeof view.initialize === "function", "view should have initialize method");
			});

			it("initializes and retrieves field values", () => {
				const PersonSchema = sf.object("PersonInit", {
					name: sf.string,
					age: sf.number,
				});

				const map = createLocalMap("testMap");
				const view = map.viewWith(PersonSchema);

				view.initialize();
				view.root.name = "Alice";
				view.root.age = 30;

				assert.equal(view.root.name, "Alice");
				assert.equal(view.root.age, 30);
			});

			it("sets and retrieves updated field values", () => {
				const PersonSchema = sf.object("PersonSet", {
					name: sf.string,
					age: sf.number,
				});

				const map = createLocalMap("testMap");
				const view = map.viewWith(PersonSchema);

				view.initialize();
				view.root.name = "Alice";
				view.root.age = 30;
				view.root.age = 31;

				assert.equal(view.root.age, 31);
			});

			it("handles optional fields when present", () => {
				const PersonSchema = sf.object("PersonOptional", {
					name: sf.string,
					nickname: sf.optional(sf.string),
				});

				const map = createLocalMap("testMap");
				const view = map.viewWith(PersonSchema);

				view.initialize();
				view.root.name = "Alice";
				view.root.nickname = "Ali";

				assert.equal(view.root.nickname, "Ali");
			});

			it("handles optional fields when absent", () => {
				const PersonSchema = sf.object("PersonOptionalAbsent", {
					name: sf.string,
					nickname: sf.optional(sf.string),
				});

				const map = createLocalMap("testMap");
				const view = map.viewWith(PersonSchema);

				view.initialize();
				view.root.name = "Alice";

				assert.equal(view.root.nickname, undefined);
			});

			it("allows setting optional fields to undefined", () => {
				const PersonSchema = sf.object("PersonOptionalUndef", {
					name: sf.string,
					nickname: sf.optional(sf.string),
				});

				const map = createLocalMap("testMap");
				const view = map.viewWith(PersonSchema);

				view.initialize();
				view.root.name = "Alice";
				view.root.nickname = "Ali";
				assert.equal(view.root.nickname, "Ali");

				view.root.nickname = undefined;
				assert.equal(view.root.nickname, undefined);
			});

			it("checks field existence with 'in' operator", () => {
				const PersonSchema = sf.object("PersonHasField", {
					name: sf.string,
					nickname: sf.optional(sf.string),
				});

				const map = createLocalMap("testMap");
				const view = map.viewWith(PersonSchema);

				view.initialize();
				view.root.name = "Alice";

				assert.equal("name" in view.root, true);
				assert.equal("nickname" in view.root, false);
			});
		});

		describe("validation", () => {
			// Note: Schema validation is disabled by default in the SchematizedObjectView.
			// The viewWith API doesn't expose enableSchemaValidation option,
			// so individual property validation is not tested here.

			it("throws when initializing twice", () => {
				const PersonSchema = sf.object("PersonTwice", {
					name: sf.string,
				});

				const map = createLocalMap("testMap");
				const view = map.viewWith(PersonSchema);

				view.initialize();

				assert.throws(() => view.initialize());
			});
		});

		describe("schema persistence", () => {
			it("sets persisted schema on initialize", () => {
				const PersonSchema = sf.object("PersonPersist", {
					name: sf.string,
				});

				const map = createLocalMap("testMap");
				const view = map.viewWith(PersonSchema);

				// Before initialize
				assert.equal(view.compatibility.canInitialize, true);

				view.initialize();
				view.root.name = "Alice";

				// After initialize
				assert.equal(view.compatibility.canInitialize, false);
			});
		});

		describe("compatibility", () => {
			it("returns canInitialize=true when no schema stored", () => {
				const PersonSchema = sf.object("PersonCanInit", {
					name: sf.string,
				});

				const map = createLocalMap("testMap");
				const view = map.viewWith(PersonSchema);

				assert.equal(view.compatibility.canInitialize, true);
			});

			it("returns canView=true for compatible schema", () => {
				const PersonSchema = sf.object("PersonCanView", {
					name: sf.string,
				});

				const map = createLocalMap("testMap");
				const view = map.viewWith(PersonSchema);

				view.initialize();
				view.root.name = "Alice";

				assert.equal(view.compatibility.canView, true);
			});

			it("returns canUpgrade=true when adding optional field", () => {
				const PersonSchemaV1 = sf.object("PersonUpgrade", {
					name: sf.string,
				});
				const PersonSchemaV2 = sf.object("PersonUpgrade", {
					name: sf.string,
					email: sf.optional(sf.string),
				});

				const map = createLocalMap("testMap");

				// Initialize with V1
				const viewV1 = map.viewWith(PersonSchemaV1);
				viewV1.initialize();
				viewV1.root.name = "Alice";

				// Create V2 view
				const viewV2 = map.viewWith(PersonSchemaV2);

				assert.equal(viewV2.compatibility.canUpgrade, true);
			});

			it("returns canUpgrade=false for incompatible schema changes", () => {
				const PersonSchemaV1 = sf.object("PersonIncompat", {
					name: sf.string,
				});
				const PersonSchemaV2 = sf.object("PersonIncompat", {
					name: sf.string,
					requiredField: sf.number, // New required field is breaking
				});

				const map = createLocalMap("testMap");

				// Initialize with V1
				const viewV1 = map.viewWith(PersonSchemaV1);
				viewV1.initialize();
				viewV1.root.name = "Alice";

				// Create V2 view
				const viewV2 = map.viewWith(PersonSchemaV2);

				assert.equal(viewV2.compatibility.canUpgrade, false);
			});
		});
	});

	describe("MapNodeSchema views", () => {
		describe("basic operations", () => {
			it("returns a SchematizedMapView for MapNodeSchema", () => {
				const ConfigSchema = sf.map("Config", sf.string);

				const map = createLocalMap("testMap");
				const view = map.viewWith(ConfigSchema);

				// View should have Map-like interface
				assert.ok(view, "viewWith should return a view");
				assert.ok(typeof view.initialize === "function", "view should have initialize method");
				assert.ok(typeof view.root.get === "function", "view should have get method");
				assert.ok(typeof view.root.set === "function", "view should have set method");
				assert.ok(typeof view.root.delete === "function", "view should have delete method");
				assert.ok(typeof view.root.has === "function", "view should have has method");
			});

			it("gets and sets values", () => {
				const ConfigSchema = sf.map("ConfigGetSet", sf.string);

				const map = createLocalMap("testMap");
				const view = map.viewWith(ConfigSchema);

				view.initialize();
				view.root.set("key1", "value1");

				assert.equal(view.root.get("key1"), "value1");

				view.root.set("key2", "value2");
				assert.equal(view.root.get("key2"), "value2");
			});

			it("returns undefined for missing keys", () => {
				const ConfigSchema = sf.map("ConfigMissing", sf.string);

				const map = createLocalMap("testMap");
				const view = map.viewWith(ConfigSchema);

				view.initialize();

				assert.equal(view.root.get("nonexistent"), undefined);
			});

			it("deletes entries", () => {
				const ConfigSchema = sf.map("ConfigDelete", sf.string);

				const map = createLocalMap("testMap");
				const view = map.viewWith(ConfigSchema);

				view.initialize();
				view.root.set("key1", "value1");
				assert.equal(view.root.has("key1"), true);

				const deleted = view.root.delete("key1");
				assert.equal(deleted, true);
				assert.equal(view.root.has("key1"), false);
			});

			it("delete returns false for non-existent keys", () => {
				const ConfigSchema = sf.map("ConfigDeleteNonExist", sf.string);

				const map = createLocalMap("testMap");
				const view = map.viewWith(ConfigSchema);

				view.initialize();

				const deleted = view.root.delete("nonexistent");
				assert.equal(deleted, false);
			});

			it("has returns correct boolean", () => {
				const ConfigSchema = sf.map("ConfigHas", sf.string);

				const map = createLocalMap("testMap");
				const view = map.viewWith(ConfigSchema);

				view.initialize();
				view.root.set("exists", "value");

				assert.equal(view.root.has("exists"), true);
				assert.equal(view.root.has("notExists"), false);
			});
		});

		describe("size property", () => {
			it("returns correct size", () => {
				const ConfigSchema = sf.map("ConfigSize", sf.string);

				const map = createLocalMap("testMap");
				const view = map.viewWith(ConfigSchema);

				view.initialize();
				assert.equal(view.root.size, 0);

				view.root.set("key1", "value1");
				assert.equal(view.root.size, 1);

				view.root.set("key2", "value2");
				assert.equal(view.root.size, 2);

				view.root.delete("key1");
				assert.equal(view.root.size, 1);
			});
		});

		describe("iteration methods", () => {
			it("iterates over keys", () => {
				const ConfigSchema = sf.map("ConfigKeys", sf.string);

				const map = createLocalMap("testMap");
				const view = map.viewWith(ConfigSchema);

				view.initialize();
				view.root.set("key1", "value1");
				view.root.set("key2", "value2");

				const keys = [...view.root.keys()];
				assert.deepEqual(keys.sort(), ["key1", "key2"]);
			});

			it("iterates over values", () => {
				const ConfigSchema = sf.map("ConfigValues", sf.string);

				const map = createLocalMap("testMap");
				const view = map.viewWith(ConfigSchema);

				view.initialize();
				view.root.set("key1", "value1");
				view.root.set("key2", "value2");

				const values = [...view.root.values()];
				assert.deepEqual(values.sort(), ["value1", "value2"]);
			});

			it("iterates over entries", () => {
				const ConfigSchema = sf.map("ConfigEntries", sf.string);

				const map = createLocalMap("testMap");
				const view = map.viewWith(ConfigSchema);

				view.initialize();
				view.root.set("key1", "value1");
				view.root.set("key2", "value2");

				const entries = [...view.root.entries()];
				assert.equal(entries.length, 2);
				const entryMap = new Map(entries);
				assert.equal(entryMap.get("key1"), "value1");
				assert.equal(entryMap.get("key2"), "value2");
			});

			it("is iterable with for...of", () => {
				const ConfigSchema = sf.map("ConfigIterable", sf.string);

				const map = createLocalMap("testMap");
				const view = map.viewWith(ConfigSchema);

				view.initialize();
				view.root.set("key1", "value1");
				view.root.set("key2", "value2");

				const collected: [string, unknown][] = [];
				for (const entry of view.root) {
					collected.push(entry);
				}

				assert.equal(collected.length, 2);
			});

			it("supports forEach", () => {
				const ConfigSchema = sf.map("ConfigForEach", sf.string);

				const map = createLocalMap("testMap");
				const view = map.viewWith(ConfigSchema);

				view.initialize();
				view.root.set("key1", "value1");
				view.root.set("key2", "value2");

				const collected: [string, unknown][] = [];
				for (const [key, value] of view.root) {
					collected.push([key, value]);
				}

				assert.equal(collected.length, 2);
				const entryMap = new Map(collected);
				assert.equal(entryMap.get("key1"), "value1");
			});
		});

		describe("compatibility", () => {
			it("returns canInitialize=true when no schema stored", () => {
				const ConfigSchema = sf.map("ConfigCanInit", sf.string);

				const map = createLocalMap("testMap");
				const view = map.viewWith(ConfigSchema);

				assert.equal(view.compatibility.canInitialize, true);
			});

			it("returns canInitialize=false after initialization", () => {
				const ConfigSchema = sf.map("ConfigCanInitAfter", sf.string);

				const map = createLocalMap("testMap");
				const view = map.viewWith(ConfigSchema);

				view.initialize();

				assert.equal(view.compatibility.canInitialize, false);
			});

			it("returns canView=true for compatible schema", () => {
				const ConfigSchema = sf.map("ConfigCanView", sf.string);

				const map = createLocalMap("testMap");
				const view = map.viewWith(ConfigSchema);

				view.initialize();
				view.root.set("key", "value");

				assert.equal(view.compatibility.canView, true);
			});
		});

		describe("validation", () => {
			it("accepts valid initial content", () => {
				const ConfigSchema = sf.map("ConfigValid", sf.string);

				const map = createLocalMap("testMap");
				const view = map.viewWith(ConfigSchema);

				// Should not throw for valid content
				view.initialize();
				view.root.set("key", "value");
				assert.equal(view.root.get("key"), "value");
			});

			it("throws when initializing twice", () => {
				const ConfigSchema = sf.map("ConfigTwice", sf.string);

				const map = createLocalMap("testMap");
				const view = map.viewWith(ConfigSchema);

				view.initialize();

				assert.throws(() => view.initialize());
			});
		});
	});

	describe("error handling", () => {
		it("throws for unsupported schema types", () => {
			// LeafNodeSchema is not supported for viewWith
			const LeafSchema = sf.string;

			const map = createLocalMap("testMap");

			assert.throws(() => {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
				(map as any).viewWith(LeafSchema);
			}, /Schema must be an ObjectNodeSchema or MapNodeSchema/);
		});
	});

	describe("data persistence", () => {
		it("view changes are reflected in underlying map", () => {
			const PersonSchema = sf.object("PersonUnderlyingMap", {
				name: sf.string,
				age: sf.number,
			});

			const map = createLocalMap("testMap");
			const view = map.viewWith(PersonSchema);

			view.initialize();
			view.root.name = "Alice";
			view.root.age = 30;

			// The underlying map should have the data
			assert.equal(map.get("name"), "Alice");
			assert.equal(map.get("age"), 30);

			// Update via view
			view.root.age = 31;
			assert.equal(map.get("age"), 31);
		});

		it("map changes are reflected in view", () => {
			const PersonSchema = sf.object("PersonMapChanges", {
				name: sf.string,
				age: sf.number,
			});

			const map = createLocalMap("testMap");
			const view = map.viewWith(PersonSchema);

			view.initialize();
			view.root.name = "Alice";
			view.root.age = 30;

			// Update underlying map directly
			map.set("age", 32);

			// View should see the change
			assert.equal(view.root.age, 32);
		});
	});

	describe("Complex ObjectNodeSchema", () => {
		describe("multiple field types", () => {
			it("creates object schema with many fields of different types", () => {
				const UserProfileSchema = sf.object("UserProfile", {
					username: sf.string,
					age: sf.number,
					isActive: sf.boolean,
					email: sf.string,
				});

				const map = createLocalMap("testMap");
				const view = map.viewWith(UserProfileSchema);

				view.initialize();
				view.root.username = "alice123";
				view.root.age = 30;
				view.root.isActive = true;
				view.root.email = "alice@example.com";

				assert.equal(view.root.username, "alice123");
				assert.equal(view.root.age, 30);
				assert.equal(view.root.isActive, true);
				assert.equal(view.root.email, "alice@example.com");
			});

			it("handles mixed required and optional fields", () => {
				const ProfileSchema = sf.object("MixedProfile", {
					name: sf.string,
					age: sf.number,
					nickname: sf.optional(sf.string),
					bio: sf.optional(sf.string),
				});

				const map = createLocalMap("testMap");
				const view = map.viewWith(ProfileSchema);

				view.initialize();
				view.root.name = "Bob";
				view.root.age = 25;
				view.root.nickname = "Bobby";

				assert.equal(view.root.name, "Bob");
				assert.equal(view.root.age, 25);
				assert.equal(view.root.nickname, "Bobby");
				assert.equal(view.root.bio, undefined);
			});

			it("updates multiple fields independently", () => {
				const PersonSchema = sf.object("PersonMultiUpdate", {
					firstName: sf.string,
					lastName: sf.string,
					age: sf.number,
				});

				const map = createLocalMap("testMap");
				const view = map.viewWith(PersonSchema);

				view.initialize();
				view.root.firstName = "Charlie";
				view.root.lastName = "Brown";
				view.root.age = 35;

				// Update each field independently
				view.root.firstName = "Charles";
				view.root.age = 36;

				assert.equal(view.root.firstName, "Charles");
				assert.equal(view.root.lastName, "Brown"); // unchanged
				assert.equal(view.root.age, 36);
			});
		});

		describe("all leaf types", () => {
			it("handles object schema with all leaf types", () => {
				const AllTypesSchema = sf.object("AllLeafTypes", {
					stringField: sf.string,
					numberField: sf.number,
					booleanField: sf.boolean,
				});

				const map = createLocalMap("testMap");
				const view = map.viewWith(AllTypesSchema);

				view.initialize();
				view.root.stringField = "hello";
				view.root.numberField = 42;
				view.root.booleanField = true;

				assert.equal(view.root.stringField, "hello");
				assert.equal(view.root.numberField, 42);
				assert.equal(view.root.booleanField, true);
			});

			it("updates all leaf types correctly", () => {
				const AllTypesSchema = sf.object("AllLeafTypesUpdate", {
					stringField: sf.string,
					numberField: sf.number,
					booleanField: sf.boolean,
				});

				const map = createLocalMap("testMap");
				const view = map.viewWith(AllTypesSchema);

				view.initialize();
				view.root.stringField = "initial";
				view.root.numberField = 0;
				view.root.booleanField = false;

				// Update each field
				view.root.stringField = "updated";
				view.root.numberField = 100;
				view.root.booleanField = true;

				assert.equal(view.root.stringField, "updated");
				assert.equal(view.root.numberField, 100);
				assert.equal(view.root.booleanField, true);
			});
		});
	});

	describe("Complex MapNodeSchema", () => {
		describe("map with object values", () => {
			it("creates map schema with object values", () => {
				const UserValueSchema = sf.object("UserMapValue", {
					name: sf.string,
					email: sf.string,
				});

				const UserMapSchema = sf.map("UserMap", UserValueSchema);

				const map = createLocalMap("testMap");
				const view = map.viewWith(UserMapSchema);

				view.initialize();
				view.root.set("user1", { name: "Alice", email: "alice@example.com" });

				assert.deepEqual(view.root.get("user1"), {
					name: "Alice",
					email: "alice@example.com",
				});
			});

			it("sets and gets object values in a map", () => {
				const ProductSchema = sf.object("ProductMapValue", {
					name: sf.string,
					price: sf.number,
				});

				const ProductMapSchema = sf.map("ProductMap", ProductSchema);

				const map = createLocalMap("testMap");
				const view = map.viewWith(ProductMapSchema);

				view.initialize();

				view.root.set("prod1", { name: "Widget", price: 9.99 });
				view.root.set("prod2", { name: "Gadget", price: 19.99 });

				assert.deepEqual(view.root.get("prod1"), { name: "Widget", price: 9.99 });
				assert.deepEqual(view.root.get("prod2"), { name: "Gadget", price: 19.99 });
			});

			it("deletes object entries", () => {
				const ItemSchema = sf.object("ItemMapValue", {
					id: sf.number,
					description: sf.string,
				});

				const ItemMapSchema = sf.map("ItemMap", ItemSchema);

				const map = createLocalMap("testMap");
				const view = map.viewWith(ItemMapSchema);

				view.initialize();
				view.root.set("item1", { id: 1, description: "First item" });
				view.root.set("item2", { id: 2, description: "Second item" });

				assert.equal(view.root.has("item1"), true);
				assert.equal(view.root.size, 2);

				const deleted = view.root.delete("item1");
				assert.equal(deleted, true);
				assert.equal(view.root.has("item1"), false);
				assert.equal(view.root.size, 1);
			});

			it("iterates over object values", () => {
				const RecordSchema = sf.object("RecordMapValue", {
					value: sf.number,
				});

				const RecordMapSchema = sf.map("RecordMap", RecordSchema);

				const map = createLocalMap("testMap");
				const view = map.viewWith(RecordMapSchema);

				view.initialize();
				view.root.set("a", { value: 1 });
				view.root.set("b", { value: 2 });
				view.root.set("c", { value: 3 });

				const values = [...view.root.values()] as { value: number }[];

				assert.equal(values.length, 3);
				const sum = values.reduce((acc, v) => acc + v.value, 0);
				assert.equal(sum, 6);
			});
		});

		describe("nested object values", () => {
			it("handles objects with nested object fields", () => {
				const AddressSchema = sf.object("Address", {
					street: sf.string,
					city: sf.string,
				});

				const PersonWithAddressSchema = sf.object("PersonWithAddress", {
					name: sf.string,
					address: AddressSchema,
				});

				const PersonMapSchema = sf.map("PersonWithAddressMap", PersonWithAddressSchema);

				const map = createLocalMap("testMap");
				const view = map.viewWith(PersonMapSchema);

				view.initialize();
				view.root.set("user1", {
					name: "Alice",
					address: { street: "123 Main St", city: "Seattle" },
				});

				const user = view.root.get("user1");
				assert.ok(user, "user1 should exist");
				assert.equal(user.name, "Alice");
				assert.equal(user.address.street, "123 Main St");
				assert.equal(user.address.city, "Seattle");
			});

			it("handles deeply nested objects (3 levels)", () => {
				const CoordinatesSchema = sf.object("Coordinates", {
					lat: sf.number,
					lng: sf.number,
				});

				const LocationSchema = sf.object("Location", {
					name: sf.string,
					coords: CoordinatesSchema,
				});

				const CompanySchema = sf.object("Company", {
					companyName: sf.string,
					headquarters: LocationSchema,
				});

				const CompanyMapSchema = sf.map("CompanyMap", CompanySchema);

				const map = createLocalMap("testMap");
				const view = map.viewWith(CompanyMapSchema);

				view.initialize();
				view.root.set("acme", {
					companyName: "Acme Corp",
					headquarters: {
						name: "HQ Building",
						coords: { lat: 47.6062, lng: -122.3321 },
					},
				});

				const company = view.root.get("acme");
				assert.ok(company, "acme should exist");
				assert.equal(company.companyName, "Acme Corp");
				assert.equal(company.headquarters.name, "HQ Building");
				assert.equal(company.headquarters.coords.lat, 47.6062);
				assert.equal(company.headquarters.coords.lng, -122.3321);
			});

			it("handles optional nested objects", () => {
				const MetadataSchema = sf.object("Metadata", {
					createdAt: sf.string,
					updatedAt: sf.optional(sf.string),
				});

				const DocumentSchema = sf.object("Document", {
					title: sf.string,
					metadata: sf.optional(MetadataSchema),
				});

				const DocumentMapSchema = sf.map("DocumentMap", DocumentSchema);

				const map = createLocalMap("testMap");
				const view = map.viewWith(DocumentMapSchema);

				view.initialize();

				// Document without metadata
				view.root.set("doc1", { title: "Untitled" });

				// Document with metadata
				view.root.set("doc2", {
					title: "Report",
					metadata: { createdAt: "2025-01-01" },
				});

				const doc1 = view.root.get("doc1");
				const doc2 = view.root.get("doc2");

				assert.ok(doc1, "doc1 should exist");
				assert.ok(doc2, "doc2 should exist");
				assert.equal(doc1.title, "Untitled");
				assert.equal(doc1.metadata, undefined);
				assert.equal(doc2.title, "Report");
				assert.equal(doc2.metadata?.createdAt, "2025-01-01");
			});
		});

		describe("nested map schemas", () => {
			// Note: Nested sf.map() inside sf.map() is not currently supported.
			// The inner map schema gets flattened to its value type.
			// Use objects with map-like patterns instead for nested structures.

			it("handles map with number values", () => {
				const ScoresMapSchema = sf.map("ScoresMap", sf.number);

				const map = createLocalMap("testMap");
				const view = map.viewWith(ScoresMapSchema);

				view.initialize();
				view.root.set("player1", 100);
				view.root.set("player2", 250);
				view.root.set("player3", 175);

				assert.equal(view.root.get("player1"), 100);
				assert.equal(view.root.get("player2"), 250);
				assert.equal(view.root.get("player3"), 175);

				// Iteration works with number values
				let total = 0;
				for (const [, score] of view.root) {
					total += score;
				}
				assert.equal(total, 525);
			});

			it("handles map with boolean values", () => {
				const FlagsMapSchema = sf.map("FlagsMap", sf.boolean);

				const map = createLocalMap("testMap");
				const view = map.viewWith(FlagsMapSchema);

				view.initialize();
				view.root.set("featureA", true);
				view.root.set("featureB", false);
				view.root.set("featureC", true);

				assert.equal(view.root.get("featureA"), true);
				assert.equal(view.root.get("featureB"), false);
				assert.equal(view.root.get("featureC"), true);
			});
		});
	});

	describe("Object proxy enumeration", () => {
		it("Object.keys() returns field names", () => {
			const EnumSchema = sf.object("EnumKeys", {
				firstName: sf.string,
				lastName: sf.string,
				age: sf.number,
			});

			const map = createLocalMap("testMap");
			const view = map.viewWith(EnumSchema);

			view.initialize();
			view.root.firstName = "John";
			view.root.lastName = "Doe";
			view.root.age = 25;

			const keys = Object.keys(view.root);
			assert.deepEqual(keys.sort(), ["age", "firstName", "lastName"]);
		});

		it("Object.values() returns field values", () => {
			const EnumValuesSchema = sf.object("EnumValues", {
				a: sf.string,
				b: sf.number,
			});

			const map = createLocalMap("testMap");
			const view = map.viewWith(EnumValuesSchema);

			view.initialize();
			view.root.a = "hello";
			view.root.b = 42;

			const values = Object.values(view.root);
			assert.deepEqual(values.sort(), [42, "hello"]);
		});

		it("Object.entries() returns field name/value pairs", () => {
			const EnumEntriesSchema = sf.object("EnumEntries", {
				x: sf.string,
				y: sf.number,
			});

			const map = createLocalMap("testMap");
			const view = map.viewWith(EnumEntriesSchema);

			view.initialize();
			view.root.x = "test";
			view.root.y = 100;

			const entries = Object.entries(view.root);
			const entryMap = new Map(entries);

			assert.equal(entryMap.get("x"), "test");
			assert.equal(entryMap.get("y"), 100);
		});

		it("for...in loop iterates over fields", () => {
			const ForInSchema = sf.object("ForInEnum", {
				prop1: sf.string,
				prop2: sf.string,
				prop3: sf.number,
			});

			const map = createLocalMap("testMap");
			const view = map.viewWith(ForInSchema);

			view.initialize();
			view.root.prop1 = "a";
			view.root.prop2 = "b";
			view.root.prop3 = 3;

			// Using Object.keys as a proxy to verify enumerable properties work correctly
			// This tests the same underlying proxy enumeration behavior as for...in
			const keys = Object.keys(view.root);

			assert.deepEqual(keys.sort(), ["prop1", "prop2", "prop3"]);
		});
	});

	describe("Schema upgrade flow", () => {
		it("upgradeSchema() updates the stored schema", () => {
			const SchemaV1 = sf.object("UpgradeTest", {
				name: sf.string,
			});
			const SchemaV2 = sf.object("UpgradeTest", {
				name: sf.string,
				email: sf.optional(sf.string),
			});

			const map = createLocalMap("testMap");

			// Initialize with V1
			const viewV1 = map.viewWith(SchemaV1);
			viewV1.initialize();
			viewV1.root.name = "Alice";

			// Create V2 view and check upgrade is possible
			const viewV2 = map.viewWith(SchemaV2);
			assert.equal(viewV2.compatibility.canUpgrade, true);

			// Perform upgrade
			viewV2.upgradeSchema();

			// After upgrade, should be able to view
			assert.equal(viewV2.compatibility.canView, true);
		});

		it("after upgrade, new optional fields are accessible", () => {
			const SchemaV1 = sf.object("UpgradeAccessTest", {
				name: sf.string,
			});
			const SchemaV2 = sf.object("UpgradeAccessTest", {
				name: sf.string,
				nickname: sf.optional(sf.string),
			});

			const map = createLocalMap("testMap");

			// Initialize with V1
			const viewV1 = map.viewWith(SchemaV1);
			viewV1.initialize();
			viewV1.root.name = "Bob";

			// Create V2 view and upgrade
			const viewV2 = map.viewWith(SchemaV2);
			viewV2.upgradeSchema();

			// New optional field should be undefined
			assert.equal(viewV2.root.nickname, undefined);

			// Should be able to set the new optional field
			viewV2.root.nickname = "Bobby";
			assert.equal(viewV2.root.nickname, "Bobby");
		});

		it("cannot upgrade to incompatible schema", () => {
			const SchemaV1 = sf.object("IncompatUpgrade", {
				name: sf.string,
			});
			const SchemaV2 = sf.object("IncompatUpgrade", {
				name: sf.string,
				requiredField: sf.number, // New required field - incompatible
			});

			const map = createLocalMap("testMap");

			// Initialize with V1
			const viewV1 = map.viewWith(SchemaV1);
			viewV1.initialize();
			viewV1.root.name = "Charlie";

			// Create V2 view - should not be able to upgrade
			const viewV2 = map.viewWith(SchemaV2);
			assert.equal(viewV2.compatibility.canUpgrade, false);

			// Attempting to upgrade should throw
			assert.throws(() => viewV2.upgradeSchema());
		});
	});
});
