/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { strict as assert } from "assert";
import {
    IFluidCodeDetails,
    IFluidCodeResolver,
    IResolvedFluidCodeDetails,
} from "@fluidframework/container-definitions";
import { ILocalDeltaConnectionServer, LocalDeltaConnectionServer } from "@fluidframework/server-local-server";
import {
    createAndAttachContainer,
    createLocalLoaderProps,
    ITestFluidObject,
    OpProcessingController,
    TestFluidObjectFactory,
} from "@fluidframework/test-utils";
import { ISharedMap, SharedMap } from "@fluidframework/map";
import { Container, ILoaderProps, Loader } from "@fluidframework/container-loader";
import { requestFluidObject } from "@fluidframework/runtime-utils";

describe("CodeProposal.EndToEnd", () => {
    const documentId = "codeProposalTest";
    const documentLoadUrl = `fluid-test://localhost/${documentId}`;
    const codeDetails1: IFluidCodeDetails = {
        package: "test@1.0",
    };
    const codeDetails2: IFluidCodeDetails = {
        package: "test@2.0",
    };
    const codeDetails2dot1: IFluidCodeDetails = {
        package: "test@2.1",
    };

    const resolvedCodeDetails = [codeDetails1, codeDetails2, codeDetails2dot1].reduce((pv,cv)=>{
        if (typeof cv.package === "string") {
            const key = cv.package.split(".")[0];
            if (!pv.has(key)) {
                const pkgParts = cv.package.split("@");
                pv.set(key,{
                    ...cv,
                    resolvedPackage: {
                        name: pkgParts[0],
                        version: pkgParts[1],
                    },
                });
            }
        }
        return pv;
    },
    new Map<string, IResolvedFluidCodeDetails>());

    const codeResolver: IFluidCodeResolver = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        resolveCodeDetails: async (code)=> resolvedCodeDetails.get((code.package as string).split(".")[0])!,
    };

    let deltaConnectionServer: ILocalDeltaConnectionServer;
    let opProcessingController: OpProcessingController;

    async function createContainer(codeDetails: IFluidCodeDetails = codeDetails1): Promise<Container> {
        const factory = new TestFluidObjectFactory([["map", SharedMap.getFactory()]]);
        const props: ILoaderProps = {
            ...createLocalLoaderProps(
            [
                [codeDetails1, factory],
                [codeDetails2, factory],
            ],
            deltaConnectionServer),
            codeResolver,
        };
        const loader = new Loader(props);
        return createAndAttachContainer(
            documentId,
            codeDetails,
            loader,
            loader.services.urlResolver) as any as Container;
    }

    async function loadContainer(): Promise<Container> {
        const factory = new TestFluidObjectFactory([["map", SharedMap.getFactory()]]);
        const props: ILoaderProps = {
            ...createLocalLoaderProps(
            [
                [codeDetails1, factory],
                [codeDetails2, factory],
            ],
            deltaConnectionServer),
            codeResolver,
        };
        const loader = new Loader(props);
        return loader.resolve({ url: documentLoadUrl }) as any as Container;
    }

    async function createContainers(codeDetails: IFluidCodeDetails = codeDetails1) {
        deltaConnectionServer = LocalDeltaConnectionServer.create();

        // Create a Container for the first client.
        const container0 = await createContainer(codeDetails);

        opProcessingController = new OpProcessingController(deltaConnectionServer);
        opProcessingController.addDeltaManagers(container0.deltaManager);

        await opProcessingController.process();

        // Load the Container that was created by the first client.
        const container1 = await loadContainer();
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

        return [container0, container1];
    }

    it("Code Proposal", async () => {
        const containers = await createContainers();
        const containerEvents: Set<string>[] = [];
        for (let i = 0; i < containers.length; i++) {
            const expectedEvents = new Set<string>();
            containerEvents.push(expectedEvents);
            for (const event of ["contextDisposed", "contextChanged"]) {
                expectedEvents.add(event);
                containers[i].once(event,(c)=>{
                    expectedEvents.delete(event);
                    assert.deepStrictEqual(
                        c.package,
                        codeDetails2.package,
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
                `containers[${i}]: unfired events: ${JSON.stringify([... containerEvents[i]])}`);
        }
    });

    it("Code Proposal Rejection", async () => {
        const containers = await createContainers();
        for (let i = 0; i < containers.length; i++) {
            for (const event of ["contextDisposed", "contextChanged"]) {
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
        const containers = await createContainers();
        const containerEvents: Set<string>[] = [];
        const expectedEvents = new Set<string>();
        containerEvents.push(expectedEvents);
        for (const event of ["contextDisposed", "contextChanged"]) {
            expectedEvents.add(event);
            containers[0].once(event,(c)=>{
                expectedEvents.delete(event);
                assert.deepStrictEqual(
                    c.package,
                    codeDetails2.package,
                    `containers[0]: ${event}: expected updated code details `);
            });
        }

        containers[1].once("contextDisposed",()=>{
            containers[1].close();
            containers[1].once("contextChanged",()=>{
                assert.fail("containers[1]: contextChanged should not fire");
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
            `containers[0]: unfired events: ${JSON.stringify([... containerEvents[0]])}`);
    });

    it("Keep Existing Context on Code Proposal", async () => {
        const containers = await createContainers(codeDetails2);

        containers[0].once("contextDisposed",()=>{
            assert.fail("containers[1]: contextDisposed should not fire");
        });
        containers[0].once("contextChanged",()=>{
            assert.fail("containers[1]: contextChanged should not fire");
        });

        containers[1].once("contextDisposed",()=>{
            assert.fail("containers[1]: contextDisposed should not fire");
        });
        containers[1].once("contextChanged",()=>{
            assert.fail("containers[1]: contextChanged should not fire");
        });

        await Promise.all([
            containers[0].getQuorum().propose("code", codeDetails2dot1),
            opProcessingController.process(),
        ]);

        assert.strictEqual(containers[0].closed, false, "containers[0] should not be closed");
        assert.strictEqual(containers[1].closed, false, "containers[1] should not be closed");
    });

    afterEach(async () => {
        await deltaConnectionServer.webSocketServer.close();
    });
});
