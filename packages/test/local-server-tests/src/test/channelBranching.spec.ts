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

function keysAndValueOfbMatchThoseInA(
	a: SharedDirectory | ParentDataObject,
	b: SharedDirectory | ParentDataObject,
) {
	const aDir = "ParentDataObject" in a ? a.root : a;
	const bDir = "ParentDataObject" in b ? b.root : b;
	for (const key of aDir.keys()) {
		if (aDir.get(key) !== bDir.get(key)) {
			return false;
		}
	}
	return true;
}

class ParentDataObject extends DataObject {
	get ParentDataObject() {
		return this;
	}

	public get root() {
		return super.root;
	}

	async branch() {
		const branch = await this.runtime.branchChannels?.({ root: this.root });
		assert(branch !== undefined, "blah");
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		this._makeEdits(branch.channels.root, "branch");
		return branch;
	}

	public makeEdits(prefix: string) {
		this._makeEdits(this.root, prefix);
	}
	private _makeEdits(dds: ISharedDirectory, prefix: string) {
		dds.set(`${dds.id}-${prefix}-${Date.now()}`, Date.now());
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
	opts?: Pick<CreateLoaderParams, "deltaConnectionServer" | "documentServiceFactory">,
) {
	const { loaderProps, codeDetails, urlResolver, deltaConnectionServer } = createLoader({
		...opts,
		deltaConnectionServer: LocalDeltaConnectionServer.create(),
		runtimeFactory,
	});

	const container = await createDetachedContainer({ ...loaderProps, codeDetails });

	// doesn't work without this, as otherwise the default datastore is not initialized
	await container.getEntryPoint();
	const entryPoint: FluidObject<ParentDataObject> = await container.getEntryPoint();
	assert(entryPoint.ParentDataObject !== undefined, "must be ParentDataObject");
	entryPoint.ParentDataObject.makeEdits("create");

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
	// entryPoint.ParentDataObject.makeEdits("beforeBranch");
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
	it("Branch with main channel changes while detached", async () => {
		const create = await createContainer();
		const branch = await branchChannel(create);
		create.dataStore.makeEdits("afterBranch");
		assert(
			keysAndValueOfbMatchThoseInA(branch.branch.channels.root, create.dataStore) === false,
			"before merge",
		);
		branch.branch.merge();
		assert(
			keysAndValueOfbMatchThoseInA(create.dataStore, branch.branch.channels.root) === true,
			"after merge",
		);
	});
	it("Branch while detached", async () => {
		const create = await createContainer();
		const branch = await branchChannel(create);
		assert(
			keysAndValueOfbMatchThoseInA(branch.branch.channels.root, create.dataStore) === false,
			"before merge",
		);
		branch.branch.merge();
		assert(
			keysAndValueOfbMatchThoseInA(create.dataStore, branch.branch.channels.root) === true,
			"after merge",
		);
	});

	it("Branch while attaching", async () => {
		const deltaConnectionServer = LocalDeltaConnectionServer.create();
		const attachDeferred = new Deferred<void>();
		const documentServiceFactory = new Proxy<IDocumentServiceFactory>(
			new LocalDocumentServiceFactory(deltaConnectionServer),
			{
				get: (t, p: keyof LocalDocumentServiceFactory, r) => {
					if (p === "createContainer") {
						return async (...args: Parameters<IDocumentServiceFactory["createContainer"]>) =>
							attachDeferred.promise.then(async () => Reflect.get(t, p, r).bind(t)(...args));
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
		assert(
			keysAndValueOfbMatchThoseInA(branch.branch.channels.root, create.dataStore) === false,
			"before merge",
		);
		branch.branch.merge();
		assert(
			keysAndValueOfbMatchThoseInA(create.dataStore, branch.branch.channels.root) === true,
			"after merge",
		);

		attachDeferred.resolve();
		await attachingP;
	});

	it("Branch after attach", async () => {
		const create = await attachContainer(createContainer());
		const branch = await branchChannel(create);
		assert(
			keysAndValueOfbMatchThoseInA(branch.branch.channels.root, create.dataStore) === false,
			"before merge",
		);
		await Promise.resolve(
			create.container.isDirty
				? new Promise<void>((resolve) => create.container.once("saved", () => resolve()))
				: undefined,
		);
		branch.branch.merge();
		assert(
			keysAndValueOfbMatchThoseInA(create.dataStore, branch.branch.channels.root) === true,
			"after merge",
		);
	});

	it("Channel branching", async () => {
		const create = await attachContainer(createContainer());
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

		assert(
			keysAndValueOfbMatchThoseInA(
				containers[0].dataStore,
				containers[0].branch.channels.root,
			) === true,
			"2",
		);
		assert(
			keysAndValueOfbMatchThoseInA(containers[0].dataStore, containers[1].dataStore) === true,
			"3",
		);
		assert(
			keysAndValueOfbMatchThoseInA(
				containers[0].dataStore,
				containers[1].branch.channels.root,
			) === true,
			"4",
		);

		assert(
			keysAndValueOfbMatchThoseInA(
				containers[1].dataStore,
				containers[1].branch.channels.root,
			) === true,
			"6",
		);
		assert(
			keysAndValueOfbMatchThoseInA(containers[1].dataStore, containers[0].dataStore) === true,
			"7",
		);
		assert(
			keysAndValueOfbMatchThoseInA(
				containers[1].dataStore,
				containers[0].branch.channels.root,
			) === true,
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

		assert(
			keysAndValueOfbMatchThoseInA(
				containers[0].dataStore,
				containers[0].branch.channels.root,
			) === true,
			"2",
		);
		assert(
			keysAndValueOfbMatchThoseInA(containers[0].dataStore, containers[1].dataStore) === true,
			"3",
		);
		assert(
			keysAndValueOfbMatchThoseInA(
				containers[0].dataStore,
				containers[1].branch.channels.root,
			) === true,
			"4",
		);

		assert(
			keysAndValueOfbMatchThoseInA(
				containers[1].dataStore,
				containers[1].branch.channels.root,
			) === true,
			"6",
		);
		assert(
			keysAndValueOfbMatchThoseInA(containers[1].dataStore, containers[0].dataStore) === true,
			"7",
		);
		assert(
			keysAndValueOfbMatchThoseInA(
				containers[1].dataStore,
				containers[0].branch.channels.root,
			) === true,
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

		assert(
			keysAndValueOfbMatchThoseInA(
				containers[0].dataStore,
				containers[0].branch.channels.root,
			) === true,
			"2",
		);
		assert(
			keysAndValueOfbMatchThoseInA(containers[0].dataStore, containers[1].dataStore) === true,
			"3",
		);
		assert(
			keysAndValueOfbMatchThoseInA(
				containers[0].dataStore,
				containers[1].branch.channels.root,
			) === true,
			"4",
		);

		assert(
			keysAndValueOfbMatchThoseInA(
				containers[1].dataStore,
				containers[1].branch.channels.root,
			) === true,
			"6",
		);
		assert(
			keysAndValueOfbMatchThoseInA(containers[1].dataStore, containers[0].dataStore) === true,
			"7",
		);
		assert(
			keysAndValueOfbMatchThoseInA(
				containers[1].dataStore,
				containers[0].branch.channels.root,
			) === true,
			"8",
		);
	});
});
