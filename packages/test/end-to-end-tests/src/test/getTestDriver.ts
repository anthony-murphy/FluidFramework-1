// eslint-disable-next-line import/no-extraneous-dependencies
import { Lazy } from "@fluidframework/common-utils";
import {
    LocalServerTestDriver,
    TinyliciousTestDriver,
    OdspTestDriver,
    RouterliciousTestDriver,
    TestDriverTypes,
 // eslint-disable-next-line import/no-extraneous-dependencies
 } from "@fluidframework/test-drivers";
import { TestDriver } from "./oldVersion";

const envVar = "E2E_TEST_DRIVER";
type EnvVarTestDriverTypes = TestDriverTypes | "" | undefined;
const testDriver = new Lazy<TestDriver>(()=>{
    const type =
        process.env[envVar]?.toLocaleLowerCase() as EnvVarTestDriverTypes;

    switch (type) {
        case undefined:
        case "":
        case "local":
            return new LocalServerTestDriver();

        case "tinylicious":
            return new TinyliciousTestDriver();

        case "routerlicious":
            return RouterliciousTestDriver.createFromEnv();

        case "odsp":
            return  OdspTestDriver.createFromEnv();

        default:
            throw new Error(`No driver config registered for type "${type}"`);
    }
});

export const getTestDriver =
    (): TestDriver => testDriver.value;
