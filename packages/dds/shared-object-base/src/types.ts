/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { IErrorEvent, IEventProvider } from "@fluidframework/common-definitions";
import { IChannel, IChannelServices } from "@fluidframework/datastore-definitions";
import { IChannelSummarizeResult, IGCData } from "@fluidframework/runtime-definitions";

/**
 * Base interface for shared objects from which other interfaces derive. Implemented by SharedObject
 */
export interface ISharedObject<TEvent extends IErrorEvent = IErrorEvent>
    extends IChannel, IEventProvider<TEvent> {
    /**
     * Binds the given shared object to its containing data store runtime, causing it to attach once
     * the runtime attaches.
     */
    bindToContext(): void;

    /**
     * Returns whether the given shared object is attached to storage.
     * @returns True if the given shared object is attached
     */
    isAttached(): boolean;

    /**
     * Generates summary of the shared object.
     * @returns A tree representing the summary of the shared object.
     */
    summarize(fullTree?: boolean, trackState?: boolean): IChannelSummarizeResult;

    /**
     * Enables the channel to send and receive ops.
     * @param services - Services to connect to
     */
    connect(services: IChannelServices): void;

    /**
     * Returns the GC data for this shared object. It contains a list of GC nodes that contains references to
     * other GC nodes.
     */
    getGCData(): IGCData;
}
