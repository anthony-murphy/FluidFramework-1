/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import {
    ICodeLoader,
    IContainer,
    ILoader,
    ILoaderOptions,
} from "@fluidframework/container-definitions";
import { Loader } from "@fluidframework/container-loader";
import { IFluidCodeDetails, IRequest } from "@fluidframework/core-interfaces";
import { ITestDriver } from "@fluidframework/test-drivers";
import { fluidEntryPoint, LocalCodeLoader } from "./localCodeLoader";

/**
 * Creates a loader with the given package entries and a delta connection server.
 * @param packageEntries - A list of code details to Fluid entry points.
 * @param deltaConnectionServer - The delta connection server to use as the server.
 */
export function createLocalLoader(
    packageEntries: Iterable<[IFluidCodeDetails, fluidEntryPoint]>,
    driver: ITestDriver,
    options?: ILoaderOptions,
): ILoader {
    const codeLoader: ICodeLoader = new LocalCodeLoader(packageEntries);

    return new Loader({
        urlResolver: driver.createUrlResolver(),
        documentServiceFactory: driver.createDocumentServiceFactory(),
        codeLoader,
        options,
    });
}

/**
 * Creates a detached Container and attaches it.
 * @param documentId - The documentId for the container.
 * @param source - The code details used to create the Container.
 * @param loader - The loader to use to initialize the container.
 * @param urlresolver - The url resolver to get the create new request from.
 */

export async function createAndAttachContainer(
    source: IFluidCodeDetails,
    loader: ILoader,
    createNewRequest: IRequest,
): Promise<IContainer> {
    const container = await loader.createDetachedContainer(source);
    await container.attach(createNewRequest);

    return container;
}
