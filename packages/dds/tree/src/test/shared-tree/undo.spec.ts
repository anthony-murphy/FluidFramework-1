/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import {
	type FieldUpPath,
	type Revertible,
	type UpPath,
	rootFieldKey,
} from "../../core/index.js";
import { singleJsonCursor } from "../json/index.js";
import { SharedTreeFactory, type ITreeCheckout } from "../../shared-tree/index.js";
import { type JsonCompatible, brand } from "../../util/index.js";
import { createTestUndoRedoStacks, expectJsonTree, moveWithin } from "../utils.js";
import { insert, jsonSequenceRootSchema, remove } from "../sequenceRootUtils.js";
import { createIdCompressor } from "@fluidframework/id-compressor/internal";
import {
	MockContainerRuntimeFactory,
	MockFluidDataStoreRuntime,
	MockStorage,
} from "@fluidframework/test-runtime-utils/internal";
import assert from "assert";
import { SchemaFactory, TreeViewConfiguration } from "../../simple-tree/index.js";
// eslint-disable-next-line import/no-internal-modules
import { initialize } from "../../shared-tree/schematizeTree.js";

const rootPath: UpPath = {
	parent: undefined,
	parentField: rootFieldKey,
	parentIndex: 0,
};

const rootField: FieldUpPath = {
	parent: undefined,
	field: rootFieldKey,
};

// TODO: Document the meaning of these various test case properties
const testCases: {
	name: string;
	edit: (undoRedoBranch: ITreeCheckout, otherBranch: ITreeCheckout) => void;
	undoCount?: number;
	initialState: JsonCompatible[];
	editedState: JsonCompatible[];
	undoState?: JsonCompatible[];
	mergeState?: JsonCompatible[];
	skip?: true;
}[] = [
	{
		name: "inserts",
		edit: (actedOn) => {
			insert(actedOn, 0, "x");
			insert(actedOn, 2, "y");
		},
		undoCount: 2,
		initialState: ["A"],
		editedState: ["x", "A", "y"],
	},
	{
		name: "rebased inserts",
		edit: (actedOn, other) => {
			insert(other, 1, "y");
			insert(actedOn, 0, "x");
			insert(actedOn, 3, "z");
		},
		undoCount: 3,
		initialState: ["A", "B"],
		editedState: ["x", "A", "y", "B", "z"],
		undoState: ["A", "y", "B"],
		mergeState: ["A", "B"],
	},
	{
		name: "the remove of a node",
		edit: (actedOn) => {
			remove(actedOn, 0, 2);
		},
		initialState: ["A", "B", "C", "D"],
		editedState: ["C", "D"],
	},
	{
		name: "nested removes",
		edit: (actedOn) => {
			const listNode: UpPath = {
				parent: rootPath,
				parentField: brand("foo"),
				parentIndex: 0,
			};

			actedOn.transaction.start();
			const listField = actedOn.editor.sequenceField({
				parent: listNode,
				field: brand(""),
			});
			listField.remove(0, 1);
			remove(actedOn, 0, 1);
			actedOn.transaction.commit();
		},
		initialState: [{ foo: ["A"] }],
		editedState: [],
	},
	{
		name: "move out under remove",
		edit: (actedOn) => {
			const listNode: UpPath = {
				parent: rootPath,
				parentField: brand("foo"),
				parentIndex: 0,
			};

			actedOn.transaction.start();
			actedOn.editor.move({ parent: listNode, field: brand("") }, 0, 1, rootField, 1);
			remove(actedOn, 0, 1);
			actedOn.transaction.commit();
		},
		initialState: [{ foo: ["A"] }],
		editedState: ["A"],
	},
	{
		name: "the move of a node",
		edit: (actedOn) => {
			moveWithin(actedOn.editor, rootField, 0, 2, 4);
		},
		initialState: ["A", "B", "C", "D"],
		editedState: ["C", "D", "A", "B"],
	},
	{
		name: "a move that has been rebased",
		edit: (actedOn, other) => {
			insert(other, 1, "x");
			moveWithin(
				actedOn.editor,
				{
					parent: undefined,
					field: rootFieldKey,
				},
				1,
				1,
				4,
			);
		},
		undoCount: 2,
		initialState: ["A", "B", "C", "D"],
		editedState: ["A", "x", "C", "D", "B"],
		undoState: ["A", "x", "B", "C", "D"],
	},
	{
		name: "a remove of content that is concurrently edited",
		edit: (actedOn, other) => {
			other.editor.sequenceField({ parent: rootPath, field: brand("child") }).remove(0, 1);
			actedOn.editor.sequenceField(rootField).remove(0, 1);
		},
		initialState: [{ child: "x" }],
		editedState: [],
		undoState: [{}],
		// TODO:#5111 unskip once inserts and removes under removed nodes are supported
		skip: true,
	},
];

