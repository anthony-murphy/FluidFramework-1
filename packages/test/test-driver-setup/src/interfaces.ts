/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import { IRequest } from "@fluidframework/core-interfaces";
import { IDocumentServiceFactory, IUrlResolver } from "@fluidframework/driver-definitions";

export interface ITestDriverConfig{
    type: "local" | "tinylicious" | "routerlicious" | "odsp";
    createDocumentServiceFactory(): IDocumentServiceFactory;
    createUrlResolver(): IUrlResolver;
    createCreateNewRequest(testId: string): IRequest;
}
