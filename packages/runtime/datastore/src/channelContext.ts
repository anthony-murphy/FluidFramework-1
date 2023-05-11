/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { ITelemetryLogger } from "@fluidframework/common-definitions";
import { IFluidHandle } from "@fluidframework/core-interfaces";
import {
	IChannel,
	IChannelAttributes,
	IChannelFactory,
	IFluidDataStoreRuntime,
} from "@fluidframework/datastore-definitions";
import { IDocumentStorageService } from "@fluidframework/driver-definitions";
import { ISequencedDocumentMessage, ISnapshotTree } from "@fluidframework/protocol-definitions";
import {
	IGarbageCollectionData,
	IExperimentalIncrementalSummaryContext,
	ISummarizeResult,
	ISummaryTreeWithStats,
	ITelemetryContext,
	IFluidDataStoreContext,
} from "@fluidframework/runtime-definitions";
import { addBlobToSummary } from "@fluidframework/runtime-utils";
import { DataCorruptionError } from "@fluidframework/container-utils";
import { readAndParse } from "@fluidframework/driver-utils";
import { TelemetryDataTag } from "@fluidframework/telemetry-utils";
import { assert } from "@fluidframework/common-utils";
import { ChannelStorageService } from "./channelStorageService";
import { ChannelDeltaConnection } from "./channelDeltaConnection";
import { ISharedObjectRegistry } from "./dataStoreRuntime";

export const attributesBlobKey = ".attributes";

export interface IChannelContext {
	getChannel(): Promise<IChannel>;

	setConnectionState(connected: boolean, clientId?: string);

	processOp(message: ISequencedDocumentMessage, local: boolean, localOpMetadata?: unknown): void;

	summarize(
		fullTree?: boolean,
		trackState?: boolean,
		telemetryContext?: ITelemetryContext,
	): Promise<ISummarizeResult>;

	reSubmit(content: any, localOpMetadata: unknown): void;

	applyStashedOp(content: any): unknown;

	rollback(message: any, localOpMetadata: unknown): void;

	/**
	 * Returns the data used for garbage collection. This includes a list of GC nodes that represent this context
	 * including any of its children. Each node has a set of outbound routes to other GC nodes in the document.
	 * @param fullGC - true to bypass optimizations and force full generation of GC data.
	 */
	getGCData(fullGC?: boolean): Promise<IGarbageCollectionData>;

	/**
	 * After GC has run, called to notify this context of routes that are used in it. These are used for the following:
	 * 1. To identify if this context is being referenced in the document or not.
	 * 2. To identify if this context or any of its children's used routes changed since last summary.
	 * 3. They are added to the summary generated by this context.
	 */
	updateUsedRoutes(usedRoutes: string[]): void;

	branchChannel(options: { process?: "remote" | "remote&Local" }): Promise<IChannel>;
}

export interface ChannelServiceEndpoints {
	deltaConnection: ChannelDeltaConnection;
	objectStorage: ChannelStorageService;
}

export function createChannelServiceEndpoints(
	connected: boolean,
	submitFn: (content: any, localOpMetadata: unknown) => void,
	dirtyFn: () => void,
	addedGCOutboundReferenceFn: (srcHandle: IFluidHandle, outboundHandle: IFluidHandle) => void,
	storageService: IDocumentStorageService,
	logger: ITelemetryLogger,
	tree?: ISnapshotTree,
	extraBlobs?: Map<string, ArrayBufferLike>,
): ChannelServiceEndpoints {
	const deltaConnection = new ChannelDeltaConnection(
		connected,
		(message, localOpMetadata) => submitFn(message, localOpMetadata),
		dirtyFn,
		addedGCOutboundReferenceFn,
	);
	const objectStorage = new ChannelStorageService(tree, storageService, logger, extraBlobs);

	return {
		deltaConnection,
		objectStorage,
	};
}

