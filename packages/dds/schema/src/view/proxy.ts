/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/**
 * Proxy creation utilities for schema views.
 */

import type { ObjectNodeSchema } from "../core/index.js";
import type { SchemaCompatibilityStatus } from "../serialization/index.js";
import type { NodeFromSchema } from "../types/index.js";

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
 * @legacy
 * @alpha
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
			return typeof prop === "string" && prop in schema.fields;
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
