/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import * as old from "protocol-definitions-0-1024-0";
import * as current from "../index";

declare function get_old_ConnectionMode(): old.ConnectionMode;
declare function set_old_ConnectionMode(oldVal: old.ConnectionMode);
const currentConnectionMode: current.ConnectionMode = get_old_ConnectionMode();
set_old_ConnectionMode(currentConnectionMode);

declare function get_old_ICapabilities(): old.ICapabilities;
declare function set_old_ICapabilities(oldVal: old.ICapabilities);
const currentICapabilities: current.ICapabilities = get_old_ICapabilities();
set_old_ICapabilities(currentICapabilities);

declare function get_old_IClient(): old.IClient;
declare function set_old_IClient(oldVal: old.IClient);
const currentIClient: current.IClient = get_old_IClient();
set_old_IClient(currentIClient);

declare function get_old_IClientDetails(): old.IClientDetails;
declare function set_old_IClientDetails(oldVal: old.IClientDetails);
const currentIClientDetails: current.IClientDetails = get_old_IClientDetails();
set_old_IClientDetails(currentIClientDetails);

declare function get_old_IClientJoin(): old.IClientJoin;
declare function set_old_IClientJoin(oldVal: old.IClientJoin);
const currentIClientJoin: current.IClientJoin = get_old_IClientJoin();
set_old_IClientJoin(currentIClientJoin);

declare function get_old_ISequencedClient(): old.ISequencedClient;
declare function set_old_ISequencedClient(oldVal: old.ISequencedClient);
const currentISequencedClient: current.ISequencedClient = get_old_ISequencedClient();
set_old_ISequencedClient(currentISequencedClient);

declare function get_old_ISignalClient(): old.ISignalClient;
declare function set_old_ISignalClient(oldVal: old.ISignalClient);
const currentISignalClient: current.ISignalClient = get_old_ISignalClient();
set_old_ISignalClient(currentISignalClient);

declare function get_old_IApprovedProposal(): old.IApprovedProposal;
declare function set_old_IApprovedProposal(oldVal: old.IApprovedProposal);
const currentIApprovedProposal: current.IApprovedProposal = get_old_IApprovedProposal();
set_old_IApprovedProposal(currentIApprovedProposal);

declare function get_old_ICommittedProposal(): old.ICommittedProposal;
declare function set_old_ICommittedProposal(oldVal: old.ICommittedProposal);
const currentICommittedProposal: current.ICommittedProposal = get_old_ICommittedProposal();
set_old_ICommittedProposal(currentICommittedProposal);

declare function get_old_IPendingProposal(): old.IPendingProposal;
declare function set_old_IPendingProposal(oldVal: old.IPendingProposal);
const currentIPendingProposal: current.IPendingProposal = get_old_IPendingProposal();
set_old_IPendingProposal(currentIPendingProposal);

declare function get_old_IProcessMessageResult(): old.IProcessMessageResult;
declare function set_old_IProcessMessageResult(oldVal: old.IProcessMessageResult);
const currentIProcessMessageResult: current.IProcessMessageResult = get_old_IProcessMessageResult();
set_old_IProcessMessageResult(currentIProcessMessageResult);

declare function get_old_IProposal(): old.IProposal;
declare function set_old_IProposal(oldVal: old.IProposal);
const currentIProposal: current.IProposal = get_old_IProposal();
set_old_IProposal(currentIProposal);

declare function get_old_IProtocolState(): old.IProtocolState;
declare function set_old_IProtocolState(oldVal: old.IProtocolState);
const currentIProtocolState: current.IProtocolState = get_old_IProtocolState();
set_old_IProtocolState(currentIProtocolState);

declare function get_old_IQuorum(): old.IQuorum;
declare function set_old_IQuorum(oldVal: old.IQuorum);
const currentIQuorum: current.IQuorum = get_old_IQuorum();
set_old_IQuorum(currentIQuorum);

