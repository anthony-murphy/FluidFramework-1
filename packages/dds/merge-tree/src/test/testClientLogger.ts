/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { strict as assert } from "assert";
import { UnassignedSequenceNumber } from "../constants";
import { TextSegment } from "../textSegment";
import { TestClient } from "./testClient";

export class TestClientLogger {
    private readonly incrementalLog = false;

    private readonly paddings: number[] = [];
    private readonly roundLogLines: string[][] = [];

    constructor(
        private readonly clients: readonly TestClient[],
        private readonly title?: string) {
        this.roundLogLines.push([]);
        for (const client of clients) {
            this.roundLogLines[0].push("refSeq", `client ${client.longClientId}`,"|");
        }
        this.roundLogLines[0].push("data");
        this.roundLogLines[0].forEach((v) => this.paddings.push(v.length));
    }

    public log(data?: any) {
        const ackedLine: string[] = [];
        this.roundLogLines.push(ackedLine);
        const localLine: string[] = [];
        let localChanges = false;
        this.clients.forEach((c, i) => {
            const refseq = c.getCurrentSeq().toString();
            const segStrings = this.getSegString(c);
            ackedLine.push(refseq, segStrings.acked, "|");
            localLine.push(" ", segStrings.local, "|");
            if (!localChanges && segStrings.local.trim().length > 0) {
                localChanges = true;
            }
        });
        ackedLine.push(data === undefined ? "" : JSON.stringify(data));
        localLine.push("");
        for (let i = 0; i < this.paddings.length; i++) {
            this.paddings[i] = Math.max(ackedLine[i].length, localLine[i].length, this.paddings[i]);
        }
        if (localChanges) {
            this.roundLogLines.push(localLine);
        }

        if (this.incrementalLog) {
            console.log(ackedLine.map((v, i) => v.padEnd(this.paddings[i])).join("  "));
        }
    }

    public validate(message?: string) {
        const baseText = this.clients[0].getText();
        this.clients.forEach(
            (c) => {
                if (c === this.clients[0]) { return; }
                // Precheck to avoid this.toString() in the string template
                if (c.getText() !== baseText) {
                    assert.equal(
                        c.getText(),
                        baseText,
                        // eslint-disable-next-line max-len
                        `${this.toString(message)}\nClient ${c.longClientId} does not match client ${this.clients[0].longClientId}`);
                }
            });
    }

    public toString(message?: string) {
        let str = "\n";
        if (this.title) {
            str += `${this.title}\n`;
        }
        if(message) {
            str += `${message}\n`;
        }

        str += "\
    -: removed value.\n\
    _: un-acked value below.\n\
    *: un-acked insert and remove\n";

        str += this.roundLogLines
            .map((line) => line.map(
                (v, i) => i % 3 === 0 ? v.padStart(this.paddings[i]) : v.padEnd(this.paddings[i])).join(" "))
            .join("\n");
        return str;
    }

    private getSegString(client: TestClient): { acked: string, local: string } {
        let acked: string = "";
        let local: string = "";
        const nodes = [...client.mergeTree.root.children];
        while (nodes.length > 0) {
            const node = nodes.shift();
            if (node) {
                if (node.isLeaf()) {
                    if (TextSegment.is(node)) {
                        if (node.removedSeq) {
                            if (node.removedSeq === UnassignedSequenceNumber) {
                                acked += "_".repeat(node.text.length);
                                if (node.seq === UnassignedSequenceNumber) {
                                    local += "*".repeat(node.text.length);
                                } else {
                                    local += "-".repeat(node.text.length);
                                }
                            } else {
                                acked += "-".repeat(node.text.length);
                                local += " ".repeat(node.text.length);
                            }
                        } else {
                            if (node.seq === UnassignedSequenceNumber) {
                                acked += "_".repeat(node.text.length);
                                local += node.text;
                            } else {
                                acked += node.text;
                                local += " ".repeat(node.text.length);
                            }
                        }
                    }
                } else {
                    nodes.push(...node.children);
                }
            }
        }
        return { acked, local };
    }
}
