/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { strict as assert } from "assert";
import {
    IAttachMessage,
    IFluidDataStoreChannel,
    IFluidDataStoreContextDetached,
    InboundAttachMessage,
} from "@fluidframework/runtime-definitions";
import { ISnapshotTree } from "@fluidframework/protocol-definitions";
import { AttachState } from "@fluidframework/container-definitions";
import { DataStores } from "../dataStores";
import { IFluidDataStoreContextImpl } from "../dataStoreContext";
import { IDataStoreContextFactory } from "../datastoresContextFactory";
import { nonDataStorePaths } from "../containerRuntime";
import { ILocalFluidDataStoreContextImpl } from "../localDataStoreContext";

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

const someDataStoreId = "someDataStore";

const snapshotWithDataStore: ISnapshotTree = {
    ... emptyTree,
    trees: {
        ... nonDataStoreTrees,
        [someDataStoreId]: emptyTree,
    },
};

function createMockChannel(id: string) {
    const channel: Partial<IFluidDataStoreChannel> = { id };
    return channel as IFluidDataStoreChannel;
}

describe("DataStores", () => {
    describe("Load", ()=>{
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

        it("Load from snapshot with datastore",async ()=>{
            const dataStores = new DataStores(
                snapshotWithDataStore,
                ()=>{} /* submitAttach */,
                {
                    ... new MockContextFactory(),
                    createFromSnapshot: (id)=> {
                        assert(id === someDataStoreId);
                        const ds: Partial<IFluidDataStoreContextImpl> = {
                            id,
                            realize: async ()=>createMockChannel(id),
                        };
                        return ds as IFluidDataStoreContextImpl;
                    },
                },
                undefined,
            );
            assert(dataStores !== undefined);
            assert(dataStores.size === 1);
            assert(await dataStores.getDataStore(someDataStoreId, false) !== undefined);
        });
    });

    describe("Create and bind", ()=>{
        let dataStores: DataStores;
        let contextFactory: IDataStoreContextFactory;
        beforeEach(async () => {
            contextFactory = {
                ... new MockContextFactory(),
                createFromSnapshot: (id)=> {
                    assert(id === someDataStoreId);
                    const ds: Partial<IFluidDataStoreContextImpl> = {
                        id,
                        realize: async ()=>createMockChannel(id),
                    };
                    return ds as IFluidDataStoreContextImpl;
                },
            };

            dataStores = new DataStores(
                emptyTree,
                ()=>{} /* submitAttach */,
                contextFactory,
                undefined);
            assert(dataStores !== undefined);
            assert(dataStores.size === 0);
        });

        it("createDetachedDataStoreCore", async ()=>{
             contextFactory.createDetachedDataStoreCore = (pkg, isRoot, id, bind)=>{
                const ds: Partial<IFluidDataStoreContextDetached & ILocalFluidDataStoreContextImpl> = {
                    id,
                    bindToContext: ()=>bind(AttachState.Attached, createMockChannel(id)),
                    generateAttachMessage: ()=>{return { id } as any as IAttachMessage;},
                    emit: (event)=>{assert(event === "attaching");},
                    realize: async ()=>createMockChannel(id),
                };
                return ds as IFluidDataStoreContextDetached & ILocalFluidDataStoreContextImpl;
            };
            const context = dataStores.createDetachedDataStoreCore([], false, someDataStoreId);
            assert(dataStores.size === 1);
            context.bindToContext();
            assert(await dataStores.getDataStore(someDataStoreId, false) !== undefined);
        });

        it("_createFluidDataStoreContext", async ()=>{
            contextFactory._createFluidDataStoreContext = (pkg, id,root,props,bind)=>{
                const ds: Partial<ILocalFluidDataStoreContextImpl> = {
                    id,
                    bindToContext: ()=>bind(AttachState.Attached, createMockChannel(id)),
                    generateAttachMessage: ()=>{return { id } as any as IAttachMessage;},
                    emit: (event)=>{assert(event === "attaching");},
                    realize: async ()=>createMockChannel(id),
                };
                return ds as ILocalFluidDataStoreContextImpl;
            };
            const context = dataStores._createFluidDataStoreContext([], someDataStoreId, false);
            assert(dataStores.size === 1);
            context.bindToContext();
            assert(await dataStores.getDataStore(someDataStoreId, false) !== undefined);
        });

        it("createFromAttachMessage", async ()=>{
            contextFactory.createFromAttachMessage = (seq,msg)=>{
                const ds: Partial<ILocalFluidDataStoreContextImpl> = {
                    id:msg.id,
                    realize: async ()=>({} as any as IFluidDataStoreChannel),
                };
                return ds as ILocalFluidDataStoreContextImpl;
            };
            const attachMsg: Partial<InboundAttachMessage> = {
                id: someDataStoreId,
            };
            dataStores.processAttachMessage({
                    clientId: "client",
                    clientSequenceNumber: 1,
                    contents: attachMsg,
                    minimumSequenceNumber: 0,
                    referenceSequenceNumber: 1,
                    sequenceNumber: 2,
                    term: 0,
                    timestamp: 0,
                    traces: [],
                    type: "attach",
                },
                false);
            assert(dataStores.size === 1);
            assert(await dataStores.getDataStore(someDataStoreId, false) !== undefined);
        });
    });

    describe("Create with existing id", ()=>{
        let dataStores: DataStores;
        let contextFactory: IDataStoreContextFactory;
        beforeEach(async () => {
            contextFactory = {
                ... new MockContextFactory(),
                createFromSnapshot: (id)=> {
                    assert(id === someDataStoreId);
                    const ds: Partial<IFluidDataStoreContextImpl> = {
                        id,
                        realize: async ()=>createMockChannel(id),
                    };
                    return ds as IFluidDataStoreContextImpl;
                },
            };

            dataStores = new DataStores(
                snapshotWithDataStore,
                ()=>{} /* submitAttach */,
                contextFactory,
                undefined);
            assert(dataStores !== undefined);
            assert(dataStores.size === 1);
            assert(await dataStores.getDataStore(someDataStoreId, false) !== undefined);
        });

        it("createDetachedDataStoreCore", ()=>{
            contextFactory.createDetachedDataStoreCore = (pkg, isRoot, id)=>{
                const ds: Partial<IFluidDataStoreContextDetached & ILocalFluidDataStoreContextImpl> = {
                    id,
                };
                return ds as IFluidDataStoreContextDetached & ILocalFluidDataStoreContextImpl;
            };
            try {
                dataStores.createDetachedDataStoreCore([], false, someDataStoreId);
                assert.fail();
            } catch {
            }
        });

        it("_createFluidDataStoreContext", ()=>{
            contextFactory._createFluidDataStoreContext = (pkg, id)=>{
                const ds: Partial<ILocalFluidDataStoreContextImpl> = {
                    id,
                };
                return ds as ILocalFluidDataStoreContextImpl;
            };
            try {
                dataStores._createFluidDataStoreContext([], someDataStoreId, false);
                assert.fail();
            } catch {
            }
        });

        it("createFromAttachMessage", ()=>{
            contextFactory.createFromAttachMessage = (seq,msg)=>{
                const ds: Partial<ILocalFluidDataStoreContextImpl> = {
                    id:msg.id,
                };
                return ds as ILocalFluidDataStoreContextImpl;
            };
            const attachMsg: Partial<InboundAttachMessage> = {
                id: someDataStoreId,
            };
            try {
                dataStores.processAttachMessage({
                    clientId: "client",
                    clientSequenceNumber: 1,
                    contents: attachMsg,
                    minimumSequenceNumber: 0,
                    referenceSequenceNumber: 1,
                    sequenceNumber: 2,
                    term: 0,
                    timestamp: 0,
                    traces: [],
                    type: "attach",
                },
                false);
                assert.fail();
            } catch {
            }
        });
    });
});
