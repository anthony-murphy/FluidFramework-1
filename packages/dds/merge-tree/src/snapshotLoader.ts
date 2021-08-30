/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { assert, bufferToString } from "@fluidframework/common-utils";
import { IFluidSerializer } from "@fluidframework/core-interfaces";
import { ChildLogger } from "@fluidframework/telemetry-utils";
import { ISequencedDocumentMessage } from "@fluidframework/protocol-definitions";
import { IFluidDataStoreRuntime, IChannelStorageService } from "@fluidframework/datastore-definitions";
import { ITelemetryLogger } from "@fluidframework/common-definitions";
import { AttachState } from "@fluidframework/container-definitions";
import * as parse5 from "parse5";
import * as htmlparser2Adapter from "parse5-htmlparser2-tree-adapter";
import { Client } from "./client";
import { NonCollabClient, UniversalSequenceNumber } from "./constants";
import { ISegment, MergeTree } from "./mergeTree";
import { IJSONSegment } from "./ops";
import {
    IJSONSegmentWithMergeInfo,
    hasMergeInfo,
} from "./snapshotChunks";
import { SnapshotLegacy } from "./snapshotlegacy";

export class SnapshotLoader {
    private readonly logger: ITelemetryLogger;

    constructor(
        private readonly runtime: IFluidDataStoreRuntime,
        private readonly client: Client,
        private readonly mergeTree: MergeTree,
        logger: ITelemetryLogger,
        private readonly serializer: IFluidSerializer) {
        this.logger = ChildLogger.create(logger, "SnapshotLoader");
    }

    public async initialize(
        services: IChannelStorageService,
    ): Promise<{ catchupOpsP: Promise<ISequencedDocumentMessage[]> }> {
        const headerLoadedP =
            services.readBlob(SnapshotLegacy.header).then((header) => {
                assert(!!header, 0x05f /* "Missing blob header on legacy snapshot!" */);
                this.loadHeader(bufferToString(header,"utf8"));
            });

        const catchupOpsP =
            this.loadBodyAndCatchupOps(services);

        catchupOpsP.catch(
            (err)=>this.logger.sendErrorEvent({ eventName: "CatchupOpsLoadFailure" },err));

        await headerLoadedP;

        return { catchupOpsP };
    }

    private async loadBodyAndCatchupOps(
        services: IChannelStorageService,
    ): Promise<ISequencedDocumentMessage[]> {
        const blobsP = services.list("");

        const blobs = await blobsP;
        if (blobs.length > 1) {
            return this.loadCatchupOps(services.readBlob(blobs[0]));
        }

        return [];
    }
    private readonly specToSegment = (spec: IJSONSegment | IJSONSegmentWithMergeInfo) => {
        let seg: ISegment;

        if (hasMergeInfo(spec)) {
            seg = this.client.specToSegment(spec.json);

            // `specToSegment()` initializes `seg` with the LocalClientId.  Overwrite this with
            // the `spec` client (if specified).  Otherwise overwrite with `NonCollabClient`.
            seg.clientId = spec.client !== undefined
                ? this.client.getOrAddShortClientId(spec.client)
                : NonCollabClient;

            seg.seq = spec.seq !== undefined
                ? spec.seq
                : UniversalSequenceNumber;

            if (spec.removedSeq !== undefined) {
                seg.removedSeq = spec.removedSeq;
            }
            if (spec.removedClient !== undefined) {
                seg.removedClientId = this.client.getOrAddShortClientId(spec.removedClient);
            }
        } else {
            seg = this.client.specToSegment(spec);
            seg.seq = UniversalSequenceNumber;

            // `specToSegment()` initializes `seg` with the LocalClientId.  We must overwrite this with
            // `NonCollabClient`.
            seg.clientId = NonCollabClient;
        }

        return seg;
    };

    private loadHeader(header: string) {
        const fragment = parse5.parseFragment(header, {treeAdapter: htmlparser2Adapter});

        const span =  fragment.firstChild;
        assert(htmlparser2Adapter.isElementNode(span), "not a span");
        const minSeq = Number.parseInt(span.attribs["data-minseq"], 10);
        const seq = Number.parseInt(span.attribs["data-seq"], 10);

        const segs = span.childNodes.map((node)=>{
            assert(htmlparser2Adapter.isElementNode(node), "not span");
            const jsonLikeObj: Record<string, any> = {};
            for(const key of Object.keys(node.attribs)) {
                jsonLikeObj[key.substring(key.indexOf("-") + 1)] = this.serializer.parse(node.attribs[key]);
            }
            if(node.childNodes.length === 1) {
                const maybeText = node.firstChild;
                assert(htmlparser2Adapter.isTextNode(maybeText), "not text");
                jsonLikeObj.text = maybeText.nodeValue;
            }
            return this.specToSegment(jsonLikeObj);
        });

        this.mergeTree.reloadFromSegments(segs);

        // If we load a detached container from snapshot, then we don't supply a default clientId
        // because we don't want to start collaboration.
        if (this.runtime.attachState !== AttachState.Detached) {
            // specify a default client id, "snapshot" here as we
            // should enter collaboration/op sending mode if we load
            // a snapshot in any case (summary or attach message)
            // once we get a client id this will be called with that
            // clientId in the connected event
            this.client.startOrUpdateCollaboration(
                this.runtime.clientId ?? "snapshot",

                // TODO: Make 'minSeq' non-optional once the new snapshot format becomes the default?
                //       (See https://github.com/microsoft/FluidFramework/issues/84)
                /* minSeq: */ minSeq,
                /* currentSeq: */ seq,
            );
        }
    }
    /**
     * If loading from a snapshot, get the catchup messages.
     * @param rawMessages - The messages in original encoding
     * @returns The decoded messages, but handles aren't parsed.  Matches the format that will be passed in
     * SharedObject.processCore.
     */
    private async loadCatchupOps(rawMessages: Promise<ArrayBufferLike>): Promise<ISequencedDocumentMessage[]> {
        return JSON.parse(bufferToString(await rawMessages, "utf8")) as ISequencedDocumentMessage[];
    }
}
