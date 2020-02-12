/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import * as assert from "assert";
import { ISequencedDocumentMessage } from "@microsoft/fluid-protocol-definitions";
// eslint-disable-next-line import/no-extraneous-dependencies
import * as random from "random-js";
import { LocalReference } from "../localReference";
import { IMergeTreeOp } from "../ops";
import { TextSegment } from "../textSegment";
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
        const segOff = client.getContainingSegment(opStart);
        if (segOff.segment) {
            return client.insertAtReferencePositionLocal(
                new LocalReference(client, segOff.segment, segOff.offset),
                TextSegment.make(client.longClientId.repeat(random.integer(1, 3)(mt))));
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
}

export function runMergeTreeOperationRunner(
    mt: random.Engine,
    startingSeq: number,
    clients: readonly TestClient[],
    minLength: number,
    config: IMergeTreeOperationRunnerConfig) {

    let seq = startingSeq;


    // eslint-disable-next-line @typescript-eslint/unbound-method
    doOverRange(config.opsPerRoundRange, config.growthFunc, (opsPerRound) => {
        if (config.incrementalLog) {
            // tslint:disable-next-line: max-line-length
            console.log(`MinLength: ${minLength} Clients: ${clients.length} Ops: ${opsPerRound} Seq: ${seq}`);
        }
        for (let round = 0; round < config.rounds; round++) {
            const minimumSequenceNumber = seq;
            const logger = new TestClientLogger(
                clients,
                `Clients: ${clients.length} Ops: ${opsPerRound} Round: ${round}`);
            logger.log();
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
                    let opIndex = random.integer(0, config.operations.length - 1)(mt);
                    const start = random.integer(0, len - 1)(mt);
                    const end = random.integer(start + 1, len)(mt);
                    // tslint:disable-next-line: prefer-for-of
                    for (let y = 0; y < config.operations.length && op === undefined; y++) {
                        op = config.operations[opIndex](client, start, end, mt);
                        opIndex++;
                        opIndex %= config.operations.length;
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
                    messagesPerClient.forEach((ca) => ca.push(message));
                    while (messagesPerClient[0].length > 0) {
                        clients[0].applyMsg(messagesPerClient[0].shift());
                    }
                    // apply some random ops, so clients are in different states
                    let opToRun = random.integer(0, 5)(mt);
                    let logged = false;
                    while(--opToRun > 0){
                        const clientIndex = random.integer(1, clients.length - 1)(mt);
                        if (messagesPerClient[clientIndex].length > 0) {
                            clients[clientIndex].applyMsg(messagesPerClient[clientIndex].shift());
                            logger.log();
                            logged = true;
                        }
                    }
                    if (!logged) {
                        logger.log();
                    }
                }
            }
            // finish applying all the ops
            while (messagesPerClient.some((ops) => ops.length > 0)) {
                for (let clientIndex = 0; clientIndex < clients.length; clientIndex++) {
                    if (messagesPerClient[clientIndex].length > 0) {
                        clients[clientIndex].applyMsg(messagesPerClient[clientIndex].shift());
                    }
                }
                logger.log();
            }


            // validate that all the clients match at the end of the round
            logger.validate();
        }
    });

    return seq;
}
