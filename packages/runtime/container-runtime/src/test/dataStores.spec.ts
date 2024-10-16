/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { strict as assert } from "assert";
import { ISnapshotTree } from "@fluidframework/protocol-definitions";
import { channelsTreeName } from "@fluidframework/runtime-definitions";
import { getSummaryForDatastores } from "../dataStores";
import { ReadContainerRuntimeMetadata, nonDataStorePaths } from "../summaryFormat";

describe("Runtime", () => {
    describe("Container Runtime", () => {
        describe("getSummaryForDatastores", () => {
            const enabledMetadata: ReadContainerRuntimeMetadata = { summaryFormatVersion: 1 };
            const disabledMetadata: ReadContainerRuntimeMetadata = {
                summaryFormatVersion: 1,
                disableIsolatedChannels: true,
            };

            const emptyTree = (id: string): ISnapshotTree => ({
                id,
                blobs: {},
                commits: {},
                trees: {},
            });
            const testSnapshot: ISnapshotTree = {
                id: "root-id",
                blobs: {},
                commits: {},
                trees: {
                    [channelsTreeName]: {
                        id: "channels-id",
                        blobs: {},
                        commits: {},
                        trees: {
                            [nonDataStorePaths[0]]: emptyTree("lower-non-datastore-1"),
                            "some-datastore": emptyTree("lower-datastore-1"),
                            [nonDataStorePaths[1]]: emptyTree("lower-non-datastore-2"),
                            "another-datastore": emptyTree("lower-datastore-2"),
                        },
                    },
                    [nonDataStorePaths[0]]: emptyTree("top-non-datastore-1"),
                    "some-datastore": emptyTree("top-datastore-1"),
                    [nonDataStorePaths[1]]: emptyTree("top-non-datastore-2"),
                    "another-datastore": emptyTree("top-datastore-2"),
                },
            };

            it("Should return undefined for undefined snapshots", () => {
                let snapshot = getSummaryForDatastores(undefined, undefined);
                assert(snapshot === undefined);
                snapshot = getSummaryForDatastores(undefined, enabledMetadata);
                assert(snapshot === undefined);
                snapshot = getSummaryForDatastores(undefined, disabledMetadata);
                assert(snapshot === undefined);
                snapshot = getSummaryForDatastores(null as any, undefined);
                assert(snapshot === undefined);
                snapshot = getSummaryForDatastores(null as any, enabledMetadata);
                assert(snapshot === undefined);
                snapshot = getSummaryForDatastores(null as any, disabledMetadata);
                assert(snapshot === undefined);
            });

            it("Should strip out non-datastore paths for versions < 1", () => {
                const snapshot = getSummaryForDatastores(testSnapshot, undefined);
                assert(snapshot, "Snapshot should be defined");
                assert.strictEqual(snapshot.id, "root-id", "Should be top-level");
                assert.strictEqual(Object.keys(snapshot.trees).length, 3, "Should have 3 datastores");
                assert.strictEqual(snapshot.trees[channelsTreeName]?.id, "channels-id",
                    "Should have channels tree as datastore");
                assert.strictEqual(snapshot.trees["some-datastore"]?.id, "top-datastore-1",
                    "Should have top datastore 1");
                assert.strictEqual(snapshot.trees["another-datastore"]?.id, "top-datastore-2",
                    "Should have top datastore 2");
            });

            it("Should strip out non-datastore paths for disabled isolated channels", () => {
                const snapshot = getSummaryForDatastores(testSnapshot, disabledMetadata);
                assert(snapshot, "Snapshot should be defined");
                assert.strictEqual(snapshot.id, "root-id", "Should be top-level");
                assert.strictEqual(Object.keys(snapshot.trees).length, 3, "Should have 3 datastores");
                assert.strictEqual(snapshot.trees[channelsTreeName]?.id, "channels-id",
                    "Should have channels tree as datastore");
                assert.strictEqual(snapshot.trees["some-datastore"]?.id, "top-datastore-1",
                    "Should have top datastore 1");
                assert.strictEqual(snapshot.trees["another-datastore"]?.id, "top-datastore-2",
                    "Should have top datastore 2");
            });

            it("Should give channels subtree for version 1", () => {
                const snapshot = getSummaryForDatastores(testSnapshot, enabledMetadata);
                assert(snapshot, "Snapshot should be defined");
                assert.strictEqual(snapshot.id, "channels-id", "Should be lower-level");
                assert.strictEqual(Object.keys(snapshot.trees).length, 4, "Should have 4 datastores");
                // Put in variable to avoid type-narrowing bug
                const nonDataStore1 = snapshot.trees[nonDataStorePaths[0]];
                assert.strictEqual(nonDataStore1?.id, "lower-non-datastore-1",
                    "Should have lower non-datastore 1");
                assert.strictEqual(snapshot.trees[nonDataStorePaths[1]]?.id, "lower-non-datastore-2",
                    "Should have lower non-datastore 2");
                assert.strictEqual(snapshot.trees["some-datastore"]?.id, "lower-datastore-1",
                    "Should have lower datastore 1");
                assert.strictEqual(snapshot.trees["another-datastore"]?.id, "lower-datastore-2",
                    "Should have lower datastore 2");
            });
        });
    });
});
