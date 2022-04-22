/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { assert, Lazy } from "@fluidframework/common-utils";
import { Client } from "./client";
import { List, ListMakeHead, ListRemoveEntry } from "./collections";
import { TreeMaintenanceSequenceNumber } from "./constants";
import { ISegment, Marker } from "./mergeTree";
import { ICombiningOp, ReferenceType } from "./ops";
import { addProperties, PropertySet } from "./properties";
import {
    ReferencePosition,
    DetachedReferencePosition,
    minReferencePosition,
    maxReferencePosition,
    compareReferencePositions,
    refHasRangeLabels,
    refHasTileLabels,
    refGetRangeLabels,
    refGetTileLabels,
    refHasRangeLabel,
    refHasTileLabel,
} from "./referencePositions";

/**
 * @deprecated - This will be removed. Use ReferencePosition instead.
 */
export abstract class LocalReference implements ReferencePosition {
    public static DetachedPosition = DetachedReferencePosition;
    abstract get properties(): PropertySet | undefined;
    abstract get refType(): ReferenceType;
    abstract getSegment(): ISegment | undefined;
    abstract getOffset(): number;
    abstract addProperties(newProps: PropertySet, op?: ICombiningOp): void;

    /**
     * @deprecated - Consumer should use owning dss to get position
     */
    abstract toPosition(): number;

    /**
     * @deprecated - Consumer should keep track of owning dds directly
     */
    abstract getClient(): Client;

    /**
     * @deprecated - use minReferencePosition
     */
    public min(b: LocalReference) {
        return minReferencePosition(this, b);
    }

    /**
     * @deprecated - use maxReferencePosition
     */
    public max(b: LocalReference) {
        return maxReferencePosition(this, b);
    }

    /**
     * @deprecated - use compareReferencePositions
     */
    public compare(b: LocalReference) {
        return compareReferencePositions(this,b);
    }
    /**
     * @deprecated - use getSegment()
     */
    public get segment() {return this.getSegment();}
    /**
     * @deprecated - use getOffset()
     */
    public get offset() {return this.getOffset();}

    isLeaf(): boolean {
        return false;
    }
    hasTileLabels() {
        return refHasTileLabels(this);
    }

    hasRangeLabels() {
        return refHasRangeLabels(this);
    }

    hasTileLabel(label: string): boolean {
        return refHasTileLabel(this, label);
    }

    hasRangeLabel(label: string): boolean {
        return refHasRangeLabel(this, label);
    }

    getTileLabels(): string[] | undefined {
        return refGetTileLabels(this);
    }

    getRangeLabels(): string[] | undefined {
        return refGetRangeLabels(this);
    }
}

class SegmentOffsetReference implements ReferencePosition {
    public pairedRef?: SegmentOffsetReference;

    constructor(
        public readonly refType: ReferenceType,
        public segment: ISegment,
        public offset: number,
        public selfNode: List<SegmentOffsetReference>,
        public properties: PropertySet | undefined,
    ) {
    }

    public addProperties(newProps: PropertySet, op?: ICombiningOp) {
        this.properties = addProperties(this.properties, newProps, op);
    }

    public getSegment() {
        if(this.segment.parent === undefined) {
            return undefined;
        }
        return this.segment;
    }

    public getOffset() {
        if (this.getSegment()?.removedSeq) {
            return 0;
        }
        return this.offset;
    }

    isLeaf(): boolean {
        return false;
    }
    hasTileLabels() {
        return refHasTileLabels(this);
    }

    hasRangeLabels() {
        return refHasRangeLabels(this);
    }

    hasTileLabel(label: string): boolean {
        return refHasTileLabel(this, label);
    }

    hasRangeLabel(label: string): boolean {
        return refHasRangeLabel(this, label);
    }

    getTileLabels(): string[] | undefined {
        return refGetTileLabels(this);
    }

    getRangeLabels(): string[] | undefined {
        return refGetRangeLabels(this);
    }
}

interface IRefsAtOffset {
    before?: List<SegmentOffsetReference>;
    at?: List<SegmentOffsetReference>;
    after?: List<SegmentOffsetReference>;
}
const deadHead = ListMakeHead<SegmentOffsetReference>();
const detachedSegment = new Lazy<ISegment>(()=> {
    const marker = Marker.make(ReferenceType.Transient);
    marker.seq = TreeMaintenanceSequenceNumber;
    marker.removedSeq = TreeMaintenanceSequenceNumber;
    return marker;
});

