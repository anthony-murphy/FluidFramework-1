/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/**
 * Schema compatibility checking - determines if stored and view schemas are compatible.
 */

import { FieldKind, NodeKind, type NodeSchema } from "../core/index.js";

import type {
	EncodedSchema,
	SimpleNodeSchema,
	SimpleObjectNodeSchema,
	SimpleArrayNodeSchema,
	SimpleMapNodeSchema,
	SimpleLeafNodeSchema,
} from "./format.js";
import { encodeSchema } from "./encode.js";
import { decodeSchema } from "./decode.js";

/**
 * Result of checking compatibility between stored and view schemas.
 *
 * @remarks
 * This interface describes the compatibility status between a stored schema
 * (from persistence) and a view schema (requested by the application).
 * @legacy
 * @alpha
 */
export interface SchemaCompatibilityStatus {
	/**
	 * True if schemas are functionally identical.
	 *
	 * @remarks
	 * This means both schemas have the exact same structure, including
	 * all fields, field kinds (required/optional), and types.
	 */
	isEquivalent: boolean;

	/**
	 * True if the view can read all stored data.
	 *
	 * @remarks
	 * The view can read data if:
	 * - For ObjectNodeSchema: Stored has all required fields that view expects
	 * - For MapNodeSchema: Value types are compatible
	 * - For LeafNodeSchema: Same leaf kind
	 */
	canView: boolean;

	/**
	 * True if stored schema can be upgraded to view schema.
	 *
	 * @remarks
	 * Upgrade is possible when:
	 * - For ObjectNodeSchema: View only adds optional fields (no removing, no type changes)
	 * - For MapNodeSchema: View value type is superset of stored
	 * - For LeafNodeSchema: Same leaf kind
	 */
	canUpgrade: boolean;

	/**
	 * True if no stored schema exists yet.
	 *
	 * @remarks
	 * When there is no stored schema, the view schema can be used to initialize storage.
	 */
	canInitialize: boolean;
}

/**
 * Check compatibility between stored schema and view schema.
 *
 * @param stored - The encoded schema from storage (or undefined if none exists)
 * @param view - The view schema being requested
 * @returns Compatibility status describing what operations are allowed
 *
 * @remarks
 * This function determines what operations are safe when the stored schema
 * differs from the view schema. The compatibility rules ensure data integrity:
 *
 * - **canInitialize**: True only when no stored schema exists
 * - **canView**: True if the view can safely read all stored data
 * - **canUpgrade**: True if the stored schema can be safely upgraded to match view
 * - **isEquivalent**: True if schemas are structurally identical
 *
 * @example
 * ```typescript
 * const sf = new SchemaFactory("myApp");
 * const UserV1 = sf.object("User", { name: sf.string });
 * const UserV2 = sf.object("User", { name: sf.string, email: sf.optional(sf.string) });
 *
 * const storedSchema = encodeSchema(UserV1);
 * const status = checkSchemaCompatibility(storedSchema, UserV2);
 *
 * // status.canUpgrade is true (only added optional field)
 * // status.canView is false (view expects email which stored doesn't have)
 * // status.isEquivalent is false (schemas differ)
 * ```
 * @legacy
 * @alpha
 */
export function checkSchemaCompatibility(
	stored: EncodedSchema | undefined,
	view: NodeSchema,
): SchemaCompatibilityStatus {
	// If no stored schema, we can initialize with the view schema
	if (stored === undefined) {
		return {
			isEquivalent: false,
			canView: false,
			canUpgrade: false,
			canInitialize: true,
		};
	}

	// Encode the view schema for comparison
	const encodedView = encodeSchema(view);

	// Decode both schemas to SimpleNodeSchema for comparison
	const decodedStored = decodeSchema(stored);
	const decodedView = decodeSchema(encodedView);

	// Check structural equality for isEquivalent
	const isEquivalent = areSimpleSchemasEqual(
		decodedStored.root,
		decodedView.root,
		decodedStored.definitions,
		decodedView.definitions,
	);

	// Check if view can read stored data
	const canView = canViewStoredData(
		decodedStored.root,
		decodedView.root,
		decodedStored.definitions,
		decodedView.definitions,
	);

	// Check if stored can be upgraded to view
	const canUpgrade = canUpgradeSchema(
		decodedStored.root,
		decodedView.root,
		decodedStored.definitions,
		decodedView.definitions,
	);

	return {
		isEquivalent,
		canView,
		canUpgrade,
		canInitialize: false,
	};
}

