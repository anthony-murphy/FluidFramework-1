/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/**
 * The kind of tree node.
 *
 * @remarks
 * More kinds may be added over time, so do not assume this is an exhaustive set.
 * @legacy
 * @alpha
 */
export const NodeKind = {
	/**
	 * A node which serves as a map, storing children under string keys.
	 */
	Map: 0,

	/**
	 * A node which serves as an array, storing children in an ordered sequence.
	 */
	Array: 1,

	/**
	 * A node which stores a heterogeneous collection of children in named fields.
	 * @remarks
	 * Each field gets its own schema.
	 */
	Object: 2,

	/**
	 * A node which stores a single leaf value.
	 */
	Leaf: 3,
} as const;

/**
 * The kind of tree node.
 *
 * @remarks
 * More kinds may be added over time, so do not assume this is an exhaustive set.
 * @legacy
 * @alpha
 */
export type NodeKind = (typeof NodeKind)[keyof typeof NodeKind];
