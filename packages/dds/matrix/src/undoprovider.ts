/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { assert } from "@fluidframework/common-utils";
import {
	MergeTreeDeltaType,
	IMergeTreeDeltaCallbackArgs,
	MergeTreeDeltaRevertible,
	appendToMergeTreeDeltaRevertibles,
	discardMergeTreeDeltaRevertible,
	Trackable,
} from "@fluidframework/merge-tree";
import { Internal, MatrixItem, SharedMatrix } from "./matrix";
import { Handle, isHandleValid } from "./handletable";
import { PermutationVector } from "./permutationvector";
import { IUndoConsumer } from "./types";

export class VectorUndoProvider {
	// 'currentGroup' and 'currentOp' are used while applying an IRevertable.revert() to coalesce
	// the recorded into a single IRevertable / tracking group as they move between the undo <->
	// redo stacks.
	private currentGroup?: MergeTreeDeltaRevertible;
	private currentOp?: MergeTreeDeltaType;

	constructor(
		private readonly manager: IUndoConsumer,
		private readonly undoInsert: (segment: Trackable) => void,
		private readonly undoRemove: (segment: Trackable) => void,
	) {}

	public record(deltaArgs: IMergeTreeDeltaCallbackArgs) {
		if (deltaArgs.deltaSegments.length > 0) {
			// Link each segment to a new TrackingGroup.  A TrackingGroup keeps track of the original
			// set of linked segments, including any fragmentation that occurs due to future splitting.
			//
			// A TrackingGroup also prevents removed segments from being unlinked from the tree during
			// Zamboni and guarantees segments will not be merged/coalesced with segments outside of the
			// current tracking group.
			//
			// These properties allow us to rely on MergeTree.getPosition() to find the locations/lengths
			// of all content contained within the tracking group in the future.

			// If we are in the process of reverting, the `IRevertible.revert()` will provide the tracking
			// group so that we can preserve the original segment ranges as a single op/group as we move
			// ops between the undo <-> redo stacks.f
			const revertibles: MergeTreeDeltaRevertible[] =
				this.currentGroup === undefined ? [] : [this.currentGroup];
			appendToMergeTreeDeltaRevertibles(undefined, deltaArgs, revertibles);

			// For SharedMatrix, each IRevertibles always holds a single row/col operation.
			// Therefore, 'currentOp' must either be undefined or equal to the current op.
			assert(
				this.currentOp === undefined || this.currentOp === deltaArgs.operation,
				0x02a /* "On vector undo, unexpected 'currentOp' type/state!" */,
			);

			switch (deltaArgs.operation) {
				case MergeTreeDeltaType.INSERT:
					if (this.currentOp !== MergeTreeDeltaType.INSERT) {
						this.pushRevertible(revertibles[0], this.undoInsert);
					}
					break;

				case MergeTreeDeltaType.REMOVE: {
					if (this.currentOp !== MergeTreeDeltaType.REMOVE) {
						this.pushRevertible(revertibles[0], this.undoRemove);
					}
					break;
				}

				default:
					throw new Error("operation type not revertible");
			}

			// If we are in the process of reverting, set 'currentOp' to remind ourselves not to push
			// another revertible until `IRevertable.revert()` finishes the current op and clears this
			// field.
			if (this.currentGroup !== undefined) {
				this.currentOp = deltaArgs.operation;
			}
		}
	}

	private pushRevertible(
		trackingGroup: MergeTreeDeltaRevertible,
		callback: (segment: Trackable) => void,
	) {
		const revertible = {
			revert: () => {
				assert(
					this.currentGroup === undefined && this.currentOp === undefined,
					0x02b /* "Must not nest calls to IRevertible.revert()" */,
				);

				try {
					while (trackingGroup.trackingGroup.size > 0) {
						const tracked = trackingGroup.trackingGroup.tracked[0];

						// Unlink 'segment' from the current tracking group before invoking the callback
						// to exclude the current undo/redo segment from those copied to the replacement
						// segment (if any). (See 'PermutationSegment.transferToReplacement()')
						tracked.trackingCollection.unlink(trackingGroup.trackingGroup);

						callback(tracked);
					}
				} finally {
					this.currentOp = undefined;
					this.currentGroup = undefined;
				}
			},
			discard: () => {
				discardMergeTreeDeltaRevertible([trackingGroup]);
			},
		};

		this.manager.pushToCurrentOperation(revertible);

		return revertible;
	}
}

export class MatrixUndoProvider<T> {
	constructor(
		private readonly consumer: IUndoConsumer,
		private readonly matrix: SharedMatrix<T>,
		private readonly rows: PermutationVector,
		private readonly cols: PermutationVector,
	) {
		rows.undo = new VectorUndoProvider(
			consumer,
			/* undoInsert: */ (segment: Trackable) => {
				assert(segment.isLeaf(), "");
				const start = this.rows.getPosition(segment);
				this.matrix.removeRows(start, segment.cachedLength);
			},
			/* undoRemove: */ (segment: Trackable) => {
				this.matrix._undoRemoveRows(segment);
			},
		);
		cols.undo = new VectorUndoProvider(
			consumer,
			/* undoInsert: */ (segment: Trackable) => {
				assert(segment.isLeaf(), "");
				const start = this.cols.getPosition(segment);
				this.matrix.removeCols(start, segment.cachedLength);
			},
			/* undoRemove: */ (segment: Trackable) => {
				this.matrix._undoRemoveCols(segment);
			},
		);
	}

	cellSet(rowHandle: Handle, colHandle: Handle, oldValue: MatrixItem<T>) {
		assert(
			isHandleValid(rowHandle) && isHandleValid(colHandle),
			0x02c /* "On cellSet(), invalid row and/or column handles!" */,
		);

		if (this.consumer !== undefined) {
			this.consumer.pushToCurrentOperation({
				revert: () => {
					this.matrix.setCell(
						this.rows.handleToPosition(rowHandle),
						this.cols.handleToPosition(colHandle),
						oldValue,
					);
				},
				discard: () => {},
			});
		}
	}
}