declare function get_old_IQuorumEvents(): old.IQuorumEvents;
declare function set_old_IQuorumEvents(oldVal: old.IQuorumEvents);
export const currentIQuorumEvents: current.IQuorumEvents = get_old_IQuorumEvents();
// set_old_IQuorumEvents(currentIQuorumEvents);

declare function get_old_ISequencedProposal(): old.ISequencedProposal;
declare function set_old_ISequencedProposal(oldVal: old.ISequencedProposal);
const currentISequencedProposal: current.ISequencedProposal = get_old_ISequencedProposal();
set_old_ISequencedProposal(currentISequencedProposal);

declare function get_old_IClientConfiguration(): old.IClientConfiguration;
declare function set_old_IClientConfiguration(oldVal: old.IClientConfiguration);
const currentIClientConfiguration: current.IClientConfiguration = get_old_IClientConfiguration();
set_old_IClientConfiguration(currentIClientConfiguration);

declare function get_old_ISummaryConfiguration(): old.ISummaryConfiguration;
declare function set_old_ISummaryConfiguration(oldVal: old.ISummaryConfiguration);
const currentISummaryConfiguration: current.ISummaryConfiguration = get_old_ISummaryConfiguration();
set_old_ISummaryConfiguration(currentISummaryConfiguration);

declare function get_old_MessageType(): old.MessageType;
declare function set_old_MessageType(oldVal: old.MessageType);
const currentMessageType: current.MessageType = get_old_MessageType();
set_old_MessageType(currentMessageType);

declare function get_old_NackErrorType(): old.NackErrorType;
declare function set_old_NackErrorType(oldVal: old.NackErrorType);
const currentNackErrorType: current.NackErrorType = get_old_NackErrorType();
set_old_NackErrorType(currentNackErrorType);

declare function get_old_IBranchOrigin(): old.IBranchOrigin;
declare function set_old_IBranchOrigin(oldVal: old.IBranchOrigin);
const currentIBranchOrigin: current.IBranchOrigin = get_old_IBranchOrigin();
set_old_IBranchOrigin(currentIBranchOrigin);

declare function get_old_IDocumentMessage(): old.IDocumentMessage;
declare function set_old_IDocumentMessage(oldVal: old.IDocumentMessage);
const currentIDocumentMessage: current.IDocumentMessage = get_old_IDocumentMessage();
set_old_IDocumentMessage(currentIDocumentMessage);

declare function get_old_IDocumentSystemMessage(): old.IDocumentSystemMessage;
declare function set_old_IDocumentSystemMessage(oldVal: old.IDocumentSystemMessage);
const currentIDocumentSystemMessage: current.IDocumentSystemMessage = get_old_IDocumentSystemMessage();
set_old_IDocumentSystemMessage(currentIDocumentSystemMessage);

declare function get_old_IHelpMessage(): old.IHelpMessage;
declare function set_old_IHelpMessage(oldVal: old.IHelpMessage);
const currentIHelpMessage: current.IHelpMessage = get_old_IHelpMessage();
set_old_IHelpMessage(currentIHelpMessage);

declare function get_old_INack(): old.INack;
declare function set_old_INack(oldVal: old.INack);
export const currentINack: current.INack = get_old_INack();
// set_old_INack(currentINack);

declare function get_old_INackContent(): old.INackContent;
declare function set_old_INackContent(oldVal: old.INackContent);
export const currentINackContent: current.INackContent = get_old_INackContent();
// set_old_INackContent(currentINackContent);

declare function get_old_IQueueMessage(): old.IQueueMessage;
declare function set_old_IQueueMessage(oldVal: old.IQueueMessage);
const currentIQueueMessage: current.IQueueMessage = get_old_IQueueMessage();
set_old_IQueueMessage(currentIQueueMessage);

