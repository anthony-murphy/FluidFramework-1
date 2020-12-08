/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { AttachState } from "@fluidframework/container-definitions";
import { readAndParseFromBlobs, buildSnapshotTree, BlobCacheStorageService } from "@fluidframework/driver-utils";
import { ISnapshotTree } from "@fluidframework/protocol-definitions";
import {
    IFluidDataStoreChannel,
    InboundAttachMessage,
    CreateChildSummarizerNodeParam,
    CreateChildSummarizerNodeFn,
    CreateSummarizerNodeSource,
} from "@fluidframework/runtime-definitions";
import {
    FluidDataStoreContext,
    LocalDetachedFluidDataStoreContext,
    LocalFluidDataStoreContext,
    RemotedFluidDataStoreContext,
    IFluidDataStoreAttributes,
    currentSnapshotFormatVersion,
    createAttributesBlob,
} from "./dataStoreContext";
import { ContainerRuntime } from ".";

export interface IDataStoreContextFactory{

    readonly attachState: AttachState;

    createFromSnapshotAttached(id: string, snapshot: ISnapshotTree | string): FluidDataStoreContext;
    createDetachedContextFromSnapshot(
        id: string, snapshot: ISnapshotTree,
        bindChannel: (channel: IFluidDataStoreChannel) => void): FluidDataStoreContext;
    createFromAttachMessage(sequenceNumber: number, attachMessage: InboundAttachMessage): FluidDataStoreContext;
    createDetachedDataStoreCore(
        pkg: Readonly<string[]>,
        isRoot: boolean,
        id: string,
        bindChannel: (channel: IFluidDataStoreChannel) => void): LocalDetachedFluidDataStoreContext;
    _createFluidDataStoreContext(
        pkg: string[], id: string, isRoot: boolean, props: any | undefined,
        bindChannel: (channel: IFluidDataStoreChannel) => void): LocalFluidDataStoreContext;
}

export class DataStoresContextFactory implements IDataStoreContextFactory {
    constructor(
        private readonly runtime: ContainerRuntime,
        private readonly getCreateChildSummarizerNodeFn:
            (id: string, createParam: CreateChildSummarizerNodeParam)  => CreateChildSummarizerNodeFn) {}

    get attachState() {return this.runtime.attachState;}

    createFromSnapshotAttached(id: string, snapshot: ISnapshotTree | string): FluidDataStoreContext {
        return new RemotedFluidDataStoreContext(
            id,
            snapshot,
            this.runtime,
            this.runtime.storage,
            this.runtime.scope,
            this.getCreateChildSummarizerNodeFn(id, { type: CreateSummarizerNodeSource.FromSummary }));
    }
    createDetachedContextFromSnapshot(id: string, snapshotTree: ISnapshotTree,
        bindChannel: (channel: IFluidDataStoreChannel) => void): FluidDataStoreContext {
        let pkgFromSnapshot: string[];

        // Need to rip through snapshot.
        const { pkg, snapshotFormatVersion, isRootDataStore }
            = readAndParseFromBlobs<IFluidDataStoreAttributes>(
                snapshotTree.blobs,
                snapshotTree.blobs[".component"]);
        // Use the snapshotFormatVersion to determine how the pkg is encoded in the snapshot.
        // For snapshotFormatVersion = "0.1", pkg is jsonified, otherwise it is just a string.
        // However the feature of loading a detached container from snapshot, is added when the
        // snapshotFormatVersion is "0.1", so we don't expect it to be anything else.
        if (snapshotFormatVersion === currentSnapshotFormatVersion) {
            pkgFromSnapshot = JSON.parse(pkg) as string[];
        } else {
            throw new Error(`Invalid snapshot format version ${snapshotFormatVersion}`);
        }
        return new LocalFluidDataStoreContext(
            id,
            pkgFromSnapshot,
            this.runtime,
            this.runtime.storage,
            this.runtime.scope,
            this.getCreateChildSummarizerNodeFn(id, { type: CreateSummarizerNodeSource.FromSummary }),
            bindChannel,
            snapshotTree,
            isRootDataStore ?? true);
    }

    createFromAttachMessage(sequenceNumber: number, attachMessage: InboundAttachMessage): FluidDataStoreContext {
        const flatBlobs = new Map<string, string>();
        let snapshotTree: ISnapshotTree | null = null;
        if (attachMessage.snapshot) {
            snapshotTree = buildSnapshotTree(attachMessage.snapshot.entries, flatBlobs);
        }

        // Include the type of attach message which is the pkg of the store to be
        // used by RemotedFluidDataStoreContext in case it is not in the snapshot.
        const pkg = [attachMessage.type];
        return new RemotedFluidDataStoreContext(
            attachMessage.id,
            snapshotTree,
            this.runtime,
            new BlobCacheStorageService(this.runtime.storage, flatBlobs),
            this.runtime.scope,
            this.getCreateChildSummarizerNodeFn(
                attachMessage.id,
                {
                    type: CreateSummarizerNodeSource.FromAttach,
                    sequenceNumber,
                    snapshot: attachMessage.snapshot ?? {
                        id: null,
                        entries: [createAttributesBlob(pkg, true /* isRootDataStore */)],
                    },
                }),
            pkg);
    }
    createDetachedDataStoreCore(
        pkg: Readonly<string[]>,
        isRoot: boolean,
        id: string,
        bindChannel: (channel: IFluidDataStoreChannel) => void): LocalDetachedFluidDataStoreContext
    {
        return new LocalDetachedFluidDataStoreContext(
            id,
            pkg,
            this.runtime,
            this.runtime.storage,
            this.runtime.scope,
            this.getCreateChildSummarizerNodeFn(id, { type: CreateSummarizerNodeSource.Local }),
            bindChannel,
            undefined,
            isRoot,
        );
    }

    _createFluidDataStoreContext(
        pkg: string[], id: string, isRoot: boolean, props: any | undefined,
        bindChannel: (channel: IFluidDataStoreChannel) => void) {
        return new LocalFluidDataStoreContext(
            id,
            pkg,
            this.runtime,
            this.runtime.storage,
            this.runtime.scope,
            this.getCreateChildSummarizerNodeFn(id, { type: CreateSummarizerNodeSource.Local }),
            bindChannel,
            undefined,
            isRoot,
            props,
        );
    }
}
