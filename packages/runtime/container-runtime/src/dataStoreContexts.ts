/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { IDisposable, ITelemetryBaseLogger, ITelemetryLogger } from "@fluidframework/common-definitions";
import { assert, Deferred, Lazy } from "@fluidframework/common-utils";
import { ChildLogger } from "@fluidframework/telemetry-utils";
import { FluidDataStoreContext, LocalFluidDataStoreContext } from "./dataStoreContext";

 export class DataStoreContexts implements Iterable<[string,FluidDataStoreContext]>, IDisposable {
    private readonly notBoundContexts = new Set<string>();

    // Attached and loaded context proxies
    private readonly _contexts = new Map<string, FluidDataStoreContext>();
    // List of pending contexts (for the case where a client knows a store will exist and is waiting
    // on its creation). This is a superset of contexts.
    private readonly contextsDeferred = new Map<string, Deferred<FluidDataStoreContext>>();

    private readonly disposeOnce = new Lazy<void>(()=>{
        // close/stop all store contexts
        for (const [fluidDataStoreId, contextD] of this.contextsDeferred) {
            contextD.promise.then((context) => {
                context.dispose();
            }).catch((contextError) => {
                this._logger.sendErrorEvent({
                    eventName: "FluidDataStoreContextDisposeError",
                    fluidDataStoreId,
                },
                contextError);
            });
        }
    });

    private readonly _logger: ITelemetryLogger;

    constructor(baseLogger: ITelemetryBaseLogger) {
        this._logger = ChildLogger.create(baseLogger);
    }

    [Symbol.iterator](): Iterator<[string, FluidDataStoreContext]> {
         return this._contexts.entries();
     }

    public get disposed() { return this.disposeOnce.evaluated;}
    public readonly dispose = () => this.disposeOnce.value;

    public has(id: string) {
        return this._contexts.has(id);
    }
    public get(id: string): FluidDataStoreContext | undefined {
        return this._contexts.get(id);
    }

    public hasUnbound(id: string) {
        return this.notBoundContexts.has(id);
    }
    public get unboundCount() {
        return this.notBoundContexts.size;
    }

    public setUnbound(context: LocalFluidDataStoreContext) {
        const id = context.id;
        assert(!this._contexts.has(id), "Creating store with existing ID");
        this.notBoundContexts.add(id);
        const deferred = new Deferred<FluidDataStoreContext>();
        this.contextsDeferred.set(id, deferred);
        this._contexts.set(id, context);
    }

    public getUnbound(id: string): LocalFluidDataStoreContext {
        assert(this.notBoundContexts.has(id),
        "Store to be bound should be in not bounded set");
        return this._contexts.get(id) as LocalFluidDataStoreContext;
    }

    public bind(id: string) {
        const context = this.getUnbound(id);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const deferred = this.contextsDeferred.get(id)!;
        assert(!!deferred);
        this.notBoundContexts.delete(id);
        deferred.resolve(context);
    }

    public async getBound(id: string, wait: boolean): Promise<FluidDataStoreContext> {
        const deferredContext = this.ensureDeferred(id);
        if (!wait && !deferredContext.isCompleted) {
            return Promise.reject(new Error(`DataStore ${id} does not exist`));
        }
        return deferredContext.promise;
    }

    public setBound(id: string, context: FluidDataStoreContext) {
        assert(!!context);
        assert(!this._contexts.has(id));
        this._contexts.set(id, context);
        const deferred = this.ensureDeferred(id);
        deferred.resolve(context);
    }

    private  ensureDeferred(id: string): Deferred<FluidDataStoreContext> {
        const deferred = this.contextsDeferred.get(id);
        if (deferred) { return deferred; }
        const newDeferred = new Deferred<FluidDataStoreContext>();
        this.contextsDeferred.set(id, newDeferred);
        return newDeferred;
    }
 }
