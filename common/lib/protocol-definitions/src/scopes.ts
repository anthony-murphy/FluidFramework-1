/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/**
 * @deprecated - use ScopeTypes instead
 */
export enum ScopeType {
    DocRead = "doc:read",
    DocWrite = "doc:write",
    SummaryWrite = "summary:write",
}

export namespace ScopeTypes {
    export type DocRead = "doc:read";
    export type DocWrite = "doc:write";
    export type SummaryWrite = "summary:write";

    export interface Const{
        DocRead: DocRead;
        DocWrite: DocWrite;
        SummaryWrite: SummaryWrite;
    }
}

export type ScopeTypes =
    ScopeTypes.DocRead | ScopeTypes.DocWrite | ScopeTypes.SummaryWrite;
