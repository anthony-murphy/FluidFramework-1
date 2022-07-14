/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { assert } from "@fluidframework/common-utils";
import { UsageError } from "@fluidframework/container-utils";
import { List, ListNode, WalkList } from "./list";
import {
    ISegment, Marker,
} from "./mergeTree";
import { TrackingGroup, TrackingGroupCollection } from "./mergeTreeTracking";
import { ICombiningOp, ReferenceType } from "./ops";
import { addProperties, PropertySet } from "./properties";
import {
    refHasTileLabels,
    refHasRangeLabels,
    ReferencePosition,
    refTypeIncludesFlag,
} from "./referencePositions";

/**
 * @internal
 */
export function _validateReferenceType(refType: ReferenceType) {
    let exclusiveCount = 0;
    if (refTypeIncludesFlag(refType, ReferenceType.Transient)) {
        ++exclusiveCount;
    }
    if (refTypeIncludesFlag(refType, ReferenceType.SlideOnRemove)) {
        ++exclusiveCount;
    }
    if (refTypeIncludesFlag(refType, ReferenceType.StayOnRemove)) {
        ++exclusiveCount;
    }
    if (exclusiveCount > 1) {
        throw new UsageError(
            "Reference types can only be one of Transient, SlideOnRemove, and StayOnRemove");
    }
}

export interface LocalReferencePosition extends ReferencePosition {
    callbacks?: Partial<Record<"beforeSlide" | "afterSlide", () => void>>;
    readonly trackingCollection: TrackingGroupCollection;
}

/**
 * @internal - this should not be exported outside merge tree
 */
class LocalReference implements LocalReferencePosition {
    public properties: PropertySet | undefined;

    private segment: ISegment;
    private offset: number = 0;
    private listNode: ListNode<LocalReference> | undefined;

    public callbacks?: Partial<Record<"beforeSlide" | "afterSlide", () => void>> | undefined;
    public readonly trackingCollection: TrackingGroupCollection = new TrackingGroupCollection(this);

    constructor(
        initSegment: ISegment,
        initOffset: number,
        public refType = ReferenceType.Simple,
        properties?: PropertySet,
    ) {
        _validateReferenceType(refType);
        this.segment = initSegment;
        this.offset = initOffset;
        this.properties = properties;
    }

    public link(segment: ISegment, offset: number, listNode: ListNode<LocalReference> | undefined) {
        if (listNode !== this.listNode) {
            this.getSegment().localRefs?.removeLocalRef(this);
            this.listNode = listNode;
        }

        this.offset = offset;

        if (segment !== this.segment) {
            const groups: TrackingGroup[] = [];
            // this might be costly, need a better solution
            this.trackingCollection.trackingGroups.forEach(
                (tg) => {
                    tg.unlink(this);
                    groups.push(tg);
                });
            this.segment = segment;

            groups.forEach((tg) => tg.link(this));
        }
    }

    public isLeaf() {
        return false;
    }

    public addProperties(newProps: PropertySet, op?: ICombiningOp) {
        this.properties = addProperties(this.properties, newProps, op);
    }

    public getSegment() {
        return this.segment;
    }

    public getOffset() {
        return this.offset;
    }

    public getListNode() {
        return this.listNode;
    }

    public getProperties() {
        return this.properties;
    }
}

export function createDetachedLocalReferencePosition(refType?: ReferenceType): LocalReferencePosition {
    return new LocalReference(Marker.make(refType ?? ReferenceType.Simple), 0, refType, undefined);
}

interface IRefsAtOffset {
    before?: List<LocalReference>;
    at?: List<LocalReference>;
    after?: List<LocalReference>;
}

export function assertLocalReferences(
    lref: any,
): asserts lref is LocalReference {
    assert(lref instanceof LocalReference, 0x2e0 /* "lref not a Local Reference" */);
}

