/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import { IRequest } from "@fluidframework/core-interfaces";
import { IDocumentServiceFactory, IUrlResolver } from "@fluidframework/driver-definitions";

export type TestDriverConfigTypes = "local" | "tinylicious" | "routerlicious" | "odsp";

export interface ITestDriverConfig{
    type: TestDriverConfigTypes;
    createDocumentServiceFactory(): IDocumentServiceFactory;
    createUrlResolver(): IUrlResolver;
    createCreateNewRequest(testId: string): IRequest;
    createContainerUrl(testId: string): string;
    reset(): Promise<void>;
}
