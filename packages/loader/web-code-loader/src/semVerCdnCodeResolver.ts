/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import {
    IFluidPackageCodeDetails,
    IFluidCodeResolver,
    IPackage,
    isFluidPackage,
    IFluidPackage,
    IResolvedCodeDetails,
    ensureFluidPackageCodeDetails,
} from "@fluidframework/container-definitions";
import fetch from "isomorphic-fetch";
import { extractPackageIdentifierDetails } from "./utils";

type ResolvedFluidPackage = IResolvedCodeDetails<IFluidPackage> & IFluidPackageCodeDetails;

class FluidPackage {
    private resolveP: Promise<ResolvedFluidPackage> | undefined;
    private _package: IFluidPackage | undefined;

    constructor(public readonly codeDetails: IFluidPackageCodeDetails, private readonly packageUrl: string) { }

    public async resolve(): Promise<ResolvedFluidPackage> {
        if (this.resolveP === undefined) {
            this.resolveP = this.resolveCore();
        }

        return this.resolveP;
    }

    public get resolvedPackage(): IFluidPackage | undefined {
        return this._package;
    }

    private async resolveCore(): Promise<ResolvedFluidPackage> {
        let packageJson: any;
        if (typeof this.codeDetails.package === "string") {
            const response = await fetch(`${this.packageUrl}/package.json`);
            packageJson = await response.json() as IPackage;
        } else {
            packageJson = this.codeDetails.package;
        }

        if (!isFluidPackage(packageJson)) {
            throw new Error(`Package ${packageJson?.name} not a Fluid module.`);
        }
        this._package = packageJson;
        const files = packageJson.fluid.browser.umd.files;
        for (let i = 0; i < packageJson.fluid.browser.umd.files.length; i++) {
            if (!files[i].startsWith("http")) {
                files[i] = `${this.packageUrl}/${files[i]}`;
            }
        }

        return {
            config: this.codeDetails.config,
            package: this.codeDetails.package,
            resolvedCodeDetails: packageJson,
            codeDetailsCacheId: this.packageUrl,
        };
    }
}

/**
 * This code resolver works against cdns that support semantic versioning in the url path of the format:
 * `cdn_base/@package_scope?/package_name@package_version`
 *
 * The `@package_scope?` is optional, and only needed it the package has a scope.
 * The `package_version` can be an npm style semantic version.
 *
 * The `cdn_base` is provided in the config of the Fluid code details, as either a global `config.cdn` property, or
 * a per scope cdn, `config["@package_scope:cdn"]`. A scope specific cdn base will take precedence over
 * the global cdn.
 */
export class SemVerCdnCodeResolver implements IFluidCodeResolver<IFluidPackage> {
    // Cache goes CDN -> package -> entrypoint
    private readonly fluidPackageCache = new Map<string, FluidPackage>();

    public async resolveCodeDetails(details: unknown): Promise<ResolvedFluidPackage> {
        ensureFluidPackageCodeDetails(details);

        const parsed = extractPackageIdentifierDetails(details.package);

        for (const resolved of this.fluidPackageCache.values()) {
            if (resolved.resolvedPackage !== undefined) {
                if (resolved.resolvedPackage.name === parsed.name) {
                    // how do we know if these versions are compatible.
                    // equals is safe, but some sort of server ver would be better
                    //
                    if (resolved.resolvedPackage.version === parsed.version) {
                        return resolved.resolve();
                    }
                }
            }
        }

        const cdn = details.config[`@${parsed.scope}:cdn`] ?? details.config.cdn;
        const scopePath = parsed.scope !== undefined && parsed.scope.length > 0 ? `@${encodeURI(parsed.scope)}/` : "";
        const packageUrl = parsed.version !== undefined
            ? `${cdn}/${scopePath}${encodeURI(`${parsed.name}@${parsed.version}`)}`
            : `${cdn}/${scopePath}${encodeURI(`${parsed.name}`)}`;

        if (!this.fluidPackageCache.has(packageUrl)) {
            const resolved = new FluidPackage(details, packageUrl);
            this.fluidPackageCache.set(packageUrl, resolved);
        }
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return this.fluidPackageCache.get(packageUrl)!.resolve();
    }
}
