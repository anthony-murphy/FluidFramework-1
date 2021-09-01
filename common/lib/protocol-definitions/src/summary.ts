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
    export type Blob = 2;
    export type Handle = 3;
    export type Attachment = 4;

    /**
     * Use to create a const object
     * to access values at runtime:
     * https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-4.html#const-assertions
     * ```
     * const summaryTypes: SummaryType.Const={
     *  Tree: 1,
     *  Blob: 2,
     *  Handle: 3,
     *  Attachment: 4,
     * } as const;
     * ```
     */
    export interface Const{
        Tree: Tree,
        Blob: Blob,
        Handle: Handle,
        Attachment: Attachment,
    }

    /**
     * @deprecated - constants will be removed from this package. Use @see Const instead.
     */
    export const Tree: Tree = 1;
    /**
     * @deprecated - constants will be removed from this package. Use @see Const instead.
     */
    export const Blob: Blob = 2;
    /**
     * @deprecated - constants will be removed from this package. Use @see Const instead.
     */
    export const Handle: Handle = 3;
    /**
     * @deprecated - constants will be removed from this package. Use @see Const instead.
     */
    export const Attachment: Attachment = 4;
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