describe("Undo and redo", () => {
	for (const attached of [true, false]) {
		const attachStr = attached ? "attached" : "detached";
		for (const {
			name,
			skip,
			edit,
			undoCount,
			initialState,
			editedState,
			undoState,
			mergeState,
		} of testCases) {
			const count = undoCount ?? 1;
			const itFn = skip ? it.skip : it;
			itFn(`${name} (act on fork undo on fork - ${attachStr})`, () => {
				const view = createCheckout(initialState, attached);
				const fork = view.branch();

				const { undoStack, redoStack, unsubscribe } = createTestUndoRedoStacks(fork.events);
				edit(fork, view);

				fork.rebaseOnto(view);
				expectJsonTree(fork, editedState);

				for (let i = 0; i < count; i++) {
					undoStack.pop()?.revert();
				}

				fork.rebaseOnto(view);
				expectJsonTree(fork, undoState ?? initialState);

				while (redoStack.length > 0) {
					redoStack.pop()?.revert();
				}

				fork.rebaseOnto(view);
				expectJsonTree(fork, editedState);
				unsubscribe();
			});

			// TODO: unskip once forking revertibles is supported
			it.skip(`${name} (act on view undo on fork - ${attachStr})`, () => {
				const view = createCheckout(initialState, attached);
				const fork = view.branch();

				const { undoStack, redoStack, unsubscribe } = createTestUndoRedoStacks(fork.events);
				edit(view, fork);

				fork.rebaseOnto(view);
				expectJsonTree(fork, editedState);

				for (let i = 0; i < count; i++) {
					undoStack.pop()?.revert();
				}

				fork.rebaseOnto(view);
				expectJsonTree(fork, undoState ?? initialState);

				while (redoStack.length > 0) {
					redoStack.pop()?.revert();
				}

				fork.rebaseOnto(view);
				expectJsonTree(fork, editedState);
				unsubscribe();
			});

			itFn(`${name} (act on view undo on view - ${attachStr})`, () => {
				const view = createCheckout(initialState, attached);
				const fork = view.branch();

				const { undoStack, redoStack, unsubscribe } = createTestUndoRedoStacks(view.events);
				edit(view, fork);

				view.merge(fork, false);
				expectJsonTree(view, editedState);

				for (let i = 0; i < count; i++) {
					undoStack.pop()?.revert();
				}

				view.merge(fork, false);
				expectJsonTree(view, mergeState ?? initialState);

				while (redoStack.length > 0) {
					redoStack.pop()?.revert();
				}

				view.merge(fork);
				expectJsonTree(view, editedState);
				unsubscribe();
			});

			// TODO: unskip once forking revertibles is supported
			it.skip(`${name} (act on fork undo on view - ${attachStr})`, () => {
				const view = createCheckout(initialState, attached);
				const fork = view.branch();

				const { undoStack, redoStack, unsubscribe } = createTestUndoRedoStacks(view.events);
				edit(fork, view);

				view.merge(fork, false);
				expectJsonTree(view, editedState);

				for (let i = 0; i < count; i++) {
					undoStack.pop()?.revert();
				}

				view.merge(fork, false);
				expectJsonTree(view, undoState ?? initialState);

				while (redoStack.length > 0) {
					redoStack.pop()?.revert();
				}

				view.merge(fork);
				expectJsonTree(view, editedState);
				unsubscribe();
			});

			it(`${name} multiple times (${attachStr})`, () => {
				const tree = createCheckout(initialState, attached);
				const fork = tree.branch();

				const { undoStack, redoStack, unsubscribe } = createTestUndoRedoStacks(tree.events);
				edit(tree, fork);

				tree.merge(fork, false);
				expectJsonTree(tree, editedState);
				while (undoStack.length > 0) {
					undoStack.pop()?.revert();
				}
				expectJsonTree(tree, mergeState ?? initialState);
				while (redoStack.length > 0) {
					redoStack.pop()?.revert();
				}
				expectJsonTree(tree, editedState);
				while (undoStack.length > 0) {
					undoStack.pop()?.revert();
				}
				expectJsonTree(tree, mergeState ?? initialState);
				while (redoStack.length > 0) {
					redoStack.pop()?.revert();
				}
				expectJsonTree(tree, editedState);
				unsubscribe();
			});
		}

		it(`can undo before and after rebasing a branch (${attachStr})`, () => {
			const tree1 = createCheckout([0, 0, 0], attached);
			const tree2 = tree1.branch();

			const { undoStack, unsubscribe } = createTestUndoRedoStacks(tree2.events);
			tree1.editor.sequenceField(rootField).insert(3, singleJsonCursor(1));
			tree2.editor.sequenceField(rootField).insert(0, singleJsonCursor(2));
			tree2.editor.sequenceField(rootField).insert(0, singleJsonCursor(3));
			undoStack.pop()?.revert();
			expectJsonTree(tree2, [2, 0, 0, 0]);
			tree2.rebaseOnto(tree1);
			expectJsonTree(tree2, [2, 0, 0, 0, 1]);
			undoStack.pop()?.revert();
			expectJsonTree(tree2, [0, 0, 0, 1]);
			unsubscribe();
		});

		// TODO: unskip once forking revertibles is supported
		it.skip(`can undo after forking a branch (${attachStr})`, () => {
			const tree1 = createCheckout(["A", "B", "C"], attached);

			const { undoStack: undoStack1, unsubscribe: unsubscribe1 } = createTestUndoRedoStacks(
				tree1.events,
			);
			tree1.editor.sequenceField(rootField).remove(0, 1);
			tree1.editor.sequenceField(rootField).remove(1, 1);

			const tree2 = tree1.branch();
			const { undoStack: undoStack2, unsubscribe: unsubscribe2 } = createTestUndoRedoStacks(
				tree2.events,
			);
			expectJsonTree(tree2, ["B"]);
			undoStack1.pop()?.revert();
			expectJsonTree(tree2, ["B", "C"]);
			undoStack2.pop()?.revert();
			expectJsonTree(tree2, ["A", "B", "C"]);
			unsubscribe1();
			unsubscribe2();
		});

		// TODO: unskip once forking revertibles is supported
		it.skip(`can redo after forking a branch (${attachStr})`, () => {
			const tree1 = createCheckout(["B"], attached);

			const { undoStack: undoStack1, unsubscribe: unsubscribe1 } = createTestUndoRedoStacks(
				tree1.events,
			);
			tree1.editor.sequenceField(rootField).insert(0, singleJsonCursor("A"));
			tree1.editor.sequenceField(rootField).insert(2, singleJsonCursor("C"));
			undoStack1.pop()?.revert();
			undoStack1.pop()?.revert();

			const tree2 = tree1.branch();
			const { redoStack: redoStack2, unsubscribe: unsubscribe2 } = createTestUndoRedoStacks(
				tree2.events,
			);
			expectJsonTree(tree2, ["B"]);
			redoStack2.pop()?.revert();
			expectJsonTree(tree2, ["A", "B"]);
			redoStack2.pop()?.revert();
			expectJsonTree(tree2, ["A", "B", "C"]);
			unsubscribe1();
			unsubscribe2();
		});

		it(`can undo/redo a transaction (${attachStr})`, () => {
			const tree = createCheckout(["A", "B"], attached);

			const { undoStack, redoStack, unsubscribe } = createTestUndoRedoStacks(tree.events);
			tree.transaction.start();
			tree.editor.sequenceField(rootField).insert(2, singleJsonCursor("C"));
			tree.editor.sequenceField(rootField).remove(0, 1);
			tree.transaction.commit();

			expectJsonTree(tree, ["B", "C"]);
			undoStack.pop()?.revert();
			expectJsonTree(tree, ["A", "B"]);
			redoStack.pop()?.revert();
			expectJsonTree(tree, ["B", "C"]);
			unsubscribe();
		});

		it(`can undo/redo a merge (${attachStr})`, () => {
			const tree = createCheckout(["A", "B"], attached);

			const { undoStack, redoStack, unsubscribe } = createTestUndoRedoStacks(tree.events);
			const branch = tree.branch();
			branch.editor.sequenceField(rootField).insert(2, singleJsonCursor("C"));
			branch.editor.sequenceField(rootField).remove(0, 1);
			tree.merge(branch);

			expectJsonTree(tree, ["B", "C"]);
			undoStack.pop()?.revert();
			expectJsonTree(tree, ["A", "B", "C"]);
			undoStack.pop()?.revert();
			expectJsonTree(tree, ["A", "B"]);
			redoStack.pop()?.revert();
			expectJsonTree(tree, ["A", "B", "C"]);
			redoStack.pop()?.revert();
			expectJsonTree(tree, ["B", "C"]);
			unsubscribe();
		});

		it(`can undo multiple merges (${attachStr})`, () => {
			const tree = createCheckout(["A", "B"], attached);

			const { undoStack, unsubscribe } = createTestUndoRedoStacks(tree.events);

			const branch = tree.branch();

			branch.editor.sequenceField(rootField).insert(2, singleJsonCursor("C"));
			tree.merge(branch, false);
			expectJsonTree(tree, ["A", "B", "C"]);
			undoStack.pop()?.revert();
			expectJsonTree(tree, ["A", "B"]);

			branch.editor.sequenceField(rootField).insert(2, singleJsonCursor("C"));
			tree.merge(branch);
			expectJsonTree(tree, ["A", "B", "C"]);
			undoStack.pop()?.revert();
			expectJsonTree(tree, ["A", "B"]);

			unsubscribe();
		});
	}

	it("can undo while detached", () => {
		const sf = new SchemaFactory(undefined);
		class Schema extends sf.object("Object", { foo: sf.number }) {}
		const sharedTreeFactory = new SharedTreeFactory();
		const runtime = new MockFluidDataStoreRuntime({ idCompressor: createIdCompressor() });
		const tree = sharedTreeFactory.create(runtime, "tree");
		const view = tree.viewWith(new TreeViewConfiguration({ schema: Schema }));
		view.initialize({ foo: 1 });
		assert.equal(tree.isAttached(), false);
		let revertible: Revertible | undefined;
		view.events.on("commitApplied", (_, getRevertible) => {
			revertible = getRevertible?.();
		});
		view.root.foo = 2;
		assert.equal(view.root.foo, 2);
		assert(revertible !== undefined);
		revertible.revert();
		assert.equal(view.root.foo, 1);
	});
});

/**
 * Create a checkout belonging to a SharedTree with the given JSON data.
 * @param attachTree - whether or not the SharedTree should be attached to the Fluid runtime
 */
export function createCheckout(json: JsonCompatible[], attachTree: boolean): ITreeCheckout {
	const sharedTreeFactory = new SharedTreeFactory();
	const runtime = new MockFluidDataStoreRuntime({ idCompressor: createIdCompressor() });
	const tree = sharedTreeFactory.create(runtime, "tree");
	const runtimeFactory = new MockContainerRuntimeFactory();
	runtimeFactory.createContainerRuntime(runtime);
	initialize(tree.checkout, {
		schema: jsonSequenceRootSchema,
		initialTree: json.map(singleJsonCursor),
	});

	if (attachTree) {
		tree.connect({
			deltaConnection: runtime.createDeltaConnection(),
			objectStorage: new MockStorage(),
		});
	}

	temp = tree;
	return tree.checkout;
}

let temp: unknown;