export function summarizeChannel(
	channel: IChannel,
	fullTree: boolean = false,
	trackState: boolean = false,
	telemetryContext?: ITelemetryContext,
): ISummaryTreeWithStats {
	const summarizeResult = channel.getAttachSummary(fullTree, trackState, telemetryContext);

	// Add the channel attributes to the returned result.
	addBlobToSummary(summarizeResult, attributesBlobKey, JSON.stringify(channel.attributes));
	return summarizeResult;
}

export async function summarizeChannelAsync(
	channel: IChannel,
	fullTree: boolean = false,
	trackState: boolean = false,
	telemetryContext?: ITelemetryContext,
	incrementalSummaryContext?: IExperimentalIncrementalSummaryContext,
): Promise<ISummaryTreeWithStats> {
	const summarizeResult = await channel.summarize(
		fullTree,
		trackState,
		telemetryContext,
		incrementalSummaryContext,
	);

	// Add the channel attributes to the returned result.
	addBlobToSummary(summarizeResult, attributesBlobKey, JSON.stringify(channel.attributes));
	return summarizeResult;
}

export async function loadChannelFactoryAndAttributes(
	dataStoreContext: IFluidDataStoreContext,
	services: ChannelServiceEndpoints,
	channelId: string,
	registry: ISharedObjectRegistry,
	attachMessageType?: string,
): Promise<{ factory: IChannelFactory; attributes: IChannelAttributes }> {
	let attributes: IChannelAttributes | undefined;
	if (await services.objectStorage.contains(attributesBlobKey)) {
		attributes = await readAndParse<IChannelAttributes | undefined>(
			services.objectStorage,
			attributesBlobKey,
		);
	}

	// This is a backward compatibility case where the attach message doesn't include attributes. They must
	// include attach message type.
	// Since old attach messages will not have attributes, we need to keep this as long as we support old attach
	// messages.
	const channelFactoryType = attributes ? attributes.type : attachMessageType;
	if (channelFactoryType === undefined) {
		throw new DataCorruptionError("channelTypeNotAvailable", {
			channelId: {
				value: channelId,
				tag: TelemetryDataTag.CodeArtifact,
			},
			dataStoreId: {
				value: dataStoreContext.id,
				tag: TelemetryDataTag.CodeArtifact,
			},
			dataStorePackagePath: dataStoreContext.packagePath.join("/"),
			channelFactoryType: attachMessageType,
		});
	}
	const factory = registry.get(channelFactoryType);
	if (factory === undefined) {
		// TODO: dataStoreId may require a different tag from PackageData #7488
		throw new DataCorruptionError("channelFactoryNotRegisteredForGivenType", {
			channelId: {
				value: channelId,
				tag: TelemetryDataTag.CodeArtifact,
			},
			dataStoreId: {
				value: dataStoreContext.id,
				tag: TelemetryDataTag.CodeArtifact,
			},
			dataStorePackagePath: dataStoreContext.packagePath.join("/"),
			channelFactoryType,
		});
	}
	// This is a backward compatibility case where the attach message doesn't include attributes. Get the attributes
	// from the factory.
	attributes = attributes ?? factory.attributes;
	return { factory, attributes };
}

export async function loadChannel(
	dataStoreRuntime: IFluidDataStoreRuntime,
	attributes: IChannelAttributes,
	factory: IChannelFactory,
	services: ChannelServiceEndpoints,
	logger: ITelemetryLogger,
	channelId: string,
): Promise<IChannel> {
	// Compare snapshot version to collaborative object version
	if (
		attributes.snapshotFormatVersion !== undefined &&
		attributes.snapshotFormatVersion !== factory.attributes.snapshotFormatVersion
	) {
		logger.sendTelemetryEvent({
			eventName: "ChannelAttributesVersionMismatch",
			channelType: { value: attributes.type, tag: TelemetryDataTag.CodeArtifact },
			channelSnapshotVersion: {
				value: `${attributes.snapshotFormatVersion}@${attributes.packageVersion}`,
				tag: TelemetryDataTag.CodeArtifact,
			},
			channelCodeVersion: {
				value: `${factory.attributes.snapshotFormatVersion}@${factory.attributes.packageVersion}`,
				tag: TelemetryDataTag.CodeArtifact,
			},
		});
	}

	return factory.load(dataStoreRuntime, channelId, services, attributes);
}

