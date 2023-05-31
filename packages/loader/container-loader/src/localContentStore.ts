/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { IResolvedUrl } from "@fluidframework/driver-definitions";
import { ensureFluidResolvedUrl } from "@fluidframework/driver-utils";
import { TreeEntry } from "@fluidframework/protocol-definitions";

export class InMemLocalBlobStorageFactory implements LocalContentStorageFactory {
	public static readonly stores = new Map<string, LocalContentStorage>();
	async createDetached(detachedId: string): Promise<LocalContentStorage> {
		let store = InMemLocalBlobStorageFactory.stores.get(detachedId);

		if (store === undefined) {
			store = new InMemLocalBlobStorage();
			InMemLocalBlobStorageFactory.stores.set(detachedId, store);
		}
		return store;
	}
	async createAttached(resolvedUrl: IResolvedUrl): Promise<LocalContentStorage> {
		ensureFluidResolvedUrl(resolvedUrl);
		let store = InMemLocalBlobStorageFactory.stores.get(resolvedUrl.url);

		if (store === undefined) {
			store = new InMemLocalBlobStorage();
			InMemLocalBlobStorageFactory.stores.set(resolvedUrl.url, store);
		}
		return store;
	}
}

class InMemLocalBlobStorage implements LocalContentStorage {
	async getData(entry: ContentEntry<ContentSpec>): Promise<any> {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		return this.blobs.find((e) => e.iid === entry.iid)?.data;
	}
	async store<S extends ContentSpec>(spec: S): Promise<ContentEntry<S>> {
		const entry = {
			...spec,
			iid: ++this.iid,
		};
		this.blobs.push(entry);
		return entry;
	}
	async update(entry: ContentEntry<LocalContentSpec & RemoteContentSpec>): Promise<void> {
		const existing = this.blobs.find((e) => e.iid === entry.iid);
		if (existing !== undefined) {
			existing.remoteId = entry.remoteId;
		}
	}
	async getEntries(
		query: ContentQuery,
	): Promise<ContentEntry<LocalContentSpec | RemoteContentSpec>[]> {
		return this.blobs.filter((e) => matches(query, e));
	}
	async release(query: ContentQuery): Promise<void> {
		let i = 0;
		while (i < this.blobs.length) {
			if (matches(query, this.blobs[i])) {
				this.blobs.splice(i, 1);
			} else {
				i++;
			}
		}
	}
	private iid = 0;
	private readonly blobs: ContentData[] = [];

	async attach?(resolvedUrl: IResolvedUrl) {
		ensureFluidResolvedUrl(resolvedUrl);

		InMemLocalBlobStorageFactory.stores.set(resolvedUrl.url, this);
	}
}

function matches(query: ContentQuery, e: ContentEntry) {
	return (
		(query.iid?.start === undefined || e.iid >= query.iid.start) &&
		(query.iid?.end === undefined || e.iid >= query.iid.end) &&
		(query.localOrRemoteIds === undefined ||
			(e.localId !== undefined && query.localOrRemoteIds.includes(e.localId)) ||
			(e.remoteId !== undefined && query.localOrRemoteIds.includes(e.remoteId))) &&
		(query.types === undefined || query.types.includes(e.type))
	);
}

export interface LocalContentStorageFactory {
	createDetached(detachedId: string): Promise<LocalContentStorage>;
	createAttached(resolvedUrl: IResolvedUrl): Promise<LocalContentStorage>;
}

export interface ContentSpec {
	type: "op" | TreeEntry.Attachment | TreeEntry.Blob | TreeEntry.Tree;
	data: any;
}
export type LocalContentSpec = ContentSpec & { localId: string };
export type RemoteContentSpec = ContentSpec & { remoteId: string };
export type AnyContentSpec = ContentSpec & Partial<LocalContentSpec & RemoteContentSpec>;
export type ContentData<S extends ContentSpec = AnyContentSpec> = S & { iid: number };
export type ContentEntry<S extends ContentSpec = AnyContentSpec> = Omit<ContentData<S>, "data">;
export interface ContentQuery {
	types?: ContentSpec["type"][];
	localOrRemoteIds?: string[];
	iid?: { start?: number; end?: number };
}

export interface LocalContentStorage {
	store<S extends LocalContentSpec | RemoteContentSpec>(spec: S): Promise<ContentEntry<S>>;
	update(entry: ContentEntry): Promise<void>;
	getEntries(query: ContentQuery): Promise<ContentEntry[]>;
	getData(entry: ContentEntry): Promise<any>;
	release(query: ContentQuery): Promise<void>;
	attach?(resolvedUrl: IResolvedUrl);
}
