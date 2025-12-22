/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/**
 * BaseSchematizedView - shared base class for typed views over schema storage.
 */

import type { IDisposable } from "@fluidframework/core-interfaces";
import { UsageError } from "@fluidframework/telemetry-utils/internal";

import type { NodeSchema } from "../core/index.js";
import type { ISchemaPersistence } from "../storage/index.js";
import {
	encodeSchema,
	checkSchemaCompatibility,
	type SchemaCompatibilityStatus,
} from "../serialization/index.js";

/**
 * Error message thrown when accessing a disposed view.
 * @internal
 */
export const disposedViewErrorMessage = "Accessed a disposed SchemaView.";

/**
 * Options for configuring schematized views.
 *
 * @alpha
 */
export interface SchematizedViewOptions {
	/**
	 * Enable runtime validation on every set operation.
	 *
	 * @remarks
	 * When true, every set operation will validate the data against the schema
	 * before storing it.
	 *
	 * @defaultValue false
	 */
	enableSchemaValidation?: boolean;

	/**
	 * List of stored schema identifiers to ignore during validation.
	 *
	 * @remarks
	 * This is an unsafe escape hatch for development/migration scenarios.
	 * When the stored schema's identifier matches one in this list,
	 * it will be ignored and the view will act as if no schema was stored.
	 */
	ignoreStoredSchema?: readonly string[];
}

/**
 * Base class for schematized views providing shared functionality.
 *
 * @remarks
 * This abstract class implements the common patterns shared by
 * {@link SchematizedObjectView} and {@link SchematizedMapView}:
 * - Disposal tracking
 * - Schema compatibility checking
 * - Schema initialization and upgrade
 *
 * @typeParam TSchema - The node schema type
 *
 * @alpha
 */
export abstract class BaseSchematizedView<TSchema extends NodeSchema> implements IDisposable {
	/**
	 * Whether schema validation is enabled for this view.
	 */
	protected readonly enableSchemaValidation: boolean;

	/**
	 * List of schema identifiers to ignore when checking compatibility.
	 */
	protected readonly ignoreStoredSchema: readonly string[] | undefined;

	/**
	 * Tracks whether this view has been disposed.
	 */
	private _disposed = false;

	/**
	 * Creates a new BaseSchematizedView.
	 *
	 * @param schema - The schema defining the structure
	 * @param persistence - Optional persistence layer for schema storage
	 * @param options - Optional configuration options
	 */
	protected constructor(
		protected readonly schema: TSchema,
		protected readonly persistence?: ISchemaPersistence,
		options?: SchematizedViewOptions,
	) {
		this.enableSchemaValidation = options?.enableSchemaValidation ?? false;
		this.ignoreStoredSchema = options?.ignoreStoredSchema;
	}

	// #region IDisposable

	/**
	 * Whether this view has been disposed.
	 */
	public get disposed(): boolean {
		return this._disposed;
	}

	/**
	 * Dispose this view, releasing resources.
	 *
	 * @remarks
	 * After disposing, accessing the view will throw an error.
	 */
	public dispose(): void {
		this._disposed = true;
	}

	/**
	 * Throws if this view has been disposed.
	 */
	protected ensureNotDisposed(): void {
		if (this._disposed) {
			throw new UsageError(disposedViewErrorMessage);
		}
	}

	// #endregion

	// #region Schema Compatibility

	/**
	 * Gets the schema compatibility status between the stored schema and this view's schema.
	 *
	 * @returns The compatibility status
	 */
	public get compatibility(): SchemaCompatibilityStatus {
		const stored = this.persistence?.getPersistedSchema();

		// Check if stored schema should be ignored (escape hatch for migration)
		if (
			stored !== undefined &&
			this.ignoreStoredSchema?.includes(stored.root.identifier) === true
		) {
			// Act as if no schema is stored - allows re-initialization
			return checkSchemaCompatibility(undefined, this.schema);
		}

		return checkSchemaCompatibility(stored, this.schema);
	}

	/**
	 * Gets the schema this view is based on.
	 */
	public get nodeSchema(): TSchema {
		return this.schema;
	}

	/**
	 * Initialize the storage by persisting the schema.
	 *
	 * @remarks
	 * This method persists the schema to enable cross-client enforcement.
	 * Setting data is a separate concern - use the appropriate accessors after initializing.
	 * Calling `initialize()` is optional - only call when you want schema persistence.
	 *
	 * @throws UsageError if a schema is already stored
	 */
	public initialize(): void {
		this.ensureNotDisposed();
		const compat = this.compatibility;
		if (!compat.canInitialize) {
			throw new UsageError("Cannot initialize - schema already stored");
		}

		// Store schema
		if (this.persistence !== undefined) {
			this.persistence.setPersistedSchema(encodeSchema(this.schema));
		}
	}

	/**
	 * Upgrade the stored schema to this view's schema.
	 *
	 * @throws UsageError if schemas are not compatible for upgrade
	 */
	public upgradeSchema(): void {
		this.ensureNotDisposed();
		const compat = this.compatibility;
		if (!compat.canUpgrade) {
			throw new UsageError("Cannot upgrade - schemas incompatible");
		}
		if (this.persistence !== undefined) {
			this.persistence.upgradePersistedSchema(encodeSchema(this.schema));
		}
	}

	/**
	 * Ensure the view can be used (not disposed and schema is compatible).
	 *
	 * @throws UsageError if the view is disposed or schema is incompatible
	 */
	protected ensureCanView(): void {
		this.ensureNotDisposed();
		if (!this.compatibility.canView) {
			throw new UsageError(
				"Cannot use view - schema incompatible. Check view.compatibility first.",
			);
		}
	}

	// #endregion
}
