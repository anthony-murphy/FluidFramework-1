/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */
import type {
	NodeSchema,
	ObjectNodeSchema,
	ArrayNodeSchema,
	MapNodeSchema,
	LeafNodeSchema,
} from "./nodeSchema.js";
/**
 * Checks if a schema is an {@link ObjectNodeSchema}.
 *
 * @param schema - The schema to check.
 * @returns `true` if the schema is an ObjectNodeSchema, `false` otherwise.
 * @legacy
 * @alpha
 */
export declare function isObjectSchema(schema: NodeSchema): schema is ObjectNodeSchema;
/**
 * Checks if a schema is an {@link ArrayNodeSchema}.
 *
 * @param schema - The schema to check.
 * @returns `true` if the schema is an ArrayNodeSchema, `false` otherwise.
 * @legacy
 * @alpha
 */
export declare function isArraySchema(schema: NodeSchema): schema is ArrayNodeSchema;
/**
 * Checks if a schema is a {@link MapNodeSchema}.
 *
 * @param schema - The schema to check.
 * @returns `true` if the schema is a MapNodeSchema, `false` otherwise.
 * @legacy
 * @alpha
 */
export declare function isMapSchema(schema: NodeSchema): schema is MapNodeSchema;
/**
 * Checks if a schema is a {@link LeafNodeSchema}.
 *
 * @param schema - The schema to check.
 * @returns `true` if the schema is a LeafNodeSchema, `false` otherwise.
 * @legacy
 * @alpha
 */
export declare function isLeafSchema(schema: NodeSchema): schema is LeafNodeSchema;
