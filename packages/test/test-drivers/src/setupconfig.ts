/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import fs from "fs";
import { setupOdspConfig } from "./odspTestDriver";

async function main() {
    console.log("loading config");
    const config: {odsp: any} = JSON.parse(fs.readFileSync(`${__dirname}/config.json`, "utf-8"));

    console.log("setupOdspConfig");
    await setupOdspConfig(config.odsp);

    console.log("writing config");
    fs.writeFileSync(`${__dirname}/config.json`, JSON.stringify(config, undefined, 2), {encoding: "utf-8"});
}
main()
    .catch((e)=>{
        console.error("Failed to read testConfig.json");
        console.error(e);
        process.exit(-1);
    });
