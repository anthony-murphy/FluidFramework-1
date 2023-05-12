/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { EventEmitter } from "events";
import { DataObject, DataObjectFactory } from "@fluidframework/aqueduct";
import { ISharedDirectory, IValueChanged } from "@fluidframework/map";
import React from "react";

const diceValueKeys = Array.from({ length: 5 }).map((_, i) => `diceValue${i}`);

/**
 * IDiceRoller describes the public API surface for our dice roller Fluid object.
 */
export interface IDiceRoller extends EventEmitter {
	/**
	 * Get the dice value as a number.
	 */
	readonly values: number[];
	readonly branches: readonly { id: number; type: string; values: number[] }[];
	/**
	 * Roll the dice.  Will cause a "diceRolled" event to be emitted.
	 */
	roll: (i?: number) => void;
	snakeEyes: (i?: number) => void;

	paused: boolean;
	pause: () => void;

	branch: (process?: "remote" | "remote&Local") => Promise<void>;
	appMergeEven: (i: number) => void;
	rebaseMerge: (i: number) => void;
	closeBranch: (i: number) => void;

	/**
	 * The diceRolled event will fire whenever someone rolls the device, either locally or remotely.
	 */
	on(event: "diceRolled", listener: () => void): this;
	on(event: "branchChanges", listener: () => void): this;
}

export interface IDiceRollerViewProps {
	model: IDiceRoller;
}

export const DiceRollerView: React.FC<IDiceRollerViewProps> = (props: IDiceRollerViewProps) => {
	const [diceValue, setDiceValue] = React.useState(props.model.values);
	const [branches, setBranchValue] = React.useState(props.model.branches);

	React.useEffect(() => {
		const onDiceRolled = () => {
			setDiceValue(props.model.values);
		};
		props.model.on("diceRolled", onDiceRolled);
		return () => {
			props.model.off("diceRolled", onDiceRolled);
		};
	}, [props.model]);

	React.useEffect(() => {
		const onBranched = () => {
			setBranchValue(props.model.branches);
		};
		props.model.on("branchChanges", onBranched);
		return () => {
			props.model.off("branchChanges", onBranched);
		};
	}, [props.model]);

	// Unicode 0x2680-0x2685 are the sides of a dice (⚀⚁⚂⚃⚄⚅)
	const diceChars = diceValue.map((v) => String.fromCodePoint(0x267f + v)).join("");

	const pausedText = props.model.paused ? "Resume" : "Pause";

	return (
		<div>
			<div key="root">
				<div>
					<span style={{ fontSize: 50 }}>{diceChars}</span>
				</div>
				<div>
					<span>Actions: </span>
					<button onClick={() => props.model.roll()}>Roll</button>
					<button onClick={() => props.model.snakeEyes()}>SnakeEyes</button>
				</div>
				<div>
					<span>Connection: </span>
					<button onClick={props.model.pause}>{pausedText}</button>
				</div>
				<div>
					<span>Branch: </span>
					<button onClick={() => void props.model.branch()}>Static</button>
					<button onClick={() => void props.model.branch("remote")}>ProcessRemote</button>
					<button onClick={() => void props.model.branch("remote&Local")}>
						ProcessRemoteAndLocal
					</button>
				</div>
			</div>
			{branches.map((b) => {
				return (
					<div key={b.id}>
						<div>
							<span style={{ fontSize: 50 }}>
								{b.values.map((v) => String.fromCodePoint(0x267f + v)).join("")}
							</span>
						</div>
						<div>
							<span>Actions: </span>
							<button onClick={() => props.model.roll(b.id)}>Roll</button>
							<button onClick={() => props.model.snakeEyes(b.id)}>SnakeEyes</button>
						</div>
						<div>
							<span>Branch: {b.type}</span>
						</div>
						<div>
							<button onClick={() => props.model.closeBranch(b.id)}>Close</button>
							<button onClick={() => props.model.appMergeEven(b.id)}>
								AppMergeEvenValues
							</button>
							<button
								onClick={() => props.model.rebaseMerge(b.id)}
								hidden={b.type === "static"}
								disabled={props.model.paused}
							>
								RebaseMerge
							</button>
						</div>
					</div>
				);
			})}
		</div>
	);
};

