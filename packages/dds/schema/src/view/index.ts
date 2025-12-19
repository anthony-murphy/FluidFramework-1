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

export { SchemaValidationError } from "./errors.js";

export { SchematizedObjectView } from "./objectView.js";

export { SchematizedMapView } from "./mapView.js";

export { createObjectViewProxy, createMapViewProxy } from "./proxy.js";

export type { ViewFor } from "./viewFor.js";

export type { SchematizedObject, SchematizedMap, SchematizedView } from "./proxyTypes.js";
