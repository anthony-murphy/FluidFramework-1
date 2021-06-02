/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import random from "random-js";
import { MergeTree } from "../mergeTree";
import {
    annotateRange,
    doOverRange,
    IConfigRange,
    IMergeTreeOperationRunnerConfig,
    insertAtRefPos,
    removeRange,
    runMergeTreeOperationRunner,
    TestOperation,
    generateClientNames,
} from "./mergeTreeOperationRunner";
import { TestClient } from "./testClient";

interface IConflictFarmConfig extends IMergeTreeOperationRunnerConfig {
    minLength: IConfigRange;
    clients: IConfigRange;
    incrementalZamboni: boolean[];
}

const allOperations: TestOperation[] = [
    removeRange,
    annotateRange,
    insertAtRefPos,
];

export const debugOptions: IConflictFarmConfig = {
    minLength: { min: 2, max: 2 },
    clients: { min: 3, max: 4 },
    opsPerRoundRange: { min: 1, max: 128 },
    rounds: 1000,
    operations: allOperations,
    incrementalZamboni: [true],
    growthFunc: (input: number) => input + 1,
    incrementalLog: true,
};

export const defaultOptions: IConflictFarmConfig = {
    minLength: { min: 1, max: 512 },
    clients: { min: 1, max: 8 },
    opsPerRoundRange: { min: 1, max: 128 },
    rounds: 8,
    operations: allOperations,
    incrementalZamboni: [true, false],
    growthFunc: (input: number) => input * 2,
};

export const longOptions: IConflictFarmConfig = {
    minLength: { min: 1, max: 512 },
    clients: { min: 1, max: 32 },
    opsPerRoundRange: { min: 1, max: 512 },
    rounds: 32,
    operations: allOperations,
    incrementalZamboni: [true, false],
    growthFunc: (input: number) => input * 2,
};

describe("MergeTree.Client", () => {
    const opts =
    defaultOptions;
    // debugOptions;
    // longOptions;

    // Generate a list of single character client names, support up to 69 clients
    const clientNames = generateClientNames();

    // eslint-disable-next-line @typescript-eslint/unbound-method
    doOverRange(opts.minLength, opts.growthFunc, (minLength) => {
        // test with and without incremental zamboni
        // not doing incremental zamboni leaves more tombstones in the tree
        // which shouldn't result in different behavior, but has due
        // to bugs
        for(const incrementalZamboni of opts.incrementalZamboni) {
            it(`ConflictFarm_${minLength}_zamboni_${incrementalZamboni}`, async () => {
                MergeTree.options.zamboniRunOnModification = incrementalZamboni;
                try {
                    const clients: TestClient[] = [new TestClient({ blockUpdateMarkers: true })];
                    clients.forEach(
                        (c, i) => c.startOrUpdateCollaboration(clientNames[i]));

                    let seq = 0;
                    while (clients.length < opts.clients.max) {
                        clients.forEach((c) => c.updateMinSeq(seq));

                        // Add double the number of clients each iteration
                        const targetClients = Math.max(opts.clients.min, opts.growthFunc(clients.length));
                        for (let cc = clients.length; cc < targetClients; cc++) {
                            const newClient = await TestClient.createFromClientSnapshot(clients[0], clientNames[cc]);
                            clients.push(newClient);
                        }

                        const mt = random.engines.mt19937();
                        mt.seedWithArray([0xDEADBEEF, 0xFEEDBED, minLength, clients.length]);

                        seq = runMergeTreeOperationRunner(
                            mt,
                            seq,
                            clients,
                            minLength,
                            opts);
                    }
                }finally{
                    // reset to default
                    MergeTree.options.zamboniRunOnModification = true;
                }
            })
            .timeout(30 * 1000);
        }
    });
});