/**
 * Check if two simple schemas are structurally equal.
 */
function areSimpleSchemasEqual(
	stored: SimpleNodeSchema,
	view: SimpleNodeSchema,
	storedDefs: ReadonlyMap<string, SimpleNodeSchema>,
	viewDefs: ReadonlyMap<string, SimpleNodeSchema>,
): boolean {
	// Different kinds are never equal
	if (stored.kind !== view.kind) {
		return false;
	}

	switch (stored.kind) {
		case NodeKind.Leaf: {
			const viewLeaf = view as SimpleLeafNodeSchema;
			return stored.leafKind === viewLeaf.leafKind;
		}
		case NodeKind.Object: {
			const viewObject = view as SimpleObjectNodeSchema;
			return areObjectSchemasEqual(stored, viewObject, storedDefs, viewDefs);
		}
		case NodeKind.Map: {
			const viewMap = view as SimpleMapNodeSchema;
			return areAllowedTypesEqual(
				stored.allowedTypes,
				viewMap.allowedTypes,
				storedDefs,
				viewDefs,
			);
		}
		case NodeKind.Array: {
			const viewArray = view as SimpleArrayNodeSchema;
			return areAllowedTypesEqual(
				stored.allowedTypes,
				viewArray.allowedTypes,
				storedDefs,
				viewDefs,
			);
		}
		default: {
			return false;
		}
	}
}

/**
 * Check if two object schemas are structurally equal.
 */
function areObjectSchemasEqual(
	stored: SimpleObjectNodeSchema,
	view: SimpleObjectNodeSchema,
	storedDefs: ReadonlyMap<string, SimpleNodeSchema>,
	viewDefs: ReadonlyMap<string, SimpleNodeSchema>,
): boolean {
	const storedFieldNames = Object.keys(stored.fields).sort();
	const viewFieldNames = Object.keys(view.fields).sort();

	// Must have same fields
	if (storedFieldNames.length !== viewFieldNames.length) {
		return false;
	}

	for (let i = 0; i < storedFieldNames.length; i++) {
		if (storedFieldNames[i] !== viewFieldNames[i]) {
			return false;
		}
	}

	// Check each field
	for (const fieldName of storedFieldNames) {
		const storedField = stored.fields[fieldName];
		const viewField = view.fields[fieldName];

		if (storedField === undefined || viewField === undefined) {
			return false;
		}

		// Field kind must match
		if (storedField.kind !== viewField.kind) {
			return false;
		}

		// Allowed types must match
		if (
			!areAllowedTypesEqual(
				storedField.allowedTypes,
				viewField.allowedTypes,
				storedDefs,
				viewDefs,
			)
		) {
			return false;
		}
	}

	return true;
}

/**
 * Check if two allowed type lists are equal.
 */
function areAllowedTypesEqual(
	stored: readonly string[],
	view: readonly string[],
	storedDefs: ReadonlyMap<string, SimpleNodeSchema>,
	viewDefs: ReadonlyMap<string, SimpleNodeSchema>,
): boolean {
	if (stored.length !== view.length) {
		return false;
	}

	const sortedStored = [...stored].sort();
	const sortedView = [...view].sort();

	for (let i = 0; i < sortedStored.length; i++) {
		const storedId = sortedStored[i];
		const viewId = sortedView[i];

		if (storedId === undefined || viewId === undefined) {
			return false;
		}

		// If identifiers match directly, they're equal
		if (storedId === viewId) {
			continue;
		}

		// Otherwise, look up in definitions and compare structurally
		const storedSchema = storedDefs.get(storedId);
		const viewSchema = viewDefs.get(viewId);

		if (storedSchema === undefined || viewSchema === undefined) {
			return false;
		}

		if (!areSimpleSchemasEqual(storedSchema, viewSchema, storedDefs, viewDefs)) {
			return false;
		}
	}

	return true;
}

