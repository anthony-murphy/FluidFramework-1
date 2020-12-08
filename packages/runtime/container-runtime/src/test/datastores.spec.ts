/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { strict as assert } from "assert";
import { IFluidDataStoreChannel } from "@fluidframework/runtime-definitions";
import { ISnapshotTree } from "@fluidframework/protocol-definitions";
import { DataStores } from "../dataStores";
import { IFluidDataStoreContextImpl } from "../dataStoreContext";
import { IDataStoreContextFactory } from "../datastoresContextFactory";
import { nonDataStorePaths } from "../containerRuntime";

class MockContextFactory implements IDataStoreContextFactory {
    _createFluidDataStoreContext = ()=> {throw Error("Not Expected");};
    createDetachedDataStoreCore = ()=> {throw Error("Not Expected");};
    createFromAttachMessage = ()=> {throw Error("Not Expected");};
    createFromSnapshot= ()=> {throw Error("Not Expected");};
}

const emptyTree: ISnapshotTree = {
    blobs: {},
    commits: {},
    id:"",
    trees: {},
};
const nonDataStoreTrees =
    nonDataStorePaths.reduce((o, key) => ({ ...o, [key]: emptyTree }), {});

const someDataStore = "someDataStore";

describe("DataStores", () => {
    it("Load from undefined snapshot",()=>{
        const dataStores = new DataStores(
            undefined /* baseSnapshot */,
            ()=>{} /* submitAttach */,
            new MockContextFactory(),
            undefined,
        );
        assert(dataStores !== undefined);
        assert(dataStores.size === 0);
    });

    it("Load from empty snapshot",()=>{
        const snapshot: ISnapshotTree = {
            ... emptyTree,
            trees: nonDataStoreTrees,
        };
        const dataStores = new DataStores(
            snapshot,
            ()=>{} /* submitAttach */,
            new MockContextFactory(),
            undefined,
        );
        assert(dataStores !== undefined);
        assert(dataStores.size === 0);
    });

    it("Load from snapshot with single datastore",async ()=>{
        const snapshot: ISnapshotTree = {
            ... emptyTree,
            trees: {
                ... nonDataStoreTrees,
                [someDataStore]: emptyTree,
            },
        };
        const dataStores = new DataStores(
            snapshot,
            ()=>{} /* submitAttach */,
            {
                ... new MockContextFactory(),
                createFromSnapshot: (id)=> {
                    assert(id === someDataStore);
                    const ds: Partial<IFluidDataStoreContextImpl> = {
                        id,
                        realize: async ()=>({} as any as IFluidDataStoreChannel),
                    };
                    return ds as IFluidDataStoreContextImpl;
                },
            },
            undefined,
        );
        assert(dataStores !== undefined);
        assert(dataStores.size === 1);
        assert(await dataStores.getDataStore(someDataStore, false) !== undefined);
    });

    it("Load from snapshot with multiple datastores",async ()=>{
        const snapshot: ISnapshotTree = {
            ... emptyTree,
            trees: {
                ... nonDataStoreTrees,
                [someDataStore]: emptyTree,
                foo: emptyTree,
                bar: emptyTree,
            },
        };
        const dataStores = new DataStores(
            snapshot,
            ()=>{} /* submitAttach */,
            {
                ... new MockContextFactory(),
                createFromSnapshot: (id)=> {
                    const ds: Partial<IFluidDataStoreContextImpl> = {
                        id,
                        realize: async ()=>({} as any as IFluidDataStoreChannel),
                    };
                    return ds as IFluidDataStoreContextImpl;
                },
            },
            undefined,
        );
        assert(dataStores !== undefined);
        assert(dataStores.size === 3);
        assert(await dataStores.getDataStore(someDataStore, false) !== undefined);
    });
});
