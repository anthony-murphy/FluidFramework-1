/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { assert } from "console";
import commander from "commander";
import { TestDriverTypes } from "@fluidframework/test-driver-definitions";
import { ILoadTestConfig } from "./testConfigFile";
import { IRunConfig } from "./loadTestDataStore";
import { createTestDriver, getProfile, load, loggerP, safeExit } from "./utils";

let logged = false;
function logStatus(runId: number, message: string) {
    console.log(`${runId.toString().padStart(3)}> ${message}`);
    logged = true;
}

async function main() {
    commander
        .version("0.0.1")
        .requiredOption("-d, --driver <driver>", "Which test driver info to use", "odsp")
        .requiredOption("-p, --profile <profile>", "Which test profile to use from testConfig.json", "ci")
        .requiredOption("-id, --testId <testId>", "Load an existing data store rather than creating new")
        .requiredOption("-r, --runId <runId>", "run a child process with the given id. Requires --testId option.")
        .option("-l, --log <filter>", "Filter debug logging. If not provided, uses DEBUG env variable.")
        .parse(process.argv);

    const driver: TestDriverTypes = commander.driver;
    const profileArg: string = commander.profile;
    const testId: string = commander.testId;
    const runId: number  = commander.runId;
    const log: string | undefined = commander.log;

    const profile = getProfile(profileArg);

    if (log !== undefined) {
        process.env.DEBUG = log;
    }

    if (testId === undefined) {
        console.error("Missing --testId argument needed to run child process");
        process.exit(-1);
    }
    setInterval(
        ()=>{
            if(logged === false) {
                logStatus(runId, "heartbeat");
            }
            logged = false;
        },
        5 * 60 * 1000);
    const result = await runnerProcess(driver, profile, runId, testId);

    await safeExit(result, testId, runId);
}

/**
 * Implementation of the runner process. Returns the return code to exit the process with.
 */
async function runnerProcess(
    driver: TestDriverTypes,
    profile: ILoadTestConfig,
    runId: number,
    testId: string,
): Promise<number> {
    try {
        const runConfig: IRunConfig = {
            runId,
            testConfig: profile,
        };

        const testDriver = await createTestDriver(driver);

        let reset = true;
        let done = false;
        while(!done) {
            const {container, test} = await load(testDriver, testId, runId);

            new Promise((res, rej)=>{
                // wait for the container to connect write
                container.once("closed", rej);
                if(!container.deltaManager.active) {
                    container.once("connected", res);
                }
            }).then(()=>{
                const quorum = container.getQuorum();
                const clientId = container.clientId;
                // calculate the clients quorum position
                const quorumIndex =
                    clientId !== undefined && quorum.has(clientId)
                        ? [... quorum.getMembers().entries()]
                            .sort((a,b)=>b[1].sequenceNumber - a[1].sequenceNumber)
                            .map((m)=>m[0])
                            .indexOf(clientId)
                        : profile.numClients;

                assert(quorumIndex >= 0);

                setTimeout(
                    ()=>{
                        if(!container.closed) {
                            container.close();
                        }
                    },
                    // bucket the clients, with bias towards the summarizer
                    (((quorumIndex % 10) + 1) * profile.readWriteCycleMs) * ((quorumIndex % 2) + 1)
                    // add some gitter up to half a cycle
                    + (profile.readWriteCycleMs * Math.random()));
            }).catch(()=>{});

            try{
                logStatus(runId, "running");
                done = await test.run(runConfig, reset);
                logStatus(runId, done ?  "finished" : "closed");
            } finally{
                reset = false;
                if(!container.closed) {
                    container.close();
                }
                await loggerP.then(async (l)=>l.flush({testId, runId}));
            }
        }
        return 0;
    } catch (e) {
        console.error(`${runId.toString().padStart(3)}> error: loading test`);
        console.error(e);
        return -1;
    }
}

main()
.catch(
    (error) => {
        console.error(error);
        process.exit(-1);
    },
);
