/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/**
 * Kind of a field on an object node.
 *
 * @remarks
 * This is a simplified version of the Tree DDS FieldKind that excludes
 * Tree-specific field kinds like `Identifier`.
 * @alpha @legacy
 */
export const FieldKind = {
	/**
	 * A field which must always be filled.
	 * @remarks
	 * Only allows exactly one child.
	 */
	Required: 0,

	/**
	 * A field which can be empty or filled.
	 * @remarks
	 * Allows 0 or one child.
	 */
	Optional: 1,
} as const;

/**
 * Kind of a field on an object node.
 *
 * @remarks
 * This is a simplified version of the Tree DDS FieldKind that excludes
 * Tree-specific field kinds like `Identifier`.
 * @alpha @legacy
 */
export type FieldKind = (typeof FieldKind)[keyof typeof FieldKind];
