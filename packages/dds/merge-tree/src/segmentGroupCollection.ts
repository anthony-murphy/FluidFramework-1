/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { List } from "./collections";
import { ISegment, SegmentGroup } from "./mergeTreeNodes";

export class SegmentGroupCollection {
    private readonly segmentGroups: List<SegmentGroup>;

    constructor(private readonly segment: ISegment) {
        this.segmentGroups = new List<SegmentGroup>();
    }

    public get size() {
        return this.segmentGroups.length;
    }

    public get empty() {
        return this.segmentGroups.empty;
    }

    public enqueue(segmentGroup: SegmentGroup) {
        this.segmentGroups.push(segmentGroup);
        segmentGroup.segments.push(this.segment);
    }

    public dequeue(): SegmentGroup | undefined {
        return this.segmentGroups.pop()?.data;
    }

    public pop?(): SegmentGroup | undefined {
        return this.segmentGroups.pop()?.data;
    }

    public clear() {
        this.segmentGroups.clear();
    }

    public copyTo(segment: ISegment) {
        for (const sg of this.segmentGroups) {
            segment.segmentGroups.enqueue(sg.data);
        }
    }
}
