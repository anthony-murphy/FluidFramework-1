/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { ISegment } from "./mergeTree";

/**
 * Stores a unique and sorted set of segments, or objects with segments
 *
 * This differs from a normal sorted set in that the keys are not fixed.
 * The segments are sorted via their ordinals which can change as the merge tree is modified.
 * Even though the values of the ordinals can change their ordering and uniqueness cannot, so the order of a set of
 * segments ordered by their ordinals will always have the same order even if the ordinal values on
 * the segments changes. This invariant allows ensure the segments stay ordered and unique, and that new segments
 * can be inserted into that order.
 */
export class SortedSegmentSet<
    T extends ISegment | { readonly segment: ISegment; } | { getSegment(): ISegment | undefined; } = ISegment> {
    private readonly ordinalSortedItems: T[] = [];

    public get size(): number {
        return this.ordinalSortedItems.length;
    }

    public get items(): readonly T[] {
        return this.ordinalSortedItems;
    }

    public addOrUpdate(newItem: T, update?: (existingItem: T, newItem: T) => T) {
        const position = this.findItemPosition(newItem);
        if (position.exists) {
            if (update) {
                update(this.ordinalSortedItems[position.index], newItem);
            }
        } else {
            this.ordinalSortedItems.splice(position.index, 0, newItem);
        }
    }
    public remove(item: T): boolean {
        const position = this.findItemPosition(item);
        if (position.exists) {
            this.ordinalSortedItems.splice(position.index, 1);
            return true;
        }
        return false;
    }

    public has(item: T): boolean {
        const position = this.findItemPosition(item);
        return position.exists;
    }

    private getOrdinal(item: T): string {
        const maybeObject =
            item as Partial<{ readonly segment: ISegment; getSegment(): ISegment; }> & Pick<ISegment, "ordinal">;
        return maybeObject.segment?.ordinal
            ?? maybeObject.getSegment?.().ordinal
            ?? maybeObject.ordinal;
    }

    private findItemPosition(
        item: T,
        start?: number,
        end?: number): { exists: boolean; index: number; } {
        if (this.ordinalSortedItems.length === 0) {
            return { exists: false, index: 0 };
        }
        if (start === undefined || end === undefined) {
            return this.findItemPosition(item, 0, this.ordinalSortedItems.length - 1);
        }
        const index = start + Math.floor((end - start) / 2);
        const itemOrdinal = this.getOrdinal(item);
        const indexOrdinal = this.getOrdinal(this.ordinalSortedItems[index]);
        if (indexOrdinal > itemOrdinal) {
            if (start === index) {
                return { exists: false, index };
            }
            return this.findItemPosition(item, start, index - 1);
        }

        if (indexOrdinal < itemOrdinal) {
            if (index === end) {
                return { exists: false, index: index + 1 };
            }
            return this.findItemPosition(item, index + 1, end);
        }

        // at this point we've found the ordinal of the item
        // so we need to find the index of the item instance
        //
        if (item === this.ordinalSortedItems[index]) {
            return { exists: true, index };
        }

        let result = { exists: false, index };
        if (index > start && this.getOrdinal(this.ordinalSortedItems[index - 1]) === itemOrdinal) {
            result = this.findItemPosition(item, start, index - 1);
            // only return the back index if the item exist
            if (result.exists) {
                return result;
            }
        }
        if (index < end && this.getOrdinal(this.ordinalSortedItems[index + 1]) === itemOrdinal) {
            // return the forward index regardless of if the item exists
            // this should be the last index with a matching ordinal
            result = this.findItemPosition(item, index + 1, end);
        }

        return result;
    }
}
