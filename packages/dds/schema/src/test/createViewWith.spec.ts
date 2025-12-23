/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment */

import { strict as assert } from "node:assert";

import { createViewWith, type IViewableStorage } from "../dds/index.js";
import { SchemaFactory } from "../factory/index.js";
import type { ISchemaStorage, ISchemaPersistence } from "../storage/index.js";
import { SchematizedObjectView, SchematizedMapView } from "../view/index.js";
import { MockStorage, MockPersistence } from "./mockStorage.js";

/**
 * Mock implementation of IViewableStorage for testing createViewWith.
 *
 * @remarks
 * This class combines MockStorage and MockPersistence into a single
 * object that implements IViewableStorage, enabling testing of the
 * createViewWith factory function.
 */
class MockViewableStorage implements IViewableStorage {
	private readonly storage = new MockStorage();
	private readonly persistence = new MockPersistence();

	public getSchemaStorage(): ISchemaStorage {
		return this.storage;
	}

	public getSchemaPersistence(): ISchemaPersistence {
		return this.persistence;
	}

	/**
	 * Get the underlying MockStorage for testing purposes.
	 */
	public getMockStorage(): MockStorage {
		return this.storage;
	}

	/**
	 * Get the underlying MockPersistence for testing purposes.
	 */
	public getMockPersistence(): MockPersistence {
		return this.persistence;
	}
}

