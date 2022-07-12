/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { assert } from "@fluidframework/common-utils";
import {
    IMergeNode,
    ISegment,
    ListMakeHead,
    LocalReferenceCollection,
    LocalReferencePosition,
    matchProperties,
    MergeTreeDeltaOperationType,
    MergeTreeDeltaType,
    PropertySet,
    ReferenceType,
    toRemovalInfo,
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
                    const sg = revertible.trackingGroup.tracked[0];
                    sg.trackingCollection.unlink(revertible.trackingGroup);
                    switch (revertible.operation) {
                        case MergeTreeDeltaType.INSERT:
                            if (sg.isLeaf() && sg.removedSeq === undefined) {
                                const start = this.sequence.getPosition(sg);
                                this.sequence.removeRange(start, start + sg.cachedLength);
                            }
                            break;

                        case MergeTreeDeltaType.REMOVE:
                           assert(!sg.isLeaf(), "should be local reference");
                            const insertPos = this.sequence.localReferencePositionToPosition(sg);
                            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                            const insertSegment = this.sequence.insertSegmentFromSpec!(
                                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                                sg.properties!.segment,
                                insertPos);

                            sg.trackingCollection.trackingGroups.forEach((tg) => {
                                tg.link(insertSegment);
                                tg.unlink(sg);
                            });
                            const forward = sg.getSegment().ordinal < insertSegment.ordinal;
                            const insertRef = ListMakeHead<LocalReferencePosition>();

                            nodeMap(
                                sg.getSegment(),
                                (seg) => {
                                    if (seg === insertSegment) {
                                        return false;
                                    }
                                    if (seg.localRefs?.empty === false) {
                                        seg.localRefs.walkReferences(
                                            (ref) => {
                                                if (ref !== sg) {
                                                    if (forward) {
                                                        insertRef.enqueue(ref);
                                                    } else {
                                                        insertRef.unshift(ref);
                                                    }
                                                }
                                            },
                                            seg === sg.getSegment() ? sg : undefined,
                                            forward);
                                    }
                                    return true;
                                },
                                forward);

                            sg.getSegment().localRefs?.removeLocalRef(sg);

                            const localRefs = insertSegment.localRefs ??= new LocalReferenceCollection(insertSegment);
                            if (forward) {
                                localRefs.addBefore(insertRef);
                            } else {
                                localRefs.addAfter(insertRef);
                            }

                            break;

                        case MergeTreeDeltaType.ANNOTATE:
                            if (sg.isLeaf() && sg.removedSeq === undefined) {
                                const start = this.sequence.getPosition(sg);
                                this.sequence.annotateRange(
                                    start,
                                    start + sg.cachedLength,
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

export function nodeMap(
    block: IMergeNode, leafAction: (seg: ISegment) => boolean, forward: boolean): boolean {
    const parent = block.parent;

    if (parent === undefined) {
        return false;
    }

    for (let childIndex = block.index;
        childIndex >= 0 && childIndex < parent.childCount;
        childIndex += (forward ? 1 : -1)) {
        const child = parent.children[childIndex];

        if (child.isLeaf()) {
            if (!leafAction(child)) {
                return false;
            }
        } else if (child.childCount > 0 && child !== block) {
           return nodeMap(
            forward ? child.children[0] : child.children[child.childCount - 1],
            leafAction,
            forward);
        }
    }
    return nodeMap(parent, leafAction, forward);
}