declare function get_old_ISequencedDocumentAugmentedMessage(): old.ISequencedDocumentAugmentedMessage;
declare function set_old_ISequencedDocumentAugmentedMessage(oldVal: old.ISequencedDocumentAugmentedMessage);
const currentISequencedDocumentAugmentedMessage: current.ISequencedDocumentAugmentedMessage =
    get_old_ISequencedDocumentAugmentedMessage();
set_old_ISequencedDocumentAugmentedMessage(currentISequencedDocumentAugmentedMessage);

declare function get_old_ISequencedDocumentMessage(): old.ISequencedDocumentMessage;
declare function set_old_ISequencedDocumentMessage(oldVal: old.ISequencedDocumentMessage);
const currentISequencedDocumentMessage: current.ISequencedDocumentMessage = get_old_ISequencedDocumentMessage();
set_old_ISequencedDocumentMessage(currentISequencedDocumentMessage);

declare function get_old_ISequencedDocumentSystemMessage(): old.ISequencedDocumentSystemMessage;
declare function set_old_ISequencedDocumentSystemMessage(oldVal: old.ISequencedDocumentSystemMessage);
const currentISequencedDocumentSystemMessage: current.ISequencedDocumentSystemMessage =
    get_old_ISequencedDocumentSystemMessage();
set_old_ISequencedDocumentSystemMessage(currentISequencedDocumentSystemMessage);

declare function get_old_IServerError(): old.IServerError;
declare function set_old_IServerError(oldVal: old.IServerError);
const currentIServerError: current.IServerError = get_old_IServerError();
set_old_IServerError(currentIServerError);

declare function get_old_ISignalMessage(): old.ISignalMessage;
declare function set_old_ISignalMessage(oldVal: old.ISignalMessage);
const currentISignalMessage: current.ISignalMessage = get_old_ISignalMessage();
set_old_ISignalMessage(currentISignalMessage);

declare function get_old_ISummaryAck(): old.ISummaryAck;
declare function set_old_ISummaryAck(oldVal: old.ISummaryAck);
const currentISummaryAck: current.ISummaryAck = get_old_ISummaryAck();
set_old_ISummaryAck(currentISummaryAck);

declare function get_old_ISummaryContent(): old.ISummaryContent;
declare function set_old_ISummaryContent(oldVal: old.ISummaryContent);
const currentISummaryContent: current.ISummaryContent = get_old_ISummaryContent();
set_old_ISummaryContent(currentISummaryContent);

declare function get_old_ISummaryNack(): old.ISummaryNack;
declare function set_old_ISummaryNack(oldVal: old.ISummaryNack);
const currentISummaryNack: current.ISummaryNack = get_old_ISummaryNack();
set_old_ISummaryNack(currentISummaryNack);

declare function get_old_ISummaryProposal(): old.ISummaryProposal;
declare function set_old_ISummaryProposal(oldVal: old.ISummaryProposal);
const currentISummaryProposal: current.ISummaryProposal = get_old_ISummaryProposal();
set_old_ISummaryProposal(currentISummaryProposal);

declare function get_old_ITrace(): old.ITrace;
declare function set_old_ITrace(oldVal: old.ITrace);
const currentITrace: current.ITrace = get_old_ITrace();
set_old_ITrace(currentITrace);

declare function get_old_IUploadedSummaryDetails(): old.IUploadedSummaryDetails;
declare function set_old_IUploadedSummaryDetails(oldVal: old.IUploadedSummaryDetails);
const currentIUploadedSummaryDetails: current.IUploadedSummaryDetails = get_old_IUploadedSummaryDetails();
set_old_IUploadedSummaryDetails(currentIUploadedSummaryDetails);

declare function get_old_FileMode(): old.FileMode;
declare function set_old_FileMode(oldVal: old.FileMode);
const currentFileMode: current.FileMode = get_old_FileMode();
set_old_FileMode(currentFileMode);

declare function get_old_TreeEntry(): old.TreeEntry;
declare function set_old_TreeEntry(oldVal: old.TreeEntry);
const currentTreeEntry: current.TreeEntry = get_old_TreeEntry();
set_old_TreeEntry(currentTreeEntry);

