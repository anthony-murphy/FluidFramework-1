/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import {
    ICodeLoader,
    ICodeAllowList,
    IFluidModule,
    IFluidCodeResolver,
    IFluidPackage,
    IResolvedCodeDetails,
} from "@fluidframework/container-definitions";
import { ScriptManager } from "./scriptManager";

export class WebCodeLoader<TResolvedCodeDetails extends Pick<IFluidPackage, "fluid"> = IFluidPackage>
implements ICodeLoader {
    private readonly loadedModules = new Map<string, Promise<IFluidModule> | IFluidModule>();
    private readonly scriptManager = new ScriptManager();

    constructor(
        private readonly codeResolver: IFluidCodeResolver<TResolvedCodeDetails>,
        private readonly allowList?: ICodeAllowList<TResolvedCodeDetails>) { }

    public async seedModule(
        source: unknown,
        maybeFluidModule?: Promise<IFluidModule> | IFluidModule,
    ): Promise<void> {
        const resolved = await this.codeResolver.resolveCodeDetails(source);
        if (resolved.codeDetailsCacheId !== undefined
            && this.loadedModules.has(resolved.codeDetailsCacheId)) {
            return;
        }
        const fluidModule = maybeFluidModule ?? this.load(source);
        if (resolved.codeDetailsCacheId !== undefined) {
            this.loadedModules.set(resolved.codeDetailsCacheId, fluidModule);
        }
    }

    public async preCache(source: unknown, tryPreload: boolean) {
        const resolved = await this.codeResolver.resolveCodeDetails(source);
        if (resolved?.resolvedCodeDetails?.fluid?.browser?.umd?.files !== undefined) {
            return this.scriptManager.preCacheFiles(
                resolved.resolvedCodeDetails.fluid.browser.umd.files, tryPreload);
        }
    }

    /**
     * @param source - Details of where to find chaincode
     */
    public async load(
        source: unknown,
    ): Promise<IFluidModule> {
        const resolved = await this.codeResolver.resolveCodeDetails(source);
        if (resolved.codeDetailsCacheId !== undefined) {
            const maybePkg = this.loadedModules.get(resolved.codeDetailsCacheId);
            if (maybePkg !== undefined) {
                return maybePkg;
            }
        }

        const fluidModuleP = this.loadModuleFromResolvedCodeDetails(resolved);
        if (resolved.codeDetailsCacheId !== undefined) {
            this.loadedModules.set(resolved.codeDetailsCacheId, fluidModuleP);
        }
        return fluidModuleP;
    }

    private async loadModuleFromResolvedCodeDetails(resolved: IResolvedCodeDetails<TResolvedCodeDetails>) {
        if (this.allowList !== undefined && !(await this.allowList.testSource(resolved))) {
            throw new Error("Attempted to load invalid code package url");
        }

        const loadedScripts = await this.scriptManager.loadLibrary(
            resolved.resolvedCodeDetails.fluid.browser.umd,
        );
        let fluidModule: IFluidModule | undefined;
        for (const script of loadedScripts) {
            const maybeFluidModule = script.entryPoint as IFluidModule;
            if (maybeFluidModule.fluidExport !== undefined) {
                if (fluidModule !== undefined) {
                    throw new Error("Multiple Fluid modules loaded");
                }
                fluidModule = maybeFluidModule;
            }
        }

        if (fluidModule?.fluidExport === undefined) {
            throw new Error("Entry point of loaded code package not a Fluid module");
        }
        return fluidModule;
    }
}
