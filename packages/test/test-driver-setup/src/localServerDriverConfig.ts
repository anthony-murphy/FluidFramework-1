/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import { IRequest } from "@fluidframework/core-interfaces";
import {
    LocalDocumentServiceFactory,
    LocalResolver,
    createLocalResolverCreateNewRequest,
} from "@fluidframework/local-driver";
import { LocalDeltaConnectionServer } from "@fluidframework/server-local-server";
import { ITestDriverConfig } from "./interfaces";

export class LocalServerDriverConfig implements ITestDriverConfig {
    public readonly type = "local";
    public readonly server = LocalDeltaConnectionServer.create();
    createDocumentServiceFactory(): LocalDocumentServiceFactory {
        return new LocalDocumentServiceFactory(this.server);
    }
    createUrlResolver(): LocalResolver {
        return new LocalResolver();
    }
    createCreateNewRequest(testId: string): IRequest {
        return createLocalResolverCreateNewRequest(testId);
    }
}
