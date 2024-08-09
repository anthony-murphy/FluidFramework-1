/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { strict as assert } from "node:assert";

import type { InternalSegment } from "../mergeTree.js";
import type { ISegment } from "../mergeTreeNodes.js";
import { SegmentGroupCollection } from "../segmentGroupCollection.js";
import { TextSegment } from "../textSegment.js";

describe("segmentGroupCollection", () => {
	let internalSegment: Required<Pick<InternalSegment, "segmentGroups">>;
	let segment: ISegment;
	beforeEach(() => {
		segment = TextSegment.make("abc");
		internalSegment = { segmentGroups: new SegmentGroupCollection(segment) };
	});
	it(".empty", () => {
		assert(internalSegment.segmentGroups.empty);
	});

	it(".size", () => {
		assert.equal(internalSegment.segmentGroups.size, 0);
	});

	it(".enqueue", () => {
		const segmentGroup = { segments: [], localSeq: 1, refSeq: 0 };
		internalSegment.segmentGroups.enqueue(segmentGroup);

		assert(!internalSegment.segmentGroups.empty);
		assert.equal(internalSegment.segmentGroups.size, 1);
		assert.equal(segmentGroup.segments.length, 1);
		assert.equal(segmentGroup.segments[0], segment);
	});

	it(".dequeue", () => {
		const segmentGroup = { segments: [], localSeq: 1, refSeq: 0 };
		internalSegment.segmentGroups.enqueue(segmentGroup);
		const segmentGroupCount = 6;
		while (internalSegment.segmentGroups.size < segmentGroupCount) {
			internalSegment.segmentGroups.enqueue({ segments: [], localSeq: 1, refSeq: 0 });
		}

		const dequeuedSegmentGroup = internalSegment.segmentGroups.dequeue();

		assert.equal(internalSegment.segmentGroups.size, segmentGroupCount - 1);
		assert.equal(dequeuedSegmentGroup?.segments.length, 1);
		assert.equal(dequeuedSegmentGroup.segments[0], segment);
		assert.equal(dequeuedSegmentGroup, segmentGroup);
	});

	it(".copyTo", () => {
		const segmentGroupCount = 6;
		while (internalSegment.segmentGroups.size < segmentGroupCount) {
			internalSegment.segmentGroups.enqueue({ segments: [], localSeq: 1, refSeq: 0 });
		}

		const segmentCopy = TextSegment.make("");
		const segmentGroupCopy = new SegmentGroupCollection(segmentCopy);
		internalSegment.segmentGroups.copyTo(segmentGroupCopy);

		assert.equal(internalSegment.segmentGroups.size, segmentGroupCount);
		assert.equal(segmentGroupCopy.size, segmentGroupCount);

		while (!internalSegment.segmentGroups.empty || !segmentGroupCopy.empty) {
			const segmentGroup = internalSegment.segmentGroups.dequeue();
			const copySegmentGroup = segmentGroupCopy.dequeue();

			assert.equal(segmentGroup, copySegmentGroup);
			assert.equal(segmentGroup?.segments.length, 2);
			assert.equal(segmentGroup.segments[0], segment);
			assert.equal(segmentGroup.segments[1], segmentCopy);
		}
	});
});
