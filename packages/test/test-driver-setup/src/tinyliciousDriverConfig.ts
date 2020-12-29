/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { IRequest } from "@fluidframework/core-interfaces";
import { RouterliciousDocumentServiceFactory } from "@fluidframework/routerlicious-driver";
import {
    createTinyliciousCreateNewRequest,
    InsecureTinyliciousTokenProvider,
    InsecureTinyliciousUrlResolver,
} from "@fluidframework/tinylicious-driver";
import { ITestDriverConfig } from "./interfaces";

export class TinyliciousDriverConfig implements ITestDriverConfig {
    public readonly type = "tinylicious";

    createDocumentServiceFactory(): RouterliciousDocumentServiceFactory {
        return new RouterliciousDocumentServiceFactory(
            new InsecureTinyliciousTokenProvider());
    }
    createUrlResolver(): InsecureTinyliciousUrlResolver {
        return new InsecureTinyliciousUrlResolver();
    }
    createCreateNewRequest(testId: string): IRequest {
        return createTinyliciousCreateNewRequest(testId);
    }
}
