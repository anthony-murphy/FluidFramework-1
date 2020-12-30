/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import assert from "assert";
import { IRequest } from "@fluidframework/core-interfaces";
import { RouterliciousDocumentServiceFactory, DefaultErrorTracking } from "@fluidframework/routerlicious-driver";
import { InsecureTokenProvider, InsecureUrlResolver } from "@fluidframework/test-runtime-utils";
import { v4 as uuid } from "uuid";
import { ITestDriverConfig } from "./interfaces";

export class RouterliciousDriverConfig implements ITestDriverConfig {
    public static createFromEnv() {
        const bearerSecret = process.env.fluid__webpack__bearerSecret;
        const tenantId = process.env.fluid__webpack__tenantId ?? "fluid";
        const tenantSecret = process.env.fluid__webpack__tenantSecret;
        const fluidHost = process.env.fluid__webpack__fluidHost;
        assert(bearerSecret, "Missing bearer secret");
        assert(tenantId, "Missing tenantId");
        assert(tenantSecret, "Missing tenant secret");
        assert(fluidHost, "Missing Fluid host");

        return new RouterliciousDriverConfig(
            bearerSecret,
            tenantId,
            tenantSecret,
            fluidHost,
        );
    }

    public readonly type = "routerlicious";

    constructor(
        private readonly bearerSecret: string,
        private readonly tenantId: string,
        private readonly tenantSecret: string,
        private readonly fluidHost: string) {
    }

    createContainerUrl(testId: string): string {
        return `${this.fluidHost}/${encodeURIComponent(this.tenantId)}/${encodeURIComponent(testId)}`;
    }

    createDocumentServiceFactory(): RouterliciousDocumentServiceFactory {
        const tokenProvider = new InsecureTokenProvider(
            this.tenantSecret,
            {
                id: uuid(),
            },
        );

        return new RouterliciousDocumentServiceFactory(
            tokenProvider,
            false,
            new DefaultErrorTracking(),
            false,
            true,
            undefined,
        );
    }
    createUrlResolver(): InsecureUrlResolver {
        return new InsecureUrlResolver(
                this.fluidHost,
                this.fluidHost.replace("www", "alfred"),
                this.fluidHost.replace("www", "historian"),
                this.tenantId,
                this.bearerSecret,
                true);
    }
    createCreateNewRequest(testId: string): IRequest {
        return this.createUrlResolver().createCreateNewRequest(testId);
    }

    public async reset() {}
}
