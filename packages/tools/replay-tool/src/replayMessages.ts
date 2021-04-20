/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { strict } from "assert";
import child_process from "child_process";
import fs from "fs";
import { assert, Lazy } from "@fluidframework/common-utils";
import { ITelemetryBaseEvent, ITelemetryBaseLogger } from "@fluidframework/common-definitions";
import { Container } from "@fluidframework/container-loader";
import { ChildLogger, TelemetryLogger } from "@fluidframework/telemetry-utils";
import {
    FileDeltaStorageService,
    FileDocumentServiceFactory,
    FileSnapshotWriterClassFactory,
    FileStorageDocumentName,
    FluidFetchReaderFileSnapshotWriter,
    ISnapshotWriterStorage,
    Replayer,
    ReplayFileDeltaConnection,
} from "@fluidframework/file-driver";
import {
    ISequencedDocumentMessage,
    ITree,
    TreeEntry,
    MessageType,
} from "@fluidframework/protocol-definitions";
import {
    FileSnapshotReader,
    IFileSnapshot,
} from "@fluidframework/replay-driver";
import { compareWithReferenceSnapshot, getNormalizedFileSnapshot, loadContainer } from "./helpers";
import { ReplayArgs } from "./replayArgs";

// "worker_threads" does not resolve without --experimental-worker flag on command line
let threads = { isMainThread: true };
try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    threads = require("worker_threads");
} catch (error) { }

function expandTreeForReadability(tree: ITree): ITree {
    const newTree: ITree = { entries: [], id: undefined };
    for (const node of tree.entries) {
        const newNode = { ...node };
        if (node.type === TreeEntry.Tree) {
            newNode.value = expandTreeForReadability(node.value);
        }
        if (node.type === TreeEntry.Blob) {
            const blob = node.value;
            try {
                newNode.value = {
                    contents: JSON.parse(blob.contents) as string,
                    encoding: blob.encoding,
                };
            } catch (e) { }
        }
        newTree.entries.push(newNode);
    }
    return newTree;
}

/**
 * Helper class to container information about particular snapshot
 */
class ContainerContent {
    public snapshot?: IFileSnapshot;

    private readonly _normalizedSnapshot: Lazy<IFileSnapshot>;
    private readonly _snapshotAsString: Lazy<string>;
    private readonly _snapshotExpanded: Lazy<string>;

    public constructor(public readonly op: number) {
        this._normalizedSnapshot = new Lazy(() => {
            assert(this.snapshot !== undefined, 0x1c5 /* "snapshot should be set before retreiving it" */);
            return getNormalizedFileSnapshot(this.snapshot);
        });

        this._snapshotAsString = new Lazy(() => {
            assert(this.snapshot !== undefined, 0x1c6 /* "snapshot should be set before retreiving it" */);
            return JSON.stringify(this.snapshot, undefined, 2);
        });

        this._snapshotExpanded = new Lazy(() => {
            assert(this.snapshot !== undefined,
                0x1c7 /* "snapshot should be set before retreiving it as expanded string" */);
            const snapshotExpanded: IFileSnapshot = {
                commits: {},
                tree: expandTreeForReadability(this.snapshot.tree),
            };
            for (const commit of Object.keys(this.snapshot.commits)) {
                snapshotExpanded.commits[commit] = expandTreeForReadability(this.snapshot.commits[commit]);
            }
            return JSON.stringify(snapshotExpanded, undefined, 2);
        });
    }

    // Returns a normalized version of the file snapshot. This will be used when comparing snapshots.
    get normalizedSnapshot(): IFileSnapshot {
        return this._normalizedSnapshot.value;
    }

    // Returns the original snapshot as a string.
    get snapshotAsString(): string {
        return this._snapshotAsString.value;
    }

    // Returns an expanded string version of the original snapshot for readability.
    get snapshotExpanded(): string {
        return this._snapshotExpanded.value;
    }
}

