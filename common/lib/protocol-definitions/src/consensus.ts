/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { ISequencedClient } from "./clients";

/**
 * Proposal to set the given key/value pair.
 *
 * Consensus on the proposal is achieved if the MSN is \>= the sequence number
 * at which the proposal is made and no client within the collaboration window rejects
 * the proposal.
 */
export interface IProposal {
    // The key for the proposal
    key: string;

    // The value of the proposal
    value: any;
}

/**
 * Similar to IProposal except includes the sequence number when it was made in addition to the fields on IProposal
 */
export type ISequencedProposal = { sequenceNumber: number } & IProposal;

/**
 * Adds the sequence number at which the message was approved to an ISequencedProposal
 */
export type IApprovedProposal = { approvalSequenceNumber: number } & ISequencedProposal;

/**
 * Adds the sequence number at which the message was committed to an IApprovedProposal
 */
export type ICommittedProposal = { commitSequenceNumber: number } & IApprovedProposal;

/**
 * A proposal that has been propposed, but not yet accepted or committed
 */
export interface IPendingProposal extends ISequencedProposal {
    /**
     * Sends a rejection for the proposal
     */
    reject();

    /**
     * Disables the sending of rejections for this proposal
     */
    disableRejection();

    /**
     * Returns true if rejections has been disable, otherwise false
     */
    readonly rejectionDisabled: boolean;
}

/**
 * Events fired by a Quorum in response to client tracking.
 */
export interface IQuorumClientsEvents {
    (event: "addMember", listener: (clientId: string, details: ISequencedClient) => void);
    (event: "removeMember", listener: (clientId: string) => void);
    (event: "error", listener: (message: any) => void);
}

/**
 * Events fired by a Quorum in response to proposal tracking.
 */
export interface IQuorumProposalsEvents {
    (event: "addProposal", listener: (proposal: IPendingProposal) => void);
    (
        event: "approveProposal",
        listener: (sequenceNumber: number, key: string, value: any, approvalSequenceNumber: number) => void);
    (
        event: "commitProposal",
        listener: (
            sequenceNumber: number,
            key: string,
            value: any,
            approvalSequenceNumber: number,
            commitSequenceNumber: number) => void);
    (
        event: "rejectProposal",
        listener: (sequenceNumber: number, key: string, value: any, rejections: string[]) => void);
        (event: "error", listener: (message: any) => void);
}

/**
 * All events fired by an IQuorum, both client tracking and proposal tracking.
 */
export type IQuorumEvents = IQuorumClientsEvents & IQuorumProposalsEvents;

/**
 * Interface for tracking clients in the Quorum.
 */
export interface IQuorumClients {
    getMembers(): Map<string, ISequencedClient>;

    getMember(clientId: string): ISequencedClient | undefined;

    readonly on: IQuorumClientsEvents;
    readonly once: IQuorumClientsEvents;
    readonly off: IQuorumClientsEvents;

    readonly disposed: boolean;
    dispose(error?: Error): void;
}

/**
 * Interface for tracking proposals in the Quorum.
 */
export interface IQuorumProposals  {
    propose(key: string, value: any): Promise<void>;

    has(key: string): boolean;

    get(key: string): any;

    getApprovalData(key: string): ICommittedProposal | undefined;

    readonly on: IQuorumProposalsEvents;
    readonly once: IQuorumProposalsEvents;
    readonly off: IQuorumProposalsEvents;

    readonly disposed: boolean;
    dispose(error?: Error): void;
}

/**
 * Interface combining tracking of clients as well as proposals in the Quorum.
 */
export interface IQuorum extends IQuorumClients, IQuorumProposals{
    readonly on: IQuorumEvents;
    readonly once: IQuorumEvents;
    readonly off: IQuorumEvents;
}

export interface IProtocolState {
    sequenceNumber: number;
    minimumSequenceNumber: number;
    members: [string, ISequencedClient][];
    proposals: [number, ISequencedProposal, string[]][];
    values: [string, ICommittedProposal][];
}

export interface IProcessMessageResult {
    immediateNoOp?: boolean;
}
