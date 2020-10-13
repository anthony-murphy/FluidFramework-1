/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { strict as assert } from "assert";
import { IFluidCodeDetails, ILoader } from "@fluidframework/container-definitions";
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
    const documentId = "codeProposalTest";
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

        const quorum0 = container0.getQuorum();
        const quorum1 = container1.getQuorum();

        assert.deepStrictEqual(
            quorum0.get("code"),
            codeDetails,
            "Code proposal in container0 doesn't match");

        assert.deepStrictEqual(
            quorum1.get("code"),
            codeDetails,
            "Code proposal in container1 doesn't match");

        const dataObject1 = await requestFluidObject<ITestFluidObject>(container0, "default");
        const map1 = await dataObject1.getSharedObject<ISharedMap>("map");

        // BUG BUG quorum.propose doesn't handle readonly, so make sure connection is write
        do {
            map1.set("foo","bar");
            await Promise.all([
                new Promise((resolve) => container0.connected ? resolve() : container0.once("connect", resolve)),
                opProcessingController.process(),
            ]);
        } while (!container0.connected);

        containers = [container0, container1];
    });

    it("Code Proposal", async () => {
        const containerEvents: Set<string>[] = [];
        for (let i = 0; i < containers.length; i++) {
            const expectedEvents = new Set<string>();
            containerEvents.push(expectedEvents);
            for (const event of ["contextReloading", "contextDisposed", "contextChanged"]) {
                expectedEvents.add(event);
                containers[i].once(event,(c)=>{
                    expectedEvents.delete(event);
                    assert.deepStrictEqual(
                        c,
                        codeDetails2,
                        `containers[${i}]: ${event}: expected updated code details `);
                });
            }
        }

        await Promise.all([
            containers[0].getQuorum().propose("code", codeDetails2),
            opProcessingController.process(),
        ]);

        for (let i = 0; i < containers.length; i++) {
            assert.strictEqual(
                containerEvents[i].size,
                0,
                `containers[${i}]: unfired events: ${JSON.stringify([... containerEvents.values()])}`);
        }
    });

    it("Code Proposal Rejection", async () => {
        for (let i = 0; i < containers.length; i++) {
            for (const event of ["contextReloading", "contextDisposed", "contextChanged"]) {
                containers[i].once(event, (c)=>{
                    assert.fail(`containers[${i}]: ${event}: no event should emit`);
                });
            }
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
        const containerEvents: Set<string>[] = [];
        const expectedEvents = new Set<string>();
        containerEvents.push(expectedEvents);
        for (const event of ["contextReloading", "contextDisposed", "contextChanged"]) {
            expectedEvents.add(event);
            containers[0].once(event,(c)=>{
                expectedEvents.delete(event);
                assert.deepStrictEqual(
                    c,
                    codeDetails2,
                    `containers[0]: ${event}: expected updated code details `);
            });
        }

        containers[1].once("contextReloading",()=>{
            containers[1].once("contextDisposed",()=>{
                containers[1].close();
                containers[1].once("contextChanged",()=>{
                    assert.fail("containers[1]: contextChanged should not fire");
                });
            });
        });

        await Promise.all([
            containers[0].getQuorum().propose("code", codeDetails2),
            opProcessingController.process(),
        ]);

        assert.strictEqual(containers[0].closed, false, "containers[0] should not be closed");
        assert.strictEqual(containers[1].closed, true, "containers[1] should be closed");

        assert.strictEqual(
            containerEvents[0].size,
            0,
            `containers[0]: unfired events: ${JSON.stringify([... containerEvents.values()])}`);
    });

    it("Keep Existing Context on Code Proposal", async () => {
        const containerEvents: Set<string>[] = [];
        const expectedEvents = new Set<string>();
        containerEvents.push(expectedEvents);
        for (const event of ["contextReloading", "contextDisposed", "contextChanged"]) {
            expectedEvents.add(event);
            containers[0].once(event,(c)=>{
                expectedEvents.delete(event);
                assert.deepStrictEqual(
                    c,
                    codeDetails2,
                    `containers[0]: ${event}: expected updated code details `);
            });
        }

        containers[1].once("contextReloading",(c,p, cancel)=>{
            cancel();
            containers[1].once("contextDisposed",()=>{
                assert.fail("containers[1]: contextDisposed should not fire");
            });
            containers[1].once("contextChanged",()=>{
                assert.fail("containers[1]: contextChanged should not fire");
            });
        });

        await Promise.all([
            containers[0].getQuorum().propose("code", codeDetails2),
            opProcessingController.process(),
        ]);

        assert.strictEqual(
            containerEvents[0].size,
            0,
            `containers[0]: unfired events: ${JSON.stringify([... containerEvents.values()])}`);
    });

    afterEach(async () => {
        await deltaConnectionServer.webSocketServer.close();
    });
});