/**
 * Logger to catch errors in containers
 */
class Logger implements ITelemetryBaseLogger {
    public constructor(
        private readonly containerDescription: string,
        private readonly errorHandler: (event: ITelemetryBaseEvent) => boolean) {
    }

    // ITelemetryBaseLogger implementation
    public send(event: ITelemetryBaseEvent) {
        if (event.category === "error" && this.errorHandler(event)) {
            // Stack is not output properly (with newlines), if done as part of event
            const stack: string | undefined = event.stack as string | undefined;
            delete event.stack;
            const error = new Error(`An error has been logged from ${this.containerDescription}!\n
                        ${JSON.stringify(event)}`);
            error.stack = stack;
            // throw instead of printing an error to fail tests
            throw error;
        }
    }
}

/**
 * Helper class holding container and providing load / snapshot capabilities
 */
class Document {
    private container: Container;
    private replayer: Replayer;
    private documentSeqNumber = 0;
    private from = -1;
    private snapshotFileName: string = "";
    private docLogger: TelemetryLogger;
    private originalSummarySeqs: number[];

    public constructor(
        protected readonly args: ReplayArgs,
        public readonly storage: ISnapshotWriterStorage,
        public readonly containerDescription: string) {
    }

    public get currentOp() {
        return this.replayer.currentReplayedOp;
    }

    public get fromOp() {
        return this.from;
    }

    public get logger() {
        return this.docLogger;
    }

    public get originalSummarySequenceNumbers(): readonly number[] {
        return this.originalSummarySeqs;
    }

    public getFileName() {
        return `snapshot_${this.currentOp}_${this.snapshotFileName}`;
    }

    public appendToFileName(suffix: string) {
        this.snapshotFileName = `${this.snapshotFileName}${suffix}`;
    }

    public async load(
        deltaStorageService: FileDeltaStorageService,
        errorHandler: (event: ITelemetryBaseEvent) => boolean) {
        const deltaConnection = await ReplayFileDeltaConnection.create(deltaStorageService);
        const documentServiceFactory = new FileDocumentServiceFactory(
            this.storage,
            deltaStorageService,
            deltaConnection);

        this.docLogger = ChildLogger.create(new Logger(this.containerDescription, errorHandler));
        this.container = await loadContainer(
            documentServiceFactory,
            FileStorageDocumentName,
            this.docLogger);

        this.from = this.container.deltaManager.lastSequenceNumber;
        this.replayer = deltaConnection.getReplayer();
        this.originalSummarySeqs = [];
        this.replayer.ops.forEach((op) => {
            if (op?.type === MessageType.Summarize) {
                const seq = op.referenceSequenceNumber;
                if (seq !== undefined) {
                    this.originalSummarySeqs.push(seq);
                }
            }
        });

        this.replayer.currentReplayedOp = this.from;

        this.snapshotFileName = `${this.fromOp}`;

        this.container.on("op", (message: ISequencedDocumentMessage) => {
            this.documentSeqNumber = message.sequenceNumber;
            if (this.currentOp === this.documentSeqNumber) {
                this.resolveC();
            }
        });
    }

    public async replay(replayTo: number) {
        const fetched = this.replayer.replay(replayTo);

        if (fetched > 0 && this.documentSeqNumber !== this.currentOp) {
            await new Promise<void>((resolve) => {
                this.resolveC = resolve;
            });
            assert(this.documentSeqNumber === this.currentOp,
                0x1c8 /* "Mismatch between document sequence number and current op number" */);
        }
    }

    public async snapshot() {
        return this.container.snapshot(
            `ReplayTool Snapshot: op ${this.currentOp}, ${this.getFileName()}`,
            !this.args.incremental /* generateFullTreeNoOtimizations */);
    }

