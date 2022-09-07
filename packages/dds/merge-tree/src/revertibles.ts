import { assert } from "@fluidframework/common-utils";
import { UsageError } from "@fluidframework/container-utils";
import { Client } from "./client";
import {
    IMergeTreeDeltaCallbackArgs,
    IMergeTreeSegmentDelta,
} from "./mergeTreeDeltaCallback";
import { toRemovalInfo } from "./mergeTreeNodes";
import { TrackingGroup } from "./mergeTreeTracking";
import { createGroupOp } from "./opBuilder";
import { IJSONSegment, IMergeTreeDeltaOp, IMergeTreeGroupMsg, MergeTreeDeltaType, ReferenceType } from "./ops";
import { matchProperties, PropertySet } from "./properties";

export interface InsertRevertible {
    operation: typeof MergeTreeDeltaType.INSERT;
    trackingGroup: TrackingGroup;
}
export interface RemoveRevertible {
    operation: typeof MergeTreeDeltaType.REMOVE;
    trackingGroup: TrackingGroup;
}
export interface AnnotateRevertible {
    operation: typeof MergeTreeDeltaType.ANNOTATE;
    trackingGroup: TrackingGroup;
    propertyDeltas: PropertySet;
}

export type MergeTreeDeltaRevertible = InsertRevertible | RemoveRevertible | AnnotateRevertible;

interface RemoveSegmentRefProperties extends PropertySet{
    segSpec: IJSONSegment;
    referenceSpace: "revertible";
}

function appendLocalInsertToRevertible(
    revertibles: MergeTreeDeltaRevertible[], deltaSegments: IMergeTreeSegmentDelta[],
) {
    if (revertibles[revertibles.length - 1]?.operation !== MergeTreeDeltaType.INSERT) {
        revertibles.push({
            operation: MergeTreeDeltaType.INSERT,
            trackingGroup: new TrackingGroup(),
        });
    }
    const last = revertibles[revertibles.length - 1];
    deltaSegments.forEach((t) => last.trackingGroup.link(t.segment));

    return revertibles;
}

function appendLocalRemoveToRevertible(
    revertibles: MergeTreeDeltaRevertible[], client: Client, deltaSegments: IMergeTreeSegmentDelta[],
) {
    if (revertibles[revertibles.length - 1]?.operation !== MergeTreeDeltaType.REMOVE) {
        revertibles.push({
            operation: MergeTreeDeltaType.REMOVE,
            trackingGroup: new TrackingGroup(),
        });
    }
    const last = revertibles[revertibles.length - 1];

    deltaSegments.forEach((t) => {
        const props: RemoveSegmentRefProperties = {
            segSpec: t.segment.toJSONObject(),
            referenceSpace: "revertible",
        };
        const ref = client.createLocalReferencePosition(
            t.segment,
            0,
            ReferenceType.SlideOnRemove,
            props);
        t.segment.trackingCollection.trackingGroups.forEach((tg) => {
            tg.link(ref);
            tg.unlink(t.segment);
        });

        last.trackingGroup.link(ref);
    });
    return revertibles;
}

function appendLocalAnnotateToRevertibles(
    revertibles: MergeTreeDeltaRevertible[], deltaSegments: IMergeTreeSegmentDelta[],
) {
    let last = revertibles[revertibles.length - 1];
    deltaSegments.forEach((ds) => {
        const propertyDeltas = ds.propertyDeltas;
        if (propertyDeltas) {
            if (last?.operation === MergeTreeDeltaType.ANNOTATE
                && matchProperties(last?.propertyDeltas, propertyDeltas)) {
                    last.trackingGroup.link(ds.segment);
            } else {
                last = {
                    operation: MergeTreeDeltaType.ANNOTATE,
                    propertyDeltas,
                    trackingGroup: new TrackingGroup(),
                };
                last.trackingGroup.link(ds.segment);
                revertibles.push(last);
            }
        }
    });
    return revertibles;
}