/**
 * Check if the view schema can read data stored with the stored schema.
 *
 * @remarks
 * The view can read stored data if:
 * - For leaf: Same leaf kind
 * - For object: Stored has all required fields that view expects (with compatible types)
 * - For map/array: Value types are compatible (stored types are subset of view types)
 */
function canViewStoredData(
	stored: SimpleNodeSchema,
	view: SimpleNodeSchema,
	storedDefs: ReadonlyMap<string, SimpleNodeSchema>,
	viewDefs: ReadonlyMap<string, SimpleNodeSchema>,
): boolean {
	// Different kinds cannot be viewed
	if (stored.kind !== view.kind) {
		return false;
	}

	switch (stored.kind) {
		case NodeKind.Leaf: {
			const viewLeaf = view as SimpleLeafNodeSchema;
			// Leaf schemas must have the same kind
			return stored.leafKind === viewLeaf.leafKind;
		}
		case NodeKind.Object: {
			const viewObject = view as SimpleObjectNodeSchema;
			return canViewObjectData(stored, viewObject, storedDefs, viewDefs);
		}
		case NodeKind.Map: {
			const viewMap = view as SimpleMapNodeSchema;
			// View can read stored map if stored value types are subset of view value types
			return areTypesSubset(stored.allowedTypes, viewMap.allowedTypes, storedDefs, viewDefs);
		}
		case NodeKind.Array: {
			const viewArray = view as SimpleArrayNodeSchema;
			// View can read stored array if stored item types are subset of view item types
			return areTypesSubset(stored.allowedTypes, viewArray.allowedTypes, storedDefs, viewDefs);
		}
		default: {
			return false;
		}
	}
}

/**
 * Check if view object schema can read stored object data.
 *
 * @remarks
 * View can read stored data if:
 * - All required fields in view exist in stored with compatible types
 * - All optional fields in view either exist in stored with compatible types, or don't exist
 * - Extra fields in stored (not in view) are allowed (view just ignores them)
 */
function canViewObjectData(
	stored: SimpleObjectNodeSchema,
	view: SimpleObjectNodeSchema,
	storedDefs: ReadonlyMap<string, SimpleNodeSchema>,
	viewDefs: ReadonlyMap<string, SimpleNodeSchema>,
): boolean {
	// For each field in view, check if it can be satisfied by stored
	for (const [fieldName, viewField] of Object.entries(view.fields)) {
		const storedField = stored.fields[fieldName];

		if (storedField === undefined) {
			// Field doesn't exist in stored
			if (viewField.kind === FieldKind.Required) {
				// View requires this field but stored doesn't have it
				return false;
			}
			// Optional field not in stored is OK - will be undefined
			continue;
		}

		// Field exists in both - check type compatibility
		// Stored types must be subset of view types for this field
		if (
			!areTypesSubset(storedField.allowedTypes, viewField.allowedTypes, storedDefs, viewDefs)
		) {
			return false;
		}
	}

	return true;
}

/**
 * Check if stored schema can be upgraded to view schema.
 *
 * @remarks
 * Upgrade is possible when:
 * - For leaf: Same leaf kind (no upgrade needed)
 * - For object: View only adds optional fields, no removing fields, no type changes
 * - For map/array: View value type is superset of stored
 */
