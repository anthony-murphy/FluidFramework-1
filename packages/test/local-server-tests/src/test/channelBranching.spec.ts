/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { DataObject, DataObjectFactory } from "@fluidframework/aqueduct/internal";
import { type IRuntimeFactory } from "@fluidframework/container-definitions/internal";
import { loadContainerRuntime } from "@fluidframework/container-runtime/internal";
import type { FluidObject } from "@fluidframework/core-interfaces";
import { assert } from "@fluidframework/core-utils/internal";
import type { ISharedDirectory, SharedDirectory } from "@fluidframework/map/internal";
import {
	LocalDeltaConnectionServer,
	type ILocalDeltaConnectionServer,
} from "@fluidframework/server-local-server";

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
		const branch = await this.runtime.branchChannel?.(this.root);
		assert(branch !== undefined, "blah");
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		this._makeEdits(branch.channel);
		return branch;
	}

	public makeEdits() {
		this._makeEdits(this.root);
	}
	private _makeEdits(dds: ISharedDirectory) {
		for (let i = 0; i < 5; i++) {
			dds.set(`${dds.id}-${i}-${Date.now()}`, Date.now());
		}
	}
	public containsTheSameData(dataStore: ParentDataObject);
	public containsTheSameData(dds: SharedDirectory);
	public containsTheSameData(ddsOrDo: SharedDirectory | ParentDataObject) {
		const root = "ParentDataObject" in ddsOrDo ? ddsOrDo.root : ddsOrDo;
		for (const key of this.root.keys()) {
			if (root.get(key) !== this.root.get(key)) {
				return false;
			}
		}
		return true;
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

async function createContainer(deltaConnectionServer: ILocalDeltaConnectionServer) {
	const { loader, codeDetails, urlResolver } = createLoader({
		deltaConnectionServer,
		runtimeFactory,
	});

	const container = await loader.createDetachedContainer(codeDetails);

	// doesn't work without this, as otherwise the default datastore is not initialized
	await container.getEntryPoint();

	await container.attach(urlResolver.createCreateNewRequest("test"));
	const url = await container.getAbsoluteUrl("");
	assert(url !== undefined, "container must have url");
	container.dispose();
	return url;
}

async function loadContainer(deltaConnectionServer: ILocalDeltaConnectionServer, url: string) {
	const { loader } = createLoader({
		deltaConnectionServer,
		runtimeFactory,
	});
	const container = await loader.resolve({ url });
	const entryPoint: FluidObject<ParentDataObject> = await container.getEntryPoint();
	assert(entryPoint.ParentDataObject !== undefined, "must be ParentDataObject");
	entryPoint.ParentDataObject.makeEdits();
	return {
		container,
		dataStore: entryPoint.ParentDataObject,
		branch: await entryPoint.ParentDataObject.branch(),
	};
}

describe("Scenario Test", () => {
	it("Channel branching", async () => {
		const deltaConnectionServer = LocalDeltaConnectionServer.create();
		const url = await createContainer(deltaConnectionServer);
		const containers = [
			await loadContainer(deltaConnectionServer, url),
			await loadContainer(deltaConnectionServer, url),
		];

		await Promise.all(
			containers.map(
				async (c) =>
					new Promise<void>((resolve) => c.container.once("saved", () => resolve())),
			),
		);
		assert(containers[0].dataStore.containsTheSameData(containers[0].dataStore) === true, "1");
		assert(
			containers[0].dataStore.containsTheSameData(containers[0].branch.channel) === true,
			"2",
		);
		assert(containers[0].dataStore.containsTheSameData(containers[1].dataStore) === true, "3");
		assert(
			containers[0].dataStore.containsTheSameData(containers[1].branch.channel) === true,
			"4",
		);
	});
});
