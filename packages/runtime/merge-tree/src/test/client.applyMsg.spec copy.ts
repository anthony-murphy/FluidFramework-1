/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */


import { TestClient } from "./testClient";
import { TestClientLogger } from "./testClientLogger";

describe("client.applyMsg", () => {

    it("conflicting insert after shared delete", () => {
        const clientA = new TestClient();
        clientA.insertTextLocal(0, "a");
        clientA.startCollaboration("A");
        const clientB = new TestClient();
        clientB.insertTextLocal(0, clientA.getText());
        clientB.startCollaboration("B");
        const clientC = new TestClient();
        clientC.insertTextLocal(0, clientA.getText());
        clientC.startCollaboration("C");

        const clients = [clientA, clientB, clientC];
        let seq = 0;

        const messages = [
            clientB.makeOpMessage(clientB.insertTextLocal(0, "b"), ++seq),
            clientC.makeOpMessage(clientC.removeRangeLocal(0, clientC.getLength()), ++seq),
            clientC.makeOpMessage(clientC.insertTextLocal(0, "c"), ++seq),
        ];

        const logger = new TestClientLogger(clients);
        logger.log();
        while (messages.length > 0) {
            const msg = messages.shift();
            clients.forEach((c) => c.applyMsg(msg));
            logger.log();
        }

        logger.validate();
    });

    it("local remove followed by conflicting insert", () => {
        const clientA = new TestClient();
        clientA.startCollaboration("A");
        const clientB = new TestClient();
        clientB.startCollaboration("B");
        const clientC = new TestClient();
        clientC.startCollaboration("C");

        const clients = [clientA, clientB, clientC];
        let seq = 0;

        const messages = [
            clientC.makeOpMessage(clientC.insertTextLocal(0, "c"), ++seq),
            clientB.makeOpMessage(clientB.insertTextLocal(0, "b"), ++seq),
            clientC.makeOpMessage(clientC.removeRangeLocal(0, 1), ++seq),
            clientC.makeOpMessage(clientC.insertTextLocal(0, "c"), ++seq),
        ];
        const logger = new TestClientLogger(clients);
        logger.log();
        while (messages.length > 0) {
            const msg = messages.shift();
            clients.forEach((c) => c.applyMsg(msg));
            logger.log();
        }

        logger.validate();
    });
});
