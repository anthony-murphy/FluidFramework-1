/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

"use strict";

const getFluidTestMochaConfig = require("@fluid-internal/mocha-test-setup/mocharc-common");

const config = getFluidTestMochaConfig(__dirname);

// Exclude type-only test files from mocha - they are compile-time type tests,
// not runtime tests. They use patterns like `undefined as unknown as Type`
// which only work at compile time.
config.ignore = config.ignore || [];
config.ignore.push("**/test/types/**");

module.exports = config;