/**
 * Represents a collection of {@link ReferencePosition}s associated with one segment in a merge-tree.
 */
export class LocalReferenceCollection {
    public static append(seg1: ISegment, seg2: ISegment) {
        if (seg2.localRefs && !seg2.localRefs.empty) {
            if (!seg1.localRefs) {
                seg1.localRefs = new LocalReferenceCollection(seg1);
            }
            assert(seg1.localRefs.refsByOffset.length === seg1.cachedLength,
                0x2be /* "LocalReferences array contains a gap" */);
            seg1.localRefs.append(seg2.localRefs);
        }
        else if (seg1.localRefs) {
            // Since creating the LocalReferenceCollection, we may have appended
            // segments that had no local references. Account for them now by padding the array.
            seg1.localRefs.refsByOffset.length += seg2.cachedLength;
        }
    }

    public hierRefCount: number = 0;
    private readonly refsByOffset: (IRefsAtOffset | undefined)[];
    private refCount: number = 0;

    constructor(
        /** Segment this `LocalReferenceCollection` is associated to. */
        private readonly segment: ISegment,
        initialRefsByfOffset?: (IRefsAtOffset | undefined)[]) {
        // Since javascript arrays are sparse the above won't populate any of the
        // indices, but it will ensure the length property of the array matches
        // the length of the segment.
        this.refsByOffset = initialRefsByfOffset ?? new Array<IRefsAtOffset | undefined>(segment.cachedLength);
    }

    public [Symbol.iterator](): Iterator<ReferencePosition> {
        return this.createIterator();
    }

    private createIterator() {
        const subiterators: IterableIterator<SegmentOffsetReference>[] = [];
        for (const refs of this.refsByOffset) {
            if (refs) {
                if (refs.before) {
                    subiterators.push(refs.before[Symbol.iterator]());
                }
                if (refs.at) {
                    subiterators.push(refs.at[Symbol.iterator]());
                }
                if (refs.after) {
                    subiterators.push(refs.after[Symbol.iterator]());
                }
            }
        }

        const iterator = {
            next(): IteratorResult<SegmentOffsetReference> {
                while (subiterators.length > 0) {
                    const next = subiterators[0].next();
                    if (next.done === true) {
                        subiterators.shift();
                    } else {
                        return next;
                    }
                }

                return { value: undefined, done: true };
            },
            [Symbol.iterator]() {
                return this;
            },
        };
        return iterator;
    }

    public createReference(
        offset: number, refType: ReferenceType, properties: PropertySet | undefined): ReferencePosition {
        const ref = new SegmentOffsetReference(
           refType,
           this.segment,
           offset,
           deadHead,
           properties,
        );
        if(refType !== ReferenceType.Transient) {
            const offsetRefs = this.refsByOffset?.[offset] ?? {at: ListMakeHead()};
            const at = offsetRefs.at ?? ListMakeHead();
            this.refsByOffset[offset] = offsetRefs;
            ref.selfNode = at.enqueue(ref);
        }
        return ref;
    }

    public clear() {
        this.refCount = 0;
        this.hierRefCount = 0;
        const detachSegments = (refs: List<SegmentOffsetReference> | undefined) => {
            if (refs) {
                refs.walk((r) => {
                    if (r.segment === this.segment) {
                        r.segment = detachedSegment.value;
                    }
                });
                refs.clear();
            }
        };
        for (let i = 0; i < this.refsByOffset.length; i++) {
            const refsAtOffset = this.refsByOffset[i];
            if (refsAtOffset) {
                detachSegments(refsAtOffset.before);
                detachSegments(refsAtOffset.at);
                detachSegments(refsAtOffset.after);
                this.refsByOffset[i] = undefined;
            }
        }
    }

    public get empty() {
        return this.refCount === 0;
    }

    public removeLocalRef(lref: ReferencePosition) {
        return this.removeLocalRefInternal(lref);
    }

    private removeLocalRefInternal(lref: ReferencePosition): lref is SegmentOffsetReference {
        if(lref instanceof SegmentOffsetReference) {
            ListRemoveEntry(lref.selfNode);
            lref.segment = detachedSegment.value;
            lref.offset = 0;
            return true;
        }
        return false;
    }