function canUpgradeSchema(
	stored: SimpleNodeSchema,
	view: SimpleNodeSchema,
	storedDefs: ReadonlyMap<string, SimpleNodeSchema>,
	viewDefs: ReadonlyMap<string, SimpleNodeSchema>,
): boolean {
	// Different kinds cannot be upgraded
	if (stored.kind !== view.kind) {
		return false;
	}

	switch (stored.kind) {
		case NodeKind.Leaf: {
			const viewLeaf = view as SimpleLeafNodeSchema;
			// Leaf schemas must have the same kind
			return stored.leafKind === viewLeaf.leafKind;
		}
		case NodeKind.Object: {
			const viewObject = view as SimpleObjectNodeSchema;
			return canUpgradeObjectSchema(stored, viewObject, storedDefs, viewDefs);
		}
		case NodeKind.Map: {
			const viewMap = view as SimpleMapNodeSchema;
			// Can upgrade if stored value types are subset of view value types
			return areTypesSubset(stored.allowedTypes, viewMap.allowedTypes, storedDefs, viewDefs);
		}
		case NodeKind.Array: {
			const viewArray = view as SimpleArrayNodeSchema;
			// Can upgrade if stored item types are subset of view item types
			return areTypesSubset(stored.allowedTypes, viewArray.allowedTypes, storedDefs, viewDefs);
		}
		default: {
			return false;
		}
	}
}

/**
 * Check if stored object schema can be upgraded to view object schema.
 *
 * @remarks
 * Upgrade is allowed if:
 * - All stored fields exist in view with compatible types
 * - New fields in view (not in stored) must be optional
 * - Field kind can become more permissive (required -\> optional) but not stricter
 */
function canUpgradeObjectSchema(
	stored: SimpleObjectNodeSchema,
	view: SimpleObjectNodeSchema,
	storedDefs: ReadonlyMap<string, SimpleNodeSchema>,
	viewDefs: ReadonlyMap<string, SimpleNodeSchema>,
): boolean {
	// Check that all stored fields exist in view with compatible types
	for (const [fieldName, storedField] of Object.entries(stored.fields)) {
		const viewField = view.fields[fieldName];

		if (viewField === undefined) {
			// Stored field removed in view - not allowed for upgrade
			return false;
		}

		// Check type compatibility - types must be equal or view must be superset
		if (
			!areTypesSubset(storedField.allowedTypes, viewField.allowedTypes, storedDefs, viewDefs)
		) {
			return false;
		}

		// Field kind changes: required->optional is OK, optional->required is NOT
		if (storedField.kind === FieldKind.Optional && viewField.kind === FieldKind.Required) {
			return false;
		}
	}

	// Check that new fields in view are optional
	for (const [fieldName, viewField] of Object.entries(view.fields)) {
		const storedField = stored.fields[fieldName];

		if (
			storedField === undefined && // New field in view
			viewField.kind === FieldKind.Required
		) {
			// Adding a required field is not allowed
			return false;
		}
		// Adding optional fields is allowed
	}

	return true;
}

/**
 * Check if subset types are all contained in superset types.
 *
 * @remarks
 * Returns true if every type in subset has a compatible type in superset.
 * Types are compatible if they have the same identifier or are structurally equal.
 */
function areTypesSubset(
	subset: readonly string[],
	superset: readonly string[],
	subsetDefs: ReadonlyMap<string, SimpleNodeSchema>,
	supersetDefs: ReadonlyMap<string, SimpleNodeSchema>,
): boolean {
	for (const subId of subset) {
		// Check if this type has a compatible type in superset
		const found = superset.some((superId) => {
			if (subId === superId) {
				return true;
			}

			// Look up schemas and compare structurally
			const subSchema = subsetDefs.get(subId);
			const superSchema = supersetDefs.get(superId);

			if (subSchema === undefined || superSchema === undefined) {
				return false;
			}

			return areSimpleSchemasEqual(subSchema, superSchema, subsetDefs, supersetDefs);
		});

		if (!found) {
			return false;
		}
	}

	return true;
}
