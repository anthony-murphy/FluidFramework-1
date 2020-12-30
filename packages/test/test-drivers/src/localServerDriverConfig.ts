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
import { ISummaryConfiguration } from "@fluidframework/protocol-definitions";
import { ITestDriverConfig } from "./interfaces";

export class LocalServerDriverConfig implements ITestDriverConfig {
    private _server = LocalDeltaConnectionServer.create();

    public readonly type = "local";
    public get server() {return this._server;}

    createDocumentServiceFactory(): LocalDocumentServiceFactory {
        return new LocalDocumentServiceFactory(this._server);
    }
    createUrlResolver(): LocalResolver {
        return new LocalResolver();
    }
    createCreateNewRequest(testId: string): IRequest {
        return createLocalResolverCreateNewRequest(testId);
    }

    createContainerUrl(testId: string): string {
        return `fluid-test://localhost/${testId}`;
    }

    public async reset(options?: {serviceConfiguration?: {summary?: Partial<ISummaryConfiguration>}}) {
        await this._server?.webSocketServer.close();
        this._server = LocalDeltaConnectionServer.create(undefined, options?.serviceConfiguration as any);
    }
}
