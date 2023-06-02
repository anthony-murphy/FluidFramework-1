/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { ISubmittedDocumentMessage } from "@fluidframework/container-definitions";
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
	async update<S extends RemoteIdContentSpec | SequencedContentSpec>(
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

	async getData(...disjunctiveQueries: ContentQuery[]): Promise<ContentData<ContentEntry>[]> {
		return this.localContents.filter((e) => matches(e, ...disjunctiveQueries));
	}
	async store<S extends ContentSpec>(spec: ContentData<S>): Promise<ContentEntry<S>> {
		const entry = {
			...spec,
			iid: ++this.iid,
		};
		this.localContents.push(entry);
		return { ...entry };
	}

	async getEntries(...disjunctiveQueries: ContentQuery[]): Promise<ContentEntry[]> {
		return this.localContents
			.filter((e) => matches(e, ...disjunctiveQueries))
			.map((e) => ({ ...e }));
	}
	async remove(...disjunctiveQueries: ContentQuery[]): Promise<void> {
		this.localContents.splice(0, this.localContents.length).forEach((e) => {
			if (!matches(e, ...disjunctiveQueries)) {
				this.localContents.push(e);
			}
		});
	}
	private iid = 0;
	private readonly localContents: ContentEntry<ContentData>[] = [];

	async attach?(resolvedUrl: IResolvedUrl) {
		ensureFluidResolvedUrl(resolvedUrl);

		InMemLocalBlobStorageFactory.stores.set(resolvedUrl.url, this);
	}
}

function matches(e: ContentEntry, ...disjunctiveQueries: ContentQuery[]) {
	return disjunctiveQueries.some(
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
export type RemoteIdContentSpec = ContentSpec & { remoteId: string };
export type SequencedContentSpec = ContentSpec & { sequenceNumber: number };
export type AnyContentSpec = ContentSpec &
	Partial<LocalContentSpec & RemoteIdContentSpec & SequencedContentSpec>;
export type ContentData<S extends ContentSpec = AnyContentSpec> = S & { data: unknown };
export type ContentEntry<S extends ContentSpec = AnyContentSpec> = S & { iid: number };
export type ContentQuery = Partial<
	ContentEntry & Record<"sequenceNumberRange" | "iidRange", { start?: number; end?: number }>
>;

export interface LocalContentStorage {
	store<S extends LocalContentSpec | RemoteIdContentSpec | SequencedContentSpec>(
		spec: ContentData<S>,
	): Promise<ContentEntry<S>>;
	update<S extends RemoteIdContentSpec | SequencedContentSpec>(
		entry: LocalContentSpec & S,
	): Promise<ContentEntry | undefined>;
	getEntries(...disjunctiveQueries: ContentQuery[]): Promise<ContentEntry[]>;
	getData(...disjunctiveQueries: ContentQuery[]): Promise<ContentEntry<ContentData>[]>;
	remove(...disjunctiveQueries: ContentQuery[]): Promise<void>;
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
						sequenceNumberRange: { end: sequenceNumber - 1 },
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
		...disjunctiveQueries: ContentQuery[]
	): Promise<ContentData<ContentData> | undefined> {
		return this.localContentStorage.getData(...disjunctiveQueries).then(async (entries) => {
			if (entries.length > 1) {
				entries.sort((a, b) => a.iid - b.iid);
				await this.localContentStorage.remove({
					iidRange: { end: entries[0].iid - 1 },
				});
			}
			return entries[0];
		});
	}

	async getSequenceMessages(sequenceStart: number, trimBelowStart: boolean) {
		return this.localContentStorage
			.getEntries({
				type: "op",
				sequenceNumberRange: { start: sequenceStart + 1 },
			})
			.then(async (e) => {
				if (trimBelowStart) {
					await this.localContentStorage.remove({
						type: "op",
						sequenceNumberRange: { end: sequenceStart - 1 },
					});
				}
				return e;
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
				return datas.map((d) => d.data as ISubmittedDocumentMessage);
			});
	}

	async storeLocalMessage(data: ISubmittedDocumentMessage) {
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
