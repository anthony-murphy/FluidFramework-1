import { assert, unreachableCase } from "@fluidframework/common-utils";
import { UsageError } from "@fluidframework/container-utils";
import { List } from "./collections";
import { EndOfTreeSegment } from "./endOfTreeSegment";
import { LocalReferenceCollection, LocalReferencePosition } from "./localReference";
import {
    IMergeTreeDeltaCallbackArgs,
    IMergeTreeSegmentDelta,
} from "./mergeTreeDeltaCallback";
import { IRemovalInfo, ISegment, toRemovalInfo } from "./mergeTreeNodes";
import { depthFirstNodeWalk } from "./mergeTreeNodeWalk";
import { TrackingGroup } from "./mergeTreeTracking";
import {
    IJSONSegment,
    MergeTreeDeltaType,
    ReferenceType,
} from "./ops";
import { matchProperties, PropertySet } from "./properties";
import { DetachedReferencePosition } from "./referencePositions";

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

export interface RevertDriver{
    /**
     * Creates a `LocalReferencePosition` on this SharedString. If the refType does not include
     * ReferenceType.Transient, the returned reference will be added to the localRefs on the provided segment.
     * @param segment - Segment to add the local reference on
     * @param offset - Offset on the segment at which to place the local reference
     * @param refType - ReferenceType for the created local reference
     * @param properties - PropertySet to place on the created local reference
     */
    createLocalReferencePosition(
        segment: ISegment,
        offset: number,
        refType: ReferenceType,
        properties: PropertySet | undefined): LocalReferencePosition;

    removeRange(start: number, end: number);
    /**
     * Returns the current position of a segment, and -1 if the segment
     * does not exist in this sequence
     * @param segment - The segment to get the position of
     */
    getPosition(segment: ISegment): number;

    /**
     * Annotates the range with the provided properties
     *
     * @param start - The inclusive start position of the range to annotate
     * @param end - The exclusive end position of the range to annotate
     * @param props - The properties to annotate the range with
     *
     */
    annotateRange(
        start: number,
        end: number,
        props: PropertySet);

    insertFromSpec(pos: number, spec: IJSONSegment): ISegment;

    localReferencePositionToPosition(lref: LocalReferencePosition): number;

}
type InternalRevertDriver = RevertDriver & {
    __mergeTreeRevertible?: {
        detachedReferences?: ISegment & IRemovalInfo;
        refCallbacks?: LocalReferencePosition["callbacks"]; };
};

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
    revertibles: MergeTreeDeltaRevertible[], driver: RevertDriver, deltaSegments: IMergeTreeSegmentDelta[],
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
        const ref = driver.createLocalReferencePosition(
            t.segment,
            0,
            ReferenceType.SlideOnRemove,
            props);
        const internalDriver: InternalRevertDriver = driver;
        const driverRevertibleProps = internalDriver.__mergeTreeRevertible ??= {};
        ref.callbacks = driverRevertibleProps.refCallbacks ??= {
            afterSlide: (r: LocalReferencePosition) => {
                if (driver.localReferencePositionToPosition(r) === DetachedReferencePosition) {
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    const detached = driverRevertibleProps.detachedReferences ??= new EndOfTreeSegment(r.getSegment()!);
                    const refs = detached.localRefs ??= new LocalReferenceCollection(detached);
                    refs.addAfterTombstones([r]);
                }
            },
        };
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
    revertibles: MergeTreeDeltaRevertible[], driver: RevertDriver, event: IMergeTreeDeltaCallbackArgs,
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
                driver,
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

export function revertLocalInsert(driver: RevertDriver, revertible: InsertRevertible) {
    while (revertible.trackingGroup.size > 0) {
        const tracked = revertible.trackingGroup.tracked[0];
        assert(
            tracked.trackingCollection.unlink(revertible.trackingGroup),
        "tracking group removed");
        assert(tracked.isLeaf(), "inserts must track segments");
        if (toRemovalInfo(tracked) === undefined) {
            const start = driver.getPosition(tracked);
            driver.removeRange(start, start + tracked.cachedLength);
        }
    }
}

