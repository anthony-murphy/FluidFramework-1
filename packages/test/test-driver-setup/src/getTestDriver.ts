/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import { Lazy } from "@fluidframework/common-utils";
import { LocalServerDriverConfig } from "./localServerDriverConfig";
import { OdspDriverConfig } from "./odspDriverConfig";
import { TinyliciousDriverConfig } from "./tinyliciousDriverConfig";

const testDriver = new Lazy(()=>{
    switch (process.env.fluid__test__driver__type) {
        case undefined:
        case "local":
            return new LocalServerDriverConfig();
        case "tinylicious":
            return new TinyliciousDriverConfig();
        case "odsp":
            return new OdspDriverConfig();
        default:
            throw new Error(`No driver registered for type ${process.env.fluid__test__driver__type}`);
    }
});

export const getTestDriverConfig =
    (): LocalServerDriverConfig | TinyliciousDriverConfig | OdspDriverConfig => testDriver.value;
