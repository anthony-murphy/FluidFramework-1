/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/**
 * Proxy creation utilities for schema views.
 */

import type { ObjectNodeSchema, MapNodeSchema } from "../core/index.js";
import type { SchemaCompatibilityStatus } from "../serialization/index.js";
import type { NodeFromSchema, InferValueSchema } from "../types/index.js";

import type { SchematizedMapView } from "./mapView.js";
import type { SchematizedObjectView } from "./objectView.js";

/**
 * Create a Proxy that provides property access to a {@link SchematizedObjectView}.
 *
 * @remarks
 * This function creates a JavaScript Proxy that enables property-style access
 * to the fields defined in the schema. It combines data access with view methods.
 *
 * @param view - The view to wrap
 * @param schema - The schema defining available fields
 * @returns A proxy providing property access
 *
 * @example
 * ```typescript
 * const view = new SchematizedObjectView(storage, UserSchema);
 * const proxy = createObjectViewProxy(view, UserSchema);
 *
 * // Property access
 * proxy.name = "Alice";
 * console.log(proxy.name); // "Alice"
 *
 * // View methods still available
 * console.log(proxy.compatibility);
 * ```
 *
 * @internal
 */
export function createObjectViewProxy<TSchema extends ObjectNodeSchema>(
	view: SchematizedObjectView<TSchema>,
	schema: TSchema,
): NodeFromSchema<TSchema> & {
	compatibility: SchemaCompatibilityStatus;
	initialize: (content: NodeFromSchema<TSchema>) => void;
	upgradeSchema: () => void;
} {
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
	const proxyTarget: NodeFromSchema<TSchema> = {} as NodeFromSchema<TSchema>;
	return new Proxy(proxyTarget, {
		get(_target, prop) {
			if (prop === "compatibility") {
				return view.compatibility;
			}
			if (prop === "initialize") {
				return view.initialize.bind(view);
			}
			if (prop === "upgradeSchema") {
				return view.upgradeSchema.bind(view);
			}
			if (typeof prop === "string" && prop in schema.fields) {
				return view.getFieldValue(prop);
			}
			return undefined;
		},
		set(_target, prop, value) {
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
	}) as unknown as NodeFromSchema<TSchema> & {
		compatibility: SchemaCompatibilityStatus;
		initialize: (content: NodeFromSchema<TSchema>) => void;
		upgradeSchema: () => void;
	};
}

/**
 * Create a Proxy that provides Map-like access to a {@link SchematizedMapView}.
 *
 * @remarks
 * This function creates a JavaScript Proxy that enables Map-style access
 * to the entries defined in the schema. It combines data access with view methods.
 *
 * @param view - The view to wrap
 * @param schema - The schema defining the map value type
 * @returns A proxy providing Map-like access
 *
 * @example
 * ```typescript
 * const view = new SchematizedMapView(storage, ConfigMap);
 * const proxy = createMapViewProxy(view, ConfigMap);
 *
 * // Map operations
 * proxy.set("key1", "value1");
 * console.log(proxy.get("key1")); // "value1"
 * console.log(proxy.has("key1")); // true
 * proxy.delete("key1");
 *
 * // Iteration
 * for (const [key, value] of proxy) {
 *   console.log(key, value);
 * }
 *
 * // View methods still available
 * console.log(proxy.compatibility);
 * ```
 *
 * @internal
 */
export function createMapViewProxy<TSchema extends MapNodeSchema>(
	view: SchematizedMapView<TSchema>,
	_schema: TSchema,
): Map<string, InferValueSchema<TSchema>> & {
	compatibility: SchemaCompatibilityStatus;
	initialize: (content: Map<string, InferValueSchema<TSchema>>) => void;
	upgradeSchema: () => void;
} {
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
	const proxyTarget = {} as Map<string, InferValueSchema<TSchema>>;
	return new Proxy(proxyTarget, {
		get(_target, prop) {
			// View properties
			if (prop === "compatibility") {
				return view.compatibility;
			}
			if (prop === "initialize") {
				return view.initialize.bind(view);
			}
			if (prop === "upgradeSchema") {
				return view.upgradeSchema.bind(view);
			}
			// Map methods
			if (prop === "get") {
				return (key: string) => view.get(key);
			}
			if (prop === "set") {
				return (key: string, value: InferValueSchema<TSchema>) => {
					view.set(key, value);
					return proxyTarget; // Return proxy for chaining like Map
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
						callback.call(thisArg, value, key, proxyTarget);
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
			const viewProps = ["compatibility", "initialize", "upgradeSchema"];
			return mapProps.includes(prop) || viewProps.includes(prop as string);
		},
	}) as unknown as Map<string, InferValueSchema<TSchema>> & {
		compatibility: SchemaCompatibilityStatus;
		initialize: (content: Map<string, InferValueSchema<TSchema>>) => void;
		upgradeSchema: () => void;
	};
}
