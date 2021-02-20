/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import assert from "assert";
import fs from "fs";
import child_process from "child_process";
import commander from "commander";
import { Loader } from "@fluidframework/container-loader";
import { IFluidCodeDetails } from "@fluidframework/core-interfaces";
import { LocalCodeLoader } from "@fluidframework/test-utils";
import { IOdspTestLoginInfo, OdspTestDriver } from "@fluidframework/test-drivers";
import { ITestDriver } from "@fluidframework/test-driver-definitions";
import { pkgName, pkgVersion } from "./packageVersion";
import { ITestConfig, ILoadTestConfig, ITestTenant } from "./testConfigFile";
import { IRunConfig, fluidExport, ILoadTest } from "./loadTestDataStore";

const packageName = `${pkgName}@${pkgVersion}`;

const codeDetails: IFluidCodeDetails = {
    package: packageName,
    config: {},
};

const codeLoader = new LocalCodeLoader([[codeDetails, fluidExport]]);

function createLoader(testDriver: ITestDriver) {
    // Construct the loader
    const loader = new Loader({
        urlResolver: testDriver.createUrlResolver(),
        documentServiceFactory: testDriver.createDocumentServiceFactory(),
        codeLoader,
    });
    return loader;
}

async function initialize(testDriver: ITestDriver) {
    const loader = createLoader(testDriver);
    const container = await loader.createDetachedContainer(codeDetails);
    container.on("error", (error) => {
        console.log(error);
        process.exit(-1);
    });
    const testId = Date.now().toString();
    const request = testDriver.createCreateNewRequest(testId);
    await container.attach(request);
    const url = await container.getAbsoluteUrl("/");
    container.close();
    assert(url);
    return url;
}

async function load(testDriver: ITestDriver, url: string) {
    const loader = createLoader(testDriver);
    const respond = await loader.request({ url });
    // TODO: Error checking
    return respond.value as ILoadTest;
}

async function main() {
    commander
        .version("0.0.1")
        .requiredOption("-t, --tenant <tenant>", "Which test tenant info to use from testConfig.json", "fluidCI")
        .requiredOption("-p, --profile <profile>", "Which test profile to use from testConfig.json", "ci")
        .option("-u, --url <url>", "Load an existing data store rather than creating new")
        .option("-r, --runId <runId>", "run a child process with the given id. Requires --url option.")
        .option("-d, --debug", "Debug child processes via --inspect-brk")
        .option("-l, --log <filter>", "Filter debug logging. If not provided, uses DEBUG env variable.")
        .parse(process.argv);

    const tenantArg: string = commander.tenant;
    const profileArg: string = commander.profile;
    const url: string | undefined = commander.url;
    const runId: number | undefined = commander.runId === undefined ? undefined : parseInt(commander.runId, 10);
    const debug: true | undefined = commander.debug;
    const log: string | undefined = commander.log;

    let config: ITestConfig;
    try {
        config = JSON.parse(fs.readFileSync("./testConfig.json", "utf-8"));
    } catch (e) {
        console.error("Failed to read testConfig.json");
        console.error(e);
        process.exit(-1);
    }

    const tenant: ITestTenant | undefined = config.tenants[tenantArg];
    if (tenant === undefined) {
        console.error("Invalid --tenant argument not found in testConfig.json tenants");
        process.exit(-1);
    }

    let password: string;
    try {
        // Expected format of login__odsp__test__accounts is simply string key-value pairs of username and password
        const passwords: { [user: string]: string } =
            JSON.parse(process.env.login__odsp__test__accounts ?? "");

        password = passwords[tenant.username];
        assert(password, "Expected to find Password in an env variable since it wasn't provided via script param");
    } catch (e) {
        console.error("Failed to parse login__odsp__test__accounts env variable");
        console.error(e);
        process.exit(-1);
    }
    const loginInfo: IOdspTestLoginInfo = { server: tenant.server, username: tenant.username, password };

    const profile: ILoadTestConfig | undefined = config.profiles[profileArg];
    if (profile === undefined) {
        console.error("Invalid --profile argument not found in testConfig.json profiles");
        process.exit(-1);
    }

    if (log !== undefined) {
        process.env.DEBUG = log;
    }

    let result: number;
    // When runId is specified (with url), kick off a single test runner and exit when it's finished
    if (runId !== undefined) {
        if (url === undefined) {
            console.error("Missing --url argument needed to run child process");
            process.exit(-1);
        }
        result = await runnerProcess(loginInfo, profile, runId, url);
        process.exit(result);
    }

    // When runId is not specified, this is the orchestrator process which will spawn child test runners.
    result = await orchestratorProcess(
        { ...loginInfo, tenantFriendlyName: tenantArg },
        { ...profile, name: profileArg },
        { url, debug });
    process.exit(result);
}

/**
 * Implementation of the runner process. Returns the return code to exit the process with.
 */
async function runnerProcess(
    loginInfo: IOdspTestLoginInfo,
    profile: ILoadTestConfig,
    runId: number,
    url: string,
): Promise<number> {
    try {
        const runConfig: IRunConfig = {
            runId,
            testConfig: profile,
        };
        const testDriver = await OdspTestDriver.create(loginInfo, "stress");
        const stressTest = await load(testDriver, url);
        await stressTest.run(runConfig);
        console.log(`${runId.toString().padStart(3)}> exit`);
        return 0;
    } catch (e) {
        console.error(`${runId.toString().padStart(3)}> error: loading test`);
        console.error(e);
        return -1;
    }
}

/**
 * Implementation of the orchestrator process. Returns the return code to exit the process with.
 */
async function orchestratorProcess(
    loginInfo: IOdspTestLoginInfo & { tenantFriendlyName: string },
    profile: ILoadTestConfig & { name: string },
    args: { url?: string, debug?: true },
): Promise<number> {
    const testDriver = await OdspTestDriver.create(loginInfo, "stress");

    // Create a new file if a url wasn't provided
    const url = args.url ?? await initialize(testDriver);

    const estRunningTimeMin = Math.floor(2 * profile.totalSendCount / (profile.opRatePerMin * profile.numClients));
    console.log(`Connecting to ${args.url ? "existing" : "new"} Container targeting dataStore with URL:\n${url}`);
    console.log(`Authenticated as user: ${loginInfo.username}`);
    console.log(`Selected test profile: ${profile.name}`);
    console.log(`Estimated run time: ${estRunningTimeMin} minutes\n`);

    const p: Promise<void>[] = [];
    for (let i = 0; i < profile.numClients; i++) {
        const childArgs: string[] = [
            "./dist/nodeStressTest.js",
            "--tenant", loginInfo.tenantFriendlyName,
            "--profile", profile.name,
            "--runId", i.toString(),
            "--url", url];
        if (args.debug) {
            const debugPort = 9230 + i; // 9229 is the default and will be used for the root orchestrator process
            childArgs.unshift(`--inspect-brk=${debugPort}`);
        }
        const process = child_process.spawn(
            "node",
            childArgs,
            { stdio: "inherit" },
        );
        p.push(new Promise((resolve) => process.on("close", resolve)));
    }
    await Promise.all(p);
    return 0;
}

main().catch(
    (error) => {
        console.error(error);
        process.exit(-1);
    },
);
