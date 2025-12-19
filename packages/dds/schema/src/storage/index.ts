/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/**
 * Storage interfaces for DDSes implementing schema-based data access.
 *
 * This module defines the interfaces that DDSes implement to provide schema-aware
 * storage capabilities. The {@link ISchemaStorage} interface provides unified data
 * access, while {@link ISchemaPersistence} handles schema persistence for Modality 2.
 */

export type { StorageResult, ISchemaStorage, ISchemaPersistence } from "./interfaces.js";
