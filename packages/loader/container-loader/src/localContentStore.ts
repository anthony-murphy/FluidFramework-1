/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { IResolvedUrl } from "@fluidframework/driver-definitions";
import { ensureFluidResolvedUrl } from "@fluidframework/driver-utils";

export class InMemLocalBlobStorageFactory implements LocalContentStorageFactory {
	public static readonly stores = new Map<string, LocalContentStorage>();
	async createDetached(detachedId: string): Promise<LocalContentStorage> {
		let store = InMemLocalBlobStorageFactory.stores.get(detachedId);

		if (store === undefined) {
			store = new InMemLocalContentStorage();
			InMemLocalBlobStorageFactory.stores.set(detachedId, store);
		}
		return store;
	}
	async createAttached(resolvedUrl: IResolvedUrl): Promise<LocalContentStorage> {
		ensureFluidResolvedUrl(resolvedUrl);
		let store = InMemLocalBlobStorageFactory.stores.get(resolvedUrl.url);

		if (store === undefined) {
			store = new InMemLocalContentStorage();
			InMemLocalBlobStorageFactory.stores.set(resolvedUrl.url, store);
		}
		return store;
	}
}

class InMemLocalContentStorage implements LocalContentStorage {
	async update<S extends RemoteContentSpec | SequencedContentSpec>(
		entry: LocalContentSpec & S,
	): Promise<ContentEntry | undefined> {
		const existing = this.blobs.findIndex((e) => matches(e, { localId: entry.localId }));
		if (existing > 0) {
			this.blobs[existing] = { ...this.blobs[existing], ...entry };
		}
		return { ...this.blobs[existing] };
	}

	async getData(entry: ContentEntry<ContentSpec>): Promise<unknown> {
		return this.blobs.find((e) => e.iid === entry.iid)?.data;
	}
	async store<S extends ContentSpec>(spec: ContentData<S>): Promise<ContentEntry<S>> {
		const entry = {
			...spec,
			iid: ++this.iid,
		};
		this.blobs.push(entry);
		return { ...entry };
	}

	async getEntries(...queries: ContentQuery[]): Promise<ContentEntry[]> {
		return this.blobs.filter((e) => matches(e, ...queries)).map((e) => ({ ...e }));
	}
	async remove(query: ContentQuery): Promise<void> {
		let i = 0;
		while (i < this.blobs.length) {
			if (matches(this.blobs[i], query)) {
				this.blobs.splice(i, 1);
			} else {
				i++;
			}
		}
	}
	private iid = 0;
	private readonly blobs: (ContentData & ContentEntry)[] = [];

	async attach?(resolvedUrl: IResolvedUrl) {
		ensureFluidResolvedUrl(resolvedUrl);

		InMemLocalBlobStorageFactory.stores.set(resolvedUrl.url, this);
	}
}

function matches(e: ContentEntry, ...queries: ContentQuery[]) {
	return queries.some(
		(query) =>
			(!("type" in query) || e.type === query.type) &&
			(!("localId" in query) || e.localId === query.localId) &&
			(!("sequenceNumber" in query) || e.sequenceNumber === query.sequenceNumber) &&
			(!("iid" in query) || e.iid === query.iid) &&
			(query.iidRange?.start === undefined || e.iid >= query.iidRange.start) &&
			(query.iidRange?.end === undefined || e.iid >= query.iidRange.end) &&
			(query.sequenceNumberRange?.start === undefined ||
				e.iid >= query.sequenceNumberRange.start) &&
			(query.sequenceNumberRange?.end === undefined ||
				e.iid >= query.sequenceNumberRange.end),
	);
}

export interface LocalContentStorageFactory {
	createDetached(detachedId: string): Promise<LocalContentStorage>;
	createAttached(resolvedUrl: IResolvedUrl): Promise<LocalContentStorage>;
}

export interface ContentSpec {
	type: "op" | "baseSnapshot" | "blob";
}
export type LocalContentSpec = ContentSpec & { localId: string };
export type RemoteContentSpec = ContentSpec & { remoteId: string };
export type SequencedContentSpec = ContentSpec & { sequenceNumber: number };
export type AnyContentSpec = ContentSpec &
	Partial<LocalContentSpec & RemoteContentSpec & SequencedContentSpec>;
export type ContentData<S extends ContentSpec = AnyContentSpec> = S & { data: unknown };
export type ContentEntry<S extends ContentSpec = AnyContentSpec> = S & { iid: number };
export type ContentQuery = Partial<
	ContentEntry & Record<"sequenceNumberRange" | "iidRange", { start?: number; end?: number }>
>;

export interface LocalContentStorage {
	store<S extends LocalContentSpec | RemoteContentSpec | SequencedContentSpec>(
		spec: ContentData<S>,
	): Promise<ContentEntry<S>>;
	update<S extends RemoteContentSpec | SequencedContentSpec>(
		entry: LocalContentSpec & S,
	): Promise<ContentEntry | undefined>;
	getEntries(...queries: ContentQuery[]): Promise<ContentEntry[]>;
	getData(entry: ContentEntry): Promise<unknown>;
	remove(...queries: ContentQuery[]): Promise<void>;
	attach?(resolvedUrl: IResolvedUrl);
}
