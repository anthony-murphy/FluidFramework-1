import { Stack } from "./collections";
import { ISegment } from "./mergeTree";
import { ReferenceType, ICombiningOp } from "./ops";
import { PropertySet, MapLike } from "./properties";

export const reservedTileLabelsKey = "referenceTileLabels";
export const reservedRangeLabelsKey = "referenceRangeLabels";

export interface LabeledReference{
        refType: ReferenceType,
        properties?: PropertySet,
}

export const refGetTileLabels = (refPos: LabeledReference) =>
    // eslint-disable-next-line no-bitwise
    (refPos.refType & ReferenceType.Tile)
        && refPos.properties ? refPos.properties[reservedTileLabelsKey] as string[] : undefined;

export const refGetRangeLabels = (refPos: LabeledReference) =>
    // eslint-disable-next-line no-bitwise
    (refPos.refType & (ReferenceType.NestBegin | ReferenceType.NestEnd))
        && refPos.properties ? refPos.properties[reservedRangeLabelsKey] as string[] : undefined;

export function refHasTileLabel(refPos: LabeledReference, label: string) {
    const tileLabels = refGetTileLabels(refPos);
    if (tileLabels) {
        for (const refLabel of tileLabels) {
            if (label === refLabel) {
                return true;
            }
        }
    }
    return false;
}

export function refHasRangeLabel(refPos: LabeledReference, label: string) {
    const rangeLabels = refGetRangeLabels(refPos);
    if (rangeLabels) {
        for (const refLabel of rangeLabels) {
            if (label === refLabel) {
                return true;
            }
        }
    }
    return false;
}
export function refHasTileLabels(refPos: LabeledReference) {
    return !!refGetTileLabels(refPos);
}
export function refHasRangeLabels(refPos: LabeledReference) {
    return !!refGetRangeLabels(refPos);
}

export interface ReferencePosition {
    properties?: PropertySet;
    refType: ReferenceType;
    // True if this reference is a segment.
    /**
     * @deprecated
     */
    isLeaf(): boolean;
    getSegment(): ISegment | undefined;
    getOffset(): number;
    addProperties(newProps: PropertySet, op?: ICombiningOp): void;

    /**
     * @deprecated
     */
    hasTileLabels(): boolean;
    /**
     * @deprecated
     */
    hasRangeLabels(): boolean;
    /**
     * @deprecated
     */
    hasTileLabel(label: string): boolean;
    /**
     * @deprecated
     */
    hasRangeLabel(label: string): boolean;
    /**
     * @deprecated
     */
    getTileLabels(): string[] | undefined;
    /**
     * @deprecated
     */
    getRangeLabels(): string[] | undefined;
}

export type RangeStackMap = MapLike<Stack<ReferencePosition>>;
export const DetachedReferencePosition = -1;
