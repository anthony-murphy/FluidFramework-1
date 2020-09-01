/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import {
    ICodeAllowList, IFluidPackage, IPackageConfig, IResolvedCodeDetails,
} from "@fluidframework/container-definitions";

/**
 * Class used by hosts to allow specific containers and endpoint.
 */
export class AllowList implements
    ICodeAllowList<IFluidPackage> {
    public pkg?: IFluidPackage;
    public config?: IPackageConfig;
    public scriptIds?: string[];

    constructor(
        private readonly testHandler?: (
            source: IResolvedCodeDetails<IFluidPackage>) => Promise<boolean>,
    ) { }

    public async testSource(
        source: IResolvedCodeDetails<IFluidPackage>): Promise<boolean> {
        if (this.testHandler === undefined) {
            return true;
        }
        return this.testHandler(source);
    }
}
