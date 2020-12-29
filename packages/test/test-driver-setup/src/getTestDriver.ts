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

const testDriver = new Lazy<TestDriverConfigs>(()=>{
    switch (process.env.fluid__test__driver__type) {
        case undefined:
        case "local":
            return new LocalServerDriverConfig();
        case "tinylicious":
            return new TinyliciousDriverConfig();
        case "routerlicious":
            return new RouterliciousDriverConfig();
        case "odsp":
            return new OdspDriverConfig();
        default:
            throw new Error(`No driver registered for type ${process.env.fluid__test__driver__type}`);
    }
});

export const getTestDriverConfig =
    (): TestDriverConfigs => testDriver.value;
