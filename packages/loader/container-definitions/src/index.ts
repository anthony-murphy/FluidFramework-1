/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { IProvideRuntimeFactory, IProvideRuntimeUpgradeDetails } from "./runtime";
import { IProvideFluidTokenProvider } from "./tokenProvider";
import { IProvideMessageScheduler } from "./messageScheduler";

declare module "@fluidframework/core-interfaces" {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    export interface IFluidObject extends Readonly<Partial<
        IProvideRuntimeFactory &
        IProvideRuntimeUpgradeDetails &
        IProvideFluidTokenProvider &
        IProvideMessageScheduler>> { }
}

export * from "./audience";
export * from "./blobs";
export * from "./codeLoader";
export * from "./deltas";
export * from "./error";
export * from "./loader";
export * from "./fluidPackage";
export * from "./fluidModule";
export * from "./proxyLoader";
export * from "./messageScheduler";
export * from "./runtime";
export * from "./tokenProvider";
