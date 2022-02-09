/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */
import { strict as assert } from "assert";
import * as fs from "fs";
import { ISequencedDocumentMessage } from "@fluidframework/protocol-definitions";
import random from "random-js";
import { LocalReference } from "../localReference";
import { IMergeTreeOp } from "../ops";
import { TextSegment } from "../textSegment";
import { ISegment } from "../mergeTree";
import { TestClient } from "./testClient";
import { TestClientLogger } from "./testClientLogger";

export type TestOperation =
    (client: TestClient, opStart: number, opEnd: number, mt: random.Engine) => (IMergeTreeOp | undefined);

export const removeRange: TestOperation =
    (client: TestClient, opStart: number, opEnd: number) => client.removeRangeLocal(opStart, opEnd);

export const annotateRange: TestOperation =
    (client: TestClient, opStart: number, opEnd: number) =>
        client.annotateRangeLocal(opStart, opEnd, { client: client.longClientId }, undefined);

export const insertAtRefPos: TestOperation =
    (client: TestClient, opStart: number, opEnd: number, mt: random.Engine) => {
        const segs: ISegment[] = [];
        // gather all the segments at the pos, including removed segments
        client.mergeTree.walkAllSegments(client.mergeTree.root,(seg)=>{
            const pos = client.getPosition(seg);
            if(pos >= opStart) {
                if(pos <= opStart) {
                    segs.push(seg);
                    return true;
                }
                return false;
            }
            return true;
        });
        if(segs.length > 0) {
            const text = client.longClientId.repeat(random.integer(1, 3)(mt));
            const seg = random.pick(mt,segs);
            return client.insertAtReferencePositionLocal(
                new LocalReference(client, seg, random.integer(0, seg.cachedLength - 1)(mt)),
                TextSegment.make(text));
        }
    };

export interface IConfigRange {
    min: number;
    max: number;
}

export function doOverRange(
    range: IConfigRange,
    growthFunc: (input: number) => number,
    doAction: (current: number) => void) {
    for (let current = range.min; current <= range.max; current = growthFunc(current)) {
        doAction(current);
    }
}

export interface IMergeTreeOperationRunnerConfig {
    readonly rounds: number;
    readonly opsPerRoundRange: IConfigRange;
    readonly incrementalLog?: boolean;
    readonly operations: readonly TestOperation[];
    growthFunc(input: number): number;
    resultsFilePostfix?: string;
}

export interface ReplayGroup{
    msgs: ISequencedDocumentMessage[];
    initialText: string;
    resultText: string;
    seq: number;
}

export const replayResultsPath = `${__dirname}/../../src/test/results`;

export function runMergeTreeOperationRunner(
    mt: random.Engine,
    startingSeq: number,
    clients: readonly TestClient[],
    minLength: number,
    config: IMergeTreeOperationRunnerConfig,
    apply = applyMessages) {
    let seq = startingSeq;
    const results: ReplayGroup[] = [];
    // eslint-disable-next-line @typescript-eslint/unbound-method
    doOverRange(config.opsPerRoundRange, config.growthFunc, (opsPerRound) => {
        if (config.incrementalLog) {
            console.log(`MinLength: ${minLength} Clients: ${clients.length} Ops: ${opsPerRound} Seq: ${seq}`);
        }
        for (let round = 0; round < config.rounds; round++) {
            const logger = new TestClientLogger(
                clients,
                `Clients: ${clients.length} Ops: ${opsPerRound} Round: ${round}`);
            logger.log();
            const initialText = logger.validate();

            const messageData = generateOperationMessagesForClients(
                mt,
                seq,
                clients,
                logger,
                opsPerRound,
                minLength,
                config.operations,
            );
            const msgs = messageData.map((md)=>md[0]);
            seq = apply(seq, messageData, clients, logger);
            const resultText = logger.validate();
            results.push({
                initialText,
                resultText,
                msgs,
                seq,
            });
        }
    });
    if(config.resultsFilePostfix !== undefined) {
        const resultsFilePath =
            `${replayResultsPath}/len_${minLength}-clients_${clients.length}-${config.resultsFilePostfix}`;
        fs.writeFileSync(resultsFilePath, JSON.stringify(results, undefined, 4));
    }
    return seq;
}

