/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { ITelemetryLogger, ITelemetryBaseLogger, IDisposable } from "@fluidframework/common-definitions";
import {
    ISequencedDocumentMessage,
    ISnapshotTree,
    ITreeEntry,
    SummaryType,
} from "@fluidframework/protocol-definitions";
import {
    IAttachMessage,
    IChannelSummarizeResult,
    IEnvelope,
    IFluidDataStoreChannel,
    IFluidDataStoreContextDetached,
    IGraphNode,
    IInboundSignalMessage,
    InboundAttachMessage,
    ISummarizeResult,
    ISummaryTreeWithStats,
} from "@fluidframework/runtime-definitions";
import {
     convertSnapshotTreeToSummaryTree,
     convertSummaryTreeToITree,
     convertToSummaryTree,
     SummaryTreeBuilder,
} from "@fluidframework/runtime-utils";
import { ChildLogger } from "@fluidframework/telemetry-utils";
import { AttachState } from "@fluidframework/container-definitions";
import { assert, Lazy } from "@fluidframework/common-utils";
import { v4 as uuid } from "uuid";
import { TreeTreeEntry } from "@fluidframework/protocol-base";
import { normalizeAndPrefixGCNodeIds } from "@fluidframework/garbage-collector";
import { nonDataStorePaths } from "./containerRuntime";
import { IDataStoreContextFactory } from "./datastoresContextFactory";
import { isLocalFluidDataStoreContext } from "./localDataStoreContext";
import { DataStoreContextManger } from "./dataStoreContexts";

 /**
  * This class encapsulates data store handling. Currently it is only used by the container runtime,
  * but eventually could be hosted on any channel once we formalize the channel api boundary.
  */
export class DataStores implements IDisposable {
    // Stores tracked by the Domain
    private readonly pendingAttach = new Map<string, IAttachMessage>();
    // 0.24 back-compat attachingBeforeSummary
    public readonly attachOpFiredForDataStore = new Set<string>();

    private readonly logger: ITelemetryLogger;

    private readonly disposeOnce = new Lazy<void>(()=>this.contexts.dispose());

    private readonly contexts: DataStoreContextManger;

    constructor(
        private readonly baseSnapshot: ISnapshotTree | undefined,
        private readonly submitAttachFn: (attachContent: any) => void,
        private readonly contextFactory: IDataStoreContextFactory,
        baseLogger: ITelemetryBaseLogger | undefined,
    ) {
        this.contexts = new DataStoreContextManger(baseLogger);
        this.logger = ChildLogger.create(baseLogger);
        // Extract stores stored inside the snapshot
        const fluidDataStores = new Map<string, ISnapshotTree | string>();

        if (typeof baseSnapshot === "object") {
            Object.keys(baseSnapshot.trees).forEach((value) => {
                if (!nonDataStorePaths.includes(value)) {
                    const tree = baseSnapshot.trees[value];
                    fluidDataStores.set(value, tree);
                }
            });
        }

        // Create a context for each of them
        for (const [key, value] of fluidDataStores) {
            this.contexts.addBoundOrRemoted(
                this.contextFactory.createFromSnapshot(
                    key,
                    value,
                    this.bindFluidDataStore.bind(this)));
        }
    }

    public get size() {
        return this.contexts.size;
    }

    public processAttachMessage(message: ISequencedDocumentMessage, local: boolean) {
        const attachMessage = message.contents as InboundAttachMessage;
        // The local object has already been attached
        if (local) {
            assert(this.pendingAttach.has(attachMessage.id));
            this.contexts.get(attachMessage.id)?.emit("attached");
            this.pendingAttach.delete(attachMessage.id);
            return;
        }

         // If a non-local operation then go and create the object, otherwise mark it as officially attached.
        if (this.contexts.has(attachMessage.id)) {
            const error = new Error("DataCorruption: Duplicate data store created with existing ID");
            this.logger.sendErrorEvent({
                eventName: "DuplicateDataStoreId",
                sequenceNumber: message.sequenceNumber,
                clientId: message.clientId,
                referenceSequenceNumber: message.referenceSequenceNumber,
            }, error);
            throw error;
        }

        const remotedFluidDataStoreContext = this.contextFactory.createFromAttachMessage(
            message.sequenceNumber,
            attachMessage);

        // Resolve pending gets and store off any new ones
       this.contexts.addBoundOrRemoted(remotedFluidDataStoreContext);

        // Equivalent of nextTick() - Prefetch once all current ops have completed
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        Promise.resolve().then(async () => remotedFluidDataStoreContext.realize());
    }

