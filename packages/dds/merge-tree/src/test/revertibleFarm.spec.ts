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
    annotateRange,
} from "./mergeTreeOperationRunner";
import { createRevertDriver } from "./revertibles.spec";
import { createClientsAtInitialState, TestClientLogger } from "./testClientLogger";

 const defaultOptions = {
    initialOps: 5,
    minLength: { min: 1, max: 16 },
    concurrentOpsWithRevert: { min: 0, max: 8 },
    revertOps: { min: 1, max: 32 },
    ackBeforeRevert: [
        "None",
        "Some",
        "All",
    ] as ("None" | "Some" | "All")[],
    rounds: 10,
    operations: [removeRange, annotateRange],
    growthFunc: (input: number) => input * 2,
};

describe("MergeTree.Client", () => {
    doOverRange(defaultOptions.minLength, defaultOptions.growthFunc, (minLen) => {
        doOverRange(defaultOptions.concurrentOpsWithRevert, defaultOptions.growthFunc, (opsWithRevert) => {
            doOverRange(defaultOptions.revertOps, defaultOptions.growthFunc, (revertOps) => {
                for (const ackBeforeRevert of defaultOptions.ackBeforeRevert) {
                    // eslint-disable-next-line max-len
                    it(`InitialOps: ${defaultOptions.initialOps} MinLen: ${minLen}  ConcurrentOpsWithRevert: ${opsWithRevert} RevertOps: ${revertOps} AckBeforeRevert: ${ackBeforeRevert}`, async () => {
                        const mt = random.engines.mt19937();
                        mt.seedWithArray([
                            0xDEADBEEF,
                            0xFEEDBED,
                            minLen,
                            revertOps,
                            [...ackBeforeRevert].reduce<number>((pv, cv) => pv + cv.charCodeAt(0), 0),
                            opsWithRevert,
                        ]);

                        const clients = createClientsAtInitialState(
                            {
                                initialState: "",
                                options: { mergeTreeUseNewLengthCalculations: true },
                            },
                            "A", "B", "C");
                        let seq = 0;
                        for (let rnd = 0; rnd < defaultOptions.rounds; rnd++) {
                            clients.all.forEach((c) => c.updateMinSeq(seq));

                            const logger = new TestClientLogger(clients.all, `Round ${rnd}`);
                            {
                                // init with random values
                                const initialMsgs = generateOperationMessagesForClients(
                                    mt,
                                    seq,
                                    clients.all,
                                    logger,
                                    defaultOptions.initialOps,
                                    minLen,
                                    defaultOptions.operations);

                                seq = applyMessages(seq, initialMsgs, clients.all, logger);
                            }

                            // cache the base text to ensure we get back to it after revert
                            const baseText = logger.validate({ clear: true, errorPrefix: "After Initial Ops" });

                            const clientB_Revertibles: MergeTreeDeltaRevertible[] = [];
                            const clientBDriver = createRevertDriver(clients.B);

                            const msgs: [ISequencedDocumentMessage, SegmentGroup | SegmentGroup[]][] = [];
                            {
                                const old = clients.B.mergeTreeDeltaCallback;
                                clientBDriver.opCreated = (op) => msgs.push(
                                    [
                                        clients.B.makeOpMessage(op, undefined, undefined, undefined, seq),
                                        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                                        clients.B.peekPendingSegmentGroups()!,
                                    ]);
                                clients.B.mergeTreeDeltaCallback = (op, delta) => {
                                    old?.(op, delta);
                                    appendToRevertibles(clientB_Revertibles, clientBDriver, delta);
                                };
                                msgs.push(...generateOperationMessagesForClients(
                                    mt,
                                    seq,
                                    [clients.A, clients.B],
                                    logger,
                                    revertOps,
                                    minLen,
                                    defaultOptions.operations));

                                clients.B.mergeTreeDeltaCallback = old;
                            }

                            if (opsWithRevert > 0) {
                                // add modifications from another client
                                msgs.push(...generateOperationMessagesForClients(
                                    mt,
                                    seq,
                                    [clients.A, clients.C],
                                    logger,
                                    opsWithRevert,
                                    minLen,
                                    defaultOptions.operations));
                            }

                            if (ackBeforeRevert !== "None") {
                                const ackAll = ackBeforeRevert === "All";
                                seq = applyMessages(
                                    seq,
                                    msgs.splice(
                                        0,
                                        ackAll
                                            ? msgs.length
                                            : random.integer(0, Math.floor(msgs.length / 2))(mt)),
                                    clients.all,
                                    logger);
                                if (ackAll) {
                                    logger.validate({ errorPrefix: "Before Revert Ack" });
                                }
                            }

                            try {
                                revert(clientBDriver, ... clientB_Revertibles);
                                seq = applyMessages(seq, msgs.splice(0), clients.all, logger);
                            } catch (e) {
                                throw logger.addLogsToError(e);
                            }
                            logger.validate({
                                clear: true,
                                baseText: opsWithRevert === 0 ? baseText : undefined,
                                errorPrefix: "After Revert",
                            });
                        }
                    });
                }
            });
        });
    });
});