export function generateOperationMessagesForClients(
    mt: random.Engine,
    startingSeq: number,
    clients: readonly TestClient[],
    logger: TestClientLogger,
    opsPerRound: number,
    minLength: number,
    operations: readonly TestOperation[]) {
    const minimumSequenceNumber = startingSeq;

    let seq = startingSeq;
    const messagesPerClient: ISequencedDocumentMessage[][] = [];
    clients.forEach((c) => messagesPerClient.push([]));
    for (let i = 0; i < opsPerRound; i++) {
        // pick a client greater than 0, client 0 only applies remote ops
        // and is our baseline
        const client = clients[random.integer(1, clients.length - 1)(mt)];
        const len = client.getLength();
        const sg = client.mergeTree.pendingSegments.last();
        let op: IMergeTreeOp | undefined;
        if (len === 0 || len < minLength) {
            const text = client.longClientId.repeat(random.integer(1, 3)(mt));
            op = client.insertTextLocal(
                random.integer(0, len)(mt),
                text);
        } else {
            let opIndex = random.integer(0, operations.length - 1)(mt);
            const start = random.integer(0, len - 1)(mt);
            const end = random.integer(start + 1, len)(mt);

            for (let y = 0; y < operations.length && op === undefined; y++) {
                op = operations[opIndex](client, start, end, mt);
                opIndex++;
                opIndex %= operations.length;
            }
        }
        if (op !== undefined) {
            // Precheck to avoid logger.toString() in the string template
            if (sg === client.mergeTree.pendingSegments.last()) {
                assert.notEqual(
                    sg,
                    client.mergeTree.pendingSegments.last(),
                    `op created but segment group not enqueued.${logger}`);
            }
            const message = client.makeOpMessage(op, ++seq);
            message.minimumSequenceNumber = minimumSequenceNumber;
            logger.log();
            messagesPerClient.forEach((ca) => ca.push(message));

            // apply some random ops, so clients are in different states
            let opToRun = random.integer(0, 5)(mt);
            while(--opToRun > 0) {
                const clientIndex = random.integer(1, clients.length - 1)(mt);
                if (messagesPerClient[clientIndex].length > 0) {
                    clients[clientIndex].applyMsg(messagesPerClient[clientIndex].shift());
                    logger.log();
                }
            }
        }
    }
    return messagesPerClient;
}

export function generateClientNames(): string[] {
    const clientNames = [];
    function addClientNames(startChar: string, count: number) {
        const startCode = startChar.charCodeAt(0);
        for (let i = 0; i < count; i++) {
            clientNames.push(String.fromCharCode(startCode + i));
        }
    }

    addClientNames("A", 26);
    addClientNames("a", 26);
    addClientNames("0", 17);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return clientNames;
}

export function applyMessages(
    startingSeq: number,
    messagesPerClient: ISequencedDocumentMessage[][],
    clients: readonly TestClient[],
    logger: TestClientLogger,
) {
    const endingSeq = messagesPerClient[0][messagesPerClient[0].length - 1 ].sequenceNumber;
    // finish applying all the ops
    while (messagesPerClient.some((ops) => ops.length > 0)) {
        for (let clientIndex = 0; clientIndex < clients.length; clientIndex++) {
            if (messagesPerClient[clientIndex].length > 0) {
                const message = messagesPerClient[clientIndex].shift();
                const client = clients[clientIndex];
                try {
                    client.applyMsg(message);
                    if(clientIndex === 0) {
                        logger.log(message);
                    }
                } catch (error) {
                    const msgStr = JSON.stringify(message, undefined, 1);
                    throw new Error(
                        `${logger.toString()}\nClient ${client.longClientId}: ${error}\n${msgStr}\n`);
                }
            }
        }
        logger.log();
    }
    return  endingSeq;
}
