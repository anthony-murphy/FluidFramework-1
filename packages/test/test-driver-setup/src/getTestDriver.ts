/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import { Lazy } from "@fluidframework/common-utils";
import { LocalServerDriverConfig } from "./localServerDriverConfig";
import { OdspDriverConfig } from "./odspDriverConfig";
import { RouterliciousDriverConfig } from "./routerliciousDriverConfig";
import { TinyliciousDriverConfig } from "./tinyliciousDriverConfig";

export type TestDriverConfigs =
    LocalServerDriverConfig
    | TinyliciousDriverConfig
    | RouterliciousDriverConfig
    | OdspDriverConfig;

const envVar = "fluid__test__driver";
const cmdArg = "--test-driver=";

const testDriver = new Lazy<TestDriverConfigs>(()=>{
    const arg = process.argv.find((v)=>v.toLocaleLowerCase().startsWith(cmdArg))?.toLocaleLowerCase();
    const type = process.env[envVar]?.toLocaleLowerCase() ?? arg?.replace(cmdArg, "");

    switch (type) {
        case undefined:
        case "":
        case "local":
            return new LocalServerDriverConfig();

        case "tinylicious":
            return new TinyliciousDriverConfig();

        case "routerlicious":
            return new RouterliciousDriverConfig();

        case "odsp":
            return new OdspDriverConfig();

        default:
            throw new Error(`No driver registered for type ${type}`);
    }
});

export const getTestDriverConfig =
    (): TestDriverConfigs => testDriver.value;
