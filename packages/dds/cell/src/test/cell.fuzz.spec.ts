/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { strict as assert } from "node:assert";
import * as path from "node:path";

import type { AsyncGenerator, Generator } from "@fluid-private/stochastic-test-utils";
import {
	combineReducers,
	createWeightedGenerator,
	takeAsync,
} from "@fluid-private/stochastic-test-utils";
import type { DDSFuzzModel, DDSFuzzTestState } from "@fluid-private/test-dds-utils";
import { createDDSFuzzSuite } from "@fluid-private/test-dds-utils";
import { isFluidHandle } from "@fluidframework/runtime-utils/internal";

import type { IFluidHandle } from "@fluidframework/core-interfaces";
import type { Serializable } from "@fluidframework/datastore-definitions/internal";

import { CellFactory } from "../cellFactory.js";
import type { ISharedCell } from "../interfaces.js";
import { _dirname } from "./dirname.cjs";

interface SetKey {
	type: "setKey";
	value: Serializable<unknown>;
}

interface DeleteKey {
	type: "deleteKey";
}

type Operation = SetKey | DeleteKey;

// This type gets used a lot as the state object of the suite; shorthand it here.
type State = DDSFuzzTestState<CellFactory>;

async function assertMapsAreEquivalent(a: ISharedCell, b: ISharedCell): Promise<void> {
	const aVal: unknown = a.get();
	const bVal: unknown = b.get();
	const aHandle: unknown = isFluidHandle(aVal) ? await aVal.get() : aVal;
	const bHandle: unknown = isFluidHandle(bVal) ? await bVal.get() : bVal;
	assert.deepEqual(
		aHandle,
		bHandle,
		`${a.id} and ${b.id} differ}: ${JSON.stringify(aHandle)} vs ${JSON.stringify(bHandle)}`,
	);
}

const reducer = combineReducers<Operation, State>({
	setKey: ({ client }, { value }) => {
		client.channel.set(value);
	},
	deleteKey: ({ client }) => {
		client.channel.delete();
	},
});

interface GeneratorOptions {
	setWeight: number;
	deleteWeight: number;
}

const defaultOptions: GeneratorOptions = {
	setWeight: 20,
	deleteWeight: 20,
};

function makeGenerator(optionsParam?: Partial<GeneratorOptions>): AsyncGenerator<Operation, State> {
	const { setWeight, deleteWeight } = {
		...defaultOptions,
		...optionsParam,
	};

	const setKey: Generator<SetKey, State> = ({ random }) => ({
		type: "setKey",
		value: random.pick([
			(): number => random.integer(1, 50),
			(): string => random.string(random.integer(3, 7)),
			(): IFluidHandle => random.handle(),
		])(),
	});
	const deleteKey: Generator<DeleteKey, State> = () => ({
		type: "deleteKey",
	});

	const syncGenerator = createWeightedGenerator<Operation, State>([
		[setKey, setWeight],
		[deleteKey, deleteWeight],
	]);

	return async (state) => syncGenerator(state);
}

describe("Cell fuzz tests", () => {
	const model: DDSFuzzModel<CellFactory, Operation> = {
		workloadName: "default",
		factory: new CellFactory(),
		generatorFactory: () => takeAsync(100, makeGenerator()),
		reducer: async (state, operation) => reducer(state, operation),
		validateConsistency: async (a, b) => assertMapsAreEquivalent(a.channel, b.channel),
	};

	createDDSFuzzSuite(model, {
		// Uncomment to replay a particular seed.
		// replay: 0,
		saveFailures: { directory: path.join(_dirname, "/results/") },
	});
});
