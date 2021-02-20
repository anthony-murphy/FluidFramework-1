/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import assert from "assert";
import fs from "fs";
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
import { getDriveId} from "@fluidframework/odsp-doclib-utils";
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

export interface TenantConfig {
    tenants: { [friendlyName: string]: ITestTenant | undefined };
}

/** Type modeling the tenant sub-structure of the testConfig.json file */
export interface ITestTenant {
    server: string,
    username: string,
    driveId: string,
}

export async function setupOdspConfig(config: TenantConfig) {
    const loginAccounts = process.env.login__odsp__test__accounts;
    assert(loginAccounts !== undefined, "Missing login__odsp__test__accounts");
    // Expected format of login__odsp__test__accounts is simply string key-value pairs of username and password
    const passwords: { [user: string]: string } = JSON.parse(loginAccounts);

    const tenants = config.tenants;

    if(Object.keys(passwords) !==
        Object.keys(tenants).map((t)=>tenants[t]?.username)) {
        console.log("we should have a password for every tenant");
    }

    for(const tenantName of Object.keys(tenants)) {
        const tenant: ITestTenant | undefined = tenants[tenantName];
        assert(tenant, `No Tenant: ${tenantName}`);

        const password = passwords[tenant.username];

        const loginInfo: IOdspTestLoginInfo = { server: tenant.server, username: tenant.username, password };

        const odspTokens = await odspTokenManager.getOdspTokens(
            loginInfo.server,
            getMicrosoftConfiguration(),
            passwordTokenConfig(loginInfo.username, loginInfo.password),
            undefined /* forceRefresh */,
            true /* forceReauth */,
        );
          tenant.driveId =  await getDriveId(loginInfo.server, "", undefined, { accessToken: odspTokens.accessToken });
    }
}

export class OdspTestDriver implements ITestDriver {
    public static createFromEnv(): OdspTestDriver {
        const loginAccounts = process.env.login__odsp__test__accounts;
        assert(loginAccounts !== undefined, "Missing login__odsp__test__accounts");
        // Expected format of login__odsp__test__accounts is simply string key-value pairs of username and password
        const passwords: { [user: string]: string } = JSON.parse(loginAccounts);

        const config: {odsp: TenantConfig} = JSON.parse(fs.readFileSync(`${__dirname}/config.json`, "utf-8"));
        const tenants = config.odsp.tenants;
        const tenant: ITestTenant | undefined = tenants[Object.keys(tenants)[0]];
        assert(tenant, "No Tenants");

        const password = passwords[tenant.username];

        const loginInfo: IOdspTestLoginInfo = { server: tenant.server, username: tenant.username, password };

        return new OdspTestDriver(loginInfo, tenant.driveId, "test");
    }
    public static async create(loginInfo: IOdspTestLoginInfo, defaultDirectory: string) {
        const odspTokens = await odspTokenManager.getOdspTokens(
            loginInfo.server,
            getMicrosoftConfiguration(),
            passwordTokenConfig(loginInfo.username, loginInfo.password),
            undefined /* forceRefresh */,
            true /* forceReauth */,
        );
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