export async function branchChannel(
	options: { process?: "remote" | "remote&Local" },
	channel: IChannel,
	channelServices: ChannelServiceEndpoints,
	dataStoreRuntime: IFluidDataStoreRuntime,
	factory: IChannelFactory,
	logger: ITelemetryLogger,
) {
	const branchOps: { content: unknown; localOpMetadata: unknown }[] = [];
	const services: ChannelServiceEndpoints = {
		deltaConnection: ChannelDeltaConnection.clone(channelServices.deltaConnection, {
			submit: (content: unknown, localOpMetadata: unknown) =>
				branchOps.push({ content, localOpMetadata }),
			dirty: () => {},
			addedGCOutboundReference: () => {},
		}),
		objectStorage: channelServices.objectStorage,
	};

	if (factory.branch) {
		return {
			channel: await factory.branch(options, services, channel),
			services,
		};
	}

	const branch = {
		channel: await loadChannel(
			dataStoreRuntime,
			channel.attributes,
			factory,
			services,
			logger,
			channel.id,
		),
		services,
	};

	switch (options.process) {
		case "remote": {
			channelServices.deltaConnection.on("process", (msg) => {
				services.deltaConnection.process(msg, false, undefined);
			});
			break;
		}
		case "remote&Local": {
			const skipMd = { content: "SKIP", localOpMetadata: "SKIP" };
			const channelToBranchPending = new Map<
				unknown,
				{ content: unknown; localOpMetadata: unknown }
			>();

			let resbumitting = false;
			channelServices.deltaConnection.on("submit", (msg, imd) => {
				if (!resbumitting) {
					const md = services.deltaConnection.applyStashedOp(msg);
					const branchData = { content: msg, localOpMetadata: md };
					channelToBranchPending.set(imd, branchData);
					branchOps.push(branchData);
				}
			});
			channelServices.deltaConnection.on("pre-resubmit", () => {
				resbumitting = true;
				const newMds: unknown[] = [];
				// capture the new branch metadata if submitted
				const onResbumitSubmit = (_, newMd) => newMds.push(newMd);
				channelServices.deltaConnection.on("submit", onResbumitSubmit);

				channelServices.deltaConnection.once("post-resubmit", (_, originalMd) => {
					// stop capturing resubmit metadatas
					channelServices.deltaConnection.off("submit", onResbumitSubmit);
					resbumitting = false;
					// get the original branch data from original submit metadata
					const branchData = channelToBranchPending.get(originalMd);
					assert(branchData !== undefined, "all local changes need branch data");
					// delete the original metadata, as its no longer applies
					channelToBranchPending.delete(originalMd);
					if (newMds.length > 0) {
						// mark all resubmit ops as skip
						newMds.forEach((nm) => channelToBranchPending.set(nm, skipMd));
						// map the last resubmit op to the branches data
						channelToBranchPending.set(newMds[newMds.length - 1], branchData);
					}
				});
			});

			channelServices.deltaConnection.on("rollback", (msg, md) => {
				services.deltaConnection.rollback(msg, channelToBranchPending.get(md));
				channelToBranchPending.delete(md);
			});

			channelServices.deltaConnection.on("process", (msg, local, md) => {
				if (local) {
					const branchData = channelToBranchPending.get(md);
					assert(branchData !== undefined, "all local changes need branch data");
					if (branchData !== skipMd) {
						services.deltaConnection.process(
							{ ...msg, contents: branchData.content },
							true,
							branchData.localOpMetadata,
						);
					}
				} else {
					services.deltaConnection.process(msg, false, undefined);
				}
			});
			break;
		}
		default:
	}

	return {
		...branch,
		rebase() {
			const outstanding = branchOps.splice(0);
			outstanding.forEach((b) =>
				services.deltaConnection.reSubmit(b.content, b.localOpMetadata),
			);
			return [...branchOps];
		},
	};
}
