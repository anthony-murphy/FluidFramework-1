/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { strict as assert } from "assert";

import { describeCompat } from "@fluid-private/test-version-utils";
import type { IContainer } from "@fluidframework/container-definitions/internal";
import type { ISharedMap, ISchematizedSharedMap } from "@fluidframework/map/internal";
import { SchemaFactory } from "@fluidframework/schema/internal";
import {
	ChannelFactoryRegistry,
	DataObjectFactoryType,
	type ITestContainerConfig,
	type ITestFluidObject,
	type ITestObjectProvider,
	getContainerEntryPointBackCompat,
} from "@fluidframework/test-utils/internal";

const mapId = "schematizedMapKey";

/**
 * Creates a schema factory with the given scope for test isolation.
 */
function createSchemaFactory(scope: string): SchemaFactory {
	return new SchemaFactory(scope);
}

describeCompat(
	"SharedMap.viewWith schema functionality",
	"NoCompat",
	(getTestObjectProvider, apis) => {
		const { SharedMap } = apis.dds;

		const registry: ChannelFactoryRegistry = [[mapId, SharedMap.getFactory()]];
		const testContainerConfig: ITestContainerConfig = {
			fluidDataObjectType: DataObjectFactoryType.Test,
			registry,
		};

		let provider: ITestObjectProvider;

		beforeEach("getTestObjectProvider", () => {
			provider = getTestObjectProvider();
		});

		/**
		 * Helper function to get the SharedMap from a container as ISchematizedSharedMap.
		 */
		async function getSchematizedMap(container: IContainer): Promise<ISchematizedSharedMap> {
			const dataObject = await getContainerEntryPointBackCompat<ITestFluidObject>(container);
			const map = await dataObject.getSharedObject<ISharedMap>(mapId);
			return map as ISchematizedSharedMap;
		}

		describe("Basic schema sync tests", () => {
			it("Initialize and sync - Client 1 creates schematized map, Client 2 loads and sees data", async () => {
				const sf = createSchemaFactory("test.basic.init");
				const PersonSchema = sf.object("Person", {
					name: sf.string,
					age: sf.number,
				});

				// Client 1 creates container and initializes data
				const container1 = await provider.makeTestContainer(testContainerConfig);
				const map1 = await getSchematizedMap(container1);
				const view1 = map1.viewWith(PersonSchema);

				assert.equal(
					view1.compatibility.canInitialize,
					true,
					"View should be able to initialize",
				);
				view1.initialize({ name: "Alice", age: 30 });

				// Wait for sync
				await provider.ensureSynchronized();

				// Client 2 loads container and sees the data
				const container2 = await provider.loadTestContainer(testContainerConfig);
				const map2 = await getSchematizedMap(container2);
				const view2 = map2.viewWith(PersonSchema);

				await provider.ensureSynchronized();

				assert.equal(view2.compatibility.canView, true, "View2 should be able to view");
				assert.equal(view2.name, "Alice", "Name should sync to client 2");
				assert.equal(view2.age, 30, "Age should sync to client 2");
			});

			it("Property updates sync - Client 1 updates a property, Client 2 sees the update", async () => {
				const sf = createSchemaFactory("test.basic.update");
				const PersonSchema = sf.object("Person", {
					name: sf.string,
					age: sf.number,
				});

				// Client 1 creates and initializes
				const container1 = await provider.makeTestContainer(testContainerConfig);
				const map1 = await getSchematizedMap(container1);
				const view1 = map1.viewWith(PersonSchema);
				view1.initialize({ name: "Bob", age: 25 });

				// Client 2 loads
				const container2 = await provider.loadTestContainer(testContainerConfig);
				const map2 = await getSchematizedMap(container2);
				const view2 = map2.viewWith(PersonSchema);

				await provider.ensureSynchronized();

				// Verify initial state
				assert.equal(view2.name, "Bob");
				assert.equal(view2.age, 25);

				// Client 1 updates
				(view1 as { age: number }).age = 26;

				await provider.ensureSynchronized();

				// Client 2 sees update
				assert.equal(view2.age, 26, "Age update should sync to client 2");
			});

			it("Object schema sync - Full object with multiple fields syncs between clients", async () => {
				const sf = createSchemaFactory("test.basic.fullobj");
				const AddressSchema = sf.object("Address", {
					street: sf.string,
					city: sf.string,
					zip: sf.string,
					country: sf.optional(sf.string),
				});

				// Client 1
				const container1 = await provider.makeTestContainer(testContainerConfig);
				const map1 = await getSchematizedMap(container1);
				const view1 = map1.viewWith(AddressSchema);
				view1.initialize({
					street: "123 Main St",
					city: "Seattle",
					zip: "98101",
					country: "USA",
				});

				await provider.ensureSynchronized();

				// Client 2
				const container2 = await provider.loadTestContainer(testContainerConfig);
				const map2 = await getSchematizedMap(container2);
				const view2 = map2.viewWith(AddressSchema);

				await provider.ensureSynchronized();

				assert.equal(view2.street, "123 Main St");
				assert.equal(view2.city, "Seattle");
				assert.equal(view2.zip, "98101");
				assert.equal(view2.country, "USA");
			});
		});

		describe("MapNodeSchema sync tests", () => {
			it("Map entries sync - Client 1 adds entries, Client 2 sees them", async () => {
				const sf = createSchemaFactory("test.map.entries");
				const ConfigSchema = sf.map("Config", sf.string);

				// Client 1
				const container1 = await provider.makeTestContainer(testContainerConfig);
				const map1 = await getSchematizedMap(container1);
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const view1 = map1.viewWith(ConfigSchema) as any;

				// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
				view1.initialize(
					new Map([
						["key1", "value1"],
						["key2", "value2"],
					]),
				);

				await provider.ensureSynchronized();

				// Client 2
				const container2 = await provider.loadTestContainer(testContainerConfig);
				const map2 = await getSchematizedMap(container2);
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const view2 = map2.viewWith(ConfigSchema) as any;

				await provider.ensureSynchronized();

				// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
				assert.equal(view2.get("key1"), "value1", "key1 should sync");
				// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
				assert.equal(view2.get("key2"), "value2", "key2 should sync");

				// Client 1 adds more entries
				// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
				view1.set("key3", "value3");

				await provider.ensureSynchronized();

				// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
				assert.equal(view2.get("key3"), "value3", "key3 should sync after add");
			});

			it("Map delete syncs - Client 1 deletes entry, Client 2 sees deletion", async () => {
				const sf = createSchemaFactory("test.map.delete");
				const ConfigSchema = sf.map("Config", sf.string);

				// Client 1
				const container1 = await provider.makeTestContainer(testContainerConfig);
				const map1 = await getSchematizedMap(container1);
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const view1 = map1.viewWith(ConfigSchema) as any;

				// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
				view1.initialize(
					new Map([
						["toDelete", "willBeDeleted"],
						["toKeep", "willRemain"],
					]),
				);

				await provider.ensureSynchronized();

				// Client 2
				const container2 = await provider.loadTestContainer(testContainerConfig);
				const map2 = await getSchematizedMap(container2);
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const view2 = map2.viewWith(ConfigSchema) as any;

				await provider.ensureSynchronized();

				// Verify initial state
				// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
				assert.equal(view2.has("toDelete"), true);

				// Client 1 deletes
				// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
				view1.delete("toDelete");

				await provider.ensureSynchronized();

				// Client 2 sees deletion
				// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
				assert.equal(view2.has("toDelete"), false, "Deleted key should not exist");
				// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
				assert.equal(view2.has("toKeep"), true, "Non-deleted key should still exist");
			});

			it("Map iteration syncs - Verify iteration works on receiving client", async () => {
				const sf = createSchemaFactory("test.map.iteration");
				const ConfigSchema = sf.map("Config", sf.number);

				// Client 1
				const container1 = await provider.makeTestContainer(testContainerConfig);
				const map1 = await getSchematizedMap(container1);
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const view1 = map1.viewWith(ConfigSchema) as any;

				// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
				view1.initialize(
					new Map([
						["a", 1],
						["b", 2],
						["c", 3],
					]),
				);

				await provider.ensureSynchronized();

				// Client 2
				const container2 = await provider.loadTestContainer(testContainerConfig);
				const map2 = await getSchematizedMap(container2);
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const view2 = map2.viewWith(ConfigSchema) as any;

				await provider.ensureSynchronized();

				// Test keys iteration
				// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
				const keys = [...view2.keys()];
				assert.deepEqual(keys.sort(), ["a", "b", "c"], "Keys should iterate correctly");

				// Test values iteration
				// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
				const values = [...view2.values()];
				assert.deepEqual(values.sort(), [1, 2, 3], "Values should iterate correctly");

				// Test entries iteration
				// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
				const entries = [...view2.entries()];
				const entryMap = new Map(entries);
				assert.equal(entryMap.get("a"), 1);
				assert.equal(entryMap.get("b"), 2);
				assert.equal(entryMap.get("c"), 3);

				// Test size
				// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
				assert.equal(view2.size, 3, "Size should be correct");
			});
		});

		describe("Schema compatibility tests", () => {
			it("Compatible schemas - Two clients view same data with identical schemas", async () => {
				// Create two separate but identical schema factories and schemas
				const sf1 = createSchemaFactory("test.compat.identical");
				const PersonSchema1 = sf1.object("Person", {
					name: sf1.string,
					age: sf1.number,
				});

				const sf2 = createSchemaFactory("test.compat.identical");
				const PersonSchema2 = sf2.object("Person", {
					name: sf2.string,
					age: sf2.number,
				});

				// Client 1
				const container1 = await provider.makeTestContainer(testContainerConfig);
				const map1 = await getSchematizedMap(container1);
				const view1 = map1.viewWith(PersonSchema1);
				view1.initialize({ name: "Charlie", age: 40 });

				await provider.ensureSynchronized();

				// Client 2 with identical schema
				const container2 = await provider.loadTestContainer(testContainerConfig);
				const map2 = await getSchematizedMap(container2);
				const view2 = map2.viewWith(PersonSchema2);

				await provider.ensureSynchronized();

				assert.equal(
					view2.compatibility.canView,
					true,
					"Should be able to view with identical schema",
				);
				assert.equal(view2.name, "Charlie");
				assert.equal(view2.age, 40);
			});

			it("View after initialize - Second client uses viewWith() on already-initialized map", async () => {
				const sf = createSchemaFactory("test.compat.viewafter");
				const PersonSchema = sf.object("Person", {
					name: sf.string,
				});

				// Client 1 initializes
				const container1 = await provider.makeTestContainer(testContainerConfig);
				const map1 = await getSchematizedMap(container1);
				const view1 = map1.viewWith(PersonSchema);

				assert.equal(view1.compatibility.canInitialize, true);
				view1.initialize({ name: "David" });
				assert.equal(view1.compatibility.canInitialize, false, "Cannot initialize twice");

				await provider.ensureSynchronized();

				// Client 2 connects after initialization
				const container2 = await provider.loadTestContainer(testContainerConfig);
				const map2 = await getSchematizedMap(container2);
				const view2 = map2.viewWith(PersonSchema);

				await provider.ensureSynchronized();

				// Client 2 should not be able to initialize but should be able to view
				assert.equal(
					view2.compatibility.canInitialize,
					false,
					"Client 2 should not be able to initialize",
				);
				assert.equal(view2.compatibility.canView, true, "Client 2 should be able to view");
				assert.equal(view2.name, "David");
			});

			it("Same schema different instances - Both clients create schema instances but same structure", async () => {
				// Both clients independently create the same schema structure
				const createPersonSchema = () => {
					const sf = createSchemaFactory("test.compat.samestructure");
					return sf.object("Person", {
						firstName: sf.string,
						lastName: sf.string,
					});
				};

				const PersonSchema1 = createPersonSchema();
				const PersonSchema2 = createPersonSchema();

				// Client 1
				const container1 = await provider.makeTestContainer(testContainerConfig);
				const map1 = await getSchematizedMap(container1);
				const view1 = map1.viewWith(PersonSchema1);
				view1.initialize({ firstName: "Emma", lastName: "Wilson" });

				await provider.ensureSynchronized();

				// Client 2 with independently created schema
				const container2 = await provider.loadTestContainer(testContainerConfig);
				const map2 = await getSchematizedMap(container2);
				const view2 = map2.viewWith(PersonSchema2);

				await provider.ensureSynchronized();

				assert.equal(view2.compatibility.canView, true);
				assert.equal(view2.firstName, "Emma");
				assert.equal(view2.lastName, "Wilson");
			});
		});

		describe("Persistence tests", () => {
			it("Data survives container reload - Save, close, reload, verify data", async () => {
				const sf = createSchemaFactory("test.persist.reload");
				const PersonSchema = sf.object("Person", {
					name: sf.string,
					score: sf.number,
				});

				// Create and initialize
				const container1 = await provider.makeTestContainer(testContainerConfig);
				const map1 = await getSchematizedMap(container1);
				const view1 = map1.viewWith(PersonSchema);
				view1.initialize({ name: "Frank", score: 100 });

				await provider.ensureSynchronized();

				// Load a second container to get the data persisted
				const container2 = await provider.loadTestContainer(testContainerConfig);
				const map2 = await getSchematizedMap(container2);
				const view2 = map2.viewWith(PersonSchema);

				await provider.ensureSynchronized();

				// Verify data is present
				assert.equal(view2.name, "Frank");
				assert.equal(view2.score, 100);

				// Load a third container (simulating complete reload)
				const container3 = await provider.loadTestContainer(testContainerConfig);
				const map3 = await getSchematizedMap(container3);
				const view3 = map3.viewWith(PersonSchema);

				await provider.ensureSynchronized();

				// Verify data persists
				assert.equal(view3.name, "Frank", "Name should persist across reload");
				assert.equal(view3.score, 100, "Score should persist across reload");
			});

			it("Schema survives reload - After reload, can still use viewWith()", async () => {
				const sf = createSchemaFactory("test.persist.schema");
				const ConfigSchema = sf.object("Config", {
					theme: sf.string,
					fontSize: sf.number,
				});

				// Create and initialize
				const container1 = await provider.makeTestContainer(testContainerConfig);
				const map1 = await getSchematizedMap(container1);
				const view1 = map1.viewWith(ConfigSchema);
				view1.initialize({ theme: "dark", fontSize: 14 });

				await provider.ensureSynchronized();

				// Load new container
				const container2 = await provider.loadTestContainer(testContainerConfig);
				const map2 = await getSchematizedMap(container2);

				// viewWith should still work
				const view2 = map2.viewWith(ConfigSchema);

				await provider.ensureSynchronized();

				assert.equal(view2.compatibility.canView, true, "Should be able to view after reload");
				assert.equal(
					view2.compatibility.canInitialize,
					false,
					"Should not be able to initialize after reload",
				);
				assert.equal(view2.theme, "dark");
				assert.equal(view2.fontSize, 14);

				// Modify through view2
				(view2 as { fontSize: number }).fontSize = 16;

				await provider.ensureSynchronized();

				// Load yet another container
				const container3 = await provider.loadTestContainer(testContainerConfig);
				const map3 = await getSchematizedMap(container3);
				const view3 = map3.viewWith(ConfigSchema);

				await provider.ensureSynchronized();

				// Verify modifications persisted
				assert.equal(view3.fontSize, 16, "Modifications should persist");
			});
		});
	},
);
