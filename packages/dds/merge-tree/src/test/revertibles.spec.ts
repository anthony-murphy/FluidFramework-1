/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { ISequencedDocumentMessage } from "@fluidframework/protocol-definitions";
import { appendToRevertibles, MergeTreeDeltaRevertible, revert } from "../revertibles";
import { createClientsAtInitialState, TestClientLogger } from "./testClientLogger";

describe("MergeTree.Revertibles", () => {
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
});