export function revertLocalRemove(driver: RevertDriver, revertible: RemoveRevertible) {
    while (revertible.trackingGroup.size > 0) {
        const tracked = revertible.trackingGroup.tracked[0];

        assert(
            tracked.trackingCollection.unlink(revertible.trackingGroup),
        "tracking group removed");

        assert(!tracked.isLeaf(), "removes must track local refs");

        let realPos = driver.localReferencePositionToPosition(tracked);
        const refSeg = tracked.getSegment();

        if (realPos === DetachedReferencePosition || refSeg === undefined) {
            throw new UsageError("Cannot insert at detached references position");
        }

        if (toRemovalInfo(refSeg) === undefined
            && refSeg.localRefs?.isAfterTombstone(tracked)) {
            realPos++;
        }

        const props = tracked.properties as RemoveSegmentRefProperties;
        const insertSegment = driver.insertFromSpec(
            realPos,
            props.segSpec);

        const localSlideFilter = (lref: LocalReferencePosition) =>
            (lref.properties as Partial<RemoveSegmentRefProperties>)?.referenceSpace === "revertible";

        const insertRef: Partial<Record<"before" | "after", List<LocalReferencePosition>>> = {};
        const forward = insertSegment.ordinal < refSeg.ordinal;
        const refHandler = (lref: LocalReferencePosition) => {
            if (localSlideFilter(lref)) {
                if (forward) {
                    const before = insertRef.before ??= new List();
                    before.push(lref);
                } else {
                    const after = insertRef.after ??= new List();
                    after.unshift(lref);
                }
            }
            if (tracked === lref) {
                return false;
            }
        };
        depthFirstNodeWalk(
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            insertSegment.parent!,
            insertSegment,
            undefined,
            (seg) => {
                if (seg.localRefs?.empty === false) {
                    return seg.localRefs.walkReferences(
                        refHandler,
                        undefined,
                        forward);
                }
                return true;
            },
            undefined,
            forward);
        const internalDriver: InternalRevertDriver = driver;
        if (internalDriver.__mergeTreeRevertible?.detachedReferences?.localRefs?.has(tracked)) {
            assert(forward, "forward should always be true when detached");
            internalDriver.__mergeTreeRevertible.detachedReferences.localRefs.walkReferences(refHandler);
        }

        if (insertRef !== undefined) {
            const localRefs =
                insertSegment.localRefs ??= new LocalReferenceCollection(insertSegment);
            if (insertRef.before?.empty === false) {
                localRefs.addBeforeTombstones(insertRef.before.map((n) => n.data));
            }
            if (insertRef.after?.empty === false) {
                localRefs.addAfterTombstones(insertRef.after.map((n) => n.data));
            }
        }

        tracked.trackingCollection.trackingGroups.forEach((tg) => {
            tg.link(insertSegment);
            tg.unlink(tracked);
        });
        tracked.getSegment()?.localRefs?.removeLocalRef(tracked);
    }
}

export function revertLocalAnnotate(driver: RevertDriver, revertible: AnnotateRevertible) {
    while (revertible.trackingGroup.size > 0) {
        const tracked = revertible.trackingGroup.tracked[0];
        const unlinked = tracked.trackingCollection.unlink(revertible.trackingGroup);
        assert(unlinked && tracked.isLeaf(), "annotates must track segments");
        if (toRemovalInfo(tracked) === undefined) {
            const start = driver.getPosition(tracked);
            driver.annotateRange(
                start,
                start + tracked.cachedLength,
                revertible.propertyDeltas);
        }
    }
}

export function revert(driver: RevertDriver, ... revertibles: MergeTreeDeltaRevertible[]) {
    while (revertibles.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const r = revertibles.pop()!;
        const operation = r.operation;
        switch (operation) {
            case MergeTreeDeltaType.INSERT:
                revertLocalInsert(driver, r);
                break;
            case MergeTreeDeltaType.REMOVE:
                revertLocalRemove(driver, r);
                break;
            case MergeTreeDeltaType.ANNOTATE:
                revertLocalAnnotate(driver, r);
                break;
            default:
                unreachableCase(operation, "");
        }
    }
}
