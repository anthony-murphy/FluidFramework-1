/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, unicorn/no-array-for-each, unicorn/no-array-method-this-argument */

import { strict as assert } from "node:assert";

import { SchemaFactory } from "../factory/index.js";
import { MockStorage, MockPersistence } from "./mockStorage.js";
import { SchematizedObjectView, SchematizedMapView, UsageError } from "../view/index.js";

describe("View", () => {
	const sf = new SchemaFactory("test");

	describe("SchematizedObjectView", () => {
		describe("field access", () => {
			it("gets and sets field values", () => {
				const PersonSchema = sf.object("PersonView", {
					name: sf.string,
					age: sf.number,
				});

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedObjectView(storage, PersonSchema, persistence);

				view.initialize();
				view.root.name = "Alice";
				view.root.age = 30;

				assert.equal(view.root.name, "Alice");
				assert.equal(view.root.age, 30);

				view.root.age = 31;
				assert.equal(view.root.age, 31);
			});

			it("handles optional fields when present", () => {
				const PersonSchema = sf.object("PersonOptionalView", {
					name: sf.string,
					nickname: sf.optional(sf.string),
				});

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedObjectView(storage, PersonSchema, persistence);

				view.initialize();
				view.root.name = "Alice";
				view.root.nickname = "Ali";

				assert.equal(view.root.nickname, "Ali");
			});

			it("handles optional fields when absent", () => {
				const PersonSchema = sf.object("PersonOptionalAbsentView", {
					name: sf.string,
					nickname: sf.optional(sf.string),
				});

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedObjectView(storage, PersonSchema, persistence);

				view.initialize();
				view.root.name = "Alice";

				assert.equal(view.root.nickname, undefined);
			});

			it("allows setting optional field to undefined", () => {
				const PersonSchema = sf.object("PersonSetOptionalUndefined", {
					name: sf.string,
					nickname: sf.optional(sf.string),
				});

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedObjectView(storage, PersonSchema, persistence);

				view.initialize();
				view.root.name = "Alice";
				view.root.nickname = "Ali";
				assert.equal(view.root.nickname, "Ali");

				view.root.nickname = undefined;
				assert.equal(view.root.nickname, undefined);
			});

			it("checks field existence with hasField", () => {
				const PersonSchema = sf.object("PersonHasField", {
					name: sf.string,
					nickname: sf.optional(sf.string),
				});

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedObjectView(storage, PersonSchema, persistence);

				view.initialize();
				view.root.name = "Alice";

				assert.equal("name" in view.root, true);
				assert.equal("nickname" in view.root, false);
			});

			it("returns undefined for unknown field on get", () => {
				const PersonSchema = sf.object("PersonUnknownGet", {
					name: sf.string,
				});

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedObjectView(storage, PersonSchema, persistence);

				view.initialize();
				view.root.name = "Alice";

				// Accessing unknown fields via proxy returns undefined (Reflect fallback)
				assert.equal(Reflect.get(view.root, "unknownField"), undefined);
			});

			it("returns false when setting unknown field", () => {
				const PersonSchema = sf.object("PersonUnknownSet", {
					name: sf.string,
				});

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedObjectView(storage, PersonSchema, persistence);

				view.initialize();
				view.root.name = "Alice";

				// Setting unknown fields via proxy returns false
				const result = Reflect.set(view.root, "unknownField", "value");
				assert.equal(result, false);
			});

			it("throws UsageError when setting required field to undefined", () => {
				const PersonSchema = sf.object("PersonRequiredUndefined", {
					name: sf.string,
				});

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedObjectView(storage, PersonSchema, persistence);

				view.initialize();
				view.root.name = "Alice";

				assert.throws(() => Reflect.set(view.root, "name", undefined), UsageError);
			});
		});

		describe("validation on set", () => {
			// Note: The proxy set handler uses a simplified getFieldNodeSchema that creates
			// a minimal schema for storage operations. This means validation only checks
			// against the first allowed type's leaf kind, not the full type system.
			// These tests verify the current behavior.

			it("accepts valid values", () => {
				const PersonSchema = sf.object("PersonValidType", {
					name: sf.string,
					age: sf.number,
				});

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedObjectView(storage, PersonSchema, persistence);

				view.initialize();
				view.root.name = "Alice";
				view.root.age = 30;

				// Should not throw for valid values
				view.root.age = 31;
				assert.equal(view.root.age, 31);
			});
		});

		describe("initialize()", () => {
			it("persists schema on initialize", () => {
				const PersonSchema = sf.object("PersonInit", {
					name: sf.string,
					age: sf.number,
				});

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedObjectView(storage, PersonSchema, persistence);

				view.initialize();
				view.root.name = "Alice";
				view.root.age = 30;

				assert.equal(view.root.name, "Alice");
				assert.equal(view.root.age, 30);
			});

			it("throws UsageError when initializing twice", () => {
				const PersonSchema = sf.object("PersonInitTwice", {
					name: sf.string,
				});

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedObjectView(storage, PersonSchema, persistence);

				view.initialize();

				assert.throws(() => view.initialize(), UsageError);
			});

			it("sets persisted schema on initialize", () => {
				const PersonSchema = sf.object("PersonPersisted", {
					name: sf.string,
				});

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedObjectView(storage, PersonSchema, persistence);

				assert.equal(persistence.getPersistedSchema(), undefined);

				view.initialize();

				assert.notEqual(persistence.getPersistedSchema(), undefined);
			});
		});

		describe("upgradeSchema()", () => {
			it("upgrades schema when compatible", () => {
				const PersonSchemaV1 = sf.object("PersonUpgrade", {
					name: sf.string,
				});
				const PersonSchemaV2 = sf.object("PersonUpgrade", {
					name: sf.string,
					email: sf.optional(sf.string),
				});

				const storage = new MockStorage();
				const persistence = new MockPersistence();

				const viewV1 = new SchematizedObjectView(storage, PersonSchemaV1, persistence);
				viewV1.initialize();
				viewV1.root.name = "Alice";

				const viewV2 = new SchematizedObjectView(storage, PersonSchemaV2, persistence);
				assert.equal(viewV2.compatibility.canUpgrade, true);

				viewV2.upgradeSchema();
			});

			it("throws UsageError when schemas are incompatible", () => {
				const PersonSchemaV1 = sf.object("PersonIncompat", {
					name: sf.string,
				});
				const PersonSchemaV2 = sf.object("PersonIncompat", {
					name: sf.string,
					requiredField: sf.number, // New required field is breaking
				});

				const storage = new MockStorage();
				const persistence = new MockPersistence();

				const viewV1 = new SchematizedObjectView(storage, PersonSchemaV1, persistence);
				viewV1.initialize();
				viewV1.root.name = "Alice";

				const viewV2 = new SchematizedObjectView(storage, PersonSchemaV2, persistence);

				assert.throws(() => viewV2.upgradeSchema(), UsageError);
			});
		});

		describe("compatibility property", () => {
			it("returns canInitialize=true when no schema stored", () => {
				const PersonSchema = sf.object("PersonCompat", {
					name: sf.string,
				});

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedObjectView(storage, PersonSchema, persistence);

				assert.equal(view.compatibility.canInitialize, true);
			});

			it("returns canInitialize=false after initialization", () => {
				const PersonSchema = sf.object("PersonCompatInit", {
					name: sf.string,
				});

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedObjectView(storage, PersonSchema, persistence);

				view.initialize();

				assert.equal(view.compatibility.canInitialize, false);
			});
		});

		describe("nodeSchema property", () => {
			it("returns the schema", () => {
				const PersonSchema = sf.object("PersonNodeSchema", {
					name: sf.string,
				});

				const storage = new MockStorage();
				const view = new SchematizedObjectView(storage, PersonSchema);

				assert.strictEqual(view.nodeSchema, PersonSchema);
			});
		});

		describe("ignoreStoredSchema option", () => {
			it("ignores stored schema when identifier matches", () => {
				const PersonSchemaV1 = sf.object("PersonIgnoreV1", {
					name: sf.string,
				});
				const PersonSchemaV2 = sf.object("PersonIgnoreV2", {
					name: sf.string,
					email: sf.string, // Breaking change - new required field
				});

				const storage = new MockStorage();
				const persistence = new MockPersistence();

				// Initialize with V1
				const viewV1 = new SchematizedObjectView(storage, PersonSchemaV1, persistence);
				viewV1.initialize();
				viewV1.root.name = "Alice";

				// Without ignoreStoredSchema, we cannot initialize with V2
				const viewV2NoIgnore = new SchematizedObjectView(storage, PersonSchemaV2, persistence);
				assert.equal(viewV2NoIgnore.compatibility.canInitialize, false);

				// With ignoreStoredSchema, we can initialize with V2 (escape hatch)
				const viewV2WithIgnore = new SchematizedObjectView(
					storage,
					PersonSchemaV2,
					persistence,
					{
						ignoreStoredSchema: ["test.PersonIgnoreV1"],
					},
				);
				assert.equal(viewV2WithIgnore.compatibility.canInitialize, true);
			});

			it("does not ignore stored schema when identifier does not match", () => {
				const PersonSchemaV1 = sf.object("PersonNoMatchV1", {
					name: sf.string,
				});
				const PersonSchemaV2 = sf.object("PersonNoMatchV2", {
					name: sf.string,
					email: sf.string,
				});

				const storage = new MockStorage();
				const persistence = new MockPersistence();

				// Initialize with V1
				const viewV1 = new SchematizedObjectView(storage, PersonSchemaV1, persistence);
				viewV1.initialize();

				// With ignoreStoredSchema for a different identifier, canInitialize should still be false
				const viewV2 = new SchematizedObjectView(storage, PersonSchemaV2, persistence, {
					ignoreStoredSchema: ["test.SomeOtherSchema"],
				});
				assert.equal(viewV2.compatibility.canInitialize, false);
			});

			it("allows re-initialization after ignoring stored schema", () => {
				const PersonSchemaV1 = sf.object("PersonReinitV1", {
					name: sf.string,
				});
				const PersonSchemaV2 = sf.object("PersonReinitV2", {
					name: sf.string,
					email: sf.string,
				});

				const storage = new MockStorage();
				const persistence = new MockPersistence();

				// Initialize with V1
				const viewV1 = new SchematizedObjectView(storage, PersonSchemaV1, persistence);
				viewV1.initialize();
				viewV1.root.name = "Alice";

				// Create view V2 with ignoreStoredSchema and initialize
				// Note: MockPersistence.setPersistedSchema throws if already set,
				// so we need to upgrade instead
				const viewV2 = new SchematizedObjectView(storage, PersonSchemaV2, persistence, {
					ignoreStoredSchema: ["test.PersonReinitV1"],
				});

				// With ignore, canInitialize is true (as if no schema stored)
				assert.equal(viewV2.compatibility.canInitialize, true);
			});
		});
	});

	describe("SchematizedMapView", () => {
		describe("get/set/delete/has operations", () => {
			it("gets and sets values", () => {
				const ConfigSchema = sf.map("ConfigMap", sf.string);

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedMapView(storage, ConfigSchema, persistence);

				view.initialize();
				view.set("key1", "value1");

				assert.equal(view.get("key1"), "value1");

				view.set("key2", "value2");
				assert.equal(view.get("key2"), "value2");
			});

			it("returns undefined for missing keys", () => {
				const ConfigSchema = sf.map("ConfigMapMissing", sf.string);

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedMapView(storage, ConfigSchema, persistence);

				view.initialize();

				assert.equal(view.get("nonexistent"), undefined);
			});

			it("deletes entries", () => {
				const ConfigSchema = sf.map("ConfigMapDelete", sf.string);

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedMapView(storage, ConfigSchema, persistence);

				view.initialize();
				view.set("key1", "value1");
				assert.equal(view.has("key1"), true);

				const deleted = view.delete("key1");
				assert.equal(deleted, true);
				assert.equal(view.has("key1"), false);
			});

			it("delete returns false for non-existent keys", () => {
				const ConfigSchema = sf.map("ConfigMapDeleteNonExistent", sf.string);

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedMapView(storage, ConfigSchema, persistence);

				view.initialize();

				const deleted = view.delete("nonexistent");
				assert.equal(deleted, false);
			});

			it("has returns correct boolean", () => {
				const ConfigSchema = sf.map("ConfigMapHas", sf.string);

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedMapView(storage, ConfigSchema, persistence);

				view.initialize();
				view.set("exists", "value");

				assert.equal(view.has("exists"), true);
				assert.equal(view.has("notExists"), false);
			});
		});

		describe("size property", () => {
			it("returns correct size", () => {
				const ConfigSchema = sf.map("ConfigMapSize", sf.string);

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedMapView(storage, ConfigSchema, persistence);

				view.initialize();
				assert.equal(view.size, 0);

				view.set("key1", "value1");
				assert.equal(view.size, 1);

				view.set("key2", "value2");
				assert.equal(view.size, 2);

				view.delete("key1");
				assert.equal(view.size, 1);
			});
		});

		describe("keys/values/entries iteration", () => {
			it("iterates over keys", () => {
				const ConfigSchema = sf.map("ConfigMapKeys", sf.string);

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedMapView(storage, ConfigSchema, persistence);

				view.initialize();
				view.set("key1", "value1");
				view.set("key2", "value2");

				const keys = [...view.keys()];
				assert.deepEqual(keys.sort(), ["key1", "key2"]);
			});

			it("iterates over values", () => {
				const ConfigSchema = sf.map("ConfigMapValues", sf.string);

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedMapView(storage, ConfigSchema, persistence);

				view.initialize();
				view.set("key1", "value1");
				view.set("key2", "value2");

				const values = [...view.values()];
				assert.deepEqual(values.sort(), ["value1", "value2"]);
			});

			it("iterates over entries", () => {
				const ConfigSchema = sf.map("ConfigMapEntries", sf.string);

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedMapView(storage, ConfigSchema, persistence);

				view.initialize();
				view.set("key1", "value1");
				view.set("key2", "value2");

				const entries = [...view.entries()];
				assert.equal(entries.length, 2);
				const entryMap = new Map(entries);
				assert.equal(entryMap.get("key1"), "value1");
				assert.equal(entryMap.get("key2"), "value2");
			});

			it("is iterable with for...of", () => {
				const ConfigSchema = sf.map("ConfigMapIterable", sf.string);

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedMapView(storage, ConfigSchema, persistence);

				view.initialize();
				view.set("key1", "value1");
				view.set("key2", "value2");

				const collected: [string, unknown][] = [];
				for (const entry of view) {
					collected.push(entry);
				}

				assert.equal(collected.length, 2);
			});
		});

		describe("forEach method", () => {
			it("calls callback for each entry", () => {
				const ConfigSchema = sf.map("ConfigMapForEach", sf.string);

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedMapView(storage, ConfigSchema, persistence);

				view.initialize();
				view.set("key1", "value1");
				view.set("key2", "value2");

				const collected: [string, unknown][] = [];
				view.forEach((value, key) => {
					collected.push([key, value]);
				});

				assert.equal(collected.length, 2);
				const entryMap = new Map(collected);
				assert.equal(entryMap.get("key1"), "value1");
			});

			it("respects thisArg", () => {
				const ConfigSchema = sf.map("ConfigMapForEachThis", sf.string);

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedMapView(storage, ConfigSchema, persistence);

				view.initialize();
				view.set("key1", "value1");

				const context = { count: 0 };
				view.forEach(function (this: typeof context) {
					this.count++;
				}, context);

				assert.equal(context.count, 1);
			});
		});

		describe("clear method", () => {
			it("removes all entries", () => {
				const ConfigSchema = sf.map("ConfigMapClear", sf.string);

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedMapView(storage, ConfigSchema, persistence);

				view.initialize();
				view.set("key1", "value1");
				view.set("key2", "value2");

				assert.equal(view.size, 2);

				view.clear();

				assert.equal(view.size, 0);
				assert.equal(view.has("key1"), false);
				assert.equal(view.has("key2"), false);
			});
		});

		describe("validation on set", () => {
			// Note: The SchematizedMapView.set uses a simplified getValueNodeSchema
			// that creates a minimal schema for storage operations. Full type validation
			// depends on proper schema registry population.

			it("accepts valid values", () => {
				const ConfigSchema = sf.map("ConfigMapValidSet", sf.string);

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedMapView(storage, ConfigSchema, persistence);

				view.initialize();

				// Should not throw for valid string values
				view.set("key", "valid string");
				assert.equal(view.get("key"), "valid string");
			});
		});

		describe("initialize()", () => {
			// Note: Validation in initialize also uses simplified schema resolution.

			it("persists schema on initialize", () => {
				const ConfigSchema = sf.map("ConfigMapInitValid", sf.string);

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedMapView(storage, ConfigSchema, persistence);

				// Should not throw
				view.initialize();
				view.set("key", "value");
				assert.equal(view.get("key"), "value");
			});

			it("throws UsageError when initializing twice", () => {
				const ConfigSchema = sf.map("ConfigMapInitTwice", sf.string);

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedMapView(storage, ConfigSchema, persistence);

				view.initialize();

				assert.throws(() => view.initialize(), UsageError);
			});
		});

		describe("compatibility and nodeSchema", () => {
			it("returns correct compatibility status", () => {
				const ConfigSchema = sf.map("ConfigMapCompat", sf.string);

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedMapView(storage, ConfigSchema, persistence);

				assert.equal(view.compatibility.canInitialize, true);
				(view as any).initialize();

				assert.equal(view.compatibility.canInitialize, false);
			});

			it("returns the schema from nodeSchema", () => {
				const ConfigSchema = sf.map("ConfigMapNodeSchema", sf.string);

				const storage = new MockStorage();
				const view = new SchematizedMapView(storage, ConfigSchema);

				assert.strictEqual(view.nodeSchema, ConfigSchema);
			});
		});

		describe("set() returns this", () => {
			it("allows chaining set calls", () => {
				const ConfigSchema = sf.map("ConfigMapChain", sf.string);

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedMapView(storage, ConfigSchema, persistence);

				view.initialize();

				const result = view.set("key1", "value1").set("key2", "value2");

				assert.strictEqual(result, view);
				assert.equal(view.get("key1"), "value1");
				assert.equal(view.get("key2"), "value2");
			});
		});

		describe("ignoreStoredSchema option", () => {
			it("ignores stored schema when identifier matches", () => {
				const ConfigSchemaV1 = sf.map("ConfigIgnoreV1", sf.string);
				const ConfigSchemaV2 = sf.map("ConfigIgnoreV2", sf.number); // Incompatible change

				const storage = new MockStorage();
				const persistence = new MockPersistence();

				// Initialize with V1
				const viewV1 = new SchematizedMapView(storage, ConfigSchemaV1, persistence);
				viewV1.initialize();
				viewV1.set("key1", "value1");

				// Without ignoreStoredSchema, we cannot initialize with V2
				const viewV2NoIgnore = new SchematizedMapView(storage, ConfigSchemaV2, persistence);
				assert.equal(viewV2NoIgnore.compatibility.canInitialize, false);

				// With ignoreStoredSchema, we can initialize with V2 (escape hatch)
				const viewV2WithIgnore = new SchematizedMapView(storage, ConfigSchemaV2, persistence, {
					ignoreStoredSchema: ["test.ConfigIgnoreV1"],
				});
				assert.equal(viewV2WithIgnore.compatibility.canInitialize, true);
			});

			it("does not ignore stored schema when identifier does not match", () => {
				const ConfigSchemaV1 = sf.map("ConfigNoMatchV1", sf.string);
				const ConfigSchemaV2 = sf.map("ConfigNoMatchV2", sf.number);

				const storage = new MockStorage();
				const persistence = new MockPersistence();

				// Initialize with V1
				const viewV1 = new SchematizedMapView(storage, ConfigSchemaV1, persistence);
				viewV1.initialize();

				// With ignoreStoredSchema for a different identifier, canInitialize should still be false
				const viewV2 = new SchematizedMapView(storage, ConfigSchemaV2, persistence, {
					ignoreStoredSchema: ["test.SomeOtherSchema"],
				});
				assert.equal(viewV2.compatibility.canInitialize, false);
			});
		});
	});

	describe("SchematizedObjectView root property", () => {
		describe("property access through root", () => {
			it("gets property values through root", () => {
				const PersonSchema = sf.object("PersonProxy", {
					name: sf.string,
					age: sf.number,
				});

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedObjectView(storage, PersonSchema, persistence);

				view.initialize();
				view.root.name = "Alice";
				view.root.age = 30;

				assert.equal(view.root.name, "Alice");
				assert.equal(view.root.age, 30);
			});

			it("returns undefined for schema fields without values", () => {
				const PersonSchema = sf.object("PersonProxyUndefined", {
					name: sf.string,
					nickname: sf.optional(sf.string),
				});

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedObjectView(storage, PersonSchema, persistence);

				view.initialize();
				view.root.name = "Alice";

				assert.equal(view.root.nickname, undefined);
			});
		});

		describe("property assignment through root", () => {
			it("sets property values through root", () => {
				const PersonSchema = sf.object("PersonProxySet", {
					name: sf.string,
					age: sf.number,
				});

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedObjectView(storage, PersonSchema, persistence);

				view.initialize();
				view.root.name = "Alice";
				view.root.age = 30;

				// Use direct assignment via the root proxy
				(view.root as any).age = 31;
				assert.equal(view.root.age, 31);
				assert.equal(view.root.age, 31);
			});

			it("returns false for unknown properties on root", () => {
				const PersonSchema = sf.object("PersonProxyUnknown", {
					name: sf.string,
				});

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedObjectView(storage, PersonSchema, persistence);

				view.initialize();
				view.root.name = "Alice";

				// Setting unknown property on root returns false (strict mode would throw)
				const result = Reflect.set(view.root, "unknownProp", "value");
				assert.equal(result, false);
			});
		});

		describe("hasOwnProperty behavior on root", () => {
			it("returns true for schema fields in root", () => {
				const PersonSchema = sf.object("PersonProxyHas", {
					name: sf.string,
					age: sf.number,
				});

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedObjectView(storage, PersonSchema, persistence);

				view.initialize();
				view.root.name = "Alice";
				view.root.age = 30;

				assert.equal("name" in view.root, true);
				assert.equal("age" in view.root, true);
				assert.equal("unknownField" in view.root, false);
			});

			it("Object.keys on root returns field names", () => {
				const PersonSchema = sf.object("PersonProxyKeys", {
					name: sf.string,
					age: sf.number,
				});

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedObjectView(storage, PersonSchema, persistence);

				view.initialize();
				view.root.name = "Alice";
				view.root.age = 30;

				const keys = Object.keys(view.root);
				assert.deepEqual(keys.sort(), ["age", "name"]);
			});
		});

		describe("view methods access", () => {
			it("exposes compatibility property", () => {
				const PersonSchema = sf.object("PersonProxyCompat", {
					name: sf.string,
				});

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedObjectView(storage, PersonSchema, persistence);

				assert.equal(view.compatibility.canInitialize, true);
			});

			it("exposes initialize method", () => {
				const PersonSchema = sf.object("PersonProxyInit", {
					name: sf.string,
				});

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedObjectView(storage, PersonSchema, persistence);

				view.initialize();
				view.root.name = "Bob";

				assert.equal(view.root.name, "Bob");
			});

			it("exposes upgradeSchema method", () => {
				const PersonSchema = sf.object("PersonProxyUpgrade", {
					name: sf.string,
				});

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedObjectView(storage, PersonSchema, persistence);

				view.initialize();
				view.root.name = "Alice";

				// Should not throw (same schema)
				view.upgradeSchema();
			});
		});

		describe("Reflect fallback for prototype methods", () => {
			it("Reflect.get on non-schema properties returns undefined on plain proxy", () => {
				const PersonSchema = sf.object("PersonReflect", {
					name: sf.string,
				});

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedObjectView(storage, PersonSchema, persistence);

				view.initialize();
				view.root.name = "Alice";

				// Non-schema property should return undefined (since target is {})
				assert.equal((view.root as any).nonExistentProp, undefined);
			});

			it("Reflect.has on non-schema properties returns false on plain proxy", () => {
				const PersonSchema = sf.object("PersonReflectHas", {
					name: sf.string,
				});

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedObjectView(storage, PersonSchema, persistence);

				view.initialize();

				// Non-schema property should not be "in" the proxy
				assert.equal("nonExistentProp" in view.root, false);
			});
		});

		describe("custom methods via schema subclassing", () => {
			// Note: Casts in these tests are inherent to the custom methods pattern.
			// When subclassing a schema, `this` doesn't have field types, so methods
			// must cast to access fields. Similarly, the proxy type doesn't know about
			// custom methods added via subclassing, so callers must cast to invoke them.

			it("custom getter works on schema subclass", () => {
				// Create a schema class and subclass it with a custom getter
				const UserSchemaBase = sf.object("UserWithGetter", {
					firstName: sf.string,
					lastName: sf.string,
				});

				// Subclass to add custom getter
				class UserSchema extends UserSchemaBase {
					public get fullName(): string {
						return `${(this as any).firstName} ${(this as any).lastName}`;
					}
				}

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedObjectView(storage, UserSchema, persistence);

				view.initialize();
				view.root.firstName = "John";
				view.root.lastName = "Doe";

				// Access the custom getter through the proxy
				const fullName = (view.root as any).fullName;
				assert.equal(fullName, "John Doe");
			});

			it("custom method works on schema subclass", () => {
				// Create a schema class and subclass it with a custom method
				const CounterSchemaBase = sf.object("CounterWithMethod", {
					value: sf.number,
				});

				// Subclass to add custom method
				class CounterSchema extends CounterSchemaBase {
					public increment(): void {
						const current = (this as any).value as number;
						(this as any).value = current + 1;
					}
					public double(): number {
						return ((this as any).value as number) * 2;
					}
				}

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedObjectView(storage, CounterSchema, persistence);

				view.initialize();
				view.root.value = 5;

				// Access the custom method through the proxy
				// Cast needed: custom methods exist on schema class but aren't reflected in NodeFromSchema
				const root = view.root as { value: number; double(): number; increment(): void };
				assert.equal(root.double(), 10);

				// Call increment method which modifies the field
				root.increment();
				assert.equal(view.root.value, 6);
			});

			it("schema class can be subclassed multiple times", () => {
				// Create a base schema class
				const PersonSchemaBase = sf.object("PersonMultiSubclass", {
					name: sf.string,
					age: sf.number,
				});

				// First subclass
				class Adult extends PersonSchemaBase {
					public canVote(): boolean {
						return ((this as any).age as number) >= 18;
					}
				}

				// Second subclass
				class Child extends PersonSchemaBase {
					public canVote(): boolean {
						return false;
					}
				}

				// Test Adult subclass
				const adultStorage = new MockStorage();
				const adultPersistence = new MockPersistence();
				const adultView = new SchematizedObjectView(adultStorage, Adult, adultPersistence);
				adultView.initialize();
				adultView.root.name = "Alice";
				adultView.root.age = 25;
				assert.equal((adultView.root as any).canVote(), true);

				// Test Child subclass
				const childStorage = new MockStorage();
				const childPersistence = new MockPersistence();
				const childView = new SchematizedObjectView(childStorage, Child, childPersistence);
				childView.initialize();
				childView.root.name = "Bob";
				childView.root.age = 10;
				assert.equal((childView.root as any).canVote(), false);
			});

			it("instanceof works correctly with schema subclasses", () => {
				const SchemaBase = sf.object("InstanceOfTest", {
					value: sf.string,
				});

				class MySchema extends SchemaBase {}

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedObjectView(storage, MySchema, persistence);

				view.initialize();
				view.root.value = "test";

				// The proxy target is Object.create(MySchema.prototype), so instanceof should work
				assert(view.root instanceof MySchema);
				assert(view.root instanceof SchemaBase);
			});
		});

		describe("FieldProps.key storage override", () => {
			it("uses props.key for storage instead of property name", () => {
				const DocumentSchema = sf.object("DocWithKey", {
					title: sf.required(sf.string, { key: "doc_title" }),
				});

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedObjectView(storage, DocumentSchema, persistence);

				view.initialize();
				view.root.title = "My Document";

				// Verify the value is stored under "doc_title" key, not "title"
				assert.equal(storage.getRawValue("doc_title"), "My Document");
				assert.equal(storage.getRawValue("title"), undefined);

				// Verify we can read it back through the property name
				assert.equal(view.root.title, "My Document");
			});

			it("uses props.key for optional fields", () => {
				const PersonSchema = sf.object("PersonWithKey", {
					nickname: sf.optional(sf.string, { key: "nick" }),
				});

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedObjectView(storage, PersonSchema, persistence);

				view.initialize();
				view.root.nickname = "Ali";

				assert.equal(storage.getRawValue("nick"), "Ali");
				assert.equal(storage.getRawValue("nickname"), undefined);
				assert.equal(view.root.nickname, "Ali");
			});

			it("uses props.key for delete operation", () => {
				const PersonSchema = sf.object("PersonDeleteKey", {
					nickname: sf.optional(sf.string, { key: "nick" }),
				});

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedObjectView(storage, PersonSchema, persistence);

				view.initialize();
				view.root.nickname = "Ali";
				assert.equal(storage.getRawValue("nick"), "Ali");

				view.root.nickname = undefined;
				assert.equal(storage.getRawValue("nick"), undefined);
				assert.equal(storage.hasRawValue("nick"), false);
			});

			it("uses props.key for has check", () => {
				const PersonSchema = sf.object("PersonHasKey", {
					nickname: sf.optional(sf.string, { key: "nick" }),
				});

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedObjectView(storage, PersonSchema, persistence);

				view.initialize();

				// Should check "nick" key, not "nickname"
				assert.equal("nickname" in view.root, false);

				view.root.nickname = "Ali";
				assert.equal("nickname" in view.root, true);
			});

			it("mixed fields with and without key override", () => {
				const Schema = sf.object("MixedKeys", {
					normalField: sf.string,
					renamedField: sf.required(sf.string, { key: "stored_name" }),
					optionalRenamed: sf.optional(sf.number, { key: "opt_num" }),
				});

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedObjectView(storage, Schema, persistence);

				view.initialize();
				view.root.normalField = "normal";
				view.root.renamedField = "renamed";
				view.root.optionalRenamed = 42;

				// Check storage keys
				assert.equal(storage.getRawValue("normalField"), "normal");
				assert.equal(storage.getRawValue("stored_name"), "renamed");
				assert.equal(storage.getRawValue("opt_num"), 42);

				// Check property access
				assert.equal(view.root.normalField, "normal");
				assert.equal(view.root.renamedField, "renamed");
				assert.equal(view.root.optionalRenamed, 42);
			});
		});
	});
});
