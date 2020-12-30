// eslint-disable-next-line import/no-extraneous-dependencies
import { Lazy } from "@fluidframework/common-utils";
import {
    LocalServerDriverConfig,
    TinyliciousDriverConfig,
    OdspDriverConfig,
    RouterliciousDriverConfig,
    TestDriverConfigTypes,
 // eslint-disable-next-line import/no-extraneous-dependencies
 } from "@fluidframework/test-drivers";
import { TestDriverConfig } from "./oldVersion";

const envVar = "E2E_TEST_DRIVER";
type EnvVarTestDriverConfigTypes = TestDriverConfigTypes | "" | undefined;
const testDriver = new Lazy<TestDriverConfig>(()=>{
    const type =
        process.env[envVar]?.toLocaleLowerCase() as EnvVarTestDriverConfigTypes;

    switch (type) {
        case undefined:
        case "":
        case "local":
            return new LocalServerDriverConfig();

        case "tinylicious":
            return new TinyliciousDriverConfig();

        case "routerlicious":
            return RouterliciousDriverConfig.createFromEnv();

        case "odsp":
            return  OdspDriverConfig.createFromEnv();

        default:
            throw new Error(`No driver config registered for type "${type}"`);
    }
});

export const getTestDriverConfig =
    (): TestDriverConfig => testDriver.value;
