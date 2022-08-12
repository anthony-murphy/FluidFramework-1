/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { strict as assert } from "assert";
import {
    List,
    walkList,
} from "../collections";

describe("Collections.List", () => {
    const listCount = 5;
    let list: List<number>;

    beforeEach(() => {
        list = new List<number>();
        for (let i = 0; i < listCount; i++) {
            list.unshift(i);
        }
    });

    describe(".length", () => {
        it("Should return the total number of items in the list",
            () => assert.equal(list.length, listCount, "The list count doesn't match the expected count."));
    });

    describe(".first", () => {
        it("Should return the first item in the list",
            () => assert.equal(list.first?.data, listCount - 1, "first item not expected value"));
    });

    describe(".last", () => {
        it("Should return the last item in the list",
            () => assert.equal(list.last?.data, 0, "last item not expected value"));
    });

    describe(".clear", () => {
        it("List should be empty after clear, and all nodes should be detached",
            () => {
                const nodes = [... list];
                list.clear();
                assert.equal(list.length, 0, "length should be 0");
                assert.equal(list.empty, true, "empty should be true");
                assert.equal(list.first, undefined, "first should be undefined");
                assert.equal(list.last, undefined, "last should be undefined");
                nodes.forEach((n) => {
                    assert.equal(n.list, undefined, `node(${n}) list should be undefined `);
                    assert.equal(n.prev, undefined, `node(${n}) prev should be undefined `);
                    assert.equal(n.next, undefined, `node(${n}) next should be undefined `);
                    assert.equal(list.has(n), false, `list should not have node(${n})`);
                });
            });
    });

    describe("walkList", () => {
        it("Should walk all items of the list", () => {
            let i = listCount - 1;
            walkList(list, (item) => {
                assert.equal(item.data, i, "element not expected value");
                i--;
            });
        });
    });

    describe(".iterator", () => {
        it("Should walk all items of the list", () => {
            let i = listCount - 1;
            for (const item of list) {
                assert.equal(item.data, i, "element not expected value");
                i--;
            }
        });
    });

    describe(".unshift", () => {
        it("Should add item to the start of the list",
            () => {
                list.unshift(99);
                assert.equal(list.first?.data, 99, "first item not expected value");
                assert.equal(list.length, listCount + 1, "The list count doesn't match the expected count.");
            });
    });
    describe(".enqueue", () => {
        it("Should add item to the end of the list",
            () => {
                list.push(99);
                assert.equal(list.last?.data, 99, "last item not expected value");
                assert.equal(list.length, listCount + 1, "The list count doesn't match the expected count.");
            });
    });
});
