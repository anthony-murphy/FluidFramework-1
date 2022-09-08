/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { ISequencedDocumentMessage } from "@fluidframework/protocol-definitions";
import { appendToRevertibles, MergeTreeDeltaRevertible, revert } from "../revertibles";
import { createRevertDriver } from "./testClient";
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
        const clientBDriver = createRevertDriver(clients.B);
        clientBDriver.submitOpCallback = (op) => ops.push(clients.B.makeOpMessage(op, ++seq));
        clients.B.mergeTreeDeltaCallback = (op, delta) => {
            old?.(op, delta);
            appendToRevertibles(clientB_Revertibles, clientBDriver, delta);
        };
        ops.push(clients.B.makeOpMessage(clients.B.insertTextLocal(0, "BB"), ++seq));

        ops.splice(0).forEach((op) => clients.all.forEach((c) => c.applyMsg(op)));
        logger.validate({ baseText: "BB123" });

        revert(clientBDriver, ... clientB_Revertibles);

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
        const clientBDriver = createRevertDriver(clients.B);
        clientBDriver.submitOpCallback = (op) => ops.push(clients.B.makeOpMessage(op, ++seq));
        clients.B.mergeTreeDeltaCallback = (op, delta) => {
            old?.(op, delta);
            appendToRevertibles(clientB_Revertibles, clientBDriver, delta);
        };
        ops.push(clients.B.makeOpMessage(clients.B.removeRangeLocal(0, 1), ++seq));

        ops.splice(0).forEach((op) => clients.all.forEach((c) => c.applyMsg(op)));
        logger.validate({ baseText: "23" });

        revert(clientBDriver, ... clientB_Revertibles);

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
        // the test logger uses these callbacks, so preserve it
        const old = clients.B.mergeTreeDeltaCallback;
        const clientBDriver = createRevertDriver(clients.B);
        clientBDriver.submitOpCallback = (op) => ops.push(clients.B.makeOpMessage(op, ++seq));
        clients.B.mergeTreeDeltaCallback = (op, delta) => {
            old?.(op, delta);
            appendToRevertibles(clientB_Revertibles, clientBDriver, delta);
        };
        ops.push(clients.B.makeOpMessage(clients.B.annotateRangeLocal(0, 1, { test: 1 }, undefined), ++seq));

        ops.splice(0).forEach((op) => clients.all.forEach((c) => c.applyMsg(op)));
        logger.validate({ baseText: "123" });

        revert(clientBDriver, ... clientB_Revertibles);

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
        // the test logger uses these callbacks, so preserve it
        const old = clients.B.mergeTreeDeltaCallback;
        const clientBDriver = createRevertDriver(clients.B);
        clientBDriver.submitOpCallback = (op) => ops.push(clients.B.makeOpMessage(op, ++seq));
        clients.B.mergeTreeDeltaCallback = (op, delta) => {
            old?.(op, delta);
            appendToRevertibles(clientB_Revertibles, clientBDriver, delta);
        };
        ops.push(clients.B.makeOpMessage(clients.B.removeRangeLocal(0, 1), ++seq));
        ops.push(clients.B.makeOpMessage(clients.B.insertTextLocal(0, "BB"), ++seq));
        ops.push(clients.B.makeOpMessage(clients.B.removeRangeLocal(2, 3), ++seq));

        clients.B.mergeTreeDeltaCallback = old;

        ops.splice(0).forEach((op) => clients.all.forEach((c) => c.applyMsg(op)));

        revert(clientBDriver, ... clientB_Revertibles);

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
        const clientBDriver = createRevertDriver(clients.B);
        clientBDriver.submitOpCallback = (op) => ops.push(clients.B.makeOpMessage(op, ++seq));
        clients.B.mergeTreeDeltaCallback = (op, delta) => {
            old?.(op, delta);
            appendToRevertibles(clientB_Revertibles, clientBDriver, delta);
        };

        ops.push(clients.B.makeOpMessage(clients.B.removeRangeLocal(2, 3), ++seq));
        ops.push(clients.B.makeOpMessage(clients.B.removeRangeLocal(0, 1), ++seq));
        ops.push(clients.B.makeOpMessage(clients.B.insertTextLocal(1, "BB"), ++seq));

        clients.B.mergeTreeDeltaCallback = old;

        ops.splice(0).forEach((op) => clients.all.forEach((c) => c.applyMsg(op)));

        revert(clientBDriver, ... clientB_Revertibles);

        ops.splice(0).forEach((op) => clients.all.forEach((c) => c.applyMsg(op)));

        logger.validate({ baseText: "BBC" });
    });
    /**
```
1) MergeTree.Client
       MinLen: 1 InitialOps: 10 RevertOps: 3 AckBeforeRevert: true ModifyBeforeRevert: false:

      AssertionError [ERR_ASSERTION]: After Revert:
_: Local State
-: Deleted
*: Unacked Insert and Delete
194: msn/offset
Op format <seq>:<ref>:<client><type>@<pos1>,<pos2>
sequence number represented as offset from msn. L means local.
op types: 0) insert 1) remove 2) annotate
Round 11
op         | client A | op           | client B | op         | client C
           | B-CC--   |              | B-CC--   |            | B-CC--
           | B-CC--   | L:191:B1@0,2 | _-_C--   |            | B-CC--
           |          |              | - -      |            |
           | B-CC--   | L:191:B2@0,1 | _-_C--   |            | B-CC--
           |          |              | - -      |            |
           | B-CC--   | L:191:B1@0,1 | _-__--   |            | B-CC--
           |          |              | - --     |            |
1:0:B1@0,2 | ---C--   | 1:0:B1@0,2   | ---_--   | 1:0:B1@0,2 | ---C--
           |          |              |    -     |            |
2:0:B2@0,1 | --C      | 2:0:B2@0,1   | --_      | 2:0:B2@0,1 | --C
           |          |              |   -      |            |
3:0:B1@0,1 | ---      | 3:0:B1@0,1   | ---      | 3:0:B1@0,1 | ---
           | ---      | L:194:B0@0   | _---     |            | ---
           |          |              | C        |            |
           | ---      | L:194:B2@0,1 | _---     |            | ---
           |          |              | C        |            |
           | ---      | L:194:B0@1   | __---    |            | ---
           |          |              | CB       |            |
           | ---      | L:194:B0@2   | ___---   |            | ---
           |          |              | CBC      |            |
1:0:B0@0   | C---     | 1:0:B0@0     | C__---   | 1:0:B0@0   | C---
           |          |              |  BC      |            |
2:0:B2@0,1 | C        | 2:0:B2@0,1   | C__      | 2:0:B2@0,1 | C
           |          |              |  BC      |            |
3:0:B0@1   | CB       | 3:0:B0@1     | CB_      | 3:0:B0@1   | CB
           |          |              |   C      |            |
4:0:B0@2   | CBC      | 4:0:B0@2     | CBC      | 4:0:B0@2   | CBC
Client A does not match client baseText
      + expected - actual

      -CBC
      +BCC
```
     */
    it("Revert remove to empty with annotate", () => {
        const clients = createClientsAtInitialState(
            { initialState: "1-23--", options: { mergeTreeUseNewLengthCalculations: true } },
            "A", "B", "C");

        const logger = new TestClientLogger(clients.all);
        let seq = 0;
        const ops: ISequencedDocumentMessage[] = [];

        const clientB_Revertibles: MergeTreeDeltaRevertible[] = [];
        const old = clients.B.mergeTreeDeltaCallback;
        const clientBDriver = createRevertDriver(clients.B);
        clientBDriver.submitOpCallback = (op) => ops.push(clients.B.makeOpMessage(op, ++seq));
        clients.B.mergeTreeDeltaCallback = (op, delta) => {
            old?.(op, delta);
            appendToRevertibles(clientB_Revertibles, clientBDriver, delta);
        };

        ops.push(clients.B.makeOpMessage(clients.B.removeRangeLocal(0, 2), ++seq));
        ops.push(clients.B.makeOpMessage(clients.B.annotateRangeLocal(0, 1, { test: 1 }, undefined), ++seq));
        ops.push(clients.B.makeOpMessage(clients.B.removeRangeLocal(0, 1), ++seq));

        clients.B.mergeTreeDeltaCallback = old;

        ops.splice(0).forEach((op) => clients.all.forEach((c) => c.applyMsg(op)));

        revert(clientBDriver, ... clientB_Revertibles);

        ops.splice(0).forEach((op) => clients.all.forEach((c) => c.applyMsg(op)));

        logger.validate({ baseText: "123" });
    });
    it("Revert Local annotate and remove with intersecting remote annotate", () => {
        const clients = createClientsAtInitialState(
            { initialState: "1234-----", options: { mergeTreeUseNewLengthCalculations: true } },
            "A", "B", "C");

        const logger = new TestClientLogger(clients.all);
        let seq = 0;
        const ops: ISequencedDocumentMessage[] = [];

        const clientB_Revertibles: MergeTreeDeltaRevertible[] = [];
        // the test logger uses these callbacks, so preserve it
        const old = clients.B.mergeTreeDeltaCallback;
        const clientBDriver = createRevertDriver(clients.B);
        clientBDriver.submitOpCallback = (op) => ops.push(clients.B.makeOpMessage(op, ++seq));
        clients.B.mergeTreeDeltaCallback = (op, delta) => {
            old?.(op, delta);
            if (op.sequencedMessage === undefined) {
                appendToRevertibles(clientB_Revertibles, clientBDriver, delta);
            }
        };
        ops.push(clients.B.makeOpMessage(clients.B.annotateRangeLocal(0, 4, { test: "B" }, undefined), ++seq));
        ops.push(clients.B.makeOpMessage(clients.B.removeRangeLocal(1, 2), ++seq));
        clients.B.mergeTreeDeltaCallback = old;

        ops.push(clients.C.makeOpMessage(clients.C.annotateRangeLocal(3, 4, { test: "C" }, undefined), ++seq));

        ops.splice(0).forEach((op) => clients.all.forEach((c) => c.applyMsg(op)));
        logger.validate();

        try {
            revert(clientBDriver, ... clientB_Revertibles);
            ops.splice(0).forEach((op) => clients.all.forEach((c) => c.applyMsg(op)));
        } catch (e) {
            throw logger.addLogsToError(e);
        }

        logger.validate();
    });
});
