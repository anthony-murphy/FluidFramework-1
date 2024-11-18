/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { DataObject, DataObjectFactory } from "@fluidframework/aqueduct/internal";
import { type IRuntimeFactory } from "@fluidframework/container-definitions/internal";
import { waitContainerToCatchUp } from "@fluidframework/container-loader/internal";
import { loadContainerRuntime } from "@fluidframework/container-runtime/internal";
import { type FluidObject } from "@fluidframework/core-interfaces/internal";
import { assert } from "@fluidframework/core-utils/internal";
import { LocalDeltaConnectionServer } from "@fluidframework/server-local-server";

import { createLoader } from "../utils.js";

/**
 * This is the parent DataObject, which is also a datastore. It has a
 * synchronous method to create child datastores, which could be called
 * in response to synchronous user input, like a key press.
 */
class ParentDataObject extends DataObject {
	get ParentDataObject() {
		return this;
	}

	async branch() {
		return this.runtime.branchChannel?.("root");
	}
}

/**
 * This is the parent DataObjects factory. It specifies the child data stores
 * factory in a sub-registry. This is requires for synchronous creation of the child.
 */
const parentDataObjectFactory = new DataObjectFactory(
	"ParentDataObject",
	ParentDataObject,
	undefined,
	{},
);

// a simple container runtime factory with a single datastore aliased as default.
// the default datastore is also returned as the entrypoint
const runtimeFactory: IRuntimeFactory = {
	get IRuntimeFactory() {
		return this;
	},
	instantiateRuntime: async (context, existing) => {
		return loadContainerRuntime({
			context,
			existing,
			registryEntries: [
				[
					parentDataObjectFactory.type,
					// the parent is still async in the container registry
					// this allows things like code splitting for dynamic loading
					Promise.resolve(parentDataObjectFactory),
				],
			],
			provideEntryPoint: async (rt) => {
				const maybeRoot = await rt.getAliasedDataStoreEntryPoint("default");
				if (maybeRoot === undefined) {
					const ds = await rt.createDataStore(parentDataObjectFactory.type);
					await ds.trySetAlias("default");
				}
				const root = await rt.getAliasedDataStoreEntryPoint("default");
				assert(root !== undefined, "default must exist");
				return root.get();
			},
		});
	},
};

describe("Scenario Test", () => {
	it("Synchronously create child data store", async () => {
		const deltaConnectionServer = LocalDeltaConnectionServer.create();

		const { loader, codeDetails, urlResolver } = createLoader({
			deltaConnectionServer,
			runtimeFactory,
		});

		const container = await loader.createDetachedContainer(codeDetails);

		// const entrypoint: FluidObject<ParentDataObject> = await container.getEntryPoint();
		await container.attach(urlResolver.createCreateNewRequest("test"));
		const url = await container.getAbsoluteUrl("");
		assert(url !== undefined, "container must have url");
		container.dispose();

		{
			const container2 = await loader.resolve({ url });
			await waitContainerToCatchUp(container2);
			const entrypoint: FluidObject<ParentDataObject> = await container2.getEntryPoint();

			assert(
				entrypoint.ParentDataObject !== undefined,
				"container2 entrypoint must be ParentDataStore",
			);

			container2.dispose();
		}
	});
});