/**
 * The DiceRoller is our implementation of the IDiceRoller interface.
 */
export class DiceRoller extends DataObject implements IDiceRoller {
	public static get Name() {
		return "@fluid-example/dice-roller";
	}

	public static readonly factory = new DataObjectFactory(DiceRoller.Name, DiceRoller, [], {});

	/**
	 * initializingFirstTime is called only once, it is executed only by the first client to open the
	 * Fluid object and all work will resolve before the view is presented to any user.
	 *
	 * This method is used to perform Fluid object setup, which can include setting an initial schema or initial values.
	 */
	protected async initializingFirstTime() {
		this.snakeEyes();
	}

	public snakeEyes = (id?: number) => {
		const dir = id === undefined ? this.root : this._branches.get(id)?.dir;
		if (dir !== undefined) {
			diceValueKeys.forEach((k) => dir.set(k, 1));
		}
	};

	public get paused() {
		return (
			this.runtime.deltaManager.outbound.paused || this.runtime.deltaManager.inbound.paused
		);
	}
	public pause = async () => {
		if (this.runtime.deltaManager.outbound.paused) {
			this.runtime.deltaManager.inbound.resume();
			this.runtime.deltaManager.outbound.resume();
		} else {
			await this.runtime.deltaManager.inbound.pause();
			await this.runtime.deltaManager.outbound.pause();
		}
		this.emit("diceRolled");
	};

	protected async hasInitialized() {
		this.root.on("valueChanged", (changed: IValueChanged) => {
			if (diceValueKeys.includes(changed.key)) {
				this.emit("diceRolled");
			}
		});
	}

	public get values() {
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		return diceValueKeys.map((k) => this.root.get<number>(k)!);
	}

	private dieIndex: number = 0;

	public readonly roll = (id?: number) => {
		const rollValue = Math.floor(Math.random() * 6) + 1;
		this.dieIndex++;
		this.dieIndex %= diceValueKeys.length;
		const dir = id === undefined ? this.root : this._branches.get(id)?.dir;
		if (dir !== undefined) {
			dir.set(diceValueKeys[this.dieIndex], rollValue);
		}
	};

	private readonly _branches = new Map<
		number,
		{ dir: ISharedDirectory; id: number; type: string; merge?: () => void }
	>();
	public get branches() {
		return Array.from(this._branches.values()).map((v) => ({
			id: v.id,
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			values: diceValueKeys.map((k) => v.dir.get<number>(k)!),
			type: v.type,
		}));
	}

	public readonly branch = async (process?: "remote" | "remote&Local") => {
		const details = await this.runtime.branchChannel?.("root", { process });

		const branch = {
			dir: details?.channel as ISharedDirectory,
			merge: details?.context?.merge,
			id: Date.now(),
			type: process ?? "static",
		};
		this._branches.set(branch.id, branch);
		branch.dir.on("valueChanged", (changed: IValueChanged) => {
			if (diceValueKeys.includes(changed.key)) {
				this.emit("branchChanges");
			}
		});
		this.emit("branchChanges");
	};

	public readonly appMergeEven = (id: number) => {
		const branch = this._branches.get(id);
		if (branch !== undefined) {
			diceValueKeys.forEach((k) => {
				const val = branch.dir.get(k);
				if (val % 2 === 0) {
					this.root.set(k, val);
				}
			});
		}
	};

	public readonly rebaseMerge = (id: number) => {
		const branch = this._branches.get(id);
		branch?.merge?.();
		this.emit("branchChanges");
	};

	public readonly closeBranch = (i: number) => {
		this._branches.delete(i);
		this.emit("branchChanges");
	};
}

/**
 * The DataObjectFactory declares the Fluid object and defines any additional distributed data structures.
 * To add a SharedSequence, SharedMap, or any other structure, put it in the array below.
 */
export const DiceRollerInstantiationFactory = DiceRoller.factory;
