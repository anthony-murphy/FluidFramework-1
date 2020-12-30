/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { LocalServerDriverConfig } from "./localServerDriverConfig";
import { OdspDriverConfig } from "./odspDriverConfig";
import { RouterliciousDriverConfig } from "./routerliciousDriverConfig";
import { TinyliciousDriverConfig } from "./tinyliciousDriverConfig";

export type TestDriverConfig =
    LocalServerDriverConfig
    | TinyliciousDriverConfig
    | RouterliciousDriverConfig
    | OdspDriverConfig;

export * from "./interfaces";
export * from "./localServerDriverConfig";
export * from "./odspDriverConfig";
export * from "./tinyliciousDriverConfig";
export * from "./routerliciousDriverConfig";
