/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { Loader, waitContainerToCatchUp } from "@fluidframework/container-loader";
import { IFluidCodeDetails } from "@fluidframework/core-interfaces";
import { IUrlResolver, IDocumentServiceFactory } from "@fluidframework/driver-definitions";
import { TestDriverConfig } from "@fluidframework/test-driver-setup";
import { fluidEntryPoint, LocalCodeLoader } from "./localCodeLoader";
import { createAndAttachContainer } from "./localLoader";
import { OpProcessingController } from "./opProcessingController";

const defaultCodeDetails: IFluidCodeDetails = {
    package: "defaultTestPackage",
    config: {},
};

/**
 * Shared base class for test object provider.  Contain code for loader and container creation and loading
 */
export class TestObjectProvider {
    private _documentServiceFactory: IDocumentServiceFactory | undefined;
    private _defaultUrlResolver: IUrlResolver | undefined;
    private _opProcessingController: OpProcessingController | undefined;

    /**
     * Manage objects for loading and creating container, including the driver, loader, and OpProcessingController
     * @param createFluidEntryPoint - callback to create a fluidEntryPoint, with an optiona; set of channel name
     * and factory for TestFluidObject
     */
    constructor(
        public readonly driverConfig: TestDriverConfig,
        private readonly createFluidEntryPoint: (testContainerConfig?: any) => fluidEntryPoint,
    ) {
    }

    get defaultCodeDetails() {
        return defaultCodeDetails;
    }

    get documentServiceFactory() {
        if (!this._documentServiceFactory) {
            this._documentServiceFactory = this.driverConfig.createDocumentServiceFactory();
        }
        return this._documentServiceFactory;
    }

    get urlResolver() {
        if (!this._defaultUrlResolver) {
            this._defaultUrlResolver = this.driverConfig.createUrlResolver();
        }
        return this._defaultUrlResolver;
    }

    get opProcessingController() {
        if (!this._opProcessingController) {
            this._opProcessingController =
                this.driverConfig.type === "local"
                    ? new OpProcessingController(this.driverConfig.server)
                    : new OpProcessingController(undefined, 25);
        }
        return this._opProcessingController;
    }

    private createLoader(packageEntries: Iterable<[IFluidCodeDetails, fluidEntryPoint]>) {
        const codeLoader = new LocalCodeLoader(packageEntries);
        return new Loader({
            urlResolver: this.urlResolver,
            documentServiceFactory: this.documentServiceFactory,
            codeLoader,
        });
    }

    /**
     * Make a test loader.  Container created/loaded thru this loader will not be automatically added
     * to the OpProcessingController, and will need to be added manually if needed.
     * @param testContainerConfig - optional configuring the test Container
     */
    public makeTestLoader(testContainerConfig?: any) {
        return this.createLoader([[defaultCodeDetails, this.createFluidEntryPoint(testContainerConfig)]]);
    }

    /**
     * Make a container using a default document id and code details
     * Container loaded is automatically added to the OpProcessingController to manage op flow
     * @param testContainerConfig - optional configuring the test Container
     */
    public async makeTestContainer(documentId: string, testContainerConfig?: any) {
        const loader = this.makeTestLoader(testContainerConfig);
        const container =
            await createAndAttachContainer(
                defaultCodeDetails,
                loader,
                this.driverConfig.createCreateNewRequest(documentId));
        this.opProcessingController.addDeltaManagers(container.deltaManager);
        return container;
    }

    /**
     * Load a container using a default document id and code details.
     * Container loaded is automatically added to the OpProcessingController to manage op flow
     * @param testContainerConfig - optional configuring the test Container
     */
    public async loadTestContainer(documentId: string, testContainerConfig?: any) {
        const loader = this.makeTestLoader(testContainerConfig);
        const container = await loader.resolve({ url: this.driverConfig.createContainerUrl(documentId) });
        await waitContainerToCatchUp(container);
        this.opProcessingController.addDeltaManagers(container.deltaManager);
        return container;
    }

    public async reset() {
        this._documentServiceFactory = undefined;
        this._defaultUrlResolver = undefined;
        this._opProcessingController = undefined;
        await this.driverConfig.reset();
    }
}
