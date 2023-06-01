/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { IResolvedUrl } from "@fluidframework/driver-definitions";
import { ensureFluidResolvedUrl } from "@fluidframework/driver-utils";
import { ISequencedDocumentMessage, ISnapshotTree } from "@fluidframework/protocol-definitions";

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
		const existing = this.localContents.findIndex((e) =>
			matches(e, { localId: entry.localId }),
		);
		if (existing > 0) {
			this.localContents[existing] = { ...this.localContents[existing], ...entry };
			return { ...this.localContents[existing] };
		}
		return undefined;
	}

	async getData(...entries: ContentQuery[]): Promise<ContentData<ContentEntry>[]> {
		return this.localContents.filter((e) => matches(e, ...entries));
	}
	async store<S extends ContentSpec>(spec: ContentData<S>): Promise<ContentEntry<S>> {
		const entry = {
			...spec,
			iid: ++this.iid,
		};
		this.localContents.push(entry);
		return { ...entry };
	}

	async getEntries(...queries: ContentQuery[]): Promise<ContentEntry[]> {
		return this.localContents.filter((e) => matches(e, ...queries)).map((e) => ({ ...e }));
	}
	async remove(query: ContentQuery): Promise<void> {
		let i = 0;
		while (i < this.localContents.length) {
			if (matches(this.localContents[i], query)) {
				this.localContents.splice(i, 1);
			} else {
				i++;
			}
		}
	}
	private iid = 0;
	private readonly localContents: (ContentData & ContentEntry)[] = [];

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
	getData(...queries: ContentQuery[]): Promise<ContentEntry<ContentData>[]>;
	remove(...queries: ContentQuery[]): Promise<void>;
	attach?(resolvedUrl: IResolvedUrl): Promise<void>;
}

export class LocalContentStorageAdapter {
	constructor(private readonly localContentStorage: LocalContentStorage) {}

	async storeBaseSnapshot(data: ISnapshotTree, sequenceNumber: number) {
		return this.localContentStorage
			.store({
				type: "baseSnapshot",
				sequenceNumber,
				data,
			})
			.then(async (e) => {
				await this.localContentStorage.remove(
					{
						type: "baseSnapshot",
						iidRange: { end: e.iid - 1 },
					},
					{ type: "op", sequenceNumberRange: { end: sequenceNumber } },
				);
			});
	}

	async getBaseSnapshotData() {
		return this.getLatestData({
			type: "baseSnapshot",
		}).then((e) => e?.data as ISnapshotTree | undefined);
	}

	async getLocalBlobEntries(): Promise<ContentEntry<LocalContentSpec>[]> {
		return this.localContentStorage.getEntries({
			type: "blob",
			remoteId: undefined,
		}) as Promise<ContentEntry<LocalContentSpec>[]>;
	}

	async getAllBlobEntries(): Promise<ContentEntry[]> {
		return this.localContentStorage.getEntries({
			type: "blob",
		});
	}
	async getBlobData(localOrRemoteId: string): Promise<ArrayBufferLike | undefined> {
		return this.getLatestData(
			{
				type: "blob",
				localId: localOrRemoteId,
			},
			{
				type: "blob",
				remoteId: localOrRemoteId,
			},
		).then((e) => e?.data as ArrayBufferLike | undefined);
	}

	async storeLocalBlob(data: ArrayBufferLike, localId: string) {
		return this.localContentStorage.store({
			data,
			localId,
			type: "blob",
		});
	}
	async updateLocalBlob(localId: string, remoteId: string) {
		return this.localContentStorage.update({
			remoteId,
			localId,
			type: "blob",
		});
	}

	private async getLatestData(
		...queries: ContentQuery[]
	): Promise<ContentData<ContentData> | undefined> {
		return this.localContentStorage.getData(...queries).then(async (entries) => {
			if (entries.length > 1) {
				entries.sort((a, b) => a.iid - b.iid);
				await this.localContentStorage.remove({
					iidRange: { end: entries[0].iid - 1 },
				});
			}
			return entries[0];
		});
	}

	async getSequenceMessages(sequenceStart: number) {
		return this.localContentStorage
			.getEntries({
				type: "op",
				sequenceNumberRange: { start: sequenceStart + 1 },
			})
			.then(async (e) => {
				const datas = await this.localContentStorage.getData(...e);
				return datas.map((d) => d.data as ISequencedDocumentMessage);
			});
	}
	async getLocalMessages() {
		return this.localContentStorage
			.getEntries({
				type: "op",
				sequenceNumber: undefined,
			})
			.then(async (e) => {
				const datas = await this.localContentStorage.getData(...e);
				return datas.map(
					(d) =>
						d.data as Omit<
							ISequencedDocumentMessage,
							"sequenceNumber" | "term" | "minimumSequenceNumber" | "timestamp"
						>,
				);
			});
	}

	async storeLocalMessage(
		data: Omit<
			ISequencedDocumentMessage,
			"sequenceNumber" | "term" | "minimumSequenceNumber" | "timestamp"
		>,
	) {
		return this.localContentStorage.store({
			type: "op",
			data,
			localId: `${data.clientId}-${data.clientSequenceNumber.toString()}`,
		});
	}

	async storeSequencedMessage(data: ISequencedDocumentMessage, local: boolean) {
		return local
			? this.localContentStorage
					.update({
						type: "op",
						localId: `${data.clientId}-${data.clientSequenceNumber.toString()}`,
						sequenceNumber: data.sequenceNumber,
						data,
					})
					.then(async (e) => {
						if (e !== undefined) {
							await this.localContentStorage.remove({
								type: "op",
								sequenceNumber: undefined,
								iidRange: { end: e.iid - 1 },
							});
						}
						return e;
					})
			: this.localContentStorage.store({
					type: "op",
					data,
					sequenceNumber: data.sequenceNumber,
			  });
	}

	attach(resolveUrl: IResolvedUrl) {
		return this.localContentStorage.attach?.(resolveUrl);
	}
}
