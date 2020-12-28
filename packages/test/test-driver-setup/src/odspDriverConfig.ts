/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import fs from "fs";
import { IRequest } from "@fluidframework/core-interfaces";
import { IDocumentServiceFactory, IUrlResolver } from "@fluidframework/driver-definitions";
import {
    OdspDocumentServiceFactory,
    OdspDriverUrlResolver,
    createOdspCreateContainerRequest,
 } from "@fluidframework/odsp-driver";
import {
    OdspTokenConfig,
    OdspTokenManager,
    odspTokensCache,
    getMicrosoftConfiguration,
} from "@fluidframework/tool-utils";
import { ITestDriverConfig } from "./interfaces";

const passwordTokenConfig = (username, password): OdspTokenConfig => ({
    type: "password",
    username,
    password,
});

interface IOdspConfig {
    server: string;
    driveId: string;
    username: string;
}

export class OdspDriverConfig implements ITestDriverConfig {
    public readonly type = "odsp";
    private readonly odspTokenManager = new OdspTokenManager(odspTokensCache);
    private readonly config: IOdspConfig;

    private readonly dir = Date.now().toString();

    constructor() {
        this.config = JSON.parse(fs.readFileSync("./testConfig.json", "utf-8"));
    }

    createDocumentServiceFactory(): IDocumentServiceFactory {
        return new OdspDocumentServiceFactory(
            async (_siteUrl: string, refresh: boolean, _claims?: string) => {
                const tokens = await this.odspTokenManager.getOdspTokens(
                    this.config.server,
                    getMicrosoftConfiguration(),
                    passwordTokenConfig(this.config.username, password),
                    refresh,
                );
                return tokens.accessToken;
            },
            async (refresh: boolean, _claims?: string) => {
                const tokens = await this.odspTokenManager.getPushTokens(
                    this.config.server,
                    getMicrosoftConfiguration(),
                    passwordTokenConfig(this.config.username, password),
                    refresh,
                );
                return tokens.accessToken;
            },
        );
    }
    createUrlResolver(): IUrlResolver {
        return new OdspDriverUrlResolver();
    }
    createCreateNewRequest(testId: string): IRequest {
        return createOdspCreateContainerRequest(
            `https://${this.config.server}`,
            this.config.driveId,
            this.dir,
            testId,
        );
    }
}
