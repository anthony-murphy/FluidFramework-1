/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { isObject } from "@fluidframework/core-utils/internal";
import type { ITelemetryErrorEventExt } from "@fluidframework/telemetry-utils/internal";
import { ITelemetryLoggerExt } from "@fluidframework/telemetry-utils/internal";

import { OnlineStatus, canRetryOnError, isOnline } from "./network.js";

/**
 * @internal
 */
export function logNetworkFailure(
	logger: ITelemetryLoggerExt,
	event: ITelemetryErrorEventExt,
	error?: any,
) {
	const newEvent = { ...event };

	const errorOnlineProp = error?.online;
	newEvent.online =
		typeof errorOnlineProp === "string" ? errorOnlineProp : OnlineStatus[isOnline()];

	if (isObject(navigator)) {
		const nav = navigator as any;
		const connection = nav.connection ?? nav.mozConnection ?? nav.webkitConnection;
		if (isObject(connection) && "type" in connection && typeof connection.type === "string") {
			newEvent.connectionType = connection.type;
		}
	}

	// non-retryable errors are fatal and should be logged as errors
	newEvent.category = canRetryOnError(error) ? "generic" : "error";
	logger.sendTelemetryEvent(newEvent, error);
}