    public extractContent(): ContainerContent {
        const content = new ContainerContent(this.currentOp);

        // Add here any interesting data extraction code that you want to use for comparison.
        // We can also write it out to disk, thus giving us an extra validation when
        // comparing changes "before" and "after", giving us view not just into internal data
        // representation, but also into observable impact to upper layers.
        // For example, it would be great to enumerate all shared strings and retrieve their text.

        return content;
    }

    public close() {
        this.container.close();
    }

    private resolveC = () => { };
}

/**
 * All the logic of replay tool
 */
export class ReplayTool {
    private storage: ISnapshotWriterStorage;
    private mainDocument: Document;
    private documentNeverSnapshot?: Document;
    private documentPriorSnapshot?: Document;
    private documentPriorWindow?: Document;
    private readonly documents: Document[] = [];
    private readonly documentsWindow: Document[] = [];
    private readonly documentsFromStorageSnapshots: Document[] = [];
    private windiffCount = 0;
    private deltaStorageService: FileDeltaStorageService;
    private readonly errors: string[] = [];

    public constructor(private readonly args: ReplayArgs) { }

    public async Go(): Promise<string[]> {
        this.args.checkArgs();

        // Make unhandled exceptions errors, not just warnings
        // Also report few of them!
        const listener = (up) => {
            this.reportError("UnhandledRejectionPromise", up);
        };
        process.on("unhandledRejection", listener);

        await this.setup();

        if (this.args.verbose) {
            console.log("Starting");
        }

        await this.mainCycle();

        if (this.args.verbose) {
            console.log("\nLast replayed op seq# ", this.mainDocument.currentOp);
        } else if (threads.isMainThread) {
            process.stdout.write("\n");
        }
        assert(this.documentsFromStorageSnapshots.length === 0,
            0x1c9 /* "Leftover documents after replay!" */);

        process.removeListener("unhandledRejection", listener);

        return this.errors;
    }

    private shouldReportError(errorString: string) {
        // Report only first 5 errors
        this.errors.push(errorString);
        const errorsToReport = 5;
        if (this.errors.length <= errorsToReport) {
            return true;
        }
        if (this.errors.length === errorsToReport + 1) {
            console.error("\n!!! Too many errors - stopped reporting errors !!!");
        }
        return false;
    }

    private reportError(description: string, error?: any) {
        let errorString: string;
        if (error === undefined) {
            errorString = description;
        } else if (error instanceof Error) {
            errorString = `${description}\n${error.stack}`;
        } else {
            errorString = `${description} ${error}`;
        }
        if (this.shouldReportError(errorString)) {
            console.error(errorString);
        }
    }

    private errorHandler(event: ITelemetryBaseEvent): boolean {
        const errorString = JSON.stringify(event);
        // Snapshots errors are both reported to telemetry and propagated to caller
        // So if we d not filter them out, we report them twice.
        // Avoid that, but have a safety net - increase error count, so that tool
        // still fails even if error is not propagated / reported properly.
        if (event.eventName === "fluid:telemetry:Container:SnapshotExceptionError") {
            if (this.errors.length === 0) {
                this.errors.push(errorString);
            }
            return false;
        }
        return this.shouldReportError(errorString);
    }

    // eslint-disable-next-line @typescript-eslint/promise-function-async
    private loadDoc(doc: Document) {
        return doc.load(
            this.deltaStorageService,
            (event) => this.errorHandler(event));
    }

