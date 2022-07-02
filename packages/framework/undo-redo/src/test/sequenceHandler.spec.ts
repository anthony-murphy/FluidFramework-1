/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { strict as assert } from "assert";
import { SharedString, SharedStringFactory } from "@fluidframework/sequence";
import {
    MockContainerRuntimeFactory,
    MockFluidDataStoreRuntime,
    MockStorage,
} from "@fluidframework/test-runtime-utils";
import { SharedSegmentSequenceUndoRedoHandler } from "../sequenceHandler";
import { UndoRedoStackManager } from "../undoRedoStackManager";

const text =
    // eslint-disable-next-line max-len
    "The SharedSegmentSequenceRevertible does the heavy lifting of tracking and reverting changes on the underlying SharedSegmentSequence. This is accomplished via TrackingGroup objects.";

function insertTextAsChunks(sharedString: SharedString, targetLength = text.length) {
    let chunks = 0;
    while (sharedString.getLength() < targetLength && sharedString.getLength() < text.length) {
        const len = sharedString.getLength() % 13 + 1;
        sharedString.insertText(
            sharedString.getLength(),
            text.substr(sharedString.getLength(), len));
        chunks++;
    }
    return chunks;
}
function deleteTextByChunk(sharedString: SharedString, targetLength = 0) {
    let chunks = 0;
    while (sharedString.getLength() > targetLength && sharedString.getLength() > 0) {
        const len = sharedString.getLength() % 17 + 1;
        sharedString.removeText(
            Math.max(sharedString.getLength() - len, 0),
            sharedString.getLength());
        chunks++;
    }
    return chunks;
}

describe("SharedSegmentSequenceUndoRedoHandler", () => {
    const documentId = "fakeId";
    let containerRuntimeFactory: MockContainerRuntimeFactory;
    let sharedString: SharedString;
    let undoRedoStack: UndoRedoStackManager;

    beforeEach(() => {
        const dataStoreRuntime = new MockFluidDataStoreRuntime();

        containerRuntimeFactory = new MockContainerRuntimeFactory();
        const containerRuntime = containerRuntimeFactory.createContainerRuntime(dataStoreRuntime);
        const services = {
            deltaConnection: containerRuntime.createDeltaConnection(),
            objectStorage: new MockStorage(undefined),
        };

        sharedString = new SharedString(dataStoreRuntime, documentId, SharedStringFactory.Attributes);
        sharedString.initializeLocal();
        sharedString.bindToContext();
        sharedString.connect(services);

        undoRedoStack = new UndoRedoStackManager();
    });

    it("Undo and Redo Delete", () => {
        insertTextAsChunks(sharedString);
        const handler = new SharedSegmentSequenceUndoRedoHandler(undoRedoStack);
        handler.attachSequence(sharedString);

        deleteTextByChunk(sharedString);

        assert.equal(sharedString.getText(), "");

        while (undoRedoStack.undoOperation()) { }

        assert.equal(sharedString.getText(), text);

        while (undoRedoStack.redoOperation()) { }

        assert.equal(sharedString.getText(), "");
    });

    it("Undo and Redo Insert", () => {
        const handler = new SharedSegmentSequenceUndoRedoHandler(undoRedoStack);
        handler.attachSequence(sharedString);
        insertTextAsChunks(sharedString);

        assert.equal(sharedString.getText(), text);

        while (undoRedoStack.undoOperation()) { }

        assert.equal(sharedString.getText(), "");

        while (undoRedoStack.redoOperation()) { }

        assert.equal(sharedString.getText(), text);
    });

    it.only("Undo and Redo Insert & Delete", () => {
        const handler = new SharedSegmentSequenceUndoRedoHandler(undoRedoStack);
        handler.attachSequence(sharedString);

        const states = [sharedString.getText()];
        undoRedoStack.closeCurrentOperation();

        for (let i = 1; i < text.length; i *= 2) {
            insertTextAsChunks(sharedString, text.length - i);
            undoRedoStack.closeCurrentOperation();
            states.push(sharedString.getText());

            deleteTextByChunk(sharedString, i);
            undoRedoStack.closeCurrentOperation();
            states.push(sharedString.getText());
        }

        let state = states.length;
        do {
            assert.equal(sharedString.getText(), states[--state], `undo ${state}`);
            console.log(sharedString.getText());
        }
        while (undoRedoStack.undoOperation());

        do {
            assert.equal(sharedString.getText(), states[state++], `redo ${state}`);
            console.log(sharedString.getText());
        }
        while (undoRedoStack.undoOperation());
    });

    it("Undo and redo insert of split segment", () => {
        const handler = new SharedSegmentSequenceUndoRedoHandler(undoRedoStack);
        handler.attachSequence(sharedString);

        // insert all text as a single segment
        sharedString.insertText(0, text);

        containerRuntimeFactory.processAllMessages();

        // this will split that into three segment
        sharedString.walkSegments(
            () => true,
            20,
            30,
            undefined,
            true);

        assert.equal(sharedString.getText(), text);

        // undo and redo split insert
        undoRedoStack.undoOperation();
        undoRedoStack.redoOperation();

        assert.equal(sharedString.getText(), text);
    });

    it("simple insert", () => {
        const handler = new SharedSegmentSequenceUndoRedoHandler(undoRedoStack);
        handler.attachSequence(sharedString);
        const initialText = "hello world";
        sharedString.insertText(0, initialText);
        containerRuntimeFactory.processAllMessages();
        assert.equal(sharedString.getText(), initialText);

        // undo and redo split insert
        undoRedoStack.undoOperation();
        assert.equal(sharedString.getText(), "");
        undoRedoStack.redoOperation();

        assert.equal(sharedString.getText(), initialText);
    });
});
