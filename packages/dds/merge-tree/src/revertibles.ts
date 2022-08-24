import { UsageError } from "@fluidframework/container-utils";
import { Client } from "./client";
import {
    IMergeTreeDeltaCallbackArgs,
    IMergeTreeSegmentDelta,
} from "./mergeTreeDeltaCallback";
import { Trackable, TrackingGroup } from "./mergeTreeTracking";
import { MergeTreeDeltaType, ReferenceType } from "./ops";
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

export function appendLocalInsertToRevertible(revertible: InsertRevertible, deltaSegments: IMergeTreeSegmentDelta[]) {
    deltaSegments.forEach((t) => revertible.trackingGroup.link(t.segment));
    return revertible;
}

export function createLocalInsertRevertible(deltaSegments: IMergeTreeSegmentDelta[]) {
    return appendLocalInsertToRevertible(
        {
            operation: MergeTreeDeltaType.INSERT,
            trackingGroup: new TrackingGroup(),
        },
        deltaSegments);
}

export function appendLocalRemoveToRevertible(
    revertible: RemoveRevertible, client: Client, deltaSegments: IMergeTreeSegmentDelta[],
) {
    deltaSegments.forEach((t) => {
        const ref = client.createLocalReferencePosition(
            t.segment,
            0,
            ReferenceType.SlideOnRemove,
            { segSpec: t.segment.toJSONObject() });
        t.segment.trackingCollection.trackingGroups.forEach((tg) => {
            tg.link(ref);
            tg.unlink(t.segment);
        });
        revertible.trackingGroup.link(ref);
    });
    return revertible;
}

export function createLocalRemoveRevertible(client: Client, deltaSegments: IMergeTreeSegmentDelta[]) {
    return appendLocalRemoveToRevertible(
        {
            operation: MergeTreeDeltaType.REMOVE,
            trackingGroup: new TrackingGroup(),
        },
        client,
        deltaSegments);
}

export function appendLocalAnnotateToRevertibles(
    revertibles: MergeTreeDeltaRevertible[], deltaSegments: IMergeTreeSegmentDelta[],
) {
    deltaSegments.forEach((ds) => {
        const propertyDeltas = ds.propertyDeltas;
        if (propertyDeltas) {
            const lastRevertible: MergeTreeDeltaRevertible | undefined =
                revertibles[revertibles.length - 1];
            if (lastRevertible.operation === MergeTreeDeltaType.ANNOTATE
                && matchProperties(lastRevertible?.propertyDeltas, propertyDeltas)) {
                lastRevertible.trackingGroup.link(ds.segment);
            } else {
                const trackingGroup = new TrackingGroup();
                trackingGroup.link(ds.segment);
                revertibles.push({
                    operation: MergeTreeDeltaType.ANNOTATE,
                    propertyDeltas,
                    trackingGroup,
                });
            }
        }
    });
    return revertibles;
}

export function createLocalAnnotateRevertibles(deltaSegments: IMergeTreeSegmentDelta[]) {
    return appendLocalAnnotateToRevertibles([], deltaSegments);
}

export function createRevertibles(
    client: Client, event: IMergeTreeDeltaCallbackArgs,
): MergeTreeDeltaRevertible | MergeTreeDeltaRevertible[] {
    switch (event.operation) {
        case MergeTreeDeltaType.INSERT:
            return createLocalInsertRevertible(event.deltaSegments);
        case MergeTreeDeltaType.REMOVE:
            return createLocalRemoveRevertible(client, event.deltaSegments);
        case MergeTreeDeltaType.ANNOTATE:
            return createLocalAnnotateRevertibles(event.deltaSegments);
        default:
            throw new UsageError(`Unsupported event delta type: ${event.operation}`);
    }
}

export function appendToRevertibles(
    revertibles: MergeTreeDeltaRevertible[], client: Client, event: IMergeTreeDeltaCallbackArgs,
) {
    if (revertibles[revertibles.length - 1].operation !== event.operation) {
        revertibles.concat(createRevertibles(client, event));
    } else {
        switch (event.operation) {
            case MergeTreeDeltaType.INSERT:
                appendLocalInsertToRevertible(
                    revertibles[revertibles.length - 1] as InsertRevertible, event.deltaSegments);
                break;
            case MergeTreeDeltaType.REMOVE:
                appendLocalRemoveToRevertible(
                    revertibles[revertibles.length - 1] as RemoveRevertible, client, event.deltaSegments);
                break;
            case MergeTreeDeltaType.ANNOTATE:
                appendLocalAnnotateToRevertibles(
                    revertibles, event.deltaSegments);
                break;
            default:
                throw new UsageError(`Unsupported event delta type: ${event.operation}`);
        }
    }
}

export function discardRevertibles(... revertibles: MergeTreeDeltaRevertible[]) {
    revertibles.forEach((r) => {
        r.trackingGroup.tracked.forEach((t) => t.trackingCollection.unlink(r.trackingGroup));
    });
}

export function revertLocalInsert(client: Client, revertible: InsertRevertible) {
    let notRevertible: Trackable[] | undefined;

    for (const tracked of revertible.trackingGroup.tracked) {
        if (tracked.isLeaf()) {
            tracked.trackingCollection.unlink(revertible.trackingGroup);
            if (tracked.removedSeq === undefined) {
                const start = client.getPosition(tracked);
                client.removeRangeLocal(start, start + tracked.cachedLength);
            }
        } else {
            notRevertible ??= [];
            notRevertible.push(tracked);
        }
    }

    return notRevertible;
}

export function revertLocalRemove(client: Client, revertible: RemoveRevertible) {
    let notRevertible: Trackable[] | undefined;

    for (const tracked of revertible.trackingGroup.tracked) {
        if (!tracked.isLeaf()) {
            tracked.trackingCollection.unlink(revertible.trackingGroup);
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const insertSegment = client.specToSegment(tracked.properties!.segment);
            client.insertAtReferencePositionLocal(tracked, insertSegment, () => true);

            tracked.getSegment().localRefs?.removeLocalRef(tracked);

            tracked.trackingCollection.trackingGroups.forEach((tg) => {
                tg.link(insertSegment);
                tg.unlink(tracked);
            });
        } else {
            notRevertible ??= [];
            notRevertible.push(tracked);
        }
    }

    return notRevertible;
}

export function revertLocalAnnotate(client: Client, revertible: AnnotateRevertible) {
    let notRevertible: Trackable[] | undefined;
    for (const tracked of revertible.trackingGroup.tracked) {
        tracked.trackingCollection.unlink(revertible.trackingGroup);
        if (tracked.isLeaf()) {
            const start = client.getPosition(tracked);
            client.annotateRangeLocal(
                start,
                start + tracked.cachedLength,
                revertible.propertyDeltas,
                undefined);
        } else {
            notRevertible ??= [];
            notRevertible.push(tracked);
        }
    }

    return notRevertible;
}

export function revert(client: Client, ... revertibles: MergeTreeDeltaRevertible[]) {
    revertibles.forEach((r) => {
        switch (r.operation) {
            case MergeTreeDeltaType.INSERT:
                revertLocalInsert(client, r);
                break;
            case MergeTreeDeltaType.REMOVE:
                revertLocalRemove(client, r);
                break;
            case MergeTreeDeltaType.ANNOTATE:
                revertLocalAnnotate(client, r);
                break;
            default:
        }
    });
}