/**
 * Represents a collection of {@link LocalReferencePosition}s associated with one segment in a merge-tree.
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
        } else if (seg1.localRefs) {
            // Since creating the LocalReferenceCollection, we may have appended
            // segments that had no local references. Account for them now by padding the array.
            seg1.localRefs.refsByOffset.length += seg2.cachedLength;
        }
    }

    /**
     *
     * @internal - this method should only be called by mergeTree
     */
    public hierRefCount: number = 0;
    private readonly refsByOffset: (IRefsAtOffset | undefined)[];
    public refCount: number = 0;

    /**
     *
     * @internal - this method should only be called by mergeTree
     */
    constructor(
        /** Segment this `LocalReferenceCollection` is associated to. */
        private readonly segment: ISegment,
        initialRefsByfOffset = new Array<IRefsAtOffset | undefined>(segment.cachedLength)) {
        // Since javascript arrays are sparse the above won't populate any of the
        // indices, but it will ensure the length property of the array matches
        // the length of the segment.
        this.refsByOffset = initialRefsByfOffset;
    }

    /**
     *
     * @internal - this method should only be called by mergeTree
     */
    public [Symbol.iterator]() {
        const subiterators: IterableIterator<ListNode<LocalReference>>[] = [];
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
            next(): IteratorResult<LocalReferencePosition> {
                while (subiterators.length > 0) {
                    const next = subiterators[0].next();
                    if (next.done === true) {
                        subiterators.shift();
                    } else {
                        return { done: next.done, value: next.value.data };
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

    /**
     *
     * @internal - this method should only be called by mergeTree
     */
    public get empty() {
        return this.refCount === 0;
    }

    /**
     *
     * @internal - this method should only be called by mergeTree
     */
    public createLocalRef(
        offset: number,
        refType: ReferenceType,
        properties: PropertySet | undefined): LocalReferencePosition {
        const ref = new LocalReference(
            this.segment,
            offset,
            refType,
            properties,
        );
        if (!refTypeIncludesFlag(ref, ReferenceType.Transient)) {
            this.addLocalRef(ref, offset);
        }
        return ref;
    }

    /**
     *
     * @internal - this method should only be called by mergeTree
     */
    public addLocalRef(lref: LocalReferencePosition, offset: number) {
        assert(
            !refTypeIncludesFlag(lref, ReferenceType.Transient),
            0x2df /* "transient references cannot be bound to segments" */);
        assertLocalReferences(lref);
        assert(offset < this.segment.cachedLength, "offset cannot be beyond segment length");
        const refsAtOffset = this.refsByOffset[offset] ??= { at: new List<LocalReference>() };
        const atRefs = refsAtOffset.at ??= new List<LocalReference>();

        lref.link(this.segment, offset, atRefs.push(lref).first);

        if (refHasRangeLabels(lref) || refHasTileLabels(lref)) {
            this.hierRefCount++;
        }
        this.refCount++;
    }

    /**
     *
     * @internal - this method should only be called by mergeTree
     */
     public removeLocalRef(lref: LocalReferencePosition): LocalReferencePosition | undefined {
        if (this.has(lref)) {
            assertLocalReferences(lref);
            lref.getListNode()?.list?.remove(lref.getListNode());
            if (refHasRangeLabels(lref) || refHasTileLabels(lref)) {
                this.hierRefCount--;
            }
            this.refCount--;
            return lref;
        }
        return undefined;
    }

    /**
     * @internal - this method should only be called by mergeTree
     *
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
        for (const lref of other) {
            assertLocalReferences(lref);
            lref.link(
                this.segment,
                lref.getOffset() + this.refsByOffset.length,
                lref.getListNode());
        }

        this.refsByOffset.push(...other.refsByOffset);
    }
    /**
     * @internal - this method should only be called by mergeTree
     * Return true of the local reference is in the collection, otherwise false
     */
    public has(lref: ReferencePosition): boolean {
        if (!(lref instanceof LocalReference)
            || refTypeIncludesFlag(lref, ReferenceType.Transient)) {
            return false;
        }
        if (lref.getSegment() !== this.segment) {
            return false;
        }
        // we should be able to optimize finding the
        // list head
        const listNode = lref.getListNode();
        if (listNode === undefined || listNode.list === undefined) {
            return false;
        }
        const offset = lref.getOffset();
        const refsAtOffset = this.refsByOffset[offset];
        if (refsAtOffset?.after === listNode.list
            || refsAtOffset?.at === listNode.list
            || refsAtOffset?.before === listNode.list) {
                return true;
            }
        return false;
    }

    /**
     * @internal - this method should only be called by mergeTree
     *
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
            const localRefs =
                new LocalReferenceCollection(
                    splitSeg,
                    this.refsByOffset.splice(offset, this.refsByOffset.length - offset));

            splitSeg.localRefs = localRefs;
            for (const lref of localRefs) {
                assertLocalReferences(lref);
                lref.link(
                    splitSeg,
                    lref.getOffset() - offset,
                    lref.getListNode());
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

    public addBeforeTombstones(refs: Iterable<LocalReferencePosition>, offset?: number) {
        const firstOffset = offset ?? 0;
        const beforeRefs = this.refsByOffset[firstOffset]?.before ?? new List<LocalReference>();

        for (const lref of [...refs].reverse()) {
            assertLocalReferences(lref);
            if (refTypeIncludesFlag(lref, ReferenceType.SlideOnRemove)) {
                lref.link(
                    this.segment,
                    firstOffset,
                    beforeRefs.unshift(lref).first);
                if (refHasRangeLabels(lref) || refHasTileLabels(lref)) {
                    this.hierRefCount++;
                }
                this.refCount++;
            } else {
                lref.getSegment().localRefs?.removeLocalRef(lref);
            }
        }
        if (!beforeRefs.empty && this.refsByOffset[firstOffset]?.before === undefined) {
            // ensure offset initialized
            const refsAtOffset = this.refsByOffset[firstOffset] ??= { before: beforeRefs };
            // ensure after initialized
            refsAtOffset.before ??= beforeRefs;
        }
    }

    public addAfterTombstones(refs: Iterable<LocalReferencePosition>, offset?: number) {
        const lastOffset = offset ?? this.refsByOffset.length - 1;
        const afterRefs =
            this.refsByOffset[lastOffset]?.after ?? new List<LocalReference>();

        for (const lref of refs) {
            assertLocalReferences(lref);
            if (refTypeIncludesFlag(lref, ReferenceType.SlideOnRemove)) {
                lref.link(
                    this.segment,
                    lastOffset,
                    afterRefs.push(lref).first);
                if (refHasRangeLabels(lref) || refHasTileLabels(lref)) {
                    this.hierRefCount++;
                }
                this.refCount++;
            } else {
                lref.getSegment().localRefs?.removeLocalRef(lref);
            }
        }
        if (!afterRefs.empty && this.refsByOffset[lastOffset]?.after === undefined) {
            // ensure offset initialized
            const refsAtOffset = this.refsByOffset[lastOffset] ??= { after: afterRefs };
            // ensure after refs initialized
            refsAtOffset.after ??= afterRefs;
        }
    }

    public walkReferences(
        visitor: (lref: LocalReferencePosition) => boolean | void | undefined,
        start?: LocalReferencePosition,
        forward: boolean = true) {
        if (start !== undefined) {
            assertLocalReferences(start);
        }
        let offset = start?.getOffset() ?? (forward
            ? 0
            : this.segment.cachedLength - 1);

        const offsetPositions: [IRefsAtOffset["before"], IRefsAtOffset["at"], IRefsAtOffset["after"]] =
            [this.refsByOffset[offset]?.before, this.refsByOffset[offset]?.at, this.refsByOffset[offset]?.after];

        const startNode = start?.getListNode();
        const startList = startNode?.list;

        if (startList !== undefined) {
            const index = offsetPositions.indexOf(startList);
            if (forward) {
                for (let i = 0; i < index; i++) {
                    offsetPositions[i] = undefined;
                }
            } else {
                for (let i = index + 1; i < offsetPositions.length; i++) {
                    offsetPositions[i] = undefined;
                }
            }
        }

        const listVisitor = (node: ListNode<LocalReference>) => visitor(node.data);
        const listWalker = (pos: List<LocalReference>) => {
            if (WalkList(
                pos,
                listVisitor,
                startList === pos ? startNode : undefined,
                forward,
            ) === false) {
                return false;
            }
        };

        while (offset >= 0 && offset < this.refsByOffset.length) {
            while (offsetPositions.length > 0) {
                const pos = forward
                    ? offsetPositions.shift()
                    : offsetPositions.pop();
                if (pos !== undefined) {
                    if (listWalker(pos) === false) {
                        return false;
                    }
                }
           }
            offset += forward ? 1 : -1;
            offsetPositions.push(
                this.refsByOffset[offset]?.before, this.refsByOffset[offset]?.at, this.refsByOffset[offset]?.after);
        }
        return true;
    }
}
