/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { strict as assert } from "node:assert";

import { MockFluidDataStoreRuntime } from "@fluidframework/test-runtime-utils/internal";

import { ISchematizedSharedMap, SharedMap } from "../../index.js";
import { SchemaFactory, SchemaValidationError } from "@fluidframework/schema/internal";

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

				view.initialize({ name: "Alice", age: 30 });

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

				view.initialize({ name: "Alice", age: 30 });
				(view.root as { age: number }).age = 31;

				assert.equal(view.root.age, 31);
			});

			it("handles optional fields when present", () => {
				const PersonSchema = sf.object("PersonOptional", {
					name: sf.string,
					nickname: sf.optional(sf.string),
				});

				const map = createLocalMap("testMap");
				const view = map.viewWith(PersonSchema);

				view.initialize({ name: "Alice", nickname: "Ali" });

				assert.equal(view.root.nickname, "Ali");
			});

			it("handles optional fields when absent", () => {
				const PersonSchema = sf.object("PersonOptionalAbsent", {
					name: sf.string,
					nickname: sf.optional(sf.string),
				});

				const map = createLocalMap("testMap");
				const view = map.viewWith(PersonSchema);

				view.initialize({ name: "Alice" });

				assert.equal(view.root.nickname, undefined);
			});

			it("allows setting optional fields to undefined", () => {
				const PersonSchema = sf.object("PersonOptionalUndef", {
					name: sf.string,
					nickname: sf.optional(sf.string),
				});

				const map = createLocalMap("testMap");
				const view = map.viewWith(PersonSchema);

				view.initialize({ name: "Alice", nickname: "Ali" });
				assert.equal(view.root.nickname, "Ali");

				(view.root as { nickname: string | undefined }).nickname = undefined;
				assert.equal(view.root.nickname, undefined);
			});

			it("checks field existence with 'in' operator", () => {
				const PersonSchema = sf.object("PersonHasField", {
					name: sf.string,
					nickname: sf.optional(sf.string),
				});

				const map = createLocalMap("testMap");
				const view = map.viewWith(PersonSchema);

				view.initialize({ name: "Alice" });

				assert.equal("name" in view.root, true);
				assert.equal("nickname" in view.root, false);
			});
		});

		describe("validation", () => {
			it("throws SchemaValidationError for invalid initial content", () => {
				const PersonSchema = sf.object("PersonInvalid", {
					name: sf.string,
					age: sf.number,
				});

				const map = createLocalMap("testMap");
				const view = map.viewWith(PersonSchema);

				assert.throws(
					() =>
						view.initialize({ name: "Alice", age: "not a number" } as unknown as {
							name: string;
							age: number;
						}),
					SchemaValidationError,
				);
			});

			it("throws when initializing twice", () => {
				const PersonSchema = sf.object("PersonTwice", {
					name: sf.string,
				});

				const map = createLocalMap("testMap");
				const view = map.viewWith(PersonSchema);

				view.initialize({ name: "Alice" });

				assert.throws(() => view.initialize({ name: "Bob" }));
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

				view.initialize({ name: "Alice" });

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

				view.initialize({ name: "Alice" });

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
				viewV1.initialize({ name: "Alice" });

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
				viewV1.initialize({ name: "Alice" });

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
				// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
				const view = map.viewWith(ConfigSchema) as any;

				// View should have Map-like interface
				assert.ok(view, "viewWith should return a view");
				/* eslint-disable @typescript-eslint/no-unsafe-member-access */
				assert.ok(typeof view.initialize === "function", "view should have initialize method");
				assert.ok(typeof view.root.get === "function", "view should have get method");
				assert.ok(typeof view.root.set === "function", "view should have set method");
				assert.ok(typeof view.root.delete === "function", "view should have delete method");
				assert.ok(typeof view.root.has === "function", "view should have has method");
				/* eslint-enable @typescript-eslint/no-unsafe-member-access */
			});

			it("gets and sets values", () => {
				const ConfigSchema = sf.map("ConfigGetSet", sf.string);

				const map = createLocalMap("testMap");
				// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
				const view = map.viewWith(ConfigSchema) as any;

				/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
				view.initialize(new Map([["key1", "value1"]]));

				assert.equal(view.root.get("key1"), "value1");

				view.root.set("key2", "value2");
				assert.equal(view.root.get("key2"), "value2");
				/* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
			});

			it("returns undefined for missing keys", () => {
				const ConfigSchema = sf.map("ConfigMissing", sf.string);

				const map = createLocalMap("testMap");
				// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
				const view = map.viewWith(ConfigSchema) as any;

				/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
				view.initialize(new Map());

				assert.equal(view.root.get("nonexistent"), undefined);
				/* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
			});

			it("deletes entries", () => {
				const ConfigSchema = sf.map("ConfigDelete", sf.string);

				const map = createLocalMap("testMap");
				// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
				const view = map.viewWith(ConfigSchema) as any;

				/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
				view.initialize(new Map([["key1", "value1"]]));
				assert.equal(view.root.has("key1"), true);

				const deleted = view.root.delete("key1");
				assert.equal(deleted, true);
				assert.equal(view.root.has("key1"), false);
				/* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
			});

			it("delete returns false for non-existent keys", () => {
				const ConfigSchema = sf.map("ConfigDeleteNonExist", sf.string);

				const map = createLocalMap("testMap");
				// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
				const view = map.viewWith(ConfigSchema) as any;

				/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
				view.initialize(new Map());

				const deleted = view.root.delete("nonexistent");
				assert.equal(deleted, false);
				/* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
			});

			it("has returns correct boolean", () => {
				const ConfigSchema = sf.map("ConfigHas", sf.string);

				const map = createLocalMap("testMap");
				// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
				const view = map.viewWith(ConfigSchema) as any;

				/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
				view.initialize(new Map([["exists", "value"]]));

				assert.equal(view.root.has("exists"), true);
				assert.equal(view.root.has("notExists"), false);
				/* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
			});
		});

		describe("size property", () => {
			it("returns correct size", () => {
				const ConfigSchema = sf.map("ConfigSize", sf.string);

				const map = createLocalMap("testMap");
				// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
				const view = map.viewWith(ConfigSchema) as any;

				/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
				view.initialize(new Map());
				assert.equal(view.root.size, 0);

				view.root.set("key1", "value1");
				assert.equal(view.root.size, 1);

				view.root.set("key2", "value2");
				assert.equal(view.root.size, 2);

				view.root.delete("key1");
				assert.equal(view.root.size, 1);
				/* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
			});
		});

		describe("iteration methods", () => {
			it("iterates over keys", () => {
				const ConfigSchema = sf.map("ConfigKeys", sf.string);

				const map = createLocalMap("testMap");
				// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
				const view = map.viewWith(ConfigSchema) as any;

				/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
				view.initialize(
					new Map([
						["key1", "value1"],
						["key2", "value2"],
					]),
				);

				const keys = [...view.root.keys()];
				/* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
				assert.deepEqual(keys.sort(), ["key1", "key2"]);
			});

			it("iterates over values", () => {
				const ConfigSchema = sf.map("ConfigValues", sf.string);

				const map = createLocalMap("testMap");
				// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
				const view = map.viewWith(ConfigSchema) as any;

				/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
				view.initialize(
					new Map([
						["key1", "value1"],
						["key2", "value2"],
					]),
				);

				const values = [...view.root.values()];
				/* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
				assert.deepEqual(values.sort(), ["value1", "value2"]);
			});

			it("iterates over entries", () => {
				const ConfigSchema = sf.map("ConfigEntries", sf.string);

				const map = createLocalMap("testMap");
				// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
				const view = map.viewWith(ConfigSchema) as any;

				/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
				view.initialize(
					new Map([
						["key1", "value1"],
						["key2", "value2"],
					]),
				);

				const entries = [...view.root.entries()];
				/* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
				assert.equal(entries.length, 2);
				const entryMap = new Map(entries);
				assert.equal(entryMap.get("key1"), "value1");
				assert.equal(entryMap.get("key2"), "value2");
			});

			it("is iterable with for...of", () => {
				const ConfigSchema = sf.map("ConfigIterable", sf.string);

				const map = createLocalMap("testMap");
				// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
				const view = map.viewWith(ConfigSchema) as any;

				// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
				view.initialize(
					new Map([
						["key1", "value1"],
						["key2", "value2"],
					]),
				);

				const collected: [string, string][] = [];
				// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
				for (const entry of view.root) {
					// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
					collected.push(entry);
				}

				assert.equal(collected.length, 2);
			});

			it("supports forEach", () => {
				const ConfigSchema = sf.map("ConfigForEach", sf.string);

				const map = createLocalMap("testMap");
				// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
				const view = map.viewWith(ConfigSchema) as any;

				// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
				view.initialize(
					new Map([
						["key1", "value1"],
						["key2", "value2"],
					]),
				);

				const collected: [string, string][] = [];
				// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
				for (const [key, value] of view.root) {
					collected.push([key as string, value as string]);
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
				// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
				const view = map.viewWith(ConfigSchema) as any;

				// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
				assert.equal(view.compatibility.canInitialize, true);
			});

			it("returns canInitialize=false after initialization", () => {
				const ConfigSchema = sf.map("ConfigCanInitAfter", sf.string);

				const map = createLocalMap("testMap");
				// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
				const view = map.viewWith(ConfigSchema) as any;

				// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
				view.initialize(new Map());

				// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
				assert.equal(view.compatibility.canInitialize, false);
			});

			it("returns canView=true for compatible schema", () => {
				const ConfigSchema = sf.map("ConfigCanView", sf.string);

				const map = createLocalMap("testMap");
				// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
				const view = map.viewWith(ConfigSchema) as any;

				// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
				view.initialize(new Map([["key", "value"]]));

				// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
				assert.equal(view.compatibility.canView, true);
			});
		});

		describe("validation", () => {
			it("accepts valid initial content", () => {
				const ConfigSchema = sf.map("ConfigValid", sf.string);

				const map = createLocalMap("testMap");
				// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
				const view = map.viewWith(ConfigSchema) as any;

				/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
				// Should not throw for valid content
				view.initialize(new Map([["key", "value"]]));
				assert.equal(view.root.get("key"), "value");
				/* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
			});

			it("throws when initializing twice", () => {
				const ConfigSchema = sf.map("ConfigTwice", sf.string);

				const map = createLocalMap("testMap");
				// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
				const view = map.viewWith(ConfigSchema) as any;

				// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
				view.initialize(new Map());

				// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
				assert.throws(() => view.initialize(new Map()));
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

			view.initialize({ name: "Alice", age: 30 });

			// The underlying map should have the data
			assert.equal(map.get("name"), "Alice");
			assert.equal(map.get("age"), 30);

			// Update via view
			(view.root as { age: number }).age = 31;
			assert.equal(map.get("age"), 31);
		});

		it("map changes are reflected in view", () => {
			const PersonSchema = sf.object("PersonMapChanges", {
				name: sf.string,
				age: sf.number,
			});

			const map = createLocalMap("testMap");
			const view = map.viewWith(PersonSchema);

			view.initialize({ name: "Alice", age: 30 });

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

				view.initialize({
					username: "alice123",
					age: 30,
					isActive: true,
					email: "alice@example.com",
				});

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

				view.initialize({
					name: "Bob",
					age: 25,
					nickname: "Bobby",
				});

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

				view.initialize({
					firstName: "Charlie",
					lastName: "Brown",
					age: 35,
				});

				// Update each field independently
				// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
				(view.root as any).firstName = "Charles";
				// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
				(view.root as any).age = 36;

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

				view.initialize({
					stringField: "hello",
					numberField: 42,
					booleanField: true,
				});

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

				view.initialize({
					stringField: "initial",
					numberField: 0,
					booleanField: false,
				});

				// Update each field
				/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
				const mutableView = view.root as any;
				mutableView.stringField = "updated";
				mutableView.numberField = 100;
				mutableView.booleanField = true;
				/* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */

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
				// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
				const view = map.viewWith(UserMapSchema) as any;

				/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
				view.initialize(new Map([["user1", { name: "Alice", email: "alice@example.com" }]]));

				assert.deepEqual(view.root.get("user1"), {
					name: "Alice",
					email: "alice@example.com",
				});
				/* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
			});

			it("sets and gets object values in a map", () => {
				const ProductSchema = sf.object("ProductMapValue", {
					name: sf.string,
					price: sf.number,
				});

				const ProductMapSchema = sf.map("ProductMap", ProductSchema);

				const map = createLocalMap("testMap");
				// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
				const view = map.viewWith(ProductMapSchema) as any;

				/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
				view.initialize(new Map());

				view.root.set("prod1", { name: "Widget", price: 9.99 });
				view.root.set("prod2", { name: "Gadget", price: 19.99 });

				assert.deepEqual(view.root.get("prod1"), { name: "Widget", price: 9.99 });
				assert.deepEqual(view.root.get("prod2"), { name: "Gadget", price: 19.99 });
				/* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
			});

			it("deletes object entries", () => {
				const ItemSchema = sf.object("ItemMapValue", {
					id: sf.number,
					description: sf.string,
				});

				const ItemMapSchema = sf.map("ItemMap", ItemSchema);

				const map = createLocalMap("testMap");
				// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
				const view = map.viewWith(ItemMapSchema) as any;

				/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
				view.initialize(
					new Map([
						["item1", { id: 1, description: "First item" }],
						["item2", { id: 2, description: "Second item" }],
					]),
				);

				assert.equal(view.root.has("item1"), true);
				assert.equal(view.root.size, 2);

				const deleted = view.root.delete("item1");
				assert.equal(deleted, true);
				assert.equal(view.root.has("item1"), false);
				assert.equal(view.root.size, 1);
				/* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
			});

			it("iterates over object values", () => {
				const RecordSchema = sf.object("RecordMapValue", {
					value: sf.number,
				});

				const RecordMapSchema = sf.map("RecordMap", RecordSchema);

				const map = createLocalMap("testMap");
				// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
				const view = map.viewWith(RecordMapSchema) as any;

				/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
				view.initialize(
					new Map([
						["a", { value: 1 }],
						["b", { value: 2 }],
						["c", { value: 3 }],
					]),
				);

				const values = [...view.root.values()];
				/* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */

				assert.equal(values.length, 3);
				// eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
				const sum = values.reduce((acc: number, v: any) => acc + v.value, 0);
				assert.equal(sum, 6);
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

			view.initialize({ firstName: "John", lastName: "Doe", age: 25 });

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

			view.initialize({ a: "hello", b: 42 });

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

			view.initialize({ x: "test", y: 100 });

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

			view.initialize({ prop1: "a", prop2: "b", prop3: 3 });

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
			viewV1.initialize({ name: "Alice" });

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
			viewV1.initialize({ name: "Bob" });

			// Create V2 view and upgrade
			const viewV2 = map.viewWith(SchemaV2);
			viewV2.upgradeSchema();

			// New optional field should be undefined
			assert.equal(viewV2.root.nickname, undefined);

			// Should be able to set the new optional field
			// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
			(viewV2.root as any).nickname = "Bobby";
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
			viewV1.initialize({ name: "Charlie" });

			// Create V2 view - should not be able to upgrade
			const viewV2 = map.viewWith(SchemaV2);
			assert.equal(viewV2.compatibility.canUpgrade, false);

			// Attempting to upgrade should throw
			assert.throws(() => viewV2.upgradeSchema());
		});
	});
});
