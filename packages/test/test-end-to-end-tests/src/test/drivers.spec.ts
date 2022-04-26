/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { strict as assert } from "assert";
import { describeFullCompat } from "@fluidframework/test-version-utils";

describeFullCompat.noCompat("drivers",(providerFactory)=>{
    it("getVersions",async ()=>{
        const provider = providerFactory();
        const container = await provider.makeTestContainer();

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const factory = await provider.documentServiceFactory.createDocumentService(container.resolvedUrl!);

        const storage = await factory.connectToStorage();

        const versions = await storage.getVersions("", 10);
        assert.equal(versions.length, 1);
    });
});
