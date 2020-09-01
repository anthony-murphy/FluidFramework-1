/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { IFluidModule } from "./fluidModule";

/**
 * Code loading interface
 */
export interface ICodeLoader {
    /**
     * Loads the package specified by IPackage and returns a promise to its entry point exports.
     */
    load(details: unknown): Promise<IFluidModule>;
}

/**
* The interface returned from a IFluidCodeResolver which represents IFluidPackageCodeDetails
 * that have been resolved and are ready to load
 */
export interface IResolvedCodeDetails<TResolvedCodeDetails> {

    /**
     * A resolved version of the Fluid package. All Fluid browser file entries should be absolute urls.
     */
    readonly resolvedCodeDetails: Readonly<TResolvedCodeDetails>;
    /**
     * If not undefined, this id will be used to cache the entry point for the code package
     */
    readonly codeDetailsCacheId: string | undefined;
}

/**
 * Fluid code resolvers take a Fluid code details, and resolve the
 * full Fluid package including absolute urls for the browser file entries.
 * The Fluid code resolver is coupled to a specific cdn and knows how to resolve
 * the code detail for loading from that cdn. This include resolving to the most recent
 * version of package that supports the provided code details.
 */
export interface IFluidCodeResolver<TResolvedCodeDetails> {
    /**
     * Resolves a Fluid code details into a form that can be loaded
     * @param details - The Fluid code details to resolve
     * @returns - A IResolvedFluidPackageCodeDetails where the
     *            resolvedPackage's Fluid file entries are absolute urls, and
     *            an optional resolvedPackageCacheId if the loaded package should be
     *            cached.
     */
    resolveCodeDetails(details: unknown):
        Promise<IResolvedCodeDetails<TResolvedCodeDetails>>;
}

/**
 * Code AllowListing Interface
 */
export interface ICodeAllowList<TResolvedCodeDetails> {
    testSource(source: IResolvedCodeDetails<TResolvedCodeDetails>): Promise<boolean>;
}
