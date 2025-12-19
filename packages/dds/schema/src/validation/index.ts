/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/**
 * Schema validation utilities.
 *
 * This module provides runtime validation of data against schema definitions.
 * It is used to ensure that data conforms to the expected structure before
 * storing it in a DDS.
 */

export {
	type ValidationError,
	type ValidationResult,
	type SchemaRegistry,
	buildSchemaRegistry,
	validateData,
} from "./validate.js";
