/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { strict as assert } from "assert";
import {  IFluidCodeDetails, ILoader } from "@fluidframework/container-definitions";
import { IChannelFactory } from "@fluidframework/datastore-definitions";
import { ILocalDeltaConnectionServer, LocalDeltaConnectionServer } from "@fluidframework/server-local-server";
import {
    createAndAttachContainer,
    createLocalLoader,
    ITestFluidObject,
    OpProcessingController,
    TestFluidObjectFactory,
} from "@fluidframework/test-utils";
import { ISharedMap, SharedMap } from "@fluidframework/map";
import { LocalResolver } from "@fluidframework/local-driver";
import { Container } from "@fluidframework/container-loader";
import { requestFluidObject } from "@fluidframework/runtime-utils";

describe("CodeProposal.EndToEnd", () => {
    const documentId = "sharedIntervalTest";
    const documentLoadUrl = `fluid-test://localhost/${documentId}`;
    const codeDetails: IFluidCodeDetails = {
        package: "test",
        config: {},
    };
    const codeDetails2: IFluidCodeDetails = {
        package: "test2",
        config: {},
    };

    let deltaConnectionServer: ILocalDeltaConnectionServer;
    let opProcessingController: OpProcessingController;

    async function createContainer(factoryEntries: Iterable<[string, IChannelFactory]>): Promise<Container> {
        const factory = new TestFluidObjectFactory(factoryEntries);
        const urlResolver = new LocalResolver();
        const loader: ILoader = createLocalLoader(
            [[codeDetails, factory],[codeDetails2,factory]],
             deltaConnectionServer, urlResolver);
        return createAndAttachContainer(documentId, codeDetails, loader, urlResolver) as any as Container;
    }

    async function loadContainer(factoryEntries: Iterable<[string, IChannelFactory]>): Promise<Container> {
        const factory = new TestFluidObjectFactory(factoryEntries);
        const urlResolver = new LocalResolver();
        const loader: ILoader = createLocalLoader(
            [[codeDetails, factory],[codeDetails2,factory]],
             deltaConnectionServer, urlResolver);
        return loader.resolve({ url: documentLoadUrl }) as any as Container;
    }

    let containers: Container[];
    beforeEach(async () => {
        deltaConnectionServer = LocalDeltaConnectionServer.create();
        // Create a Container for the first client.
        const container0 = await createContainer([["map", SharedMap.getFactory()]]);

        opProcessingController = new OpProcessingController(deltaConnectionServer);
        opProcessingController.addDeltaManagers(container0.deltaManager);

        await opProcessingController.process();

        // Load the Container that was created by the first client.
        const container1 = await loadContainer([["map", SharedMap.getFactory()]]);
        opProcessingController.addDeltaManagers(container0.deltaManager);

        const quorum1 = container0.getQuorum();
        const quorum2 = container1.getQuorum();

        assert.deepStrictEqual(
            quorum1.get("code"),
            codeDetails,
            "Code proposal in container0 doesn't match");

        assert.deepStrictEqual(
            quorum2.get("code"),
            codeDetails,
            "Code proposal in container1 doesn't match");

        const dataObject1 = await requestFluidObject<ITestFluidObject>(container0, "default");
        const map1 = await dataObject1.getSharedObject<ISharedMap>("map");

        // BUG BUG quorum.propose doesn't handle readonly, so make sure connection is write
        while (container0.deltaManager.connectionMode === "read" || !container0.connected) {
            map1.set("foo","bar");
            await Promise.all([
                new Promise((resolve) => container0.connected ? resolve() : container0.once("connect", resolve)),
                opProcessingController.process(),
            ]);
        }
        containers = [container0, container1];
    });

    it("Code Proposal", async () => {
        const containerUncalledEvents: Set<string>[] = [];
        for (let cid = 0; cid < containers.length; cid++) {
            const expectedEvents = new Set<string>([
                "contextProposed",
                "contextDisposed",
                "contextChanged",
            ]);
            containerUncalledEvents.push(expectedEvents);
            for (const event of expectedEvents.values()) {
                containers[cid].once(event,(c, p)=>{
                    expectedEvents.delete(event);
                    assert.deepStrictEqual(
                        c,
                        codeDetails2,
                        `${cid}: ${event}: code details should be codeDetails2`);
                    assert.deepStrictEqual(
                        p,
                        codeDetails,
                        `${cid}: ${event}: previous code details should be codeDetails`);
                });
            }
        }

        await Promise.all([
            containers[0].getQuorum().propose("code", codeDetails2),
            opProcessingController.process(),
        ]);

        for (let cid = 0; cid < containers.length; cid++) {
            const uncalledEvents = containerUncalledEvents[cid];
            assert.deepStrictEqual(
                uncalledEvents.size,
                0,
                `${cid}: expected events not called: ${JSON.stringify([... uncalledEvents.values()])}`);
        }
    });

    it("Code Proposal Rejection", async () => {
        for (let cid = 0; cid < containers.length; cid++) {
            containers[cid].on("contextProposed",()=>{
                assert.fail(`${cid}: contextProposed: should not happen`);
            });
            containers[cid].on("contextDisposed",()=>{
                assert.fail(`${cid}: contextDisposed: should not happen`);
            });
            containers[cid].on("contextChanged",()=>{
                assert.fail(`${cid}: contextChanged: should not happen`);
            });
        }

        containers[1].getQuorum().on("addProposal",(p)=>{
            if (p.key === "code") {
                p.reject();
            }
        });

        await Promise.all([
            containers[0].getQuorum().propose("code", codeDetails2)
                .then(()=>assert.fail("expected rejection"))
                .catch(()=>{}),
            opProcessingController.process(),
        ]);
    });

    it("Close Container on Code Proposal", async () => {
        containers[0].on("contextChanged",(c)=>{
            assert.deepStrictEqual(
                c,
                codeDetails2,
                "container 0 context should be updated");
        });

        containers[1].once("contextDisposed", () => {
            containers[1].close();
        });

        containers[1].once("contextChanged",()=>{
            assert.fail("container 1 shouldn't reload it's context");
        });

        await Promise.all([
            containers[1].getQuorum().propose("code", codeDetails2),
            opProcessingController.process(),
        ]);
    });

    it("Override on Code Proposal", async () => {
        const expectedEvents: Set<string>[] = [];
        for (let cid = 0; cid < containers.length; cid++) {
            containers[cid].on("contextDisposed",()=>{
                assert.fail(`${cid}: contextDisposed: should not happen`);
            });
            containers[cid].on("contextChanged",()=>{
                assert.fail(`${cid}: contextChanged: should not happen`);
            });

            expectedEvents.push(new Set<string>());
            containers[cid].on("newListener",(e)=>expectedEvents[cid].add(e));

            containers[cid].once("contextProposed",(c, p, overide)=>{
                overide(p);

                expectedEvents[cid].delete("contextProposed");
            });
        }

        await Promise.all([
            containers[0].getQuorum().propose("code", codeDetails2),
            opProcessingController.process(),
        ]);

        for (let cid = 0; cid < containers.length; cid++) {
            const uncalledEvents = expectedEvents[cid];
            assert.deepStrictEqual(
                uncalledEvents.size,
                0,
                `${cid}: expected events not called: ${JSON.stringify([... uncalledEvents.values()])}`);
        }
    });

    afterEach(async () => {
        await deltaConnectionServer.webSocketServer.close();
    });
});
