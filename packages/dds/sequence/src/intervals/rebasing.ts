import { assert } from "@fluidframework/core-utils/internal";
import {
	Client,
	DetachedReferencePosition,
	ISegment,
	getSlideToSegoff,
	createLocalReconnectingPerspective,
	type LocalReferencePosition,
	SlidingPreference,
} from "@fluidframework/merge-tree/internal";
import { LoggingError } from "@fluidframework/telemetry-utils/internal";

import {
	SequenceOptions,
	type IntervalAddLocalMetadata,
	type IntervalChangeLocalMetadata,
} from "../intervalCollectionMapInterfaces.js";

import type { ISerializedInterval, SerializedIntervalDelta } from "./intervalUtils.js";

export function hasEndpointChanges(
	serialized: SerializedIntervalDelta,
): serialized is ISerializedInterval {
	return serialized.start !== undefined && serialized.end !== undefined;
}

export interface RebasedIntervalPosition {
	pos: number;
	segOff?: { segment: ISegment | "start" | "end"; offset: number };
}

export function computeRebasedPositions(
	client: Client,
	options: Partial<SequenceOptions>,
	localOpMetadata: IntervalAddLocalMetadata | IntervalChangeLocalMetadata,
): Record<"start" | "end", RebasedIntervalPosition> {
	const { localSeq, interval } = localOpMetadata;
	const rebasedStart = rebasePositionWithSegmentSlide(
		client,
		options,
		interval.start,
		localSeq,
	);
	const rebasedEnd = rebasePositionWithSegmentSlide(client, options, interval.end, localSeq);
	return {
		start: rebasedStart,
		end: rebasedEnd,
	};
}

function rebasePositionWithSegmentSlide(
	client: Client,
	options: Partial<SequenceOptions>,
	localRef: LocalReferencePosition,
	localSeq: number,
): RebasedIntervalPosition {
	if (!client) {
		throw new LoggingError("mergeTree client must exist");
	}

	const { clientId } = client.getCollabWindow();
	const segment = localRef.getSegment();
	const offset = localRef.getOffset();

	// if segment is undefined, it slid off the string
	if (segment === undefined) {
		return { pos: DetachedReferencePosition };
	}

	const segOff = getSlideToSegoff(
		{ segment, offset },
		undefined,
		createLocalReconnectingPerspective(client.getCurrentSeq(), clientId, localSeq),
		options.mergeTreeReferencesCanSlideToEndpoint,
	);

	// case happens when rebasing op, but concurrently entire string has been deleted
	if (segOff === undefined) {
		if (localRef.slidingPreference !== undefined) {
			return {
				pos: DetachedReferencePosition,
				segOff: {
					offset: 0,
					segment: localRef.slidingPreference === SlidingPreference.FORWARD ? "end" : "start",
				},
			};
		}
		return { pos: DetachedReferencePosition };
	}

	assert(
		offset !== undefined && 0 <= offset && offset < segment.cachedLength,
		0x54f /* Invalid offset */,
	);
	return {
		segOff,
		pos: client.findReconnectionPosition(segOff.segment, localSeq) + segOff.offset,
	};
}
