// eslint-disable-next-line import/no-extraneous-dependencies
import { Lazy } from "@fluidframework/common-utils";
import {
    LocalServerDriverConfig,
    TinyliciousDriverConfig,
    OdspDriverConfig,
    RouterliciousDriverConfig,
 // eslint-disable-next-line import/no-extraneous-dependencies
 } from "@fluidframework/test-driver-setup";
import { TestDriverConfig } from "./oldVersion";

const envVar = "fluid__test__driver";
const cmdArg = "--test-driver=";

const testDriver = new Lazy<TestDriverConfig>(()=>{
    const arg = process.argv.find((v)=>v.toLocaleLowerCase().startsWith(cmdArg))?.toLocaleLowerCase();
    const type = process.env[envVar]?.toLocaleLowerCase() ?? arg?.replace(cmdArg, "");

    switch (type) {
        case undefined:
        case "":
        case "local":
            return new LocalServerDriverConfig();

        case "tinylicious":
            return new TinyliciousDriverConfig();

        case "routerlicious":
            return new RouterliciousDriverConfig();

        case "odsp":
            return new OdspDriverConfig();

        default:
            throw new Error(`No driver registered for type ${type}`);
    }
});

export const getTestDriverConfig =
    (): TestDriverConfig => testDriver.value;
