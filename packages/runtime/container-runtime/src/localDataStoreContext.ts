/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import {
    IFluidObject,
} from "@fluidframework/core-interfaces";
import {
    BindState,
    AttachState,
} from "@fluidframework/container-definitions";
import { Deferred, assert } from "@fluidframework/common-utils";
import { IDocumentStorageService } from "@fluidframework/driver-definitions";
import {
    ISnapshotTree,
    ITree,
} from "@fluidframework/protocol-definitions";
import {
    CreateChildSummarizerNodeFn,
    IAttachMessage,
    IFluidDataStoreChannel,
    IFluidDataStoreContextDetached,
    IProvideFluidDataStoreFactory,
} from "@fluidframework/runtime-definitions";
import { convertSummaryTreeToITree } from "@fluidframework/runtime-utils";
import { ContainerRuntime } from "./containerRuntime";
import {
    createAttributesBlob,
    FluidDataStoreContext,
    IFluidDataStoreContextImpl,
    ISnapshotDetails,
} from "./dataStoreContext";

export interface ILocalFluidDataStoreContextImpl extends IFluidDataStoreContextImpl{
    generateAttachMessage(): IAttachMessage;
}

export const isLocalFluidDataStoreContext =
    (context: IFluidDataStoreContextImpl): context is ILocalFluidDataStoreContextImpl=>
        typeof (context as ILocalFluidDataStoreContextImpl).generateAttachMessage === "function";

/**
 * Base class for detached & attached context classes
 */
export class LocalFluidDataStoreContextBase extends FluidDataStoreContext implements ILocalFluidDataStoreContextImpl {
    constructor(
        id: string,
        pkg: Readonly<string[]>,
        runtime: ContainerRuntime,
        storage: IDocumentStorageService,
        scope: IFluidObject,
        createSummarizerNode: CreateChildSummarizerNodeFn,
        bindChannel: (channel: IFluidDataStoreChannel) => void,
        private readonly snapshotTree: ISnapshotTree | undefined,
        protected readonly isRootDataStore: boolean,
        /**
         * @deprecated 0.16 Issue #1635, #3631
         */
        public readonly createProps?: any,
    ) {
        super(
            runtime,
            id,
            snapshotTree !== undefined ? true : false,
            storage,
            scope,
            createSummarizerNode,
            snapshotTree ? BindState.Bound : BindState.NotBound,
            true,
            bindChannel,
            pkg);
        this.attachListeners();
    }

    private attachListeners(): void {
        this.once("attaching", () => {
            assert(this.attachState === AttachState.Detached, "Should move from detached to attaching");
            this._attachState = AttachState.Attaching;
        });
        this.once("attached", () => {
            assert(this.attachState === AttachState.Attaching, "Should move from attaching to attached");
            this._attachState = AttachState.Attached;
        });
    }

    public generateAttachMessage(): IAttachMessage {
        assert(this.channel !== undefined, "There should be a channel when generating attach message");

        let snapshot: ITree;
        /**
         * back-compat 0.28 - snapshot is being removed and replaced with summary.
         * So, getAttachSnapshot has been deprecated and getAttachSummary should be used instead.
         */
        if (this.channel.getAttachSummary !== undefined) {
            const summaryTree = this.channel.getAttachSummary();
            // Attach message needs the summary in ITree format. Convert the ISummaryTree into an ITree.
            snapshot = convertSummaryTreeToITree(summaryTree.summary);
        } else {
            const entries = this.channel.getAttachSnapshot();
            snapshot = { entries, id: null };
        }

        assert(this.pkg !== undefined, "pkg should be available in local data store context");
        assert(this.isRootDataStore !== undefined, "isRootDataStore should be available in local data store context");
        const attributesBlob = createAttributesBlob(this.pkg, this.isRootDataStore);
        snapshot.entries.push(attributesBlob);

        const message: IAttachMessage = {
            id: this.id,
            snapshot,
            type: this.pkg[this.pkg.length - 1],
        };

        return message;
    }

    protected async getInitialSnapshotDetails(): Promise<ISnapshotDetails> {
        assert(this.pkg !== undefined, "pkg should be available in local data store context");
        assert(this.isRootDataStore !== undefined, "isRootDataStore should be available in local data store context");
        return {
            pkg: this.pkg,
            isRootDataStore: this.isRootDataStore,
            snapshot: this.snapshotTree,
        };
    }
}

/**
 * context implementation for "attached" data store runtime.
 * Various workflows (snapshot creation, requests) result in .realize() being called
 * on context, resulting in instantiation and attachment of runtime.
 * Runtime is created using data store factory that is associated with this context.
 */
export class LocalFluidDataStoreContext extends LocalFluidDataStoreContextBase {
    constructor(
        id: string,
        pkg: string[],
        runtime: ContainerRuntime,
        storage: IDocumentStorageService,
        scope: IFluidObject & IFluidObject,
        createSummarizerNode: CreateChildSummarizerNodeFn,
        bindChannel: (channel: IFluidDataStoreChannel) => void,
        snapshotTree: ISnapshotTree | undefined,
        isRootDataStore: boolean,
        /**
         * @deprecated 0.16 Issue #1635, #3631
         */
        createProps?: any,
    ) {
        super(
            id,
            pkg,
            runtime,
            storage,
            scope,
            createSummarizerNode,
            bindChannel,
            snapshotTree,
            isRootDataStore,
            createProps);
    }
}

/**
 * Detached context. Data Store runtime will be attached to it by attachRuntime() call
 * Before attachment happens, this context is not associated with particular type of runtime
 * or factory, i.e. it's package path is undefined.
 * Attachment process provides all missing parts - package path, data store runtime, and data store factory
 */
export class LocalDetachedFluidDataStoreContext
    extends LocalFluidDataStoreContextBase
    implements IFluidDataStoreContextDetached
{
    constructor(
        id: string,
        pkg: Readonly<string[]>,
        runtime: ContainerRuntime,
        storage: IDocumentStorageService,
        scope: IFluidObject & IFluidObject,
        createSummarizerNode: CreateChildSummarizerNodeFn,
        bindChannel: (channel: IFluidDataStoreChannel) => void,
        snapshotTree: ISnapshotTree | undefined,
        isRootDataStore: boolean,
    ) {
        super(
            id,
            pkg,
            runtime,
            storage,
            scope,
            createSummarizerNode,
            bindChannel,
            snapshotTree,
            isRootDataStore,
        );
        this.detachedRuntimeCreation = true;
    }

    public async attachRuntime(
        registry: IProvideFluidDataStoreFactory,
        dataStoreRuntime: IFluidDataStoreChannel)
    {
        assert(this.detachedRuntimeCreation);
        assert(this.channelDeferred === undefined);

        const factory = registry.IFluidDataStoreFactory;

        const entry = await this.factoryFromPackagePath(this.pkg);
        assert(entry.factory === factory);

        assert(this.registry === undefined);
        this.registry = entry.registry;

        this.detachedRuntimeCreation = false;
        this.channelDeferred = new Deferred<IFluidDataStoreChannel>();

        super.bindRuntime(dataStoreRuntime);

        if (this.isRootDataStore) {
            dataStoreRuntime.bindToContext();
        }
    }

    protected async getInitialSnapshotDetails(): Promise<ISnapshotDetails> {
        if (this.detachedRuntimeCreation) {
            throw new Error("Detached Fluid Data Store context can't be realized! Please attach runtime first!");
        }
        return super.getInitialSnapshotDetails();
    }
}
