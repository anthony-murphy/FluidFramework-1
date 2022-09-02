/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { ISequencedDocumentMessage } from "@fluidframework/protocol-definitions";
import { appendToRevertibles, MergeTreeDeltaRevertible, revert } from "../revertibles";
import { createClientsAtInitialState, TestClientLogger } from "./testClientLogger";

describe("MergeTree.Revertibles", () => {
    it("revert insert", () => {
        const clients = createClientsAtInitialState(
            { initialState: "123", options: { mergeTreeUseNewLengthCalculations: true } },
            "A", "B");
        const logger = new TestClientLogger(clients.all);
        let seq = 0;
        const ops: ISequencedDocumentMessage[] = [];

        const clientB_Revertibles: MergeTreeDeltaRevertible[] = [];
        // the test logger uses these callbacks, so preserve it
        const old = clients.B.mergeTreeDeltaCallback;
        clients.B.mergeTreeDeltaCallback = (op, delta) => {
            old?.(op, delta);
            appendToRevertibles(clientB_Revertibles, clients.B, delta);
        };
        ops.push(clients.B.makeOpMessage(clients.B.insertTextLocal(0, "BB"), ++seq));

        ops.splice(0).forEach((op) => clients.all.forEach((c) => c.applyMsg(op)));
        logger.validate({ baseText: "BB123" });

        const revertOp = revert(clients.B, ... clientB_Revertibles);
        revertOp.ops.forEach((op) => ops.push(clients.B.makeOpMessage(op, ++seq)));

        ops.splice(0).forEach((op) => clients.all.forEach((c) => c.applyMsg(op)));
        logger.validate({ baseText: "123" });
    });

    it("revert remove", () => {
        const clients = createClientsAtInitialState(
            { initialState: "123", options: { mergeTreeUseNewLengthCalculations: true } },
            "A", "B");
        const logger = new TestClientLogger(clients.all);
        let seq = 0;
        const ops: ISequencedDocumentMessage[] = [];

        const clientB_Revertibles: MergeTreeDeltaRevertible[] = [];
        // the test logger uses these callbacks, so preserve it
        const old = clients.B.mergeTreeDeltaCallback;
        clients.B.mergeTreeDeltaCallback = (op, delta) => {
            old?.(op, delta);
            appendToRevertibles(clientB_Revertibles, clients.B, delta);
        };
        ops.push(clients.B.makeOpMessage(clients.B.removeRangeLocal(0, 1), ++seq));

        ops.splice(0).forEach((op) => clients.all.forEach((c) => c.applyMsg(op)));
        logger.validate({ baseText: "23" });

        const revertOp = revert(clients.B, ... clientB_Revertibles);
        revertOp.ops.forEach((op) => ops.push(clients.B.makeOpMessage(op, ++seq)));

        ops.splice(0).forEach((op) => clients.all.forEach((c) => c.applyMsg(op)));
        logger.validate({ baseText: "123" });
    });

    it("revert annotate", () => {
        const clients = createClientsAtInitialState(
            { initialState: "123", options: { mergeTreeUseNewLengthCalculations: true } },
            "A", "B");
        const logger = new TestClientLogger(clients.all);
        let seq = 0;
        const ops: ISequencedDocumentMessage[] = [];

        const clientB_Revertibles: MergeTreeDeltaRevertible[] = [];
        // the test logger uses these callbacks, so preserve it
        const old = clients.B.mergeTreeDeltaCallback;
        clients.B.mergeTreeDeltaCallback = (op, delta) => {
            old?.(op, delta);
            appendToRevertibles(clientB_Revertibles, clients.B, delta);
        };
        ops.push(clients.B.makeOpMessage(clients.B.annotateRangeLocal(0, 1, { test: 1 }, undefined), ++seq));

        ops.splice(0).forEach((op) => clients.all.forEach((c) => c.applyMsg(op)));
        logger.validate({ baseText: "123" });

        const revertOp = revert(clients.B, ... clientB_Revertibles);
        revertOp.ops.forEach((op) => ops.push(clients.B.makeOpMessage(op, ++seq)));

        ops.splice(0).forEach((op) => clients.all.forEach((c) => c.applyMsg(op)));
        logger.validate({ baseText: "123" });
    });

    it("Remove All Original Text and Insert then Revert", () => {
        const clients = createClientsAtInitialState(
            { initialState: "1-2--", options: { mergeTreeUseNewLengthCalculations: true } },
            "A", "B", "C");

        const logger = new TestClientLogger(clients.all);
        let seq = 0;
        const ops: ISequencedDocumentMessage[] = [];

        const clientB_Revertibles: MergeTreeDeltaRevertible[] = [];
        // the test logger uses these callbacks, so preserve it
        const old = clients.B.mergeTreeDeltaCallback;
        clients.B.mergeTreeDeltaCallback = (op, delta) => {
            old?.(op, delta);
            appendToRevertibles(clientB_Revertibles, clients.B, delta);
        };

        ops.push(clients.B.makeOpMessage(clients.B.removeRangeLocal(0, 1), ++seq));
        ops.push(clients.B.makeOpMessage(clients.B.insertTextLocal(0, "BB"), ++seq));
        ops.push(clients.B.makeOpMessage(clients.B.removeRangeLocal(2, 3), ++seq));

        clients.B.mergeTreeDeltaCallback = old;

        ops.splice(0).forEach((op) => clients.all.forEach((c) => c.applyMsg(op)));

        const revertOp = revert(clients.B, ... clientB_Revertibles);
        revertOp.ops.forEach((op) => ops.push(clients.B.makeOpMessage(op, ++seq)));

        ops.splice(0).forEach((op) => clients.all.forEach((c) => c.applyMsg(op)));

        logger.validate({ baseText: "12" });
    });

    it("Re-Insert at position 0 in empty string", () => {
        const clients = createClientsAtInitialState(
            { initialState: "BBC-", options: { mergeTreeUseNewLengthCalculations: true } },
            "A", "B", "C");

        const logger = new TestClientLogger(clients.all);
        let seq = 0;
        const ops: ISequencedDocumentMessage[] = [];

        const clientB_Revertibles: MergeTreeDeltaRevertible[] = [];
        // the test logger uses these callbacks, so preserve it
        const old = clients.B.mergeTreeDeltaCallback;
        clients.B.mergeTreeDeltaCallback = (op, delta) => {
            old?.(op, delta);
            appendToRevertibles(clientB_Revertibles, clients.B, delta);
        };

        ops.push(clients.B.makeOpMessage(clients.B.removeRangeLocal(2, 3), ++seq));
        ops.push(clients.B.makeOpMessage(clients.B.removeRangeLocal(0, 1), ++seq));
        ops.push(clients.B.makeOpMessage(clients.B.insertTextLocal(1, "BB"), ++seq));

        clients.B.mergeTreeDeltaCallback = old;

        ops.splice(0).forEach((op) => clients.all.forEach((c) => c.applyMsg(op)));

        const revertOp = revert(clients.B, ... clientB_Revertibles);
        revertOp.ops.forEach((op) => ops.push(clients.B.makeOpMessage(op, ++seq)));

        ops.splice(0).forEach((op) => clients.all.forEach((c) => c.applyMsg(op)));

        logger.validate({ baseText: "BBC" });
    });
});
