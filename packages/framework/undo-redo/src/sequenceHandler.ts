/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { assert } from "@fluidframework/common-utils";
import {
    IMergeBlock,
    IMergeNode,
    ISegment,
    LocalReferenceCollection,
    LocalReferencePosition,
    matchProperties,
    MergeTreeDeltaOperationType,
    MergeTreeDeltaType,
    PropertySet,
    ReferenceType,
    Trackable,
    TrackingGroup,
} from "@fluidframework/merge-tree";
import { SequenceDeltaEvent, SharedSegmentSequence } from "@fluidframework/sequence";
import { IRevertible, UndoRedoStackManager } from "./undoRedoStackManager";

/**
 * A shared segment sequence undo redo handler that will add all local sequences changes to the provided
 * undo redo stack manager
 */
export class SharedSegmentSequenceUndoRedoHandler {
    // eslint-disable-next-line max-len
    private readonly sequences = new Map<SharedSegmentSequence<ISegment>, SharedSegmentSequenceRevertible | undefined>();

    constructor(private readonly stackManager: UndoRedoStackManager) {
        this.stackManager.on("changePushed", () => this.sequences.clear());
    }

    public attachSequence<T extends ISegment>(sequence: SharedSegmentSequence<T>) {
        sequence.on("sequenceDelta", this.sequenceDeltaHandler);
    }

    public detachSequence<T extends ISegment>(sequence: SharedSegmentSequence<T>) {
        sequence.removeListener("sequenceDelta", this.sequenceDeltaHandler);
    }

    private readonly sequenceDeltaHandler = (event: SequenceDeltaEvent, target: SharedSegmentSequence<ISegment>) => {
        if (event.isLocal) {
            let revertible = this.sequences.get(target);
            if (revertible === undefined) {
                revertible = new SharedSegmentSequenceRevertible(target);
                this.stackManager.pushToCurrentOperation(revertible);
                this.sequences.set(target, revertible);
            }
            revertible.add(event);
        }
    };
}

interface ITrackedSharedSegmentSequenceRevertible {
    trackingGroup: TrackingGroup;
    propertyDelta: PropertySet;
    operation: MergeTreeDeltaOperationType;
}

/**
 * Tracks a change on a shared segment sequence and allows reverting it
 */
export class SharedSegmentSequenceRevertible implements IRevertible {
    private readonly revertibles: ITrackedSharedSegmentSequenceRevertible[];

    constructor(
        public readonly sequence: SharedSegmentSequence<ISegment>,
    ) {
        this.revertibles = [];
    }

    public add(event: SequenceDeltaEvent) {
        if (event.ranges.length > 0) {
            let currentRevertible = this.revertibles.length > 0
                ? this.revertibles[this.revertibles.length - 1]
                : undefined;
            for (const range of event.ranges) {
                let trackable: Trackable = range.segment;
                // on remove create a local reference position to track
                // the position of the segment in the sequence
                // then move all tracking groups to the local reference position
                //
                if (event.deltaOperation === MergeTreeDeltaType.REMOVE) {
                    trackable = this.sequence.createLocalReferencePosition(
                        range.segment,
                        0,
                        ReferenceType.SlideOnRemove,
                        { segment: range.segment.toJSONObject() });

                    range.segment.trackingCollection.trackingGroups.forEach((tg) => {
                        tg.link(trackable);
                        tg.unlink(range.segment);
                    });
                }

                if (currentRevertible !== undefined
                    && currentRevertible.operation === event.deltaOperation
                    && matchProperties(currentRevertible.propertyDelta, range.propertyDeltas)) {
                    currentRevertible.trackingGroup.link(trackable);
                } else {
                    const tg = new TrackingGroup();
                    tg.link(trackable);
                    currentRevertible = {
                        trackingGroup: tg,
                        propertyDelta: range.propertyDeltas,
                        operation: event.deltaOperation,
                    };
                    this.revertibles.push(currentRevertible);
                }
            }
        }
    }