declare function get_old_IAttachment(): old.IAttachment;
declare function set_old_IAttachment(oldVal: old.IAttachment);
const currentIAttachment: current.IAttachment = get_old_IAttachment();
set_old_IAttachment(currentIAttachment);

declare function get_old_IBlob(): old.IBlob;
declare function set_old_IBlob(oldVal: old.IBlob);
const currentIBlob: current.IBlob = get_old_IBlob();
set_old_IBlob(currentIBlob);

declare function get_old_ICreateBlobResponse(): old.ICreateBlobResponse;
declare function set_old_ICreateBlobResponse(oldVal: old.ICreateBlobResponse);
const currentICreateBlobResponse: current.ICreateBlobResponse = get_old_ICreateBlobResponse();
set_old_ICreateBlobResponse(currentICreateBlobResponse);

declare function get_old_IDocumentAttributes(): old.IDocumentAttributes;
declare function set_old_IDocumentAttributes(oldVal: old.IDocumentAttributes);
const currentIDocumentAttributes: current.IDocumentAttributes = get_old_IDocumentAttributes();
set_old_IDocumentAttributes(currentIDocumentAttributes);

declare function get_old_ISnapshotTree(): old.ISnapshotTree;
declare function set_old_ISnapshotTree(oldVal: old.ISnapshotTree);
const currentISnapshotTree: current.ISnapshotTree = get_old_ISnapshotTree();
set_old_ISnapshotTree(currentISnapshotTree);

declare function get_old_ISnapshotTreeEx(): old.ISnapshotTreeEx;
declare function set_old_ISnapshotTreeEx(oldVal: old.ISnapshotTreeEx);
const currentISnapshotTreeEx: current.ISnapshotTreeEx = get_old_ISnapshotTreeEx();
set_old_ISnapshotTreeEx(currentISnapshotTreeEx);

declare function get_old_ITree(): old.ITree;
declare function set_old_ITree(oldVal: old.ITree);
export const currentITree: current.ITree = get_old_ITree();
// set_old_ITree(currentITree);

declare function get_old_ITreeEntry(): old.ITreeEntry;
declare function set_old_ITreeEntry(oldVal: old.ITreeEntry);
export const currentITreeEntry: current.ITreeEntry = get_old_ITreeEntry();
// set_old_ITreeEntry(currentITreeEntry);

declare function get_old_IVersion(): old.IVersion;
declare function set_old_IVersion(oldVal: old.IVersion);
const currentIVersion: current.IVersion = get_old_IVersion();
set_old_IVersion(currentIVersion);

declare function get_old_ISummaryAttachment(): old.ISummaryAttachment;
declare function set_old_ISummaryAttachment(oldVal: old.ISummaryAttachment);
export const currentISummaryAttachment: current.ISummaryAttachment = get_old_ISummaryAttachment();
// set_old_ISummaryAttachment(currentISummaryAttachment);

declare function get_old_ISummaryAuthor(): old.ISummaryAuthor;
declare function set_old_ISummaryAuthor(oldVal: old.ISummaryAuthor);
const currentISummaryAuthor: current.ISummaryAuthor = get_old_ISummaryAuthor();
set_old_ISummaryAuthor(currentISummaryAuthor);

declare function get_old_ISummaryBlob(): old.ISummaryBlob;
declare function set_old_ISummaryBlob(oldVal: old.ISummaryBlob);
export const currentISummaryBlob: current.ISummaryBlob = get_old_ISummaryBlob();
// set_old_ISummaryBlob(currentISummaryBlob);

declare function get_old_ISummaryCommitter(): old.ISummaryCommitter;
declare function set_old_ISummaryCommitter(oldVal: old.ISummaryCommitter);
const currentISummaryCommitter: current.ISummaryCommitter = get_old_ISummaryCommitter();
set_old_ISummaryCommitter(currentISummaryCommitter);

