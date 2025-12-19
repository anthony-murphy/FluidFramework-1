/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/**
 * Schema decoding - converts JSON-compatible format back to simple schemas.
 */

import { FieldKind, NodeKind } from "../core/index.js";

import type {
	EncodedSchema,
	EncodedNodeSchema,
	EncodedObjectSchema,
	EncodedArraySchema,
	EncodedMapSchema,
	EncodedLeafSchema,
	EncodedFieldSchema,
	DecodedSchema,
	SimpleNodeSchema,
	SimpleObjectNodeSchema,
	SimpleArrayNodeSchema,
	SimpleMapNodeSchema,
	SimpleLeafNodeSchema,
	SimpleFieldSchema,
} from "./format.js";

/**
 * Decodes an encoded schema back into a simple schema representation.
 *
 * @param encoded - The encoded schema to decode.
 * @returns A decoded schema containing the root and all definitions.
 *
 * @remarks
 * The decoded schema uses plain objects (not class instances) that implement
 * the core schema interfaces. This makes the result easy to work with for
 * validation, comparison, or serialization.
 *
 * @example
 * ```typescript
 * const encoded: EncodedSchema = {
 *   version: 1,
 *   root: {
 *     kind: "object",
 *     identifier: "myApp.User",
 *     fields: {
 *       name: { kind: "required", allowedTypes: [{ kind: "leaf", identifier: "com.fluidframework.leaf.string", leafKind: "string" }] }
 *     }
 *   }
 * };
 *
 * const decoded = decodeSchema(encoded);
 * // decoded.root is a SimpleObjectNodeSchema
 * // decoded.definitions contains all referenced schemas
 * ```
 * @legacy
 * @alpha
 */
export function decodeSchema(encoded: EncodedSchema): DecodedSchema {
	if (encoded.version !== 1) {
		throw new Error(`Unsupported schema version: ${encoded.version}`);
	}

	const definitions = new Map<string, SimpleNodeSchema>();

	// First, decode all definitions
	if (encoded.definitions !== undefined) {
		for (const [identifier, encodedNode] of Object.entries(encoded.definitions)) {
			definitions.set(identifier, decodeNodeSchema(encodedNode, definitions));
		}
	}

	// Decode the root schema
	const root = decodeNodeSchema(encoded.root, definitions);

	// Add the root to definitions if it has an identifier and isn't already there
	if (!definitions.has(root.identifier)) {
		definitions.set(root.identifier, root);
	}

	return { root, definitions };
}

/**
 * Decodes a single encoded node schema.
 */
function decodeNodeSchema(
	encoded: EncodedNodeSchema,
	definitions: Map<string, SimpleNodeSchema>,
): SimpleNodeSchema {
	switch (encoded.kind) {
		case "leaf": {
			return decodeLeafSchema(encoded);
		}
		case "object": {
			return decodeObjectSchema(encoded, definitions);
		}
		case "array": {
			return decodeArraySchema(encoded, definitions);
		}
		case "map": {
			return decodeMapSchema(encoded, definitions);
		}
		default: {
			throw new Error(`Unknown encoded schema kind: ${(encoded as EncodedNodeSchema).kind}`);
		}
	}
}

/**
 * Decodes a leaf schema.
 */
function decodeLeafSchema(encoded: EncodedLeafSchema): SimpleLeafNodeSchema {
	return {
		kind: NodeKind.Leaf,
		identifier: encoded.identifier,
		leafKind: encoded.leafKind,
	};
}

/**
 * Decodes an object schema.
 */
function decodeObjectSchema(
	encoded: EncodedObjectSchema,
	definitions: Map<string, SimpleNodeSchema>,
): SimpleObjectNodeSchema {
	const fields: Record<string, SimpleFieldSchema> = {};

	for (const [fieldName, encodedField] of Object.entries(encoded.fields)) {
		fields[fieldName] = decodeFieldSchema(encodedField, definitions);
	}

	return {
		kind: NodeKind.Object,
		identifier: encoded.identifier,
		fields,
	};
}

/**
 * Decodes an array schema.
 */
function decodeArraySchema(
	encoded: EncodedArraySchema,
	definitions: Map<string, SimpleNodeSchema>,
): SimpleArrayNodeSchema {
	return {
		kind: NodeKind.Array,
		identifier: encoded.identifier,
		allowedTypes: decodeAllowedTypes(encoded.allowedTypes, definitions),
	};
}

/**
 * Decodes a map schema.
 */
function decodeMapSchema(
	encoded: EncodedMapSchema,
	definitions: Map<string, SimpleNodeSchema>,
): SimpleMapNodeSchema {
	return {
		kind: NodeKind.Map,
		identifier: encoded.identifier,
		allowedTypes: decodeAllowedTypes(encoded.allowedTypes, definitions),
	};
}

/**
 * Decodes a field schema.
 */
function decodeFieldSchema(
	encoded: EncodedFieldSchema,
	definitions: Map<string, SimpleNodeSchema>,
): SimpleFieldSchema {
	return {
		kind: encoded.kind === "required" ? FieldKind.Required : FieldKind.Optional,
		allowedTypes: decodeAllowedTypes(encoded.allowedTypes, definitions),
	};
}

/**
 * Decodes allowed types from encoded format.
 *
 * @remarks
 * Each allowed type can be either:
 * - A string reference to a schema identifier
 * - An inline encoded schema
 *
 * This function extracts identifiers from both forms.
 */
function decodeAllowedTypes(
	allowedTypes: readonly (EncodedNodeSchema | string)[],
	definitions: Map<string, SimpleNodeSchema>,
): readonly string[] {
	return allowedTypes.map((typeOrRef) => {
		if (typeof typeOrRef === "string") {
			return typeOrRef;
		}
		// It's an inline schema - decode it and add to definitions if needed
		const decoded = decodeNodeSchema(typeOrRef, definitions);
		if (!definitions.has(decoded.identifier)) {
			definitions.set(decoded.identifier, decoded);
		}
		return decoded.identifier;
	});
}
