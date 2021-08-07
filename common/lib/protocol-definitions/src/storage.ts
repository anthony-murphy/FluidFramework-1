/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

export interface IDocumentAttributes {
    /**
     * Name of the branch that created the snapshot
     */
    branch: string;

    /**
     * Sequence number at which the snapshot was taken
     */
    sequenceNumber: number;

    /**
     * Minimum sequence number when the snapshot was taken
     */
    minimumSequenceNumber: number;

    /**
     * Term number at which the snapshot was taken
     */
    term: number | undefined;
}

/**
 * @deprecated - Use FileModes instead
 */
export enum FileMode {
    File = "100644",
    Executable = "100755",
    Directory = "040000",
    Commit = "160000",
    Symlink = "120000",
}

export namespace FileModes {
    export type File = "100644";
    export type Executable = "100755";
    export type Directory = "040000";
    export type Commit = "160000";
    export type Symlink = "120000";
}

export type FileModes =
    `${FileMode}` | FileModes.Commit | FileModes.Directory | FileModes.Executable | FileModes.File | FileModes.Symlink;

/**
 * Raw blob stored within the tree
 */
export interface IBlob {
    // Contents of the blob
    contents: string;

    // The encoding of the contents string (utf-8 or base64)
    encoding: string;
}

export interface IAttachment {
    id: string;
}

export interface ICreateBlobResponse {
    id: string;
    url: string;
}

/**
 * A tree entry wraps a path with a type of node
 */
export type ITreeEntry = {
    // Path to the object
    path: string;
    // The file mode; one of 100644 for file (blob), 100755 for executable (blob), 040000 for subdirectory (tree),
    // 160000 for submodule (commit), or 120000 for a blob that specifies the path of a symlink
    mode: FileMode | FileModes;
} & (
{
    type: TreeEntry.Blob | TreeEntryTypes.Blob;
    value: IBlob;
} | {
    type: TreeEntry.Commit | TreeEntryTypes.Commit;
    value: string;
} | {
    type: TreeEntry.Tree | TreeEntryTypes.Tree;
    value: ITree;
} | {
    type: TreeEntry.Attachment | TreeEntryTypes.Attachment;
    value: IAttachment;
});

/**
 * Type of entries that can be stored in a tree
 * @deprecated - use TreeEntryTypes instead
 */
export enum TreeEntry {
    Blob = "Blob",
    Commit = "Commit",
    Tree = "Tree",
    Attachment = "Attachment",
}

export namespace TreeEntryTypes{
    export type Blob = "Blob";
    export type Commit = "Commit";
    export type Tree = "Tree";
    export type Attachment = "Attachment";
}

export type TreeEntryTypes =
    `${TreeEntry}` | TreeEntryTypes.Blob | TreeEntryTypes.Commit | TreeEntryTypes.Tree | TreeEntryTypes.Attachment;

export interface ITree {
    entries: ITreeEntry[];
    // Unique ID representing all entries in the tree. Can be used to optimize snapshotting in the case
    // it is known that the ITree has already been created and stored
    id?: string;
    // Indicates that this tree is unreferenced. If this is not present, the tree is considered referenced.
    unreferenced?: true;
}

export interface ISnapshotTree {
    id? : string;
    blobs: { [path: string]: string };
    // TODO: Commits should be removed from here to ISnapshotTreeEx once ODSP snapshots move away from commits
    commits: { [path: string]: string };
    trees: { [path: string]: ISnapshotTree };
    // Indicates that this tree is unreferenced. If this is not present, the tree is considered referenced.
    unreferenced?: true;
}

export interface ISnapshotTreeEx extends ISnapshotTree {
    id: string;
    trees: { [path: string]: ISnapshotTreeEx };
}

/**
 * Represents a version of the snapshot of a data store
 */
export interface IVersion {
    // Version ID
    id: string;

    // Tree ID for this version of the snapshot
    treeId: string;

    // Time when snapshot was generated.
    // ISO 8601 format: YYYY-MM-DDTHH:MM:SSZ
    date?: string;
}
