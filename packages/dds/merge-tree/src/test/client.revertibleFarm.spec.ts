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
    minLength: { min: 1, max: 64 },
    revertOps: { min: 1, max: 4 },
    ackBeforeRevert: [true, false],
    operations: [removeRange, annotateRange],
    growthFunc: (input: number) => input * 2,
};

describe("MergeTree.Client", () => {
    // Generate a list of single character client names, support up to 69 clients
    const clientNames = generateClientNames();

    doOverRange(defaultOptions.minLength, defaultOptions.growthFunc, (minLen) => {
        it(`RevertiblesFarm_${minLen}`, async () => {
            for (const ackBeforeRevert of defaultOptions.ackBeforeRevert) {
                doOverRange(defaultOptions.revertOps, defaultOptions.growthFunc, (revertOps) => {
                    const mt = random.engines.mt19937();
                    mt.seedWithArray([0xDEADBEEF, 0xFEEDBED, minLen, revertOps]);

                    const clients: TestClient[] = new Array(4).fill(0).map(() => new TestClient());
                    clients.forEach(
                        (c, i) => c.startOrUpdateCollaboration(clientNames[i]));

                    const logger = new TestClientLogger(
                        clients,
                        `RevertOps: ${revertOps} AckBeforeRevert: ${ackBeforeRevert}`,
                    );
                    let seq = 0;
                    {
                        // init with random values
                        const initialMsgs = generateOperationMessagesForClients(
                            mt,
                            seq,
                            clients,
                            logger,
                            100,
                            minLen,
                            defaultOptions.operations);

                        seq = applyMessages(seq, initialMsgs, clients, logger);
                    }
                    const baseText = logger.validate({ clear: true });

                    const client1Revertibles: MergeTreeDeltaRevertible[] = [];
                    const old = clients[1].mergeTreeDeltaCallback;
                    clients[1].mergeTreeDeltaCallback = (op, delta) => {
                        appendToRevertibles(client1Revertibles, clients[1], delta);
                        old?.(op, delta);
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
                            logger.validate({ clear: true });
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
                        logger.validate({ clear: true, baseText });
                    }

                    for (let i = clients[0].getCollabWindow().minSeq; i <= seq; i++) {
                        clients.forEach((c) => c.updateMinSeq(i));
                    }
                    logger.validate({ clear: true });
                });
            }
        });
    });
});
