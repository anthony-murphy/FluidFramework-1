/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { takeAsync } from "@fluid-private/stochastic-test-utils";
import { createDDSFuzzSuite } from "@fluid-private/test-dds-utils";
import { FlushMode } from "@fluidframework/runtime-definitions/internal";

import {
	baseModel,
	defaultFuzzOptions,
	defaultIntervalOperationGenerationConfig,
	makeIntervalOperationGenerator,
} from "./fuzzUtils.js";

const defaultTestCount = 200;

const baseIntervalModel = {
	...baseModel,
	generatorFactory: () =>
		takeAsync(
			defaultTestCount,
			makeIntervalOperationGenerator(defaultIntervalOperationGenerationConfig),
		),
};

describe("IntervalCollection", () => {
	const model = {
		...baseIntervalModel,
		workloadName: "default interval collection",
	};

	createDDSFuzzSuite(model, {
		...defaultFuzzOptions,
		defaultTestCount,
		// Uncomment this line to replay a specific seed from its failure file:
		// replay: 0,
		skip: [148],
	});
});

describe("IntervalCollection fuzz testing with rebased batches", () => {
	const noReconnectWithRebaseModel = {
		...baseIntervalModel,
		workloadName: "interval collection with rebasing",
	};

	createDDSFuzzSuite(noReconnectWithRebaseModel, {
		...defaultFuzzOptions,
		reconnectProbability: 0.0,
		clientJoinOptions: {
			maxNumberOfClients: 3,
			clientAddProbability: 0.0,
		},
		rebaseProbability: 0.2,
		containerRuntimeOptions: {
			flushMode: FlushMode.TurnBased,
			enableGroupedBatching: true,
		},
		// Uncomment this line to replay a specific seed from its failure file:
		// replay: 0,
	});
});
