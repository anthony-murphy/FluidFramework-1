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
 * @legacy
 * @alpha
 */
export declare const FieldKind: {
	/**
	 * A field which must always be filled.
	 * @remarks
	 * Only allows exactly one child.
	 */
	readonly Required: 0;
	/**
	 * A field which can be empty or filled.
	 * @remarks
	 * Allows 0 or one child.
	 */
	readonly Optional: 1;
};
/**
 * Kind of a field on an object node.
 *
 * @remarks
 * This is a simplified version of the Tree DDS FieldKind that excludes
 * Tree-specific field kinds like `Identifier`.
 * @legacy
 * @alpha
 */
export type FieldKind = (typeof FieldKind)[keyof typeof FieldKind];
