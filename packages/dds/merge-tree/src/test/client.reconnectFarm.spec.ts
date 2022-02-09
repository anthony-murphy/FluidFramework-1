/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import random from "random-js";
import { ISequencedDocumentMessage } from "@fluidframework/protocol-definitions";
import { IMergeTreeOp, MergeTreeDeltaType } from "../ops";
import {
    generateClientNames,
    doOverRange,
    runMergeTreeOperationRunner,
    annotateRange,
    removeRange,
    applyMessages,
    IMergeTreeOperationRunnerConfig,
    IConfigRange,
} from "./mergeTreeOperationRunner";
import { TestClient } from "./testClient";
import { TestClientLogger } from "./testClientLogger";

function applyMessagesWithReconnect(
    messagesPerClient: ISequencedDocumentMessage[][],
    clients: readonly TestClient[],
    logger: TestClientLogger,
) {
    const replayWaterline = clients.reduce<number>((pv,cv)=>Math.max(pv, cv.getCurrentSeq()), 0);

    // catch up all clients to the waterline
    while(messagesPerClient.some((msgs) =>msgs[0].sequenceNumber <= replayWaterline)) {
        for (let clientIndex = 0; clientIndex < clients.length; clientIndex++) {
            if (messagesPerClient[clientIndex][0].sequenceNumber <= replayWaterline) {
                const message = messagesPerClient[clientIndex].shift();
                const client = clients[clientIndex];
                try {
                    client.applyMsg(message);
                } catch (error) {
                    const msgStr = JSON.stringify(message, undefined, 1);
                    throw new Error(
                        `${logger.toString()}\nClient ${client.longClientId}: ${error}\n${msgStr}\n`);
                }
            }
        }
        logger.log();
    }

    // replay all ops above water line from all clients expect 1
    // store the ops for client 1, to replay via reconnect
    let seq = replayWaterline;
    const reconnectClientMsgs: IMergeTreeOp[] = [];
    const messages = messagesPerClient[0];
    let minSeq = 0;
    // log and apply all the ops created in the round
    while (messages.length > 0) {
        const message = messages.shift();
        if (message.clientId === clients[1].longClientId) {
            reconnectClientMsgs.push(message.contents as IMergeTreeOp);
        } else {
            message.sequenceNumber = ++seq;
            logger.log();
            clients.forEach((c) => c.applyMsg(message));
            minSeq = message.minimumSequenceNumber;
        }
    }

    // rebuild ops for client 1 to simulate reconnect
    const reconnectMsgs: ISequencedDocumentMessage[][] = [];
    clients.forEach(() => reconnectMsgs.push([]));
    reconnectClientMsgs.forEach((op) => {
        let count = op.type === MergeTreeDeltaType.GROUP ? op.ops.length : 1;
        const sg = clients[1].mergeTree.pendingSegments.some(()=>{
            return count-- > 0;
        });
        const newOp = clients[1].regeneratePendingOp(
            op,
            sg.length === 1 ? sg[0] : sg,
        );
        const newMsg = clients[1].makeOpMessage(newOp);
        newMsg.sequenceNumber = ++seq;
        newMsg.minimumSequenceNumber = minSeq;
        reconnectMsgs.forEach((m)=>m.push(newMsg));
    });

    // apply the reconnect ops to all clients
    return applyMessages(reconnectMsgs, clients, logger);
}

export const defaultOptions: IMergeTreeOperationRunnerConfig & { minLength: number, clients: IConfigRange } = {
    minLength: 16,
    clients: { min: 2, max: 8 },
    opsPerRoundRange: { min: 40, max: 320 },
    rounds: 3,
    operations: [annotateRange, removeRange],
    growthFunc: (input: number) => input * 2,
};

describe("MergeTree.Client", () => {
    const opts = defaultOptions;

    // Generate a list of single character client names, support up to 69 clients
    const clientNames = generateClientNames();

    doOverRange(opts.clients, opts.growthFunc.bind(opts), (clientCount) => {
        it(`ReconnectFarm_${clientCount}`, async () => {
            const mt = random.engines.mt19937();
            mt.seedWithArray([0xDEADBEEF, 0xFEEDBED, clientCount]);

            const clients: TestClient[] = [new TestClient({ blockUpdateMarkers: true })];
            clients.forEach(
                (c, i) => c.startOrUpdateCollaboration(clientNames[i]));

            let seq = 0;
            clients.forEach((c) => c.updateMinSeq(seq));

            // Add double the number of clients each iteration
            const targetClients = Math.max(opts.clients.min, clientCount);
            for (let cc = clients.length; cc < targetClients; cc++) {
                const newClient = await TestClient.createFromClientSnapshot(clients[0], clientNames[cc]);
                clients.push(newClient);
            }

            seq = runMergeTreeOperationRunner(
                mt,
                seq,
                clients,
                opts.minLength,
                opts,
                applyMessagesWithReconnect);
        })
            .timeout(30 * 1000);
    });
});