    private bindFluidDataStore(attachState: AttachState, fluidDataStoreRuntime: IFluidDataStoreChannel): void {
        const id = fluidDataStoreRuntime.id;
        const localContext = this.contexts.getUnbound(id);
        assert(!!localContext, "Could not find unbound context to bind");

        // If the container is detached, we don't need to send OP or add to pending attach because
        // we will summarize it while uploading the create new summary and make it known to other
        // clients.
        if (attachState !== AttachState.Detached) {
            localContext.emit("attaching");
            const message = localContext.generateAttachMessage();

            this.pendingAttach.set(id, message);
            this.submitAttachFn(message);
            this.attachOpFiredForDataStore.add(id);
        }

        this.contexts.bind(fluidDataStoreRuntime.id);
    }

    public createDetachedDataStoreCore(
        pkg: Readonly<string[]>,
        isRoot: boolean,
        id = uuid()): IFluidDataStoreContextDetached
    {
        const context = this.contextFactory.createDetachedDataStoreCore(
            pkg,
            isRoot,
            id,
            this.bindFluidDataStore.bind(this));
        this.contexts.addUnbound(context);
        return context;
    }

    public _createFluidDataStoreContext(pkg: string[], id: string, isRoot: boolean, props?: any) {
        const context = this.contextFactory._createFluidDataStoreContext(
            pkg,
            id,
            isRoot,
            props,
            this.bindFluidDataStore.bind(this));
        this.contexts.addUnbound(context);
        return context;
    }

    public get disposed() {return this.disposeOnce.evaluated;}
    public readonly dispose = () => this.disposeOnce.value;

    public updateLeader(leader: boolean) {
        for (const [, context] of this.contexts) {
            context.updateLeader(leader);
        }
    }

    public resubmitDataStoreOp(content: any, localOpMetadata: unknown) {
        const envelope = content as IEnvelope;
        const context = this.contexts.get(envelope.address);
        assert(!!context, "There should be a store context for the op");
        context.reSubmit(envelope.contents, localOpMetadata);
    }

    public processFluidDataStoreOp(message: ISequencedDocumentMessage, local: boolean, localMessageMetadata: unknown) {
        const envelope = message.contents as IEnvelope;
        const transformed = { ...message, contents: envelope.contents };
        const context = this.contexts.get(envelope.address);
        assert(!!context, "There should be a store context for the op");
        context.process(transformed, local, localMessageMetadata);
    }

    public async getDataStore(id: string, wait: boolean): Promise<IFluidDataStoreChannel> {
        const context = await this.contexts.getBoundOrRemoted(id, wait);

        if (context === undefined) {
            throw new Error(`DataStore ${id} does not yet exist or is not yet bound`);
        }

        return context.realize();
    }

    public processSignal(address: string, message: IInboundSignalMessage, local: boolean) {
        const context = this.contexts.get(address);
        if (!context) {
            // Attach message may not have been processed yet
            assert(!local, "Missing datastore for local signal");
            this.logger.sendTelemetryEvent({
                eventName: "SignalFluidDataStoreNotFound",
                fluidDataStoreId: address,
            });
            return;
        }

        context.processSignal(message, local);
    }

    public setConnectionState(connected: boolean, clientId?: string) {
        for (const [fluidDataStore, context] of this.contexts) {
            try {
                context.setConnectionState(connected, clientId);
            } catch (error) {
                this.logger.sendErrorEvent({
                    eventName: "SetConnectionStateError",
                    clientId,
                    fluidDataStore,
                }, error);
            }
        }
    }

    public setAttachState(attachState: AttachState.Attaching | AttachState.Attached): void {
        let eventName: "attaching" | "attached";
        if (attachState === AttachState.Attaching) {
            eventName = "attaching";
        } else {
            eventName = "attached";
        }
        for (const [,context] of this.contexts) {
            // Fire only for bounded stores.
            if (!this.contexts.isNotBound(context.id)) {
                context.emit(eventName);
            }
        }
    }

