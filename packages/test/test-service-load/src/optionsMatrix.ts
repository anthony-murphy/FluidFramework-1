/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import {
    IContainerRuntimeOptions,
    IGCRuntimeOptions,
    ISummaryRuntimeOptions,
} from "@fluidframework/container-runtime";
import {
    booleanCases,
    generatePairwiseOptions,
    OptionsMatrix,
    numberCases,
} from "@fluidframework/test-pairwise-generator";
import { ILoaderOptions } from "@fluidframework/container-loader";
import { TestDriverTypes } from "@fluidframework/test-driver-definitions";

const loaderOptionsMatrix: OptionsMatrix<ILoaderOptions> = {
    cache: booleanCases,
    provideScopeLoader: booleanCases,
    maxClientLeaveWaitTime: numberCases,
    noopCountFrequency: numberCases,
    noopTimeFrequency: numberCases,
    summarizeProtocolTree: [undefined],
};

export function generateLoaderOptions(seed: number, driver?: TestDriverTypes): (ILoaderOptions | undefined)[] {
    const matrix = {
        ...loaderOptionsMatrix,
    };
    switch(driver) {
        case "odsp":
            matrix.summarizeProtocolTree = [undefined, true];
            break;
        default:
    }

    return [undefined, generatePairwiseOptions<ILoaderOptions>(matrix, seed)];
}

const gcOptionsMatrix: OptionsMatrix<IGCRuntimeOptions> = {
    disableGC: booleanCases,
    gcAllowed: booleanCases,
    runFullGC: booleanCases,
    runSweep: [false],
};

export function generateRuntimeOptions(seed: number) {
    const summaryOptionsMatrix: OptionsMatrix<ISummaryRuntimeOptions> = {
        disableIsolatedChannels: booleanCases,
        generateSummaries: [true],
        initialSummarizerDelayMs: numberCases,
        summaryConfigOverrides: [undefined],
        maxOpsSinceLastSummary: numberCases,
        summarizerClientElection: booleanCases,
        summarizerOptions: [undefined],
    };

    const runtimeOptionsMatrix: OptionsMatrix<IContainerRuntimeOptions> = {
        gcOptions: [undefined, ...generatePairwiseOptions(gcOptionsMatrix, seed)],
        summaryOptions: [undefined, ...generatePairwiseOptions(summaryOptionsMatrix, seed)],
        loadSequenceNumberVerification: [undefined],
    };

    return generatePairwiseOptions<IContainerRuntimeOptions>(runtimeOptionsMatrix, seed);
}
