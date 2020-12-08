/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { strict as assert } from "assert";
import { ContainerRuntime } from "../containerRuntime";

import { DataStores } from "../dataStores";

describe("DataStores", () => {
    it("asdsad",()=>{
        const dataStores = new DataStores(
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
        );
        assert(dataStores !== undefined);
    });
});
