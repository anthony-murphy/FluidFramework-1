/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { DataObject, DataObjectFactory } from "@fluidframework/aqueduct/internal";
import {
	AttachState,
	type IContainer,
	type IRuntimeFactory,
} from "@fluidframework/container-definitions/internal";
import {
	createDetachedContainer,
	loadExistingContainer,
} from "@fluidframework/container-loader/internal";
import { loadContainerRuntime } from "@fluidframework/container-runtime/internal";
import type { FluidObject } from "@fluidframework/core-interfaces";
import { assert, Deferred } from "@fluidframework/core-utils/internal";
import { IDocumentServiceFactory } from "@fluidframework/driver-definitions/internal";
import {
	LocalDocumentServiceFactory,
	LocalResolver,
} from "@fluidframework/local-driver/internal";
import type { ISharedDirectory, SharedDirectory } from "@fluidframework/map/internal";
import {
	LocalDeltaConnectionServer,
	type ILocalDeltaConnectionServer,
} from "@fluidframework/server-local-server";

import { createLoader, type CreateLoaderParams } from "../utils.js";

class ParentDataObject extends DataObject {
	get ParentDataObject() {
		return this;
	}

	async branch() {
		const branch = await this.runtime.branchChannels?.({ root: this.root });
		assert(branch !== undefined, "blah");
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		this._makeEdits(branch.channels.root);
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

const parentDataObjectFactory = new DataObjectFactory(
	"ParentDataObject",
	ParentDataObject,
	undefined,
	{},
);

const runtimeFactory: IRuntimeFactory = {
	get IRuntimeFactory() {
		return this;
	},
	instantiateRuntime: async (context, existing) => {
		return loadContainerRuntime({
			context,
			existing,
			registryEntries: [
				[parentDataObjectFactory.type, Promise.resolve(parentDataObjectFactory)],
			],
			provideEntryPoint: async (rt) => {
				const maybeRoot = await rt.getAliasedDataStoreEntryPoint("default");
				if (maybeRoot !== undefined) {
					return maybeRoot.get();
				}
				const ds = await rt.createDataStore(parentDataObjectFactory.type);
				await ds.trySetAlias("default");

				const root = await rt.getAliasedDataStoreEntryPoint("default");
				assert(root !== undefined, "default must exist");
				return root.get();
			},
		});
	},
};

async function createContainer(
	opts: Pick<CreateLoaderParams, "deltaConnectionServer" | "documentServiceFactory">,
) {
	const { loaderProps, codeDetails, urlResolver, deltaConnectionServer } = createLoader({
		...opts,
		runtimeFactory,
	});

	const container = await createDetachedContainer({ ...loaderProps, codeDetails });

	// doesn't work without this, as otherwise the default datastore is not initialized
	await container.getEntryPoint();
	const entryPoint: FluidObject<ParentDataObject> = await container.getEntryPoint();
	assert(entryPoint.ParentDataObject !== undefined, "must be ParentDataObject");
	entryPoint.ParentDataObject.makeEdits();

	return {
		deltaConnectionServer,
		urlResolver,
		container,
		dataStore: entryPoint.ParentDataObject,
	};
}

async function attachContainer<
	T extends { container: IContainer; urlResolver: LocalResolver },
>(params: T | Promise<T>) {
	const { container, urlResolver } = await params;
	await container.attach(urlResolver.createCreateNewRequest("test"));
	const url = await container.getAbsoluteUrl("");
	assert(url !== undefined, "container must have url");
	return { ...(await params), url };
}

async function branchChannel<T extends { container: IContainer }>(params: T | Promise<T>) {
	const { container } = await params;
	const entryPoint: FluidObject<ParentDataObject> = await container.getEntryPoint();
	assert(entryPoint.ParentDataObject !== undefined, "must be ParentDataObject");
	entryPoint.ParentDataObject.makeEdits();
	return {
		...(await params),
		dataStore: entryPoint.ParentDataObject,
		branch: await entryPoint.ParentDataObject.branch(),
	};
}

async function loadContainer<
	T extends { deltaConnectionServer: ILocalDeltaConnectionServer; url: string },
>(params: T | Promise<T>) {
	const { deltaConnectionServer, url } = await params;
	const { loaderProps } = createLoader({
		deltaConnectionServer,
		runtimeFactory,
	});
	const container = await loadExistingContainer({ ...loaderProps, request: { url } });
	return { ...(await params), container };
}

describe("Scenario Test", () => {
	it("Branch while detached", async () => {
		const deltaConnectionServer = LocalDeltaConnectionServer.create();
		const create = await createContainer({ deltaConnectionServer });
		const branch = await branchChannel(create);
		branch.branch.merge();
		assert(create.dataStore.containsTheSameData(branch.dataStore) === true, "1");
	});

	it("Branch while attaching", async () => {
		const deltaConnectionServer = LocalDeltaConnectionServer.create();
		const attachDeferred = new Deferred<void>();
		const documentServiceFactory = new Proxy<IDocumentServiceFactory>(
			new LocalDocumentServiceFactory(deltaConnectionServer),
			{
				get: (t, p: keyof LocalDocumentServiceFactory, r) => {
					if (p === "createContainer") {
						// eslint-disable-next-line @typescript-eslint/no-unsafe-return
						return attachDeferred.promise.then(() => Reflect.get(t, p, r));
					}
					// eslint-disable-next-line @typescript-eslint/no-unsafe-return
					return Reflect.get(t, p, r);
				},
			},
		);
		const create = await createContainer({ deltaConnectionServer, documentServiceFactory });
		const attachingP = create.container.attach(
			create.urlResolver.createCreateNewRequest("test"),
		);
		if (create.container.attachState === AttachState.Detached) {
			await new Promise<void>((resolve) =>
				create.container.once("attaching", () => resolve()),
			);
		}
		const branch = await branchChannel(create);
		branch.branch.merge();
		assert(create.dataStore.containsTheSameData(branch.dataStore) === true, "1");

		attachDeferred.resolve();
		await attachingP;
	});

	it("Branch after attach", async () => {
		const deltaConnectionServer = LocalDeltaConnectionServer.create();
		const create = await attachContainer(createContainer({ deltaConnectionServer }));
		const branch = await branchChannel(create);
		branch.branch.merge();
		assert(create.dataStore.containsTheSameData(branch.dataStore) === true, "1");
	});

	it("Channel branching", async () => {
		const deltaConnectionServer = LocalDeltaConnectionServer.create();
		const create = await attachContainer(createContainer({ deltaConnectionServer }));
		const containers = [
			await branchChannel(loadContainer(create)),
			await branchChannel(loadContainer(create)),
		];

		await Promise.all(
			containers.map(async (c) =>
				c.container.isDirty
					? new Promise<void>((resolve) => c.container.once("saved", () => resolve()))
					: undefined,
			),
		);

		assert(containers[0].dataStore.containsTheSameData(containers[0].dataStore) === true, "1");
		assert(
			containers[0].dataStore.containsTheSameData(containers[0].branch.channels.root) === true,
			"2",
		);
		assert(containers[0].dataStore.containsTheSameData(containers[1].dataStore) === true, "3");
		assert(
			containers[0].dataStore.containsTheSameData(containers[1].branch.channels.root) === true,
			"4",
		);

		assert(containers[1].dataStore.containsTheSameData(containers[1].dataStore) === true, "5");
		assert(
			containers[1].dataStore.containsTheSameData(containers[1].branch.channels.root) === true,
			"6",
		);
		assert(containers[1].dataStore.containsTheSameData(containers[0].dataStore) === true, "7");
		assert(
			containers[1].dataStore.containsTheSameData(containers[0].branch.channels.root) === true,
			"8",
		);

		await containers[0].branch?.merge();
		await Promise.all(
			containers.map(async (c) =>
				c.container.isDirty
					? new Promise<void>((resolve) => c.container.once("saved", () => resolve()))
					: undefined,
			),
		);

		assert(containers[0].dataStore.containsTheSameData(containers[0].dataStore) === true, "1");
		assert(
			containers[0].dataStore.containsTheSameData(containers[0].branch.channels.root) === true,
			"2",
		);
		assert(containers[0].dataStore.containsTheSameData(containers[1].dataStore) === true, "3");
		assert(
			containers[0].dataStore.containsTheSameData(containers[1].branch.channels.root) === true,
			"4",
		);

		assert(containers[1].dataStore.containsTheSameData(containers[1].dataStore) === true, "5");
		assert(
			containers[1].dataStore.containsTheSameData(containers[1].branch.channels.root) === true,
			"6",
		);
		assert(containers[1].dataStore.containsTheSameData(containers[0].dataStore) === true, "7");
		assert(
			containers[1].dataStore.containsTheSameData(containers[0].branch.channels.root) === true,
			"8",
		);

		await containers[1].branch.merge();
		await Promise.all(
			containers.map(async (c) =>
				c.container.isDirty
					? new Promise<void>((resolve) => c.container.once("saved", () => resolve()))
					: undefined,
			),
		);

		assert(containers[0].dataStore.containsTheSameData(containers[0].dataStore) === true, "1");
		assert(
			containers[0].dataStore.containsTheSameData(containers[0].branch.channels.root) === true,
			"2",
		);
		assert(containers[0].dataStore.containsTheSameData(containers[1].dataStore) === true, "3");
		assert(
			containers[0].dataStore.containsTheSameData(containers[1].branch.channels.root) === true,
			"4",
		);

		assert(containers[1].dataStore.containsTheSameData(containers[1].dataStore) === true, "5");
		assert(
			containers[1].dataStore.containsTheSameData(containers[1].branch.channels.root) === true,
			"6",
		);
		assert(containers[1].dataStore.containsTheSameData(containers[0].dataStore) === true, "7");
		assert(
			containers[1].dataStore.containsTheSameData(containers[0].branch.channels.root) === true,
			"8",
		);
	});
});