    /**
     * Notifies this object to take the snapshot of the container.
     * @deprecated - Use summarize to get summary of the container runtime.
     */
    public async snapshot(): Promise<ITreeEntry[]> {
        // Iterate over each store and ask it to snapshot
        const fluidDataStoreSnapshotsP = Array.from(this.contexts).map(async ([fluidDataStoreId, value]) => {
            const summaryTree = await value.summarize(true /* fullTree */, false /* trackState */);
            assert(
                summaryTree.summary.type === SummaryType.Tree,
                "summarize should always return a tree when fullTree is true");
            // back-compat summary - Remove this once snapshot is removed.
            const snapshot = convertSummaryTreeToITree(summaryTree.summary);

            // If ID exists then previous commit is still valid
            return {
                fluidDataStoreId,
                snapshot,
            };
        });

        const entries: ITreeEntry[] = [];

        // Add in module references to the store snapshots
        const fluidDataStoreSnapshots = await Promise.all(fluidDataStoreSnapshotsP);

        // Sort for better diffing of snapshots (in replay tool, used to find bugs in snapshotting logic)
        fluidDataStoreSnapshots.sort((a, b) => a?.fluidDataStoreId.localeCompare(b.fluidDataStoreId));

        for (const fluidDataStoreSnapshot of fluidDataStoreSnapshots) {
            entries.push(new TreeTreeEntry(
                fluidDataStoreSnapshot.fluidDataStoreId,
                fluidDataStoreSnapshot.snapshot,
            ));
        }
        return entries;
    }

    public async summarize(fullTree: boolean, trackState: boolean): Promise<IChannelSummarizeResult> {
        const builder = new SummaryTreeBuilder();
        // A list of this channel's GC nodes. Starts with this channel's GC node and adds the GC nodes all its child
        // channel contexts.
        let gcNodes: IGraphNode[] = [ await this.getGCNode() ];

        // Iterate over each store and ask it to snapshot
        await Promise.all(Array.from(this.contexts)
            .filter(([_, context]) => {
                // Summarizer works only with clients with no local changes!
                assert(context.attachState !== AttachState.Attaching);
                return context.attachState === AttachState.Attached;
            }).map(async ([contextId, context]) => {
                const contextSummary = await context.summarize(fullTree, trackState);
                builder.addWithStats(contextId, contextSummary);

                // back-compat 0.30 - Older versions will not return GC nodes. Set it to empty array.
                if (contextSummary.gcNodes === undefined) {
                    contextSummary.gcNodes = [];
                }

                // Normalize the context's GC nodes and prefix its id to the ids of GC nodes returned by it.
                normalizeAndPrefixGCNodeIds(contextSummary.gcNodes, contextId);
                gcNodes = gcNodes.concat(contextSummary.gcNodes);
            }));

        return {
            ...builder.getSummaryTree(),
            gcNodes,
        };
    }

    public createSummary(): ISummaryTreeWithStats {
        const builder = new SummaryTreeBuilder();
        // Attaching graph of some stores can cause other stores to get bound too.
        // So keep taking summary until no new stores get bound.
        let notBoundContextsLength: number;
        do {
            const builderTree = builder.summary.tree;
            notBoundContextsLength = this.contexts.notBoundLength();
            // Iterate over each data store and ask it to snapshot
            Array.from(this.contexts)
                .filter(([key, _]) =>
                    // Take summary of bounded data stores only, make sure we haven't summarized them already
                    // and no attach op has been fired for that data store because for loader versions <= 0.24
                    // we set attach state as "attaching" before taking createNew summary.
                    !(this.contexts.isNotBound(key)
                        || builderTree[key]
                        || this.attachOpFiredForDataStore.has(key)),
                )
                .map(([key, value]) => {
                    let dataStoreSummary: ISummarizeResult;
                    if (value.isLoaded) {
                        assert(isLocalFluidDataStoreContext(value), "Can only create summary for local contexts");
                        const snapshot = value.generateAttachMessage().snapshot;
                        dataStoreSummary = convertToSummaryTree(snapshot, true);
                    } else {
                        // If this data store is not yet loaded, then there should be no changes in the snapshot from
                        // which it was created as it is detached container. So just use the previous snapshot.
                        assert(this.baseSnapshot?.trees?.[key] !== undefined,
                            "BaseSnapshot should be there as detached container loaded from snapshot");
                        dataStoreSummary = convertSnapshotTreeToSummaryTree(this.baseSnapshot.trees[key]);
                    }
                    builder.addWithStats(key, dataStoreSummary);
                });
        } while (notBoundContextsLength !== this.contexts.notBoundLength());

        return builder.getSummaryTree();
    }

    /**
     * Get the outbound routes of this channel. Only root data stores are considered referenced.
     * @returns this channel's garbage collection node.
     */
    private async getGCNode(): Promise<IGraphNode> {
        const outboundRoutes: string[] = [];
        for (const [contextId, context] of this.contexts) {
            const isRootDataStore = await context.isRoot();
            if (isRootDataStore) {
                outboundRoutes.push(`/${contextId}`);
            }
        }

        return {
            id: "/",
            outboundRoutes,
        };
    }
}
