/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { strict as assert } from "assert";
import { IContainer, IFluidModule } from "@fluidframework/container-definitions";
import { IFluidRouter } from "@fluidframework/core-interfaces";
import { requestFluidObject } from "@fluidframework/runtime-utils";
import { TestObjectProvider, ChannelFactoryRegistry } from "@fluidframework/test-utils";
import { LocalServerDriverConfig, TestDriverConfig } from "@fluidframework/test-drivers";
import {
    generateCompatTest,
    createOldPrimedDataStoreFactory,
    createOldRuntimeFactory,
    createPrimedDataStoreFactory,
    createRuntimeFactory,
    ITestObjectProvider,
    OldTestDataObject,
    TestDataObject,
} from "./compatUtils";
import * as old from "./oldVersion";

async function loadContainer(
    docId: string,
    fluidModule: IFluidModule | old.IFluidModule,
    driver: TestDriverConfig | old.TestDriverConfig,
): Promise<IContainer> {
    const testObjectProvider = new TestObjectProvider(
        driver,
        (reg?: ChannelFactoryRegistry) => fluidModule as IFluidModule);
    return testObjectProvider.loadTestContainer(docId);
}

async function loadContainerWithOldLoader(
    docId: string,
    fluidModule: IFluidModule | old.IFluidModule,
    driver: TestDriverConfig | old.TestDriverConfig,
): Promise<old.IContainer> {
    const testObjectProvider = new old.TestObjectProvider(
        driver,
        (reg?: ChannelFactoryRegistry) => fluidModule as old.IFluidModule);
    return testObjectProvider.loadTestContainer(docId);
}

const tests = function(args: ITestObjectProvider) {
    describe("loader/runtime compatibility", () => {
        let container: IContainer | old.IContainer;
        let dataObject: TestDataObject | OldTestDataObject;
        let containerError: boolean = false;
        let documentId: string;

        beforeEach(async function() {
            const driver = args.driverConfig as LocalServerDriverConfig;
            if (driver.type === "local") {
                await driver.reset({
                    serviceConfiguration: {
                        summary: { maxOps: 1 },
                    },
                });
            }
            documentId = Date.now().toString();
            container = await args.makeTestContainer(documentId);
            container.on("warning", () => containerError = true);
            container.on("closed", (error) => containerError = containerError || error !== undefined);

            dataObject = await requestFluidObject<TestDataObject>(container as IFluidRouter, "default");
        });

        afterEach(async function() {
            assert.strictEqual(containerError, false, "Container warning or close with error");
        });

        it("loads", async function() {
            await args.opProcessingController.process();
        });

        it("can set/get on root directory", async function() {
            const test = ["fluid is", "pretty neat!"];
            (dataObject._root as any).set(test[0], test[1]);
            assert.strictEqual(await dataObject._root.wait(test[0]), test[1]);
        });

        it("can summarize", async function() {
            const test = ["fluid is", "pretty neat!"];
            (dataObject._root as any).set(test[0], test[1]);
            assert.strictEqual(await dataObject._root.wait(test[0]), test[1]);

            // wait for summary ack/nack
            await new Promise<void>((resolve, reject) => container.on("op", (op) => {
                if (op.type === "summaryAck") {
                    resolve();
                } else if (op.type === "summaryNack") {
                    reject(new Error("summaryNack"));
                }
            }));
        });

        it("can load existing", async function() {
            const test = ["prague is", "also neat"];
            (dataObject._root as any).set(test[0], test[1]);
            assert.strictEqual(await dataObject._root.wait(test[0]), test[1]);

            const containersP: Promise<IContainer | old.IContainer>[] = [
                loadContainer( // new everything
                    documentId,
                    { fluidExport: createRuntimeFactory(TestDataObject.type, createPrimedDataStoreFactory()) },
                    args.driverConfig),
                loadContainerWithOldLoader( // old loader, new container/data store runtimes
                    documentId,
                    { fluidExport: createRuntimeFactory(TestDataObject.type, createPrimedDataStoreFactory()) },
                    args.driverConfig),
                loadContainerWithOldLoader( // old everything
                    documentId,
                    { fluidExport: createOldRuntimeFactory(TestDataObject.type, createOldPrimedDataStoreFactory()) },
                    args.driverConfig),
                loadContainer( // new loader, old container/data store runtimes
                    documentId,
                    { fluidExport: createOldRuntimeFactory(TestDataObject.type, createOldPrimedDataStoreFactory()) },
                    args.driverConfig),
                loadContainer( // new loader/container runtime, old data store runtime
                    documentId,
                    { fluidExport: createRuntimeFactory(TestDataObject.type, createOldPrimedDataStoreFactory()) },
                    args.driverConfig),
                loadContainerWithOldLoader( // old loader/container runtime, new data store runtime
                    documentId,
                    { fluidExport: createOldRuntimeFactory(TestDataObject.type, createPrimedDataStoreFactory()) },
                    args.driverConfig),
            ];

            const dataObjects = await Promise.all(containersP.map(async (containerP) => containerP.then(
                async (c) => requestFluidObject<TestDataObject | OldTestDataObject>(c as IFluidRouter, "default"))));

            // get initial test value from each data store
            dataObjects.map(async (c) => assert.strictEqual(await c._root.wait(test[0]), test[1]));

            // set a test value from every data store (besides initial)
            const test2 = [...Array(dataObjects.length).keys()].map((x) => x.toString());
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            dataObjects.map(async (c, i) => (c._root as any).set(test2[i], test2[i]));

            // get every test value from every data store (besides initial)
            dataObjects.map(async (c) => test2.map(
                async (testVal) => assert.strictEqual(await c._root.wait(testVal), testVal)));

            // get every value from initial data store
            test2.map(async (testVal) => assert.strictEqual(await dataObject._root.wait(testVal), testVal));
        });
    });
};

generateCompatTest(tests);