    /**
     * Called by 'append()' implementations to append local refs from the given 'other' segment to the
     * end of 'this' segment.
     *
     * Note: This method should be invoked after the caller has ensured that segments can be merged,
     *       but before 'this' segment's cachedLength has changed, or the adjustment to the local refs
     *       will be incorrect.
     */
    public append(other: LocalReferenceCollection) {
        if (!other || other.empty) {
            return;
        }
        this.hierRefCount += other.hierRefCount;
        this.refCount += other.refCount;
        other.hierRefCount = 0;
        for (const lref of other.createIterator()) {
            lref.segment = this.segment;
            lref.offset += this.refsByOffset.length;
        }

        this.refsByOffset.push(...other.refsByOffset);
    }

    /**
     * Splits this `LocalReferenceCollection` into the intervals [0, offset) and [offset, originalLength).
     * Local references in the former half of this split will remain associated with the segment used on construction.
     * Local references in the latter half of this split will be transferred to `splitSeg`,
     * and its `localRefs` field will be set.
     * @param offset - Offset into the original segment at which the collection should be split
     * @param splitSeg - Split segment which originally corresponded to the indices [offset, originalLength)
     * before splitting.
     */
    public split(offset: number, splitSeg: ISegment) {
        if (!this.empty) {
            const localRefs = splitSeg.localRefs =
                new LocalReferenceCollection(
                    splitSeg,
                    this.refsByOffset.splice(offset, this.refsByOffset.length - offset));

            for (const lref of localRefs.createIterator()) {
                lref.segment = splitSeg;
                lref.offset -= offset;
                if (refHasRangeLabels(lref) || refHasTileLabels(lref)) {
                    this.hierRefCount--;
                    localRefs.hierRefCount++;
                }
                this.refCount--;
                localRefs.refCount++;
            }
        } else {
            // shrink the offset array when empty and splitting
            this.refsByOffset.length = offset;
        }
    }

    public addBeforeTombstones(...refs: Iterable<ReferencePosition>[]) {
        for (const iterable of refs) {
            for (const lref of iterable) {
                if(this.removeLocalRefInternal(lref)) {
                    // eslint-disable-next-line no-bitwise
                    if (lref.refType & ReferenceType.SlideOnRemove) {
                        const offset = this.refsByOffset[0] = this.refsByOffset[0] ?? {before: ListMakeHead()};
                        const beforeRefs = offset.before = offset.before ?? ListMakeHead();
                        const oNext = beforeRefs.next;
                        beforeRefs.next = lref.selfNode;
                        lref.selfNode.prev = beforeRefs;
                        lref.selfNode.next = oNext;
                        oNext.prev = lref.selfNode;

                        lref.segment = this.segment;
                        lref.offset = 0;
                        if (refHasRangeLabels(lref) || refHasTileLabels(lref)) {
                            this.hierRefCount++;
                        }
                        this.refCount++;
                    } else {
                        lref.segment = detachedSegment.value;
                    }
                }
            }
        }
    }

    public addAfterTombstones(...refs: Iterable<ReferencePosition>[]) {
        const endIndex = this.refsByOffset.length - 1;
        for (const iterable of refs) {
            for (const lref of iterable) {
                if(this.removeLocalRefInternal(lref)) {
                    // eslint-disable-next-line no-bitwise
                    if (lref.refType & ReferenceType.SlideOnRemove) {
                        const offset = this.refsByOffset[endIndex] =
                            this.refsByOffset[endIndex] ?? {after: ListMakeHead()};
                        const afterRefs = offset.after = offset.after ?? ListMakeHead();
                        const oPrev = afterRefs.prev;
                        afterRefs.prev = lref.selfNode;
                        lref.selfNode.next = afterRefs;
                        lref.selfNode.prev = oPrev;
                        oPrev.next = lref.selfNode;
                        lref.segment = this.segment;
                        lref.offset = this.segment.cachedLength - 1;
                        if (refHasRangeLabels(lref) || refHasTileLabels(lref)) {
                            this.hierRefCount++;
                        }
                        this.refCount++;
                    } else {
                        lref.segment = detachedSegment.value;
                    }
                }
            }
        }
    }
}