    public revert() {
        while (this.revertibles.length > 0) {
            const revertible = this.revertibles.pop();
            if (revertible !== undefined) {
                while (revertible.trackingGroup.size > 0) {
                    const tracked = revertible.trackingGroup.tracked[0];
                    tracked.trackingCollection.unlink(revertible.trackingGroup);
                    switch (revertible.operation) {
                        case MergeTreeDeltaType.INSERT:
                            if (tracked.isLeaf() && tracked.removedSeq === undefined) {
                                const start = this.sequence.getPosition(tracked);
                                this.sequence.removeRange(start, start + tracked.cachedLength);
                            }
                            break;

                        case MergeTreeDeltaType.REMOVE:
                           assert(!tracked.isLeaf(), "should be local reference");
                            const insertPos = this.sequence.localReferencePositionToPosition(tracked);
                            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                            const insertSegment = this.sequence.insertSegmentFromSpec!(
                                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                                tracked.properties!.segment,
                                insertPos);

                            tracked.trackingCollection.trackingGroups.forEach((tg) => {
                                tg.link(insertSegment);
                                tg.unlink(tracked);
                            });
                            const forward = tracked.getSegment().ordinal < insertSegment.ordinal;
                            const insertRef: LocalReferencePosition[] = [];
                            const refHandler = (
                                lref: LocalReferencePosition) => {
                                    if (tracked !== lref) {
                                        if (forward) {
                                            insertRef.push(lref);
                                        } else {
                                            insertRef.unshift(lref);
                                        }
                                    }
                                };
                            nodeMap(
                                tracked.getSegment().parent,
                                tracked.getSegment(),
                                (seg) => {
                                    if (seg === insertSegment) {
                                        return false;
                                    }
                                    if (seg.localRefs?.empty === false) {
                                        return seg.localRefs.walkReferences(
                                            refHandler,
                                            seg === tracked.getSegment() ? tracked : undefined,
                                            forward);
                                    }
                                    return true;
                                },
                                forward);

                            tracked.getSegment().localRefs?.removeLocalRef(tracked);
                            if (insertRef.length > 0) {
                                const localRefs =
                                    insertSegment.localRefs ??= new LocalReferenceCollection(insertSegment);
                                localRefs.addBeforeTombstones(insertRef);
                            }

                            break;

                        case MergeTreeDeltaType.ANNOTATE:
                            if (tracked.isLeaf() && tracked.removedSeq === undefined) {
                                const start = this.sequence.getPosition(tracked);
                                this.sequence.annotateRange(
                                    start,
                                    start + tracked.cachedLength,
                                    revertible.propertyDelta,
                                    undefined);
                            }
                            break;
                        default:
                            throw new Error("operation type not revertible");
                    }
                }
            }
        }
    }

    public discard() {
        while (this.revertibles.length > 0) {
            const tracked = this.revertibles.pop();
            if (tracked !== undefined) {
                while (tracked.trackingGroup.size > 0) {
                    tracked.trackingGroup.unlink(tracked.trackingGroup.tracked[0]);
                }
            }
        }
    }
}

export function nodeMap<TData>(
    startBlock: IMergeBlock | undefined,
    startChild: IMergeNode,
    leafAction: (seg: ISegment, accum?: TData) => boolean,
    forward: boolean,
    accum?: TData,
): boolean {
    if (startBlock?.children?.[startChild?.index] !== startChild) {
        throw new Error("invalid child");
    }
    const increment = forward ? 1 : -1;
    let current: { block: IMergeBlock; start: IMergeNode; } | undefined = {
        block: startBlock,
        start: startChild,
    };
    while (current !== undefined) {
        while (!current.start.isLeaf()) {
            current.block = current.start;
            current.start = current.block.children[forward ? 0 : current.block.childCount - 1];
        }
        for (let childIndex = current.start.index;
            childIndex >= 0 && childIndex < current.block.childCount;
            childIndex += increment) {
            const child = current.block.children[childIndex];
            assert(child.isLeaf(), "all children must be leaves when start is");
            if (leafAction(child, accum) === false) {
                return false;
            }
        }
        while (current.block.parent !== undefined
            && current.block.parent.children[current.block.index + increment] === undefined) {
            current.start = current.block;
            current.block = current.block.parent;
        }
        if (current.block.parent !== undefined) {
            current.start = current.block.parent.children[current.block.index + increment];
            current.block = current.block.parent;
        } else {
            current = undefined;
        }
    }
    return true;
}
