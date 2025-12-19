/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { strict as assert } from "node:assert";

import { SchemaFactory } from "../factory/index.js";
import { MockStorage, MockPersistence } from "./mockStorage.js";
import {
	SchematizedObjectView,
	SchematizedMapView,
	createObjectViewProxy,
	SchemaValidationError,
	UsageError,
} from "../view/index.js";

// Note: The SchematizedMapView uses InferValueSchema which extracts the schema type,
// not the value type. The tests use type assertions to work around this and test
// the underlying runtime functionality.

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

				view.initialize({ name: "Alice", age: 30 });

				assert.equal(view.getFieldValue("name"), "Alice");
				assert.equal(view.getFieldValue("age"), 30);

				view.setFieldValue("age", 31);
				assert.equal(view.getFieldValue("age"), 31);
			});

			it("handles optional fields when present", () => {
				const PersonSchema = sf.object("PersonOptionalView", {
					name: sf.string,
					nickname: sf.optional(sf.string),
				});

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedObjectView(storage, PersonSchema, persistence);

				view.initialize({ name: "Alice", nickname: "Ali" });

				assert.equal(view.getFieldValue("nickname"), "Ali");
			});

			it("handles optional fields when absent", () => {
				const PersonSchema = sf.object("PersonOptionalAbsentView", {
					name: sf.string,
					nickname: sf.optional(sf.string),
				});

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedObjectView(storage, PersonSchema, persistence);

				view.initialize({ name: "Alice" });

				assert.equal(view.getFieldValue("nickname"), undefined);
			});

			it("allows setting optional field to undefined", () => {
				const PersonSchema = sf.object("PersonSetOptionalUndefined", {
					name: sf.string,
					nickname: sf.optional(sf.string),
				});

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedObjectView(storage, PersonSchema, persistence);

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

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedObjectView(storage, PersonSchema, persistence);

				view.initialize({ name: "Alice" });

				assert.equal(view.hasField("name"), true);
				assert.equal(view.hasField("nickname"), false);
			});

			it("throws UsageError for unknown field on get", () => {
				const PersonSchema = sf.object("PersonUnknownGet", {
					name: sf.string,
				});

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedObjectView(storage, PersonSchema, persistence);

				view.initialize({ name: "Alice" });

				assert.throws(
					() => view.getFieldValue("unknownField" as keyof typeof PersonSchema.fields),
					UsageError,
				);
			});

			it("throws UsageError for unknown field on set", () => {
				const PersonSchema = sf.object("PersonUnknownSet", {
					name: sf.string,
				});

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedObjectView(storage, PersonSchema, persistence);

				view.initialize({ name: "Alice" });

				assert.throws(
					() =>
						view.setFieldValue("unknownField" as keyof typeof PersonSchema.fields, "value"),
					UsageError,
				);
			});

			it("throws UsageError when setting required field to undefined", () => {
				const PersonSchema = sf.object("PersonRequiredUndefined", {
					name: sf.string,
				});

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedObjectView(storage, PersonSchema, persistence);

				view.initialize({ name: "Alice" });

				assert.throws(() => view.setFieldValue("name", undefined), UsageError);
			});
		});

		describe("validation on set", () => {
			// Note: The SchematizedObjectView.setFieldValue uses a simplified
			// getFieldNodeSchema that creates a minimal schema for storage operations.
			// This means validation only checks against the first allowed type's leaf kind,
			// not the full type system. These tests verify the current behavior.

			it("accepts valid values", () => {
				const PersonSchema = sf.object("PersonValidType", {
					name: sf.string,
					age: sf.number,
				});

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedObjectView(storage, PersonSchema, persistence);

				view.initialize({ name: "Alice", age: 30 });

				// Should not throw for valid values
				view.setFieldValue("age", 31);
				assert.equal(view.getFieldValue("age"), 31);
			});
		});

		describe("initialize()", () => {
			it("initializes storage with valid content", () => {
				const PersonSchema = sf.object("PersonInit", {
					name: sf.string,
					age: sf.number,
				});

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedObjectView(storage, PersonSchema, persistence);

				view.initialize({ name: "Alice", age: 30 });

				assert.equal(view.getFieldValue("name"), "Alice");
				assert.equal(view.getFieldValue("age"), 30);
			});

			it("throws SchemaValidationError for invalid initial content", () => {
				const PersonSchema = sf.object("PersonInitInvalid", {
					name: sf.string,
					age: sf.number,
				});

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedObjectView(storage, PersonSchema, persistence);

				assert.throws(
					() =>
						view.initialize({ name: "Alice", age: "not a number" } as unknown as {
							name: string;
							age: number;
						}),
					SchemaValidationError,
				);
			});

			it("throws UsageError when initializing twice", () => {
				const PersonSchema = sf.object("PersonInitTwice", {
					name: sf.string,
				});

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedObjectView(storage, PersonSchema, persistence);

				view.initialize({ name: "Alice" });

				assert.throws(() => view.initialize({ name: "Bob" }), UsageError);
			});

			it("sets persisted schema on initialize", () => {
				const PersonSchema = sf.object("PersonPersisted", {
					name: sf.string,
				});

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedObjectView(storage, PersonSchema, persistence);

				assert.equal(persistence.getPersistedSchema(), undefined);

				view.initialize({ name: "Alice" });

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
				viewV1.initialize({ name: "Alice" });

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
				viewV1.initialize({ name: "Alice" });

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

				view.initialize({ name: "Alice" });

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
	});

	describe("SchematizedMapView", () => {
		// The SchematizedMapView type parameters use InferValueSchema which returns the schema type,
		// not the value type. We use 'as unknown as any' to bypass the type system and test runtime behavior.

		describe("get/set/delete/has operations", () => {
			it("gets and sets values", () => {
				const ConfigSchema = sf.map("ConfigMap", sf.string);

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const view = new SchematizedMapView(storage, ConfigSchema, persistence) as any;

				view.initialize(new Map([["key1", "value1"]]));

				assert.equal(view.get("key1"), "value1");

				view.set("key2", "value2");
				assert.equal(view.get("key2"), "value2");
			});

			it("returns undefined for missing keys", () => {
				const ConfigSchema = sf.map("ConfigMapMissing", sf.string);

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const view = new SchematizedMapView(storage, ConfigSchema, persistence) as any;

				view.initialize(new Map());

				assert.equal(view.get("nonexistent"), undefined);
			});

			it("deletes entries", () => {
				const ConfigSchema = sf.map("ConfigMapDelete", sf.string);

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const view = new SchematizedMapView(storage, ConfigSchema, persistence) as any;

				view.initialize(new Map([["key1", "value1"]]));
				assert.equal(view.has("key1"), true);

				const deleted = view.delete("key1");
				assert.equal(deleted, true);
				assert.equal(view.has("key1"), false);
			});

			it("delete returns false for non-existent keys", () => {
				const ConfigSchema = sf.map("ConfigMapDeleteNonExistent", sf.string);

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const view = new SchematizedMapView(storage, ConfigSchema, persistence) as any;

				view.initialize(new Map());

				const deleted = view.delete("nonexistent");
				assert.equal(deleted, false);
			});

			it("has returns correct boolean", () => {
				const ConfigSchema = sf.map("ConfigMapHas", sf.string);

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const view = new SchematizedMapView(storage, ConfigSchema, persistence) as any;

				view.initialize(new Map([["exists", "value"]]));

				assert.equal(view.has("exists"), true);
				assert.equal(view.has("notExists"), false);
			});
		});

		describe("size property", () => {
			it("returns correct size", () => {
				const ConfigSchema = sf.map("ConfigMapSize", sf.string);

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const view = new SchematizedMapView(storage, ConfigSchema, persistence) as any;

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

		describe("keys/values/entries iteration", () => {
			it("iterates over keys", () => {
				const ConfigSchema = sf.map("ConfigMapKeys", sf.string);

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const view = new SchematizedMapView(storage, ConfigSchema, persistence) as any;

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
				const ConfigSchema = sf.map("ConfigMapValues", sf.string);

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const view = new SchematizedMapView(storage, ConfigSchema, persistence) as any;

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
				const ConfigSchema = sf.map("ConfigMapEntries", sf.string);

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const view = new SchematizedMapView(storage, ConfigSchema, persistence) as any;

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
				const ConfigSchema = sf.map("ConfigMapIterable", sf.string);

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const view = new SchematizedMapView(storage, ConfigSchema, persistence) as any;

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
		});

		describe("forEach method", () => {
			it("calls callback for each entry", () => {
				const ConfigSchema = sf.map("ConfigMapForEach", sf.string);

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const view = new SchematizedMapView(storage, ConfigSchema, persistence) as any;

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

			it("respects thisArg", () => {
				const ConfigSchema = sf.map("ConfigMapForEachThis", sf.string);

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const view = new SchematizedMapView(storage, ConfigSchema, persistence) as any;

				view.initialize(new Map([["key1", "value1"]]));

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
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const view = new SchematizedMapView(storage, ConfigSchema, persistence) as any;

				view.initialize(
					new Map([
						["key1", "value1"],
						["key2", "value2"],
					]),
				);

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
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const view = new SchematizedMapView(storage, ConfigSchema, persistence) as any;

				view.initialize(new Map());

				// Should not throw for valid string values
				view.set("key", "valid string");
				assert.equal(view.get("key"), "valid string");
			});
		});

		describe("initialize()", () => {
			// Note: Validation in initialize also uses simplified schema resolution.

			it("accepts valid initial content", () => {
				const ConfigSchema = sf.map("ConfigMapInitValid", sf.string);

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const view = new SchematizedMapView(storage, ConfigSchema, persistence) as any;

				// Should not throw for valid content
				view.initialize(new Map([["key", "value"]]));
				assert.equal(view.get("key"), "value");
			});

			it("throws UsageError when initializing twice", () => {
				const ConfigSchema = sf.map("ConfigMapInitTwice", sf.string);

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const view = new SchematizedMapView(storage, ConfigSchema, persistence) as any;

				view.initialize(new Map());

				assert.throws(() => view.initialize(new Map()), UsageError);
			});
		});

		describe("compatibility and nodeSchema", () => {
			it("returns correct compatibility status", () => {
				const ConfigSchema = sf.map("ConfigMapCompat", sf.string);

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedMapView(storage, ConfigSchema, persistence);

				assert.equal(view.compatibility.canInitialize, true);

				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				(view as any).initialize(new Map());

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
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const view = new SchematizedMapView(storage, ConfigSchema, persistence) as any;

				view.initialize(new Map());

				const result = view.set("key1", "value1").set("key2", "value2");

				assert.strictEqual(result, view);
				assert.equal(view.get("key1"), "value1");
				assert.equal(view.get("key2"), "value2");
			});
		});
	});

	describe("createObjectViewProxy", () => {
		describe("property access", () => {
			it("gets property values", () => {
				const PersonSchema = sf.object("PersonProxy", {
					name: sf.string,
					age: sf.number,
				});

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedObjectView(storage, PersonSchema, persistence);

				view.initialize({ name: "Alice", age: 30 });

				const proxy = createObjectViewProxy(view, PersonSchema);

				assert.equal(proxy.name, "Alice");
				assert.equal(proxy.age, 30);
			});

			it("returns undefined for schema fields without values", () => {
				const PersonSchema = sf.object("PersonProxyUndefined", {
					name: sf.string,
					nickname: sf.optional(sf.string),
				});

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedObjectView(storage, PersonSchema, persistence);

				view.initialize({ name: "Alice" });

				const proxy = createObjectViewProxy(view, PersonSchema);

				assert.equal(proxy.nickname, undefined);
			});
		});

		describe("property assignment", () => {
			it("sets property values", () => {
				const PersonSchema = sf.object("PersonProxySet", {
					name: sf.string,
					age: sf.number,
				});

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedObjectView(storage, PersonSchema, persistence);

				view.initialize({ name: "Alice", age: 30 });

				const proxy = createObjectViewProxy(view, PersonSchema);

				// Use direct assignment via the proxy handler
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				(proxy as any).age = 31;
				assert.equal(proxy.age, 31);
				assert.equal(view.getFieldValue("age"), 31);
			});

			it("returns false for unknown properties", () => {
				const PersonSchema = sf.object("PersonProxyUnknown", {
					name: sf.string,
				});

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedObjectView(storage, PersonSchema, persistence);

				view.initialize({ name: "Alice" });

				const proxy = createObjectViewProxy(view, PersonSchema);

				// Setting unknown property returns false (strict mode would throw)
				const result = Reflect.set(proxy, "unknownProp", "value");
				assert.equal(result, false);
			});
		});

		describe("hasOwnProperty behavior", () => {
			it("returns true for schema fields", () => {
				const PersonSchema = sf.object("PersonProxyHas", {
					name: sf.string,
					age: sf.number,
				});

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedObjectView(storage, PersonSchema, persistence);

				view.initialize({ name: "Alice", age: 30 });

				const proxy = createObjectViewProxy(view, PersonSchema);

				assert.equal("name" in proxy, true);
				assert.equal("age" in proxy, true);
				assert.equal("unknownField" in proxy, false);
			});

			it("Object.keys returns field names", () => {
				const PersonSchema = sf.object("PersonProxyKeys", {
					name: sf.string,
					age: sf.number,
				});

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedObjectView(storage, PersonSchema, persistence);

				view.initialize({ name: "Alice", age: 30 });

				const proxy = createObjectViewProxy(view, PersonSchema);

				const keys = Object.keys(proxy);
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

				const proxy = createObjectViewProxy(view, PersonSchema);

				assert.equal(proxy.compatibility.canInitialize, true);
			});

			it("exposes initialize method", () => {
				const PersonSchema = sf.object("PersonProxyInit", {
					name: sf.string,
				});

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedObjectView(storage, PersonSchema, persistence);

				const proxy = createObjectViewProxy(view, PersonSchema);

				proxy.initialize({ name: "Bob" });

				assert.equal(proxy.name, "Bob");
			});

			it("exposes upgradeSchema method", () => {
				const PersonSchema = sf.object("PersonProxyUpgrade", {
					name: sf.string,
				});

				const storage = new MockStorage();
				const persistence = new MockPersistence();
				const view = new SchematizedObjectView(storage, PersonSchema, persistence);

				const proxy = createObjectViewProxy(view, PersonSchema);

				proxy.initialize({ name: "Alice" });

				// Should not throw (same schema)
				proxy.upgradeSchema();
			});
		});
	});
});
