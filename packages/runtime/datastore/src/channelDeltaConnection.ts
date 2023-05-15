/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { TypedEventEmitter, assert } from "@fluidframework/common-utils";
import { ISequencedDocumentMessage } from "@fluidframework/protocol-definitions";
import { IDeltaConnection, IDeltaHandler } from "@fluidframework/datastore-definitions";
import { DataProcessingError } from "@fluidframework/container-utils";
import { IFluidHandle } from "@fluidframework/core-interfaces";
import { ITelemetryLogger } from "@fluidframework/common-definitions";

export class ChannelDeltaConnection
	extends TypedEventEmitter<{
		(
			event: "submit" | "pre-resubmit" | "post-resubmit" | "rollback",
			listener: (content: any, localOpMetadata: unknown) => void,
		);
		(
			event: "process",
			listener: (
				message: ISequencedDocumentMessage,
				local: boolean,
				localOpMetadata: unknown,
			) => void,
		);
	}>
	implements IDeltaConnection
{
	private _handler: IDeltaHandler | undefined;

	private get handler(): IDeltaHandler {
		assert(!!this._handler, 0x177 /* "Missing delta handler" */);
		return this._handler;
	}
	public get connected(): boolean {
		return this._connected;
	}

	public static clone(
		original: ChannelDeltaConnection,
		overrides: {
			_connected?: boolean;
			submit?: (message: unknown, localOpMetadata: unknown) => void;
			dirty?: () => void;
			addedGCOutboundReference?: (
				srcHandle: IFluidHandle,
				outboundHandle: IFluidHandle,
			) => void;
			logger?: ITelemetryLogger;
		},
	) {
		return new ChannelDeltaConnection(
			overrides._connected ?? original._connected,
			overrides.submit ?? original.submit,
			overrides.dirty ?? original.dirty,
			overrides.addedGCOutboundReference ?? original.addedGCOutboundReference,
		);
	}
	public readonly submit: (message: unknown, localOpMetadata: unknown) => void;
	constructor(
		private _connected: boolean,
		public readonly submit: (content: any, localOpMetadata: unknown) => void,
		public readonly dirty: () => void,
		public readonly addedGCOutboundReference: (
			srcHandle: IFluidHandle,
			outboundHandle: IFluidHandle,
		) => void,
	) {
		super();
		this.submit = (msg, md) => {
			submit(msg, md);
			this.emit("submit", msg, md);
		};
	}

	public attach(handler: IDeltaHandler) {
		assert(this._handler === undefined, 0x178 /* "Missing delta handler on attach" */);
		this._handler = handler;
	}

	public setConnectionState(connected: boolean) {
		this._connected = connected;
		this.handler.setConnectionState(connected);
	}

	public process(message: ISequencedDocumentMessage, local: boolean, localOpMetadata: unknown) {
		try {
			// catches as data processing error whether or not they come from async pending queues
			this.handler.process(message, local, localOpMetadata);
		} catch (error) {
			throw DataProcessingError.wrapIfUnrecognized(
				error,
				"channelDeltaConnectionFailedToProcessMessage",
				message,
			);
		}
		this.emit("process", message, local, localOpMetadata);
	}

	public reSubmit(content: any, localOpMetadata: unknown) {
		this.emit("pre-resubmit", content, localOpMetadata);
		this.handler.reSubmit(content, localOpMetadata);
		this.emit("post-resubmit", content, localOpMetadata);
	}

	public rollback(content: any, localOpMetadata: unknown) {
		if (this.handler.rollback === undefined) {
			throw new Error("Handler doesn't support rollback");
		}
		this.handler.rollback(content, localOpMetadata);
		this.emit("rollback", content, localOpMetadata);
	}

	public applyStashedOp(content: any): unknown {
		return this.handler.applyStashedOp(content);
	}
}
