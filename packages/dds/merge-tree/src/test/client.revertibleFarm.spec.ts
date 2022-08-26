/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { ISequencedDocumentMessage } from "@fluidframework/protocol-definitions";
import random from "random-js";
import { SegmentGroup } from "../mergeTreeNodes";
import { appendToRevertibles, MergeTreeDeltaRevertible, revert } from "../revertibles";
import {
    removeRange,
    generateClientNames,
    doOverRange,
    generateOperationMessagesForClients,
    applyMessages,
    annotateRange,
} from "./mergeTreeOperationRunner";
import { TestClient } from "./testClient";
import { TestClientLogger } from "./testClientLogger";

 const defaultOptions = {
    minLength: { min: 1, max: 1 },
    initialOps: { min: 2, max: 2 },
    revertOps: { min: 1, max: 1 },
    ackBeforeRevert: [true, false],
    rounds: 100,
    operations: [removeRange, annotateRange],
    growthFunc: (input: number) => input + 1,
};

describe("MergeTree.Client", () => {
    // Generate a list of single character client names, support up to 69 clients
    const clientNames = generateClientNames();

    doOverRange(defaultOptions.minLength, defaultOptions.growthFunc, (minLen) => {
        it(`RevertiblesFarm_${minLen}`, async () => {
            for (const ackBeforeRevert of defaultOptions.ackBeforeRevert) {
                doOverRange(defaultOptions.initialOps, defaultOptions.growthFunc, (initialOps) => {
                    doOverRange(defaultOptions.revertOps, defaultOptions.growthFunc, (revertOps) => {
                        const mt = random.engines.mt19937();
                        mt.seedWithArray([0xDEADBEEF, 0xFEEDBED, minLen, initialOps, revertOps]);

                        const clients: TestClient[] = new Array(4).fill(0).map(
                            () => new TestClient({ mergeTreeUseNewLengthCalculations: true }));
                        clients.forEach(
                            (c, i) => c.startOrUpdateCollaboration(clientNames[i]));
                        let seq = 0;
                        for (let rnd = 0; rnd < defaultOptions.rounds; rnd++) {
                            const logger = new TestClientLogger(
                                clients,
                                // eslint-disable-next-line max-len
                                `InitialOps: ${initialOps} RevertOps: ${revertOps} AckBeforeRevert: ${ackBeforeRevert} Round ${rnd}`,
                            );
                            {
                                // init with random values
                                const initialMsgs = generateOperationMessagesForClients(
                                    mt,
                                    seq,
                                    clients,
                                    logger,
                                    initialOps,
                                    minLen,
                                    defaultOptions.operations);

                                seq = applyMessages(seq, initialMsgs, clients, logger);
                            }
                            const baseText = logger.validate({ clear: true, errorPrefix: "After Initial Ops" });

                            const client1Revertibles: MergeTreeDeltaRevertible[] = [];
                            // the test logger uses these callbacks, so preserve it
                            const old = clients[1].mergeTreeDeltaCallback;
                            clients[1].mergeTreeDeltaCallback = (op, delta) => {
                                old?.(op, delta);
                                appendToRevertibles(client1Revertibles, clients[1], delta);
                            };
                            const msgs: [ISequencedDocumentMessage, SegmentGroup | SegmentGroup[]][] = [];
                            {
                                msgs.push(...generateOperationMessagesForClients(
                                    mt,
                                    seq,
                                    [clients[0], clients[1]],
                                    logger,
                                    revertOps,
                                    minLen,
                                    defaultOptions.operations));

                                if (ackBeforeRevert) {
                                    seq = applyMessages(seq, msgs.splice(0, msgs.length), clients, logger);
                                    logger.validate({ errorPrefix: "Before Revert Ack" });
                                }
                            }

                            clients[1].mergeTreeDeltaCallback = old;
                            {
                                const revertOp = revert(clients[1], ... client1Revertibles);
                                msgs.push(
                                    [
                                        clients[1].makeOpMessage(revertOp, undefined, undefined, undefined, seq),
                                        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                                        clients[1].peekPendingSegmentGroups(revertOp.ops.length)!,
                                    ]);

                                seq = applyMessages(seq, msgs, clients, logger);
                                logger.validate({ clear: true, baseText, errorPrefix: "After Revert and Ack" });
                            }

                            for (let i = clients[0].getCollabWindow().minSeq; i <= seq; i++) {
                                clients.forEach((c) => c.updateMinSeq(i));
                            }
                            logger.validate({ clear: true, errorPrefix: "After Zamboni" });
                        }
                    });
                });
            }
        });
    });
});