export function appendToRevertibles(
    revertibles: MergeTreeDeltaRevertible[], client: Client, event: IMergeTreeDeltaCallbackArgs,
) {
    switch (event.operation) {
        case MergeTreeDeltaType.INSERT:
            appendLocalInsertToRevertible(
                revertibles,
                event.deltaSegments);
            break;
        case MergeTreeDeltaType.REMOVE:
            appendLocalRemoveToRevertible(
                revertibles,
                client,
                event.deltaSegments);
            break;
        case MergeTreeDeltaType.ANNOTATE:
            appendLocalAnnotateToRevertibles(
                revertibles, event.deltaSegments);
            break;
        default:
            throw new UsageError(`Unsupported event delta type: ${event.operation}`);
    }
}

export function discardRevertibles(... revertibles: MergeTreeDeltaRevertible[]) {
    revertibles.forEach((r) => {
        r.trackingGroup.tracked.forEach((t) => t.trackingCollection.unlink(r.trackingGroup));
    });
}

export function revertLocalInsert(client: Client, revertible: InsertRevertible, ops: IMergeTreeDeltaOp[]) {
    while (revertible.trackingGroup.size > 0) {
        const tracked = revertible.trackingGroup.tracked[0];
        assert(tracked.trackingCollection.trackingGroups.has(revertible.trackingGroup), "insert tracked should exist");
        tracked.trackingCollection.unlink(revertible.trackingGroup);
        assert(!tracked.trackingCollection.trackingGroups.has(revertible.trackingGroup), "tracked should be removed");
        if (!tracked.isLeaf()) {
            assert(tracked.isLeaf(), "inserts must track segments");
        }
        if (toRemovalInfo(tracked) === undefined) {
            const start = client.getPosition(tracked);
            ops.push(client.removeRangeLocal(start, start + tracked.cachedLength));
        }
    }
}

export function revertLocalRemove(client: Client, revertible: RemoveRevertible, ops: IMergeTreeDeltaOp[]) {
    while (revertible.trackingGroup.size > 0) {
        const tracked = revertible.trackingGroup.tracked[0];

        assert(
            tracked.trackingCollection.unlink(revertible.trackingGroup),
        "tracking group removed");

        assert(!tracked.isLeaf(), "removes must track local refs");
        const props = tracked.properties as RemoveSegmentRefProperties;
        const insertSegment = client.specToSegment(props.segSpec);
        const op = client.insertAtReferencePositionLocal(
            tracked,
            insertSegment,
            (lref) =>
                (lref?.properties as Partial<RemoveSegmentRefProperties> | undefined)?.referenceSpace === "revertible");

        tracked.trackingCollection.trackingGroups.forEach((tg) => {
            tg.link(insertSegment);
            tg.unlink(tracked);
        });

        tracked.getSegment()?.localRefs?.removeLocalRef(tracked);

        if (op) {
            ops.push(op);
        }
    }
}

export function revertLocalAnnotate(client: Client, revertible: AnnotateRevertible, ops: IMergeTreeDeltaOp[]) {
    while (revertible.trackingGroup.size > 0) {
        const tracked = revertible.trackingGroup.tracked[0];
        const unlinked = tracked.trackingCollection.unlink(revertible.trackingGroup);
        assert(unlinked && tracked.isLeaf(), "annotates must track segments");
        if (toRemovalInfo(tracked) === undefined) {
            const start = client.getPosition(tracked);
            const op = client.annotateRangeLocal(
                start,
                start + tracked.cachedLength,
                revertible.propertyDeltas,
                undefined);
            if (op) {
                ops.push(op);
            }
        }
    }
}

export function revert(client: Client, ... revertibles: MergeTreeDeltaRevertible[]): IMergeTreeGroupMsg {
    const ops: IMergeTreeDeltaOp[] = [];
    while (revertibles.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const r = revertibles.pop()!;
        switch (r.operation) {
            case MergeTreeDeltaType.INSERT:
                revertLocalInsert(client, r, ops);
                break;
            case MergeTreeDeltaType.REMOVE:
                revertLocalRemove(client, r, ops);
                break;
            case MergeTreeDeltaType.ANNOTATE:
                revertLocalAnnotate(client, r, ops);
                break;
            default:
        }
    }

    return createGroupOp(...ops);
}
