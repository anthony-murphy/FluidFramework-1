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

    doOverRange(config.opsPerRoundRange, config.growthFunc, (opsPerRound) => {
        if (config.incrementalLog) {
            console.log(`MinLength: ${minLength} Clients: ${clients.length} Ops: ${opsPerRound} Seq: ${seq}`);
        }
        for (let round = 0; round < config.rounds; round++) {
            // for test only. directly modify the text of the segments
            // so all initial values are "Z". this makes modification easier to
            // follow
            clients.forEach((c)=>{
                for(let i=0;i<c.getLength();i++){
                    const segOff = c.getContainingSegment(i);
                    if(segOff.offset === 0 && TextSegment.is(segOff.segment)){
                        segOff.segment.text = "Z".repeat(segOff.segment.text.length);
                    }
                }
            });
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
            seq = apply(messageData, clients, logger);
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
    try{
        for (let i = 0; i < opsPerRound; i++) {
            // pick a client greater than 0, client 0 only applies remote ops
            // and is our baseline
            const clientIndex = random.integer(1, clients.length - 1)(mt);
            const client = clients[clientIndex];

            // apply some random ops, so clients are in different states
            for(let opi=0;opi<random.integer(0, messagesPerClient[clientIndex].length)(mt); opi++){
                const msg = messagesPerClient[clientIndex].shift()
                client.applyMsg(msg);
                logger.logPartial({[clientIndex]: msg});
            }

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
                // Pre-check to avoid logger.toString() in the string template
                if (sg === client.mergeTree.pendingSegments.last()) {
                    assert.notEqual(
                        sg,
                        client.mergeTree.pendingSegments.last(),
                        `op created but segment group not enqueued.${logger}`);
                }
                const message = client.makeOpMessage(op, ++seq);
                message.minimumSequenceNumber = minimumSequenceNumber;
                logger.logLocal({[clientIndex]: message});
                messagesPerClient.forEach((ca) => ca.push(message));
            }
        }
    }catch(error){
        throw new Error(
            `${logger.toString()}\n${error}`);
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

    return clientNames;
}

export function applyMessages(
    messagesPerClient: ISequencedDocumentMessage[][],
    clients: readonly TestClient[],
    logger: TestClientLogger,
) {
    const endingSeq = messagesPerClient[0][messagesPerClient[0].length - 1 ].sequenceNumber;
    // finish applying all the ops
    while (messagesPerClient.some((ops) => ops.length > 0)) {
        const lowest = Math.min(...messagesPerClient.map((m)=>m[0]?.sequenceNumber ?? endingSeq));
        const log: Record<number, ISequencedDocumentMessage> = [];
        try{
            clients.forEach((client, i)=>{
                if(messagesPerClient[i][0]?.sequenceNumber === lowest){
                    const message = messagesPerClient[i].shift();
                    log[i] = message;
                    try {
                        client.applyMsg(message);
                    } catch (error) {
                        const msgStr = JSON.stringify(message, undefined, 1);
                        throw new Error(
                            `${logger.toString()}\nClient ${client.longClientId}: ${error}\n${msgStr}\n`);
                    }
                }
            })
        }finally{
            logger.logPartial(log);
        }
    }
    return endingSeq;
}
