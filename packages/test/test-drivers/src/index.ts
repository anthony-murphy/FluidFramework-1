/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { LocalServerTestDriver } from "./localServerDriverConfig";
import { OdspTestDriver } from "./odspDriverConfig";
import { RouterliciousTestDriver } from "./routerliciousDriverConfig";
import { TinyliciousTestDriver } from "./tinyliciousDriverConfig";

export type TestDriver =
    LocalServerTestDriver
    | TinyliciousTestDriver
    | RouterliciousTestDriver
    | OdspTestDriver;

export * from "./interfaces";
export * from "./localServerDriverConfig";
export * from "./odspDriverConfig";
export * from "./tinyliciousDriverConfig";
export * from "./routerliciousDriverConfig";
