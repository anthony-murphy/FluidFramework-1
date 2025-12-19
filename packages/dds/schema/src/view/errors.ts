/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/**
 * Schema view error types.
 */

import type { IErrorBase } from "@fluidframework/core-interfaces";

import { LoggingError } from "@fluidframework/telemetry-utils/internal";

import type { ValidationError } from "../validation/index.js";

/**
 * Interface for schema validation errors.
 *
 * @remarks
 * Use {@link isSchemaValidationError} to check if an error is a schema validation error.
 *
 * @legacy
 * @alpha
 */
export interface ISchemaValidationError extends IErrorBase {
	/**
	 * The error type identifier for schema validation errors.
	 */
	readonly errorType: "schemaValidation";

	/**
	 * The validation errors that caused this exception.
	 */
	readonly errors: readonly ValidationError[];
}

/**
 * Type guard to check if an error is a schema validation error.
 *
 * @param error - The error to check.
 * @returns True if the error is a schema validation error.
 *
 * @example
 * ```typescript
 * try {
 *   view.root.get("key");
 * } catch (e) {
 *   if (isSchemaValidationError(e)) {
 *     console.log("Validation errors:", e.errors);
 *   }
 * }
 * ```
 *
 * @legacy
 * @alpha
 */
export function isSchemaValidationError(error: unknown): error is ISchemaValidationError {
	return (
		error instanceof Error &&
		(error as Partial<ISchemaValidationError>).errorType === "schemaValidation" &&
		Array.isArray((error as Partial<ISchemaValidationError>).errors)
	);
}

/**
 * Error thrown when data fails schema validation.
 *
 * @internal
 */
export class SchemaValidationError extends LoggingError implements ISchemaValidationError {
	/**
	 * The error type identifier for schema validation errors.
	 */
	public readonly errorType = "schemaValidation" as const;

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
