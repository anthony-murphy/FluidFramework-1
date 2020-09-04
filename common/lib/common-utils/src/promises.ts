/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import assert from "assert";
import { Lazy } from "./lazy";

/**
 * A deferred creates a promise and the ability to resolve or reject it
 */
export class Deferred<T> {
    private readonly p: Promise<T>;
    private res: ((value?: T | PromiseLike<T>) => void) | undefined;
    private rej: ((reason?: any) => void) | undefined;
    private completed: boolean = false;

    constructor() {
        this.p = new Promise<T>((resolve, reject) => {
            this.res = resolve;
            this.rej = reject;
        });
    }
    /**
     * Returns whether the underlying promise has been completed
     */
    public get isCompleted() {
        return this.completed;
    }

    /**
     * Retrieves the underlying promise for the deferred
     *
     * @returns the underlying promise
     */
    public get promise(): Promise<T> {
        return this.p;
    }

    /**
     * Resolves the promise
     *
     * @param value - the value to resolve the promise with
     */
    public resolve(value?: T | PromiseLike<T>) {
        if (this.res !== undefined) {
            this.completed = true;
            this.res(value);
        }
    }

    /**
     * Rejects the promise
     *
     * @param value - the value to reject the promise with
     */
    public reject(error: any) {
        if (this.rej !== undefined) {
            this.completed = true;
            this.rej(error);
        }
    }
}

/**
 * Helper function that asserts that the given promise only resolves
 */
// eslint-disable-next-line @typescript-eslint/promise-function-async
export function assertNotRejected<T>(promise: Promise<T>): Promise<T> {
    // Assert that the given promise only resolves
    promise.catch((error) => {
        assert.ok(false);
    });

    return promise;
}

/**
 * A lazy evaluated promise. The execute function is delayed until
 * the promise is used, e.g. await, then, catch ...
 * The execute function is only called once.
 * All calls are then proxied to the promise returned by the execute method.
 */
export class LazyPromise<T> implements Promise<T> {
    public get [Symbol.toStringTag](): string {
        return this.promise.value[Symbol.toStringTag];
    }

    private readonly promise: Lazy<Promise<T>>;

    constructor(execute: () => Promise<T>) {
        this.promise = new Lazy(async ()=> execute());
     }

    public async then<TResult1 = T, TResult2 = never>(
        onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null | undefined,
        onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null | undefined):
        Promise<TResult1 | TResult2> {
        return this.promise.value.then<TResult1, TResult2>(...arguments);
    }

    public async catch<TResult = never>(
        onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null | undefined):
        Promise<T | TResult> {
        return this.promise.value.catch<TResult>(...arguments);
    }

    public async finally(onfinally?: (() => void) | null | undefined): Promise<T> {
        return this.promise.value.finally(...arguments);
    }
}