describe("createViewWith", () => {
	const sf = new SchemaFactory("test");

	describe("factory function", () => {
		it("returns a function", () => {
			const storage = new MockViewableStorage();
			const viewWith = createViewWith(storage);

			assert.equal(typeof viewWith, "function");
		});

		it("returns a reusable function", () => {
			const storage = new MockViewableStorage();
			const viewWith = createViewWith(storage);

			// Can be called multiple times (though typically you'd only use one schema)
			assert.equal(typeof viewWith, "function");
		});
	});

	describe("object schemas", () => {
		it("creates SchematizedObjectView for object schemas", () => {
			const PersonSchema = sf.object("PersonViewWith", {
				name: sf.string,
				age: sf.number,
			});

			const storage = new MockViewableStorage();
			const viewWith = createViewWith(storage);
			const view = viewWith(PersonSchema);

			assert(view instanceof SchematizedObjectView);
		});

		it("created view can initialize and set values", () => {
			const PersonSchema = sf.object("PersonViewWithInit", {
				name: sf.string,
				age: sf.number,
			});

			const storage = new MockViewableStorage();
			const viewWith = createViewWith(storage);
			const view = viewWith(PersonSchema);

			view.initialize();
			view.root.name = "Alice";
			view.root.age = 30;

			assert.equal(view.root.name, "Alice");
			assert.equal(view.root.age, 30);
		});

		it("created view handles optional fields", () => {
			const PersonSchema = sf.object("PersonViewWithOptional", {
				name: sf.string,
				nickname: sf.optional(sf.string),
			});

			const storage = new MockViewableStorage();
			const viewWith = createViewWith(storage);
			const view = viewWith(PersonSchema);

			view.initialize();
			view.root.name = "Alice";

			assert.equal(view.root.nickname, undefined);

			view.root.nickname = "Ali";
			assert.equal(view.root.nickname, "Ali");

			view.root.nickname = undefined;
			assert.equal(view.root.nickname, undefined);
		});
	});

	describe("map schemas", () => {
		it("creates SchematizedMapView for map schemas", () => {
			const ScoresSchema = sf.map("ScoresViewWith", sf.number);

			const storage = new MockViewableStorage();
			const viewWith = createViewWith(storage);
			const view = viewWith(ScoresSchema);

			assert(view instanceof SchematizedMapView);
		});

		it("created map view can initialize and set values", () => {
			const ScoresSchema = sf.map("ScoresViewWithInit", sf.number);

			const storage = new MockViewableStorage();
			const viewWith = createViewWith(storage);
			const view = viewWith(ScoresSchema);

			view.initialize();
			view.root.set("alice", 100);
			view.root.set("bob", 85);

			assert.equal(view.root.get("alice"), 100);
			assert.equal(view.root.get("bob"), 85);
		});

		it("created map view supports iteration", () => {
			const ScoresSchema = sf.map("ScoresViewWithIteration", sf.number);

			const storage = new MockViewableStorage();
			const viewWith = createViewWith(storage);
			const view = viewWith(ScoresSchema);

			view.initialize();
			view.root.set("alice", 100);
			view.root.set("bob", 85);

			const keys = [...view.root.keys()];
			assert(keys.includes("alice"));
			assert(keys.includes("bob"));
			assert.equal(keys.length, 2);
		});

		it("created map view supports delete", () => {
			const ScoresSchema = sf.map("ScoresViewWithDelete", sf.number);

			const storage = new MockViewableStorage();
			const viewWith = createViewWith(storage);
			const view = viewWith(ScoresSchema);

			view.initialize();
			view.root.set("alice", 100);
			assert.equal(view.root.has("alice"), true);

			const deleted = view.root.delete("alice");
			assert.equal(deleted, true);
			assert.equal(view.root.has("alice"), false);
		});
	});

	describe("invalid schemas", () => {
		it("throws for invalid schema types", () => {
			const storage = new MockViewableStorage();
			const viewWith = createViewWith(storage);

			// Create an object that is neither an ObjectNodeSchema nor a MapNodeSchema
			const invalidSchema = { type: "invalid" } as any;

			assert.throws(
				() => viewWith(invalidSchema),
				/Schema must be an ObjectNodeSchema or MapNodeSchema/,
			);
		});

		it("throws for primitive leaf schemas", () => {
			const storage = new MockViewableStorage();
			const viewWith = createViewWith(storage);

			// sf.string is a primitive leaf schema, not an object or map schema
			assert.throws(
				() => viewWith(sf.string as any),
				/Schema must be an ObjectNodeSchema or MapNodeSchema/,
			);
		});
	});

	describe("schema persistence", () => {
		it("persists schema when object view initializes", () => {
			const PersonSchema = sf.object("PersonViewWithPersist", {
				name: sf.string,
			});

			const storage = new MockViewableStorage();
			const viewWith = createViewWith(storage);
			const view = viewWith(PersonSchema);

			assert.equal(storage.getMockPersistence().getPersistedSchema(), undefined);

			view.initialize();

			assert.notEqual(storage.getMockPersistence().getPersistedSchema(), undefined);
		});

		it("persists schema when map view initializes", () => {
			const ScoresSchema = sf.map("ScoresViewWithPersist", sf.number);

			const storage = new MockViewableStorage();
			const viewWith = createViewWith(storage);
			const view = viewWith(ScoresSchema);

			assert.equal(storage.getMockPersistence().getPersistedSchema(), undefined);

			view.initialize();

			assert.notEqual(storage.getMockPersistence().getPersistedSchema(), undefined);
		});
	});

	describe("storage integration", () => {
		it("writes to underlying storage for object views", () => {
			const PersonSchema = sf.object("PersonViewWithStorage", {
				name: sf.string,
			});

			const storage = new MockViewableStorage();
			const viewWith = createViewWith(storage);
			const view = viewWith(PersonSchema);

			view.initialize();
			view.root.name = "Alice";

			// Verify the value was written to the underlying storage
			const rawData = storage.getMockStorage().getRawData();
			assert(rawData.size > 0);
		});

		it("writes to underlying storage for map views", () => {
			const ScoresSchema = sf.map("ScoresViewWithStorage", sf.number);

			const storage = new MockViewableStorage();
			const viewWith = createViewWith(storage);
			const view = viewWith(ScoresSchema);

			view.initialize();
			view.root.set("alice", 100);

			// Verify the value was written to the underlying storage
			const rawData = storage.getMockStorage().getRawData();
			assert(rawData.size > 0);
		});
	});
});
