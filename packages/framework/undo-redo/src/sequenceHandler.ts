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
    MergeTree,
    MergeTreeDeltaOperationType,
    MergeTreeDeltaType,
    PropertySet,
    ReferenceType,
    TextSegment,
    Trackable,
    TrackingGroup,
    UnassignedSequenceNumber,
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
                            const insertRef: LocalReferencePosition[] = [];
                            const refHandler = (
                                lref: LocalReferencePosition) => {
                                    if (sg !== lref) {
                                        if (forward) {
                                            insertRef.push(lref);
                                        } else {
                                            insertRef.unshift(lref);
                                        }
                                    }
                                };
                            nodeMap(
                                sg.getSegment().parent,
                                sg.getSegment(),
                                (seg) => {
                                    if (seg === insertSegment) {
                                        return false;
                                    }
                                    if (seg.localRefs?.empty === false) {
                                        return seg.localRefs.walkReferences(
                                            refHandler,
                                            seg === sg.getSegment() ? sg : undefined,
                                            forward);
                                    }
                                    return true;
                                },
                                forward);

                            sg.getSegment().localRefs?.removeLocalRef(sg);
                            if (insertRef.length > 0) {
                                const localRefs =
                                    insertSegment.localRefs ??= new LocalReferenceCollection(insertSegment);
                                localRefs.addBeforeTombstones([insertRef]);
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
    block: IMergeBlock | undefined,
    startChild: IMergeNode,
    leafAction: (seg: ISegment) => boolean,
    forward: boolean,
): boolean {
    if (block?.children?.[startChild?.index] !== startChild) {
        throw new Error("invalid child");
    }
    for (let childIndex = startChild.index;
        childIndex >= 0 && childIndex < block.childCount;
        childIndex += (forward ? 1 : -1)) {
        const child = block.children[childIndex];

        if (child.isLeaf()) {
            if (leafAction(child) === false) {
                return false;
            }
        } else {
            if (nodeMap(child, child.children[forward ? 0 : child.childCount - 1], leafAction, forward) === false) {
                return false;
            }
        }
    }
    {
        let child = block;
        let parent = block.parent;
        while (parent !== undefined) {
            const nextIndex = forward ? child.index + 1 : child.index - 1;
            if (parent.children[nextIndex] !== undefined) {
                return nodeMap(parent, parent.children[nextIndex], leafAction, forward);
            }
            child = parent;
            parent = child.parent;
        }
    }
    return true;
}

export function getSegString(mergeTree: MergeTree): { acked: string; local: string; refs: string; } {
    let acked: string = "";
    let local: string = "";
    let refs: string = "";
    const nodes = [...mergeTree.root.children];
    while (nodes.length > 0) {
        const node = nodes.shift();
        if (node) {
            if (node.isLeaf()) {
                if (TextSegment.is(node)) {
                    if (node.removedSeq === undefined) {
                        if (node.removedSeq === UnassignedSequenceNumber) {
                            acked += "_".repeat(node.text.length);
                            if (node.seq === UnassignedSequenceNumber) {
                                local += "*".repeat(node.text.length);
                            }
                            local += "-".repeat(node.text.length);
                        } else {
                            acked += "-".repeat(node.text.length);
                            local += " ".repeat(node.text.length);
                        }
                    } else {
                        if (node.seq === UnassignedSequenceNumber) {
                            acked += "_".repeat(node.text.length);
                            local += node.text;
                        } else {
                            acked += node.text;
                            local += " ".repeat(node.text.length);
                        }
                    }
                    refs += (node.localRefs?.refCount ?? 0).toString().padEnd(node.text.length, " ");
                }
            } else {
                nodes.push(...node.children);
            }
        }
    }
    return { acked, local, refs };
}
