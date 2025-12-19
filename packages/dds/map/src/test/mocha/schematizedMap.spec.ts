/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { strict as assert } from "node:assert";

import { MockFluidDataStoreRuntime } from "@fluidframework/test-runtime-utils/internal";

import { SharedMap } from "../../index.js";
import { SchemaFactory, SchemaValidationError } from "@fluidframework/schema/internal";

/**
 * Creates a local SharedMap for testing.
 */
function createLocalMap(id: string): SharedMap {
	const dataStoreRuntime = new MockFluidDataStoreRuntime({
		registry: [SharedMap.getFactory()],
	});
	const map = SharedMap.create(dataStoreRuntime, id);
	return map;
}

describe("SharedMap.viewWith", () => {
	const sf = new SchemaFactory("test");

	describe("ObjectNodeSchema views", () => {
		describe("basic operations", () => {
			it("returns a SchematizedObjectView for ObjectNodeSchema", () => {
				const PersonSchema = sf.object("Person", {
					name: sf.string,
					age: sf.number,
				});

				const map = createLocalMap("testMap");
				const view = map.viewWith(PersonSchema);

				// View should have the expected interface
				assert.ok(view, "viewWith should return a view");
				assert.ok(typeof view.initialize === "function", "view should have initialize method");
				assert.ok(
					typeof view.getFieldValue === "function",
					"view should have getFieldValue method",
				);
				assert.ok(
					typeof view.setFieldValue === "function",
					"view should have setFieldValue method",
				);
			});

			it("initializes and retrieves field values", () => {
				const PersonSchema = sf.object("PersonInit", {
					name: sf.string,
					age: sf.number,
				});

				const map = createLocalMap("testMap");
				const view = map.viewWith(PersonSchema);

				view.initialize({ name: "Alice", age: 30 });

				assert.equal(view.getFieldValue("name"), "Alice");
				assert.equal(view.getFieldValue("age"), 30);
			});

			it("sets and retrieves updated field values", () => {
				const PersonSchema = sf.object("PersonSet", {
					name: sf.string,
					age: sf.number,
				});

				const map = createLocalMap("testMap");
				const view = map.viewWith(PersonSchema);

				view.initialize({ name: "Alice", age: 30 });
				view.setFieldValue("age", 31);

				assert.equal(view.getFieldValue("age"), 31);
			});

			it("handles optional fields when present", () => {
				const PersonSchema = sf.object("PersonOptional", {
					name: sf.string,
					nickname: sf.optional(sf.string),
				});

				const map = createLocalMap("testMap");
				const view = map.viewWith(PersonSchema);

				view.initialize({ name: "Alice", nickname: "Ali" });

				assert.equal(view.getFieldValue("nickname"), "Ali");
			});

			it("handles optional fields when absent", () => {
				const PersonSchema = sf.object("PersonOptionalAbsent", {
					name: sf.string,
					nickname: sf.optional(sf.string),
				});

				const map = createLocalMap("testMap");
				const view = map.viewWith(PersonSchema);

				view.initialize({ name: "Alice" });

				assert.equal(view.getFieldValue("nickname"), undefined);
			});

			it("allows setting optional fields to undefined", () => {
				const PersonSchema = sf.object("PersonOptionalUndef", {
					name: sf.string,
					nickname: sf.optional(sf.string),
				});

				const map = createLocalMap("testMap");
				const view = map.viewWith(PersonSchema);

				view.initialize({ name: "Alice", nickname: "Ali" });
				assert.equal(view.getFieldValue("nickname"), "Ali");

				view.setFieldValue("nickname", undefined);
				assert.equal(view.getFieldValue("nickname"), undefined);
			});

			it("checks field existence with hasField", () => {
				const PersonSchema = sf.object("PersonHasField", {
					name: sf.string,
					nickname: sf.optional(sf.string),
				});

				const map = createLocalMap("testMap");
				const view = map.viewWith(PersonSchema);

				view.initialize({ name: "Alice" });

				assert.equal(view.hasField("name"), true);
				assert.equal(view.hasField("nickname"), false);
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

		describe("nodeSchema property", () => {
			it("returns the schema", () => {
				const PersonSchema = sf.object("PersonNodeSchema", {
					name: sf.string,
				});

				const map = createLocalMap("testMap");
				const view = map.viewWith(PersonSchema);

				assert.strictEqual(view.nodeSchema, PersonSchema);
			});
		});
	});

	describe("MapNodeSchema views", () => {
		describe("basic operations", () => {
			it("returns a SchematizedMapView for MapNodeSchema", () => {
				const ConfigSchema = sf.map("Config", sf.string);

				const map = createLocalMap("testMap");
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const view = map.viewWith(ConfigSchema) as any;

				// View should have Map-like interface
				assert.ok(view, "viewWith should return a view");
				assert.ok(typeof view.initialize === "function", "view should have initialize method");
				assert.ok(typeof view.get === "function", "view should have get method");
				assert.ok(typeof view.set === "function", "view should have set method");
				assert.ok(typeof view.delete === "function", "view should have delete method");
				assert.ok(typeof view.has === "function", "view should have has method");
			});

			it("gets and sets values", () => {
				const ConfigSchema = sf.map("ConfigGetSet", sf.string);

				const map = createLocalMap("testMap");
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const view = map.viewWith(ConfigSchema) as any;

				view.initialize(new Map([["key1", "value1"]]));

				assert.equal(view.get("key1"), "value1");

				view.set("key2", "value2");
				assert.equal(view.get("key2"), "value2");
			});

			it("returns undefined for missing keys", () => {
				const ConfigSchema = sf.map("ConfigMissing", sf.string);

				const map = createLocalMap("testMap");
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const view = map.viewWith(ConfigSchema) as any;

				view.initialize(new Map());

				assert.equal(view.get("nonexistent"), undefined);
			});

			it("deletes entries", () => {
				const ConfigSchema = sf.map("ConfigDelete", sf.string);

				const map = createLocalMap("testMap");
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const view = map.viewWith(ConfigSchema) as any;

				view.initialize(new Map([["key1", "value1"]]));
				assert.equal(view.has("key1"), true);

				const deleted = view.delete("key1");
				assert.equal(deleted, true);
				assert.equal(view.has("key1"), false);
			});

			it("delete returns false for non-existent keys", () => {
				const ConfigSchema = sf.map("ConfigDeleteNonExist", sf.string);

				const map = createLocalMap("testMap");
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const view = map.viewWith(ConfigSchema) as any;

				view.initialize(new Map());

				const deleted = view.delete("nonexistent");
				assert.equal(deleted, false);
			});

			it("has returns correct boolean", () => {
				const ConfigSchema = sf.map("ConfigHas", sf.string);

				const map = createLocalMap("testMap");
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const view = map.viewWith(ConfigSchema) as any;

				view.initialize(new Map([["exists", "value"]]));

				assert.equal(view.has("exists"), true);
				assert.equal(view.has("notExists"), false);
			});
		});

		describe("size property", () => {
			it("returns correct size", () => {
				const ConfigSchema = sf.map("ConfigSize", sf.string);

				const map = createLocalMap("testMap");
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const view = map.viewWith(ConfigSchema) as any;

				view.initialize(new Map());
				assert.equal(view.size, 0);

				view.set("key1", "value1");
				assert.equal(view.size, 1);

				view.set("key2", "value2");
				assert.equal(view.size, 2);

				view.delete("key1");
				assert.equal(view.size, 1);
			});
		});

		describe("iteration methods", () => {
			it("iterates over keys", () => {
				const ConfigSchema = sf.map("ConfigKeys", sf.string);

				const map = createLocalMap("testMap");
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const view = map.viewWith(ConfigSchema) as any;

				view.initialize(
					new Map([
						["key1", "value1"],
						["key2", "value2"],
					]),
				);

				const keys = [...view.keys()];
				assert.deepEqual(keys.sort(), ["key1", "key2"]);
			});

			it("iterates over values", () => {
				const ConfigSchema = sf.map("ConfigValues", sf.string);

				const map = createLocalMap("testMap");
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const view = map.viewWith(ConfigSchema) as any;

				view.initialize(
					new Map([
						["key1", "value1"],
						["key2", "value2"],
					]),
				);

				const values = [...view.values()];
				assert.deepEqual(values.sort(), ["value1", "value2"]);
			});

			it("iterates over entries", () => {
				const ConfigSchema = sf.map("ConfigEntries", sf.string);

				const map = createLocalMap("testMap");
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const view = map.viewWith(ConfigSchema) as any;

				view.initialize(
					new Map([
						["key1", "value1"],
						["key2", "value2"],
					]),
				);

				const entries = [...view.entries()];
				assert.equal(entries.length, 2);
				const entryMap = new Map(entries);
				assert.equal(entryMap.get("key1"), "value1");
				assert.equal(entryMap.get("key2"), "value2");
			});

			it("is iterable with for...of", () => {
				const ConfigSchema = sf.map("ConfigIterable", sf.string);

				const map = createLocalMap("testMap");
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const view = map.viewWith(ConfigSchema) as any;

				view.initialize(
					new Map([
						["key1", "value1"],
						["key2", "value2"],
					]),
				);

				const collected: Array<[string, string]> = [];
				for (const entry of view) {
					collected.push(entry);
				}

				assert.equal(collected.length, 2);
			});

			it("supports forEach", () => {
				const ConfigSchema = sf.map("ConfigForEach", sf.string);

				const map = createLocalMap("testMap");
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const view = map.viewWith(ConfigSchema) as any;

				view.initialize(
					new Map([
						["key1", "value1"],
						["key2", "value2"],
					]),
				);

				const collected: Array<[string, string]> = [];
				view.forEach((value: string, key: string) => {
					collected.push([key, value]);
				});

				assert.equal(collected.length, 2);
				const entryMap = new Map(collected);
				assert.equal(entryMap.get("key1"), "value1");
			});
		});

		describe("compatibility", () => {
			it("returns canInitialize=true when no schema stored", () => {
				const ConfigSchema = sf.map("ConfigCanInit", sf.string);

				const map = createLocalMap("testMap");
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const view = map.viewWith(ConfigSchema) as any;

				assert.equal(view.compatibility.canInitialize, true);
			});

			it("returns canInitialize=false after initialization", () => {
				const ConfigSchema = sf.map("ConfigCanInitAfter", sf.string);

				const map = createLocalMap("testMap");
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const view = map.viewWith(ConfigSchema) as any;

				view.initialize(new Map());

				assert.equal(view.compatibility.canInitialize, false);
			});

			it("returns canView=true for compatible schema", () => {
				const ConfigSchema = sf.map("ConfigCanView", sf.string);

				const map = createLocalMap("testMap");
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const view = map.viewWith(ConfigSchema) as any;

				view.initialize(new Map([["key", "value"]]));

				assert.equal(view.compatibility.canView, true);
			});
		});

		describe("nodeSchema property", () => {
			it("returns the schema", () => {
				const ConfigSchema = sf.map("ConfigNodeSchema", sf.string);

				const map = createLocalMap("testMap");
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const view = map.viewWith(ConfigSchema) as any;

				assert.strictEqual(view.nodeSchema, ConfigSchema);
			});
		});

		describe("validation", () => {
			it("accepts valid initial content", () => {
				const ConfigSchema = sf.map("ConfigValid", sf.string);

				const map = createLocalMap("testMap");
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const view = map.viewWith(ConfigSchema) as any;

				// Should not throw for valid content
				view.initialize(new Map([["key", "value"]]));
				assert.equal(view.get("key"), "value");
			});

			it("throws when initializing twice", () => {
				const ConfigSchema = sf.map("ConfigTwice", sf.string);

				const map = createLocalMap("testMap");
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const view = map.viewWith(ConfigSchema) as any;

				view.initialize(new Map());

				assert.throws(() => view.initialize(new Map()));
			});
		});
	});

	describe("error handling", () => {
		it("throws for unsupported schema types", () => {
			// LeafNodeSchema is not supported for viewWith
			const LeafSchema = sf.string;

			const map = createLocalMap("testMap");

			assert.throws(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				() => map.viewWith(LeafSchema as any),
				/Schema must be an ObjectNodeSchema or MapNodeSchema/,
			);
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
			view.setFieldValue("age", 31);
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
			assert.equal(view.getFieldValue("age"), 32);
		});
	});
});