declare function get_old_ISummaryHandle(): old.ISummaryHandle;
declare function set_old_ISummaryHandle(oldVal: old.ISummaryHandle);
export const currentISummaryHandle: current.ISummaryHandle = get_old_ISummaryHandle();
// set_old_ISummaryHandle(currentISummaryHandle);

declare function get_old_ISummaryTree(): old.ISummaryTree;
declare function set_old_ISummaryTree(oldVal: old.ISummaryTree);
export const currentISummaryTree: current.ISummaryTree = get_old_ISummaryTree();
// set_old_ISummaryTree(currentISummaryTree);

declare function get_old_SummaryObject(): old.SummaryObject;
declare function set_old_SummaryObject(oldVal: old.SummaryObject);
export const currentSummaryObject: current.SummaryObject = get_old_SummaryObject();
// set_old_SummaryObject(currentSummaryObject);

declare function get_old_SummaryTree(): old.SummaryTree;
declare function set_old_SummaryTree(oldVal: old.SummaryTree);
export const currentSummaryTree: current.SummaryTree = get_old_SummaryTree();
// set_old_SummaryTree(currentSummaryTree);

declare function get_old_SummaryTypeNoHandle(): old.SummaryTypeNoHandle;
declare function set_old_SummaryTypeNoHandle(oldVal: old.SummaryTypeNoHandle);
const currentSummaryTypeNoHandle: current.SummaryTypeNoHandle = get_old_SummaryTypeNoHandle();
set_old_SummaryTypeNoHandle(currentSummaryTypeNoHandle);

declare function get_old_IUser(): old.IUser;
declare function set_old_IUser(oldVal: old.IUser);
const currentIUser: current.IUser = get_old_IUser();
set_old_IUser(currentIUser);

declare function get_old_IActorClient(): old.IActorClient;
declare function set_old_IActorClient(oldVal: old.IActorClient);
const currentIActorClient: current.IActorClient = get_old_IActorClient();
set_old_IActorClient(currentIActorClient);

declare function get_old_ISummaryTokenClaims(): old.ISummaryTokenClaims;
declare function set_old_ISummaryTokenClaims(oldVal: old.ISummaryTokenClaims);
const currentISummaryTokenClaims: current.ISummaryTokenClaims = get_old_ISummaryTokenClaims();
set_old_ISummaryTokenClaims(currentISummaryTokenClaims);

declare function get_old_ITokenClaims(): old.ITokenClaims;
declare function set_old_ITokenClaims(oldVal: old.ITokenClaims);
const currentITokenClaims: current.ITokenClaims = get_old_ITokenClaims();
set_old_ITokenClaims(currentITokenClaims);

declare function get_old_ITokenProvider(): old.ITokenProvider;
declare function set_old_ITokenProvider(oldVal: old.ITokenProvider);
const currentITokenProvider: current.ITokenProvider = get_old_ITokenProvider();
set_old_ITokenProvider(currentITokenProvider);

declare function get_old_ITokenService(): old.ITokenService;
declare function set_old_ITokenService(oldVal: old.ITokenService);
const currentITokenService: current.ITokenService = get_old_ITokenService();
set_old_ITokenService(currentITokenService);

declare function get_old_ScopeType(): old.ScopeType;
declare function set_old_ScopeType(oldVal: old.ScopeType);
const currentScopeType: current.ScopeType = get_old_ScopeType();
set_old_ScopeType(currentScopeType);

declare function get_old_IConnect(): old.IConnect;
declare function set_old_IConnect(oldVal: old.IConnect);
const currentIConnect: current.IConnect = get_old_IConnect();
set_old_IConnect(currentIConnect);

declare function get_old_IConnected(): old.IConnected;
declare function set_old_IConnected(oldVal: old.IConnected);
const currentIConnected: current.IConnected = get_old_IConnected();
set_old_IConnected(currentIConnected);
