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
    doOverRange,
    generateOperationMessagesForClients,
    applyMessages,
} from "./mergeTreeOperationRunner";
import { createClientsAtInitialState, TestClientLogger } from "./testClientLogger";

 const defaultOptions = {
    minLength: { min: 1, max: 64 },
    initialOps: { min: 1, max: 64 },
    revertOps: { min: 1, max: 64 },
    ackBeforeRevert: [true, false],
    rounds: 10,
    operations: [removeRange],
    growthFunc: (input: number) => input * 2,
};

describe.only("MergeTree.Client", () => {
    doOverRange(defaultOptions.minLength, defaultOptions.growthFunc, (minLen) => {
        for (const ackBeforeRevert of defaultOptions.ackBeforeRevert) {
            doOverRange(defaultOptions.initialOps, defaultOptions.growthFunc, (initialOps) => {
                doOverRange(defaultOptions.revertOps, defaultOptions.growthFunc, (revertOps) => {
                    // eslint-disable-next-line max-len
                    it(`MinLen: ${minLen} InitialOps: ${initialOps} RevertOps: ${revertOps} AckBeforeRevert: ${ackBeforeRevert}`, async () => {
                        const mt = random.engines.mt19937();
                        mt.seedWithArray([0xDEADBEEF, 0xFEEDBED, minLen, initialOps, revertOps]);

                        const clients = createClientsAtInitialState(
                            {
                                initialState: "",
                                options: { mergeTreeUseNewLengthCalculations: true },
                            },
                            "A", "B", "C");
                        let seq = 0;
                        for (let rnd = 0; rnd < defaultOptions.rounds; rnd++) {
                            const logger = new TestClientLogger(clients.all, `Round ${rnd}`);
                            {
                                // init with random values
                                const initialMsgs = generateOperationMessagesForClients(
                                    mt,
                                    seq,
                                    clients.all,
                                    logger,
                                    initialOps,
                                    minLen,
                                    defaultOptions.operations);

                                seq = applyMessages(seq, initialMsgs, clients.all, logger);
                            }

                            // cache the base text to ensure we get back to it after revert
                            const baseText = logger.validate({ clear: true, errorPrefix: "After Initial Ops" });

                            const clientB_Revertibles: MergeTreeDeltaRevertible[] = [];
                            // the test logger uses these callbacks, so preserve it
                            const old = clients.B.mergeTreeDeltaCallback;
                            clients.B.mergeTreeDeltaCallback = (op, delta) => {
                                old?.(op, delta);
                                appendToRevertibles(clientB_Revertibles, clients.B, delta);
                            };
                            const msgs: [ISequencedDocumentMessage, SegmentGroup | SegmentGroup[]][] = [];
                            {
                                msgs.push(...generateOperationMessagesForClients(
                                    mt,
                                    seq,
                                    [clients.A, clients.B],
                                    logger,
                                    revertOps,
                                    minLen,
                                    defaultOptions.operations));

                                if (ackBeforeRevert) {
                                    seq = applyMessages(seq, msgs.splice(0, msgs.length), clients.all, logger);
                                    logger.validate({ errorPrefix: "Before Revert Ack" });
                                }
                            }

                            clients.B.mergeTreeDeltaCallback = old;
                            {
                                const revertOp = revert(clients.B, ... clientB_Revertibles);
                                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                                const segmentGroups = clients.B.peekPendingSegmentGroups(revertOp.ops.length)!;
                                // spread the ops and apply one by one for better logging, as groups op
                                // don't log well in the test client logger. grouped or not doesn't really
                                // matter at this layer, as internally they get spread just the same
                                revertOp.ops.forEach((op, i) => {
                                    msgs.push(
                                        [
                                            clients.B.makeOpMessage(op, undefined, undefined, undefined, seq),
                                            segmentGroups[i],
                                        ]);
                                    });

                                seq = applyMessages(seq, msgs, clients.all, logger);
                                logger.validate({ clear: true, baseText, errorPrefix: "After Revert" });
                            }

                            for (let i = clients.A.getCollabWindow().minSeq; i <= seq; i++) {
                                clients.all.forEach((c) => c.updateMinSeq(i));
                            }
                            logger.validate({ clear: true, errorPrefix: "After Zamboni" });
                        }
                    });
                });
            });
        }
    });
});
