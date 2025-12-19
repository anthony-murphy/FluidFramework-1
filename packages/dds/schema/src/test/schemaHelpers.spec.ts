/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/* eslint-disable unicorn/no-array-callback-reference */

import { strict as assert } from "node:assert";

import {
	NodeKind,
	isObjectSchema,
	isArraySchema,
	isMapSchema,
	isLeafSchema,
} from "../core/index.js";
import type {
	NodeSchema,
	ObjectNodeSchema,
	ArrayNodeSchema,
	MapNodeSchema,
	LeafNodeSchema,
} from "../core/index.js";
import { SchemaFactory } from "../factory/index.js";

describe("Schema Helpers", () => {
	// Create test schema instances for each kind
	const objectSchema: ObjectNodeSchema = {
		kind: NodeKind.Object,
		identifier: "test.Object",
		fields: {
			name: { kind: 0, allowedTypes: ["com.fluidframework.leaf.string"] },
		},
	};

	const arraySchema: ArrayNodeSchema = {
		kind: NodeKind.Array,
		identifier: "test.Array",
		allowedTypes: ["test.Item"],
	};

	const mapSchema: MapNodeSchema = {
		kind: NodeKind.Map,
		identifier: "test.Map",
		allowedTypes: ["com.fluidframework.leaf.string"],
	};

	const leafStringSchema: LeafNodeSchema = {
		kind: NodeKind.Leaf,
		identifier: "com.fluidframework.leaf.string",
		leafKind: "string",
	};

	const leafNumberSchema: LeafNodeSchema = {
		kind: NodeKind.Leaf,
		identifier: "com.fluidframework.leaf.number",
		leafKind: "number",
	};

	const leafBooleanSchema: LeafNodeSchema = {
		kind: NodeKind.Leaf,
		identifier: "com.fluidframework.leaf.boolean",
		leafKind: "boolean",
	};

	const leafNullSchema: LeafNodeSchema = {
		kind: NodeKind.Leaf,
		identifier: "com.fluidframework.leaf.null",
		leafKind: "null",
	};

	const leafHandleSchema: LeafNodeSchema = {
		kind: NodeKind.Leaf,
		identifier: "com.fluidframework.leaf.handle",
		leafKind: "handle",
	};

	// Collect all schemas for iteration tests
	const allSchemas: NodeSchema[] = [
		objectSchema,
		arraySchema,
		mapSchema,
		leafStringSchema,
		leafNumberSchema,
		leafBooleanSchema,
		leafNullSchema,
		leafHandleSchema,
	];

	describe("isObjectSchema", () => {
		it("returns true for object schemas", () => {
			assert.equal(isObjectSchema(objectSchema), true);
		});

		it("returns false for array schemas", () => {
			assert.equal(isObjectSchema(arraySchema), false);
		});

		it("returns false for map schemas", () => {
			assert.equal(isObjectSchema(mapSchema), false);
		});

		it("returns false for leaf schemas", () => {
			assert.equal(isObjectSchema(leafStringSchema), false);
			assert.equal(isObjectSchema(leafNumberSchema), false);
			assert.equal(isObjectSchema(leafBooleanSchema), false);
			assert.equal(isObjectSchema(leafNullSchema), false);
			assert.equal(isObjectSchema(leafHandleSchema), false);
		});

		it("correctly identifies only object schemas from a collection", () => {
			const objectSchemas = allSchemas.filter(isObjectSchema);
			assert.equal(objectSchemas.length, 1);
			assert.equal(objectSchemas[0], objectSchema);
		});

		it("narrows type to ObjectNodeSchema", () => {
			const schema: NodeSchema = objectSchema;
			if (isObjectSchema(schema)) {
				// TypeScript should know this is ObjectNodeSchema
				assert.ok(schema.fields !== undefined);
				assert.ok("name" in schema.fields);
			}
		});

		it("works with factory-created schemas", () => {
			const sf = new SchemaFactory("test");
			const UserSchema = sf.object("User", { name: sf.string });
			assert.equal(isObjectSchema(UserSchema), true);
		});
	});

	describe("isArraySchema", () => {
		it("returns true for array schemas", () => {
			assert.equal(isArraySchema(arraySchema), true);
		});

		it("returns false for object schemas", () => {
			assert.equal(isArraySchema(objectSchema), false);
		});

		it("returns false for map schemas", () => {
			assert.equal(isArraySchema(mapSchema), false);
		});

		it("returns false for leaf schemas", () => {
			assert.equal(isArraySchema(leafStringSchema), false);
			assert.equal(isArraySchema(leafNumberSchema), false);
			assert.equal(isArraySchema(leafBooleanSchema), false);
			assert.equal(isArraySchema(leafNullSchema), false);
			assert.equal(isArraySchema(leafHandleSchema), false);
		});

		it("correctly identifies only array schemas from a collection", () => {
			const arraySchemas = allSchemas.filter(isArraySchema);
			assert.equal(arraySchemas.length, 1);
			assert.equal(arraySchemas[0], arraySchema);
		});

		it("narrows type to ArrayNodeSchema", () => {
			const schema: NodeSchema = arraySchema;
			if (isArraySchema(schema)) {
				// TypeScript should know this is ArrayNodeSchema
				assert.ok(schema.allowedTypes !== undefined);
				assert.ok(Array.isArray(schema.allowedTypes));
			}
		});
	});

	describe("isMapSchema", () => {
		it("returns true for map schemas", () => {
			assert.equal(isMapSchema(mapSchema), true);
		});

		it("returns false for object schemas", () => {
			assert.equal(isMapSchema(objectSchema), false);
		});

		it("returns false for array schemas", () => {
			assert.equal(isMapSchema(arraySchema), false);
		});

		it("returns false for leaf schemas", () => {
			assert.equal(isMapSchema(leafStringSchema), false);
			assert.equal(isMapSchema(leafNumberSchema), false);
			assert.equal(isMapSchema(leafBooleanSchema), false);
			assert.equal(isMapSchema(leafNullSchema), false);
			assert.equal(isMapSchema(leafHandleSchema), false);
		});

		it("correctly identifies only map schemas from a collection", () => {
			const mapSchemas = allSchemas.filter(isMapSchema);
			assert.equal(mapSchemas.length, 1);
			assert.equal(mapSchemas[0], mapSchema);
		});

		it("narrows type to MapNodeSchema", () => {
			const schema: NodeSchema = mapSchema;
			if (isMapSchema(schema)) {
				// TypeScript should know this is MapNodeSchema
				assert.ok(schema.allowedTypes !== undefined);
				assert.ok(Array.isArray(schema.allowedTypes));
			}
		});

		it("works with factory-created schemas", () => {
			const sf = new SchemaFactory("test");
			const StringMapSchema = sf.map("StringMap", sf.string);
			assert.equal(isMapSchema(StringMapSchema), true);
		});
	});

	describe("isLeafSchema", () => {
		it("returns true for string leaf schema", () => {
			assert.equal(isLeafSchema(leafStringSchema), true);
		});

		it("returns true for number leaf schema", () => {
			assert.equal(isLeafSchema(leafNumberSchema), true);
		});

		it("returns true for boolean leaf schema", () => {
			assert.equal(isLeafSchema(leafBooleanSchema), true);
		});

		it("returns true for null leaf schema", () => {
			assert.equal(isLeafSchema(leafNullSchema), true);
		});

		it("returns true for handle leaf schema", () => {
			assert.equal(isLeafSchema(leafHandleSchema), true);
		});

		it("returns false for object schemas", () => {
			assert.equal(isLeafSchema(objectSchema), false);
		});

		it("returns false for array schemas", () => {
			assert.equal(isLeafSchema(arraySchema), false);
		});

		it("returns false for map schemas", () => {
			assert.equal(isLeafSchema(mapSchema), false);
		});

		it("correctly identifies all leaf schemas from a collection", () => {
			const leafSchemas = allSchemas.filter(isLeafSchema);
			assert.equal(leafSchemas.length, 5);
			assert.ok(leafSchemas.includes(leafStringSchema));
			assert.ok(leafSchemas.includes(leafNumberSchema));
			assert.ok(leafSchemas.includes(leafBooleanSchema));
			assert.ok(leafSchemas.includes(leafNullSchema));
			assert.ok(leafSchemas.includes(leafHandleSchema));
		});

		it("narrows type to LeafNodeSchema", () => {
			const schema: NodeSchema = leafStringSchema;
			if (isLeafSchema(schema)) {
				// TypeScript should know this is LeafNodeSchema
				assert.ok(schema.leafKind !== undefined);
				assert.equal(schema.leafKind, "string");
			}
		});

		it("works with factory leaf schemas", () => {
			const sf = new SchemaFactory("test");
			assert.equal(isLeafSchema(sf.string), true);
			assert.equal(isLeafSchema(sf.number), true);
			assert.equal(isLeafSchema(sf.boolean), true);
			assert.equal(isLeafSchema(sf.null), true);
			assert.equal(isLeafSchema(sf.handle), true);
		});
	});

	describe("Type guard mutual exclusivity", () => {
		it("each schema matches exactly one type guard", () => {
			for (const schema of allSchemas) {
				const matchCount = [
					isObjectSchema(schema),
					isArraySchema(schema),
					isMapSchema(schema),
					isLeafSchema(schema),
				].filter(Boolean).length;

				assert.equal(
					matchCount,
					1,
					`Schema ${schema.identifier} should match exactly one type guard, but matched ${matchCount}`,
				);
			}
		});
	});

	describe("Type guard with exhaustive checking", () => {
		it("handles all NodeKind values", () => {
			// This test verifies the type guards cover all cases
			const getSchemaKindName = (schema: NodeSchema): string => {
				if (isObjectSchema(schema)) {
					return "object";
				} else if (isArraySchema(schema)) {
					return "array";
				} else if (isMapSchema(schema)) {
					return "map";
				} else if (isLeafSchema(schema)) {
					return "leaf";
				}
				// This should be unreachable if all kinds are covered
				throw new Error(`Unknown schema kind: ${schema.kind}`);
			};

			assert.equal(getSchemaKindName(objectSchema), "object");
			assert.equal(getSchemaKindName(arraySchema), "array");
			assert.equal(getSchemaKindName(mapSchema), "map");
			assert.equal(getSchemaKindName(leafStringSchema), "leaf");
		});

		it("can be used in switch-like pattern", () => {
			const processSchema = (schema: NodeSchema): string => {
				if (isLeafSchema(schema)) {
					return `leaf:${schema.leafKind}`;
				}
				if (isObjectSchema(schema)) {
					return `object:${Object.keys(schema.fields).length} fields`;
				}
				if (isMapSchema(schema)) {
					return `map:${schema.allowedTypes.length} types`;
				}
				if (isArraySchema(schema)) {
					return `array:${schema.allowedTypes.length} types`;
				}
				return "unknown";
			};

			assert.equal(processSchema(leafStringSchema), "leaf:string");
			assert.equal(processSchema(objectSchema), "object:1 fields");
			assert.equal(processSchema(mapSchema), "map:1 types");
			assert.equal(processSchema(arraySchema), "array:1 types");
		});
	});
});