    private async setup() {
        if (this.args.inDirName === undefined) {
            return Promise.reject(new Error("Please provide --indir argument"));
        }
        if (!fs.existsSync(this.args.inDirName)) {
            return Promise.reject(new Error("File does not exist"));
        }

        this.deltaStorageService = new FileDeltaStorageService(this.args.inDirName);

        // Can't load files from ops any more, due to detached container creation
        // If there are snapshots present (from fetch tool), find latest snapshot and load from it.
        if (this.args.fromVersion === undefined) {
            for (const name of fs.readdirSync(this.args.inDirName)) {
                if (name.indexOf("9-") === 0) {
                    // It can be any file, even created not detached and downloaded by fetch-tool
                    // Do quick and ugly test to see if it's for sequenceNumber <= 1.
                    // Note we rely here on a fact that .attributes are always downloaded by fetch tool first
                    // and places as 0-... file. That may change in the future - better test would be to read
                    // a tree.json and find actual .attributes blob
                    const dir = `${this.args.inDirName}/${name}/decoded`;
                    for (const file of fs.readdirSync(dir)) {
                        try {
                            if (file.indexOf("0-") === 0 &&
                                JSON.parse(fs.readFileSync(`${dir}/${file}`).toString("utf-8")).sequenceNumber <= 1) {
                                this.args.fromVersion = name;
                            }
                        } catch (err) {}
                    }
                    if (this.args.fromVersion === undefined) {
                        // eslint-disable-next-line max-len
                        console.error(`Failed to parse ${name} snapshot to find .attributes blob and check sequence number. This may result in failure to process file. In such case, please point to any snapshot via --from argument.`);
                    }
                }
            }
        }

        this.storage = new FluidFetchReaderFileSnapshotWriter(this.args.inDirName, this.args.fromVersion);
        let description = this.args.fromVersion ? this.args.fromVersion : "main container";
        this.mainDocument = new Document(this.args, this.storage, description);
        await this.loadDoc(this.mainDocument);
        this.documents.push(this.mainDocument);
        if (this.args.from < this.mainDocument.fromOp) {
            this.args.from = this.mainDocument.fromOp;
        }

        if (this.args.fromVersion !== undefined) {
            console.log(`Starting from ${this.args.fromVersion}, seq# = ${this.mainDocument.currentOp}`);
            if (this.mainDocument.currentOp > this.args.to) {
                return Promise.reject(new Error("--to argument is below snapshot starting op. Nothing to do!"));
            }
        }

        if (this.args.initializeFromSnapshotsDir) {
            for (const node of fs.readdirSync(this.args.initializeFromSnapshotsDir, { withFileTypes: true })) {
                let storage;
                if (node.isDirectory()) {
                    // Did we load it already as main doc?
                    if (node.name === this.args.fromVersion) {
                        continue;
                    }

                    const file = `${this.args.initializeFromSnapshotsDir}/${node.name}/tree.json`;
                    if (!fs.existsSync(file)) {
                        console.error(`${file} does not exist, skipping ${node.name} snapshot`);
                        continue;
                    }
                    storage = new FluidFetchReaderFileSnapshotWriter(this.args.initializeFromSnapshotsDir, node.name);
                } else {
                    if (node.name.startsWith("snapshot_")) {
                        const content = fs.readFileSync(
                            `${this.args.initializeFromSnapshotsDir}/${node.name}`, "utf-8");
                        const snapshot = JSON.parse(content) as IFileSnapshot;
                        storage = new FileSnapshotReader(snapshot);
                    } else {
                        continue;
                    }
                }

                const doc = new Document(this.args, storage, node.name);
                try {
                    await this.loadDoc(doc);
                    doc.appendToFileName(`_storage_${node.name}`);

                    if (doc.fromOp < this.args.from || this.args.to < doc.fromOp) {
                        console.log(`Skipping snapshots ${node.name} generated at op = ${doc.fromOp}`);
                    } else {
                        if (this.args.verbose) {
                            console.log(`Loaded snapshots ${node.name} generated at op = ${doc.fromOp}`);
                        }
                        this.documents.push(doc);
                    }
                } catch (error) {
                    doc.logger.sendErrorEvent({ eventName: "FailedToLoadSnapshot" }, error);
                }
            }
        }

        // This does not seem to provide much value, we can disable it for per reasons
        // It adds about 10% to the duration of the test.
        if (this.args.snapFreq !== undefined || this.args.validateStorageSnapshots) {
            const storage = new FluidFetchReaderFileSnapshotWriter(this.args.inDirName, this.args.fromVersion);
            description = this.args.fromVersion ? this.args.fromVersion : "secondary container";
            this.documentNeverSnapshot = new Document(this.args, storage, description);
            await this.loadDoc(
                this.documentNeverSnapshot);
            this.documentNeverSnapshot.appendToFileName("_noSnapshots");
            this.documents.push(this.documentNeverSnapshot);
        }

        // Load all snapshots from storage
        if (this.args.validateStorageSnapshots) {
            for (const node of fs.readdirSync(this.args.inDirName, { withFileTypes: true })) {
                if (!node.isDirectory()) {
                    continue;
                }
                // Did we load it already as main doc?
                if (node.name === this.args.fromVersion) {
                    continue;
                }

                const file = `${this.args.inDirName}/${node.name}/tree.json`;
                if (!fs.existsSync(file)) {
                    console.error(`${file} does not exist, skipping ${node.name} snapshot`);
                    continue;
                }

                const storage = new FluidFetchReaderFileSnapshotWriter(this.args.inDirName, node.name);
                const doc = new Document(this.args, storage, node.name);
                try {
                    await this.loadDoc(doc);
                    doc.appendToFileName(`_storage_${node.name}`);

                    if (doc.fromOp < this.args.from || this.args.to < doc.fromOp) {
                        console.log(`Skipping snapshots ${node.name} generated at op = ${doc.fromOp}`);
                    } else {
                        console.log(`Loaded snapshots ${node.name} generated at op = ${doc.fromOp}`);
                        this.documentsFromStorageSnapshots.push(doc);
                    }
                } catch (error) {
                    doc.logger.sendTelemetryEvent({ eventName: "FailedToLoadSnapshot" }, error);
                }
            }
            this.documentsFromStorageSnapshots.sort((a: Document, b: Document) => a.fromOp > b.fromOp ? 1 : -1);
        }
    }

