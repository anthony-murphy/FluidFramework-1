/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { IRequest } from "@fluidframework/core-interfaces";
import { IDocumentServiceFactory, IUrlResolver } from "@fluidframework/driver-definitions";
import {
    OdspDocumentServiceFactory,
    OdspDriverUrlResolver,
    createOdspCreateContainerRequest,
    OdspResourceTokenFetchOptions,
 } from "@fluidframework/odsp-driver";
import {
    OdspTokenConfig,
    OdspTokenManager,
    odspTokensCache,
    getMicrosoftConfiguration,
} from "@fluidframework/tool-utils";
import { getDriveId, getLoginPageUrl, getOdspScope, IOdspTokens } from "@fluidframework/odsp-doclib-utils";
import { ITestDriver } from "@fluidframework/test-driver-definitions";
import { pkgVersion } from "./packageVersion";

const passwordTokenConfig = (username, password): OdspTokenConfig => ({
    type: "password",
    username,
    password,
});

export interface IOdspTestLoginInfo {
    server: string;
    username: string;
    password: string;
}

const odspTokenManager = new OdspTokenManager(odspTokensCache);

async function getOdspTokens(loginInfo: IOdspTestLoginInfo): Promise<IOdspTokens> {
    try {
        // Ensure fresh tokens here so the test runners have them cached
        const odspTokens = await odspTokenManager.getOdspTokens(
            loginInfo.server,
            getMicrosoftConfiguration(),
            passwordTokenConfig(loginInfo.username, loginInfo.password),
            undefined /* forceRefresh */,
            true /* forceReauth */,
        );
        await odspTokenManager.getPushTokens(
            loginInfo.server,
            getMicrosoftConfiguration(),
            passwordTokenConfig(loginInfo.username, loginInfo.password),
            undefined /* forceRefresh */,
            true /* forceReauth */,
        );
        return odspTokens;
    } catch (ex) {
        // Log the login page url in case the caller needs to allow consent for this app
        const loginPageUrl =
            getLoginPageUrl(
                loginInfo.server,
                getMicrosoftConfiguration(),
                getOdspScope(loginInfo.server),
                "http://localhost:7000/auth/callback",
            );

        console.log("You may need to allow consent for this app. Re-run the tool after allowing consent.");
        console.log(`Go here allow the app: ${loginPageUrl}\n`);

        throw ex;
    }
}

export class OdspTestDriver implements ITestDriver {
    public static createFromEnv(): OdspTestDriver {
        throw new Error("not supported");
    }
    public static async create(loginInfo: IOdspTestLoginInfo, defaultDirectory: string) {
        const odspTokens = await getOdspTokens(loginInfo);
        const driveId =  await getDriveId(loginInfo.server, "", undefined, { accessToken: odspTokens.accessToken });
        return new OdspTestDriver(loginInfo, driveId, defaultDirectory);
    }

    public readonly type = "odsp";
    public readonly version = pkgVersion;

    private constructor(
        private readonly loginInfo: IOdspTestLoginInfo,
        private readonly driveId: string,
        private readonly defaultDirectory: string,
        ) { }

    createContainerUrl(testId: string): string {
        throw new Error("Method not implemented.");
    }

    createDocumentServiceFactory(): IDocumentServiceFactory {
        const documentServiceFactory = new OdspDocumentServiceFactory(
            async (options: OdspResourceTokenFetchOptions) => {
                const tokens = await odspTokenManager.getOdspTokens(
                    this.loginInfo.server,
                    getMicrosoftConfiguration(),
                    passwordTokenConfig(this.loginInfo.username,  this.loginInfo.password),
                    options.refresh,
                );
                return tokens.accessToken;
            },
            async (options: OdspResourceTokenFetchOptions) => {
                const tokens = await odspTokenManager.getPushTokens(
                    this.loginInfo.server,
                    getMicrosoftConfiguration(),
                    passwordTokenConfig(this.loginInfo.username,  this.loginInfo.password),
                    options.refresh,
                );
                return tokens.accessToken;
            },
        );
        return documentServiceFactory;
    }
    createUrlResolver(): IUrlResolver {
        return new OdspDriverUrlResolver();
    }
    createCreateNewRequest(testId: string): IRequest {
        return createOdspCreateContainerRequest(
            `https://${this.loginInfo.server}`,
            this.driveId,
            this.defaultDirectory,
            `${testId}.fluid`,
        );
    }
}
