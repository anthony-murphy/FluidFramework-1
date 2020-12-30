/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

/* eslint-disable import/no-extraneous-dependencies */
export {
    ContainerRuntimeFactoryWithDefaultDataStore,
    DataObject,
    DataObjectFactory,
} from "old-aqueduct";
export * from "old-container-definitions";
export * from "old-core-interfaces";
export { Container, Loader } from "old-container-loader";
export { ContainerRuntime, IContainerRuntimeOptions } from "old-container-runtime";
export { IDocumentServiceFactory, IUrlResolver } from "old-driver-definitions";
export { IFluidDataStoreFactory } from "old-runtime-definitions";
export { IChannelFactory } from "old-datastore-definitions";
export {
    createLocalLoader,
    createAndAttachContainer,
    TestFluidObjectFactory,
    TestContainerRuntimeFactory,
    LocalCodeLoader,
    ChannelFactoryRegistry,
    OpProcessingController,
} from "old-test-utils";
export { SharedDirectory, SharedMap } from "old-map";
export { SharedString, SparseMatrix } from "old-sequence";
export { LocalDocumentServiceFactory, LocalResolver } from "old-local-driver";
export { ConsensusRegisterCollection } from "old-register-collection";
export { SharedCell } from "old-cell";
export { SharedCounter } from "old-counter";
export { Ink } from "old-ink";
export { SharedMatrix } from "old-matrix";
export { ConsensusQueue } from "old-ordered-collection";

import { TestDriverConfig } from "@fluidframework/test-driver-setup";
import {  TestObjectProvider as currentTestObjectProvider } from "@fluidframework/test-utils";
import { fluidEntryPoint } from "old-test-utils";

export { TestDriverConfig } from "@fluidframework/test-driver-setup";

export class TestObjectProvider extends currentTestObjectProvider {
    constructor(
        driverConfig: TestDriverConfig,
        createFluidEntryPoint: (testContainerConfig?: any) => fluidEntryPoint,
        ) {
            super(driverConfig, createFluidEntryPoint as any);
        }
}

/* eslint-enable import/no-extraneous-dependencies */
