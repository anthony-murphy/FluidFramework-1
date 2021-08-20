/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

export type SummaryObject = ISummaryTree | ISummaryBlob | ISummaryHandle | ISummaryAttachment;

export type SummaryTree = ISummaryTree | ISummaryHandle;

export interface ISummaryAuthor {
    name: string;
    email: string;
    // ISO 8601 format: YYYY-MM-DDTHH:MM:SSZ
    date: string;
}

export interface ISummaryCommitter {
    name: string;
    email: string;
    // ISO 8601 format: YYYY-MM-DDTHH:MM:SSZ
    date: string;
}

export namespace SummaryType{
    export type Tree = 1;
    /** @deprecated - use SummaryType.Const */
    export const Tree: Tree = 1 as const;

    export type Blob = 2;
    /** @deprecated - use SummaryType.Const */
    export const Blob: Blob = 2 as const;

    export type Handle = 3;
    /** @deprecated - use SummaryType.Const */
    export const Handle: Handle = 3 as const;

    export type Attachment = 4;
    /** @deprecated - use SummaryType.Const */
    export const Attachment: Attachment = 4 as const;

    export interface Const{
        readonly Tree: Tree;
        readonly Blob: Blob;
        readonly Handle: Handle;
        readonly Attachment: Attachment;
    }
}
export type SummaryType = SummaryType.Tree | SummaryType.Blob | SummaryType.Handle | SummaryType.Attachment;

export type SummaryTypeNoHandle = SummaryType.Tree | SummaryType.Blob | SummaryType.Attachment;

export interface ISummaryHandle {
    type: SummaryType.Handle;

    // No handles, all other SummaryType are Ok
    handleType: SummaryTypeNoHandle;

    // Stored handle reference
    handle: string;
}

export interface ISummaryBlob {
    type: SummaryType.Blob;
    content: string | Uint8Array;
}

export interface ISummaryAttachment {
    type: SummaryType.Attachment;
    id: string;
}

export interface ISummaryTree {
    type: SummaryType.Tree;

    // TODO type I can infer from SummaryObject. File mode I may want to directly specify so have symlink+exec access
    tree: { [path: string]: SummaryObject };

    // Indicates that this tree entry is unreferenced. If this is not present, the tree entry is considered referenced.
    unreferenced?: true;
}
