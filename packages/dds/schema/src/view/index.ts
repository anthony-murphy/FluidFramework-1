/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/**
 * Schema view and projection utilities.
 *
 * This module provides typed views over schema storage, enabling
 * type-safe access to data that conforms to a schema definition.
 */

// Re-export UsageError for use by consumers of this module
export { UsageError } from "@fluidframework/telemetry-utils/internal";

export { SchemaValidationError, isSchemaValidationError } from "./errors.js";
export type { ISchemaValidationError } from "./errors.js";

export { SchematizedObjectView } from "./objectView.js";
export type { SchematizedObjectViewOptions } from "./objectView.js";

export { SchematizedMapView } from "./mapView.js";
export type { SchematizedMapViewOptions } from "./mapView.js";

export { createObjectViewProxy, createMapViewProxy } from "./proxy.js";

export type { ViewFor } from "./viewFor.js";

export type { SchematizedObject, SchematizedMap, SchematizedView } from "./proxyTypes.js";

// Configuration types for views
export { normalizeViewConfig } from "./configuration.js";
export type { SchemaViewConfiguration } from "./configuration.js";

// Factory functions for creating views
export {
	createSchematizedView,
	createSchematizedObjectView,
	createSchematizedMapView,
} from "./createView.js";
export type { CreateViewOptions, ObjectViewResult, MapViewResult } from "./createView.js";
