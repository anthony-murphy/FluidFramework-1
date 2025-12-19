/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/**
 * Type utility for mapping root schemas to their corresponding view types.
 */

import type { ObjectNodeSchema, MapNodeSchema, RootSchema } from "../core/index.js";

import type { SchematizedObjectView } from "./objectView.js";
import type { SchematizedMapView } from "./mapView.js";

/**
 * Maps a root schema type to its corresponding view type.
 *
 * @remarks
 * This utility type is used by DDSes to provide the correct typed view
 * based on the schema passed to view methods like `viewWith`.
 *
 * - For {@link ObjectNodeSchema}: Returns a {@link SchematizedObjectView}
 * - For {@link MapNodeSchema}: Returns a {@link SchematizedMapView}
 *
 * @typeParam TSchema - The root schema type
 *
 * @example
 * ```typescript
 * // Usage in a DDS interface
 * viewWith<TSchema extends RootSchema>(schema: TSchema): ViewFor<TSchema>;
 * ```
 * @internal
 */
export type ViewFor<TSchema extends RootSchema> = TSchema extends ObjectNodeSchema
	? SchematizedObjectView<TSchema>
	: TSchema extends MapNodeSchema
		? SchematizedMapView<TSchema>
		: never;
