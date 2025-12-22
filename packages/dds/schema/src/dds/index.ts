/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/**
 * DDS integration utilities for schema-based views.
 *
 * This module provides simplified APIs for DDS authors to add schema support
 * without needing to understand internal details like overloads or type guards.
 */

export { createViewWith } from "./viewWithFactory.js";
export type { IViewableStorage } from "./viewWithFactory.js";