    private async mainCycle() {
        const originalSummaries =
            this.args.testSummaries ? [...this.mainDocument.originalSummarySequenceNumbers] : [];
        let nextSnapPoint;
        do {
            nextSnapPoint = originalSummaries.shift() ?? this.args.from;
        } while (nextSnapPoint < this.args.from);
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const currentOp = this.mainDocument.currentOp;
            if (nextSnapPoint <= currentOp) {
                if (this.args.snapFreq !== undefined) {
                    nextSnapPoint = currentOp + this.args.snapFreq;
                } else {
                    nextSnapPoint = originalSummaries.shift() ?? this.args.to;
                }
            }
            let replayTo = Math.min(nextSnapPoint, this.args.to);

            if (this.documentsFromStorageSnapshots.length > 0) {
                const op = this.documentsFromStorageSnapshots[0].fromOp;
                replayTo = Math.min(replayTo, op);
            }

            assert(replayTo > currentOp, 0x1ca /* "replay-to target is <= current op in replay cycle" */);
            for (const doc of this.documents) {
                await doc.replay(replayTo);
            }
            for (const doc of this.documentsWindow) {
                await doc.replay(replayTo);
            }

            const final = this.mainDocument.currentOp < replayTo || this.args.to <= this.mainDocument.currentOp;
            await this.generateSnapshot(final);
            if (final) {
                break;
            }
        }
    }

    private async generateMainSnapshot(dir: string, final: boolean): Promise<ContainerContent> {
        const op = this.mainDocument.currentOp;

        const content = this.mainDocument.extractContent();

        this.storage.onSnapshotHandler = (snapshot: IFileSnapshot) => {
            content.snapshot = snapshot;
            if (this.args.compare) {
                compareWithReferenceSnapshot(
                    content.normalizedSnapshot,
                    `${dir}/${this.mainDocument.getFileName()}`,
                    (description: string, error?: any) => this.reportError(description, error));
            } else if (this.args.write) {
                fs.mkdirSync(dir, { recursive: true });
                this.expandForReadabilityAndWriteOut(
                    content,
                    `${dir}/${this.mainDocument.getFileName()}`);
            }
        };

        if (this.args.verbose) {
            if (this.args.write) {
                console.log(`Writing snapshot at seq# ${op}`);
            } else {
                console.log(`Validating snapshot at seq# ${op}`);
            }
        }

        await this.mainDocument.snapshot();
        if (final) {
            this.mainDocument.close();
        }

        return content;
    }

    private async validateSlidingSnapshots(
        content: ContainerContent,
        dir: string,
        final: boolean) {
        const op = content.op;

        // Add extra container
        if (!final && (
            this.args.snapFreq !== undefined
            && ((op - this.mainDocument.fromOp) % this.args.snapFreq) === 0)
        ) {
            const storageClass = FileSnapshotWriterClassFactory(FileSnapshotReader);
            const storage = new storageClass(content.snapshot);
            const document3 = new Document(this.args, storage, `Saved & loaded at seq# ${op}`);
            await this.loadDoc(document3);
            this.documentsWindow.push(document3);
        }

        const startOp = op - this.args.overlappingContainers * this.args.snapFreq;
        while (this.documentsWindow.length > 0
            && (final || this.documentsWindow[0].fromOp <= startOp)) {
            const doc = this.documentsWindow.shift();
            assert(doc.fromOp === startOp || final,
                0x1cb /* "Bad window to verify snapshot" */);
            await this.saveAndVerify(doc, dir, content, final);
        }
    }

    private async validateStorageSnapshots(content: ContainerContent, dir: string, final: boolean) {
        const op = content.op;

        const processVersionedSnapshot = this.documentsFromStorageSnapshots.length > 0 &&
            this.documentsFromStorageSnapshots[0].fromOp <= op;
        if (this.documentPriorSnapshot && (processVersionedSnapshot || final)) {
            await this.documentPriorSnapshot.replay(op);
            await this.saveAndVerify(this.documentPriorSnapshot, dir, content, final);
            this.documentPriorSnapshot = undefined;
        }
        if (processVersionedSnapshot) {
            this.documentPriorSnapshot = this.documentsFromStorageSnapshots.shift();
            assert(this.documentPriorSnapshot.fromOp === op, 0x1cc /* "Unexpected previous snapshot op number" */);
            await this.saveAndVerify(this.documentPriorSnapshot, dir, content, final)
                .catch((e) => {
                    const from = this.documentPriorSnapshot.containerDescription;
                    this.reportError(`Error logged from ${from} while generating snapshot`, e);
                    this.documentPriorSnapshot = undefined;
                });
        }
    }

    private async validateSaveAndLoad(content: ContainerContent, dir: string, final: boolean) {
        const op = content.op;

        // Keep doc from previous iteration and validate here - this gives us shortest
        // distance between load & save, and finds bugs in catchup ops.
        // No need to do it if overlappingContainers === 1 - there is container like that
        // in validateSlidingSnapshots()!
        if (this.documentPriorWindow && this.args.overlappingContainers !== 1) {
            await this.documentPriorWindow.replay(op);
            await this.saveAndVerify(this.documentPriorWindow, dir, content, final);
            this.documentPriorWindow = undefined;
        }

        // Load it back to prove it's correct
        const storageClass = FileSnapshotWriterClassFactory(FileSnapshotReader);
        const storage = new storageClass(content.snapshot);
        this.documentPriorWindow = new Document(this.args, storage, `Saved & loaded at seq# ${op}`);
        await this.loadDoc(this.documentPriorWindow);
        await this.saveAndVerify(this.documentPriorWindow, dir, content, final);
    }

    private async generateSnapshot(final: boolean) {
        const op = this.mainDocument.currentOp;
        const dir = this.args.outDirName; // `${this.args.outDirName}/${op}`;

        const content = await this.generateMainSnapshot(dir, final);
        if (content.snapshot === undefined) {
            // Snapshots are not created if there is no "code" proposal
            // It takes some number of ops to get there (join, propose)
            // Do not report a failure if document is almost empty.
            if (op >= 4) {
                this.reportError(`\nSnapshot ${this.mainDocument.getFileName()} was not saved for op # ${op}!`);
            }
            return;
        }

        await this.validateSaveAndLoad(content, dir, final);

        await this.validateSlidingSnapshots(content, dir, final);

        if (final && this.documentNeverSnapshot) {
            await this.saveAndVerify(this.documentNeverSnapshot, dir, content, final);
        }

        await this.validateStorageSnapshots(content, dir, final);

        /*
        If (this.args.write) {
            // Follow up:
            // Summary needs commits (same way as snapshot), that is available in
            // FluidFetchReaderFileSnapshotWriter.write()
            const summaryTree = await container.summarize(true);
            const file = `${dir}/summary.json`;
            fs.writeFileSync(file, JSON.stringify(summaryTree, undefined, 2));
        }
        */
    }

    private async saveAndVerify(
        document2: Document,
        dir: string,
        content: ContainerContent,
        final: boolean): Promise<boolean> {
        const op = document2.currentOp;

        const content2 = document2.extractContent();

        const name1 = this.mainDocument.getFileName();
        const name2 = document2.getFileName();

        document2.storage.onSnapshotHandler = (snapshot: IFileSnapshot) => {
            content2.snapshot = snapshot;
        };

        await document2.snapshot();
        if (final) {
            document2.close();
        }

        if (content2.snapshot === undefined) {
            this.reportError(`\nSnapshot ${name2} was not saved at op # ${op}!`);
            return false;
        }

        // Check if the two snapshots match.
        let failed = true;
        let error: any;
        if (content.op === content2.op) {
            // Deep compare the normalized snapshots. If they do not match, catch the error and display it.
            try {
                strict.deepStrictEqual(content.normalizedSnapshot, content2.normalizedSnapshot);
                failed = false;
            } catch (e) {
                error = e;
            }
        }

        if (failed) {
            // eslint-disable-next-line max-len
            this.reportError(`\nOp ${op}: Discrepancy between ${name1} & ${name2}! Likely a bug in snapshot load-save sequence!`, error);

            // Write the failed snapshots under 'FailedSnapshot' sub-directory of the current directory. This will in
            // debugging by looking into the complete snapshot.
            const failedDir = `${dir}/FailedSnapshots`;
            fs.mkdirSync(failedDir, { recursive: true });

            this.expandForReadabilityAndWriteOut(content, `${failedDir}/${name1}`);
            this.expandForReadabilityAndWriteOut(content2, `${failedDir}/${name2}`);

            if (this.args.windiff) {
                console.log(`windiff.exe "${failedDir}/${name1}_expanded.json" "${failedDir}/${name2}_expanded.json"`);
                this.windiffCount++;
                if (this.windiffCount <= 10) {
                    child_process.exec(
                        `windiff.exe "${failedDir}/${name1}_expanded.json" "${failedDir}/${name2}_expanded.json"`);
                } else if (this.windiffCount === 10) {
                    console.error("Launched 10 windiff processes, stopping!");
                }
            }
            return false;
        }

        if (!this.args.verbose && threads.isMainThread) {
            process.stdout.write(".");
        }
        return true;
    }

    private expandForReadabilityAndWriteOut(content: ContainerContent, filename: string) {
        fs.writeFileSync(
            `${filename}.json`,
            content.snapshotAsString,
            { encoding: "utf-8" });

        if (this.args.expandFiles) {
            fs.writeFileSync(
                `${filename}_expanded.json`,
                content.snapshotExpanded,
                { encoding: "utf-8" });
        }
    }
}
