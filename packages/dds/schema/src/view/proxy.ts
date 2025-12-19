/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/**
 * Proxy creation utilities for schema views.
 */

import { UsageError } from "@fluidframework/telemetry-utils/internal";

import type { ObjectNodeSchema, MapNodeSchema } from "../core/index.js";
import type { SchemaCompatibilityStatus } from "../serialization/index.js";
import type { NodeFromSchema, InferValueSchema } from "../types/index.js";

import type { SchematizedMapView } from "./mapView.js";
import type { SchematizedObjectView } from "./objectView.js";

/**
 * Error message thrown when accessing a disposed view.
 */
const disposedErrorMessage = "Accessed a disposed SchemaView.";

/**
 * Create a Proxy that provides property access to a {@link SchematizedObjectView}.
 *
 * @remarks
 * This function is deprecated. The view classes now have `root` property built-in.
 * Use the view's `root` property directly instead.
 *
 * @deprecated Use SchematizedObjectView directly - it now has a `root` property built-in.
 *
 * @param view - The view to wrap
 * @param schema - The schema defining available fields
 * @returns A proxy providing view structure with root data access
 *
 * @internal
 */
export function createObjectViewProxy<TSchema extends ObjectNodeSchema>(
	view: SchematizedObjectView<TSchema>,
	schema: TSchema,
): {
	root: NodeFromSchema<TSchema>;
	compatibility: SchemaCompatibilityStatus;
	initialize: () => void;
	upgradeSchema: () => void;
	dispose: () => void;
	disposed: boolean;
} {
	// Create the data proxy for the root property
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
	const dataProxyTarget: NodeFromSchema<TSchema> = {} as NodeFromSchema<TSchema>;
	const dataProxy = new Proxy(dataProxyTarget, {
		get(_target, prop) {
			if (view.disposed) {
				throw new UsageError(disposedErrorMessage);
			}
			if (typeof prop === "string" && prop in schema.fields) {
				return view.getFieldValue(prop);
			}
			return undefined;
		},
		set(_target, prop, value) {
			if (view.disposed) {
				throw new UsageError(disposedErrorMessage);
			}
			if (typeof prop === "string" && prop in schema.fields) {
				view.setFieldValue(prop, value);
				return true;
			}
			return false;
		},
		has(_target, prop) {
			// Check if the field has a value (like hasField), not just if it's in the schema
			if (typeof prop === "string" && prop in schema.fields) {
				return view.hasField(prop);
			}
			return false;
		},
		ownKeys() {
			return Object.keys(schema.fields);
		},
		getOwnPropertyDescriptor(_target, prop) {
			if (typeof prop === "string" && prop in schema.fields) {
				return { enumerable: true, configurable: true };
			}
			return undefined;
		},
	}) as unknown as NodeFromSchema<TSchema>;

	// Create the view proxy with root property
	const viewProxy = {
		get root(): NodeFromSchema<TSchema> {
			if (view.disposed) {
				throw new UsageError(disposedErrorMessage);
			}
			return dataProxy;
		},
		set root(value: NodeFromSchema<TSchema>) {
			if (view.disposed) {
				throw new UsageError(disposedErrorMessage);
			}
			// Setting root reinitializes the view with new data
			// First clear existing data, then set new values
			// For simplicity, we set each field from the new value
			for (const fieldName of Object.keys(schema.fields)) {
				const fieldValue = (value as Record<string, unknown>)[fieldName];
				view.setFieldValue(fieldName, fieldValue);
			}
		},
		get compatibility(): SchemaCompatibilityStatus {
			if (view.disposed) {
				throw new UsageError(disposedErrorMessage);
			}
			return view.compatibility;
		},
		initialize: (): void => {
			if (view.disposed) {
				throw new UsageError(disposedErrorMessage);
			}
			view.initialize();
		},
		upgradeSchema: (): void => {
			if (view.disposed) {
				throw new UsageError(disposedErrorMessage);
			}
			view.upgradeSchema();
		},
		get disposed(): boolean {
			return view.disposed;
		},
		dispose: (): void => {
			view.dispose();
		},
	};

	return viewProxy;
}

