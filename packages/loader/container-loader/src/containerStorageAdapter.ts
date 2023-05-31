/* eslint-disable @typescript-eslint/no-non-null-assertion */
/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { IDisposable, ITelemetryLogger } from "@fluidframework/common-definitions";
import { assert, stringToBuffer } from "@fluidframework/common-utils";
import { ISnapshotTreeWithBlobContents } from "@fluidframework/container-definitions";
import {
	FetchSource,
	IDocumentService,
	IDocumentStorageService,
	IDocumentStorageServicePolicies,
	ISummaryContext,
} from "@fluidframework/driver-definitions";
import {
	ICreateBlobResponse,
	ISnapshotTree,
	ISummaryHandle,
	ISummaryTree,
	IVersion,
	TreeEntry,
} from "@fluidframework/protocol-definitions";
import { ProtocolTreeStorageService } from "./protocolTreeDocumentStorageService";
import { RetriableDocumentStorageService } from "./retriableDocumentStorageService";
import { ContentEntry, LocalContentStorage } from "./localContentStore";

/**
 * This class wraps the actual storage and make sure no wrong apis are called according to
 * container attach state.
 */
export class ContainerStorageAdapter implements IDocumentStorageService, IDisposable {
	private _storageService?: IDocumentStorageService & Partial<IDisposable>;

	private _summarizeProtocolTree: boolean | undefined;
	/**
	 * Whether the adapter will enforce sending combined summary trees.
	 */
	public get summarizeProtocolTree() {
		return this._summarizeProtocolTree === true;
	}

	/**
	 * An adapter that ensures we're using detachedBlobStorage up until we connect to a real service, and then
	 * after connecting to a real service augments it with retry and combined summary tree enforcement.
	 * @param localBlobStorage - The detached blob storage to use up until we connect to a real service
	 * @param logger - Telemetry logger
	 * @param addProtocolSummaryIfMissing - a callback to permit the container to inspect the summary we're about to
	 * upload, and fix it up with a protocol tree if needed
	 * @param forceEnableSummarizeProtocolTree - Enforce uploading a protocol summary regardless of the service's policy
	 */
	public constructor(
		private readonly localBlobStorage: LocalContentStorage,
		private readonly logger: ITelemetryLogger,
		/**
		 * ArrayBufferLikes or utf8 encoded strings, containing blobs from a snapshot
		 */
		private readonly blobContents: { [id: string]: ArrayBufferLike | string } = {},
		private readonly addProtocolSummaryIfMissing: (summaryTree: ISummaryTree) => ISummaryTree,
		forceEnableSummarizeProtocolTree: boolean | undefined,
	) {
		this._summarizeProtocolTree = forceEnableSummarizeProtocolTree;
	}

	disposed: boolean = false;
	dispose(error?: Error): void {
		this._storageService?.dispose?.(error);
		this.disposed = true;
	}

	public async connectToService(service: IDocumentService): Promise<void> {
		if (this._storageService !== undefined) {
			return;
		}

		const storageService = await service.connectToStorage();
		const retriableStorage = (this._storageService = new RetriableDocumentStorageService(
			storageService,
			this.logger,
		));

		this._summarizeProtocolTree =
			this._summarizeProtocolTree ?? service.policies?.summarizeProtocolTree;
		if (this.summarizeProtocolTree) {
			this.logger.sendTelemetryEvent({ eventName: "summarizeProtocolTreeEnabled" });
			this._storageService = new ProtocolTreeStorageService(
				retriableStorage,
				this.addProtocolSummaryIfMissing,
			);
		}

		// ensure we did not lose that policy in the process of wrapping
		assert(
			storageService.policies?.minBlobSize === this._storageService.policies?.minBlobSize,
			0x0e0 /* "lost minBlobSize policy" */,
		);
	}

	public loadSnapshotForRehydratingContainer(snapshotTree: ISnapshotTreeWithBlobContents) {
		this.getBlobContents(snapshotTree);
	}

	private getBlobContents(snapshotTree: ISnapshotTreeWithBlobContents) {
		for (const [id, value] of Object.entries(snapshotTree.blobsContents)) {
			this.blobContents[id] = value;
		}
		for (const [_, tree] of Object.entries(snapshotTree.trees)) {
			this.getBlobContents(tree);
		}
	}

	public get policies(): IDocumentStorageServicePolicies | undefined {
		// back-compat 0.40 containerRuntime requests policies even in detached container if storage is present
		// and storage is always present in >=0.41.
		try {
			return this._storageService?.policies;
		} catch (e) {}
		return undefined;
	}

	public get repositoryUrl(): string {
		return this._storageService?.repositoryUrl ?? "";
	}

	public async getSnapshotTree(
		version?: IVersion,
		scenarioName?: string,
	): Promise<ISnapshotTree | null> {
		return this._storageService!.getSnapshotTree(version, scenarioName);
	}

	public async readBlob(id: string): Promise<ArrayBufferLike> {
		const maybeBlob = this.blobContents[id];
		if (maybeBlob !== undefined) {
			if (typeof maybeBlob === "string") {
				const blob = stringToBuffer(maybeBlob, "utf8");
				return blob;
			}
			return maybeBlob;
		}
		const maybeEntries = await this.localBlobStorage.getEntries({ localOrRemoteIds: [id] });
		if (maybeEntries.length === 1) {
			return this.localBlobStorage.getData(maybeEntries[0]) as Promise<ArrayBufferLike>;
		}
		return this._storageService!.readBlob(id);
	}

	public async getVersions(
		versionId: string | null,
		count: number,
		scenarioName?: string,
		fetchSource?: FetchSource,
	): Promise<IVersion[]> {
		return this._storageService!.getVersions(versionId, count, scenarioName, fetchSource);
	}

	public async uploadSummaryWithContext(
		summary: ISummaryTree,
		context: ISummaryContext,
	): Promise<string> {
		return this._storageService!.uploadSummaryWithContext(summary, context);
	}

	public async downloadSummary(handle: ISummaryHandle): Promise<ISummaryTree> {
		return this._storageService!.downloadSummary(handle);
	}

	public async createBlob(
		data: ArrayBufferLike,
		context: { localId: string },
	): Promise<ICreateBlobResponse> {
		const localId = context.localId;
		const localEntryP = this.localBlobStorage.store({
			data,
			localId: context.localId,
			type: TreeEntry.Attachment,
		});
		if (this._storageService) {
			const resp = await this._storageService.createBlob(data, context);
			const entry: ContentEntry = await localEntryP;
			entry.remoteId = resp.id;
			await this.localBlobStorage.update(entry);
			return resp;
		} else {
			await localEntryP;
			return { id: localId };
		}
	}
}
