/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { assert } from "@fluidframework/core-utils/internal";
import { IChannelStorageService } from "@fluidframework/datastore-definitions/internal";
import {
	IDocumentStorageService,
	ISnapshotTree,
} from "@fluidframework/driver-definitions/internal";
import { getNormalizedObjectStoragePathParts } from "@fluidframework/runtime-utils/internal";
import { ITelemetryLoggerExt } from "@fluidframework/telemetry-utils/internal";

export class ChannelStorageService implements IChannelStorageService {
	private static flattenTree(
		base: string,
		tree: ISnapshotTree,
		results: { [path: string]: string },
	) {
		for (const [path, subtree] of Object.entries(tree.trees)) {
			ChannelStorageService.flattenTree(`${base}${path}/`, subtree, results);
		}

		for (const [blobName, blobId] of Object.entries(tree.blobs)) {
			results[`${base}${blobName}`] = blobId;
		}
	}

	private flattenedTree: { [path: string]: string } | undefined;
	private tree: ISnapshotTree | undefined;
	private extraBlobs?: Map<string, ArrayBufferLike>;

	constructor(
		tree: ISnapshotTree | undefined,
		private readonly storage: Pick<IDocumentStorageService, "readBlob">,
		private readonly logger: ITelemetryLoggerExt,
		extraBlobs?: Map<string, ArrayBufferLike>,
	) {
		// Create a map from paths to blobs
		this.registerSnapshot(tree, extraBlobs);
	}

	public registerSnapshot(
		tree: ISnapshotTree | undefined,
		extraBlobs?: Map<string, ArrayBufferLike>,
	) {
		if (tree !== undefined && this.tree === undefined) {
			this.flattenedTree = {};
			this.tree = tree;
			this.extraBlobs = new Map(extraBlobs);
			ChannelStorageService.flattenTree("", tree, this.flattenedTree);
		}
	}

	public async contains(path: string): Promise<boolean> {
		return this.flattenedTree?.[path] !== undefined;
	}

	public async readBlob(path: string): Promise<ArrayBufferLike> {
		const id = this.getIdForPath(path);
		assert(id !== undefined, 0x9d7 /* id is undefined in ChannelStorageService.readBlob() */);
		const blob = this.extraBlobs !== undefined ? this.extraBlobs.get(id) : undefined;

		if (blob !== undefined) {
			return blob;
		}
		const blobP = this.storage.readBlob(id);
		blobP.catch((error) =>
			this.logger.sendErrorEvent({ eventName: "ChannelStorageBlobError" }, error),
		);

		return blobP;
	}

	public async list(path: string): Promise<string[]> {
		let tree = this.tree;
		const pathParts = getNormalizedObjectStoragePathParts(path);
		while (tree !== undefined && pathParts.length > 0) {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const part = pathParts.shift()!;
			tree = tree.trees[part];
		}
		if (tree === undefined || pathParts.length !== 0) {
			throw new Error("path does not exist");
		}

		return Object.keys(tree?.blobs ?? {});
	}

	private getIdForPath(path: string): string | undefined {
		return this.flattenedTree?.[path];
	}
}
