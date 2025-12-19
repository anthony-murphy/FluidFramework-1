/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/**
 * Schema view error types.
 */

import type { ValidationError } from "../validation/index.js";

/**
 * Error thrown when data fails schema validation.
 *
 * @legacy
 * @alpha
 */
export class SchemaValidationError extends Error {
	/**
	 * The validation errors that caused this exception.
	 */
	public readonly errors: readonly ValidationError[];

	public constructor(message: string, errors: readonly ValidationError[] = []) {
		super(
			errors.length > 0
				? `${message}: ${errors.map((e) => `${e.path}: ${e.message}`).join(", ")}`
				: message,
		);
		this.name = "SchemaValidationError";
		this.errors = errors;
	}
}