/**
 * Create a Proxy that provides Map-like access to a {@link SchematizedMapView}.
 *
 * @remarks
 * This function is deprecated. The view classes now have `root` property built-in.
 * Use the view's `root` property directly instead.
 *
 * @deprecated Use SchematizedMapView directly - it now has a `root` property built-in.
 *
 * @param view - The view to wrap
 * @param schema - The schema defining the map value type
 * @returns A view providing root Map access
 *
 * @internal
 */
export function createMapViewProxy<TSchema extends MapNodeSchema>(
	view: SchematizedMapView<TSchema>,
	_schema: TSchema,
): {
	root: Map<string, InferValueSchema<TSchema>>;
	compatibility: SchemaCompatibilityStatus;
	initialize: () => void;
	upgradeSchema: () => void;
	dispose: () => void;
	disposed: boolean;
} {
	// Create a Map-like proxy for the root property
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
	const mapProxyTarget = {} as Map<string, InferValueSchema<TSchema>>;
	const mapProxy = new Proxy(mapProxyTarget, {
		get(_target, prop) {
			if (view.disposed) {
				throw new UsageError(disposedErrorMessage);
			}
			// Map methods
			if (prop === "get") {
				return (key: string) => view.get(key);
			}
			if (prop === "set") {
				return (key: string, value: InferValueSchema<TSchema>) => {
					view.set(key, value);
					return mapProxy; // Return proxy for chaining like Map
				};
			}
			if (prop === "has") {
				return (key: string) => view.has(key);
			}
			if (prop === "delete") {
				return (key: string) => view.delete(key);
			}
			if (prop === "clear") {
				return () => view.clear();
			}
			if (prop === "keys") {
				return () => view.keys();
			}
			if (prop === "values") {
				return () => view.values();
			}
			if (prop === "entries") {
				return () => view.entries();
			}
			if (prop === "forEach") {
				return (
					callback: (
						value: InferValueSchema<TSchema>,
						key: string,
						map: Map<string, InferValueSchema<TSchema>>,
					) => void,
					thisArg?: unknown,
				) => {
					for (const [key, value] of view) {
						callback.call(thisArg, value, key, mapProxy);
					}
				};
			}
			if (prop === "size") {
				return view.size;
			}
			if (prop === Symbol.iterator) {
				return () => view[Symbol.iterator]();
			}
			if (prop === Symbol.toStringTag) {
				return "Map";
			}
			return undefined;
		},
		has(_target, prop) {
			const mapProps = [
				"get",
				"set",
				"has",
				"delete",
				"clear",
				"keys",
				"values",
				"entries",
				"forEach",
				"size",
				Symbol.iterator,
				Symbol.toStringTag,
			];
			return mapProps.includes(prop);
		},
	}) as unknown as Map<string, InferValueSchema<TSchema>>;

	// Create the view with root property
	const viewProxy = {
		get root(): Map<string, InferValueSchema<TSchema>> {
			if (view.disposed) {
				throw new UsageError(disposedErrorMessage);
			}
			return mapProxy;
		},
		set root(value: Map<string, InferValueSchema<TSchema>>) {
			if (view.disposed) {
				throw new UsageError(disposedErrorMessage);
			}
			// Setting root replaces all data
			// Clear existing entries and add new ones
			view.clear();
			for (const [key, val] of value) {
				view.set(key, val);
			}
		},
		get compatibility(): SchemaCompatibilityStatus {
			if (view.disposed) {
				throw new UsageError(disposedErrorMessage);
			}
			return view.compatibility;
		},
		initialize: (): void => {
			if (view.disposed) {
				throw new UsageError(disposedErrorMessage);
			}
			view.initialize();
		},
		upgradeSchema: (): void => {
			if (view.disposed) {
				throw new UsageError(disposedErrorMessage);
			}
			view.upgradeSchema();
		},
		get disposed(): boolean {
			return view.disposed;
		},
		dispose: (): void => {
			view.dispose();
		},
	};

	return viewProxy;
}
