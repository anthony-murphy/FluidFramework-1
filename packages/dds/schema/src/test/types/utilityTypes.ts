/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable jsdoc/require-jsdoc */
/* eslint-disable no-unused-expressions */

/**
 * Type-only tests for type utilities: immutability, type guards, and schema kind detection.
 *
 * These tests verify that:
 * - DeepReadonly and ReadonlyNodeFromSchema work correctly
 * - IsLeafSchema, IsObjectSchema, IsMapSchema correctly detect schema kinds
 * - SchemaKind extracts the correct kind from schemas
 * - UnionFromSchemas creates correct union types
 */

import type { IFluidHandle } from "@fluidframework/core-interfaces";

import type {
	NodeFromSchema,
	ReadonlyNodeFromSchema,
	DeepReadonly,
	IsLeafSchema,
	IsObjectSchema,
	IsMapSchema,
	SchemaKind,
	UnionFromSchemas,
	TypedLeafNodeSchema,
	TypedObjectNodeSchema,
	TypedMapNodeSchema,
} from "../../index.js";
import { SchemaFactory, NodeKind } from "../../index.js";

/**
 * Helper to "use" a value so TypeScript doesn't complain about unused variables.
 * This ensures the type is actually checked without needing runtime code.
 */
declare function use<T>(thing: T): void;

const sf = new SchemaFactory("test.utils");

// =============================================================================
// DeepReadonly type tests
// =============================================================================

// DeepReadonly on primitives should be identity
{
	type ReadonlyString = DeepReadonly<string>;
	type ReadonlyNumber = DeepReadonly<number>;
	type ReadonlyBoolean = DeepReadonly<boolean>;

	const s: ReadonlyString = "hello";
	const n: ReadonlyNumber = 42;
	const b: ReadonlyBoolean = true;

	use(s satisfies string);
	use(n satisfies number);
	use(b satisfies boolean);
}

// DeepReadonly on objects should make all properties readonly
{
	interface Mutable {
		name: string;
		age: number;
		nested: {
			city: string;
		};
	}

	type Immutable = DeepReadonly<Mutable>;

	const immutable = undefined as unknown as Immutable;
	use(immutable.name satisfies string);
	use(immutable.nested.city satisfies string);

	// Note: The readonly constraint is a compile-time check
	// TypeScript will error if you try to assign to a readonly property
}

// DeepReadonly on arrays should make them readonly arrays
{
	type MutableArray = string[];
	type ImmutableArray = DeepReadonly<MutableArray>;

	const arr = undefined as unknown as ImmutableArray;
	use(arr[0] satisfies string | undefined);
	use(arr.length satisfies number);

	// Readonly array methods
	arr.map((x) => x.toUpperCase());
	arr.filter((x) => x.length > 0);
}

// DeepReadonly on Maps should make them ReadonlyMaps
{
	type MutableMap = Map<string, number>;
	type ImmutableMap = DeepReadonly<MutableMap>;

	const map = undefined as unknown as ImmutableMap;
	use(map.get("key") satisfies number | undefined);
	use(map.has("key") satisfies boolean);
	use(map.size satisfies number);

	// ReadonlyMap methods work
	for (const [k, v] of map) {
		use(k satisfies string);
		use(v satisfies number);
	}
}

// DeepReadonly on Sets should make them ReadonlySets
{
	type MutableSet = Set<string>;
	type ImmutableSet = DeepReadonly<MutableSet>;

	const set = undefined as unknown as ImmutableSet;
	use(set.has("key") satisfies boolean);
	use(set.size satisfies number);
}

// DeepReadonly preserves IFluidHandle
{
	interface WithHandle {
		handle: IFluidHandle;
		data: string;
	}

	type ImmutableWithHandle = DeepReadonly<WithHandle>;

	const obj = undefined as unknown as ImmutableWithHandle;
	// Handle type should be preserved (not made deeply readonly)
	use(obj.handle satisfies IFluidHandle);
}

// =============================================================================
// ReadonlyNodeFromSchema type tests
// =============================================================================

{
	const PersonSchema = sf.object("Person", {
		name: sf.string,
		age: sf.number,
		friends: sf.optional(sf.map("Friends", sf.string)),
	});

	type MutablePerson = NodeFromSchema<typeof PersonSchema>;
	type ImmutablePerson = ReadonlyNodeFromSchema<typeof PersonSchema>;

	// Mutable allows assignment
	const mutable = undefined as unknown as MutablePerson;
	mutable.name = "Alice";
	mutable.age = 30;

	// Immutable should be the readonly version
	const immutable = undefined as unknown as ImmutablePerson;
	use(immutable.name satisfies string);
	use(immutable.age satisfies number);
}

// =============================================================================
// IsLeafSchema type guard
// =============================================================================

{
	// Should be true for leaf schemas
	type StringIsLeaf = IsLeafSchema<typeof sf.string>;
	type NumberIsLeaf = IsLeafSchema<typeof sf.number>;
	type BooleanIsLeaf = IsLeafSchema<typeof sf.boolean>;

	use(undefined as unknown as StringIsLeaf satisfies true);
	use(undefined as unknown as NumberIsLeaf satisfies true);
	use(undefined as unknown as BooleanIsLeaf satisfies true);

	// Should be false for object schemas
	const ObjectSchema = sf.object("Test", { name: sf.string });
	type ObjectIsLeaf = IsLeafSchema<typeof ObjectSchema>;
	use(undefined as unknown as ObjectIsLeaf satisfies false);

	// Should be false for map schemas
	const MapSchema = sf.map("TestMap", sf.string);
	type MapIsLeaf = IsLeafSchema<typeof MapSchema>;
	use(undefined as unknown as MapIsLeaf satisfies false);
}

// =============================================================================
// IsObjectSchema type guard
// =============================================================================

{
	// Should be true for object schemas
	const ObjectSchema = sf.object("TestObj", { name: sf.string });
	type ObjectIsObject = IsObjectSchema<typeof ObjectSchema>;
	use(undefined as unknown as ObjectIsObject satisfies true);

	// Should be false for leaf schemas
	type LeafIsObject = IsObjectSchema<typeof sf.string>;
	use(undefined as unknown as LeafIsObject satisfies false);

	// Should be false for map schemas
	const MapSchema = sf.map("TestMap", sf.string);
	type MapIsObject = IsObjectSchema<typeof MapSchema>;
	use(undefined as unknown as MapIsObject satisfies false);
}

// =============================================================================
// IsMapSchema type guard
// =============================================================================

{
	// Should be true for map schemas
	const MapSchema = sf.map("TestMap", sf.string);
	type MapIsMap = IsMapSchema<typeof MapSchema>;
	use(undefined as unknown as MapIsMap satisfies true);

	// Should be false for leaf schemas
	type LeafIsMap = IsMapSchema<typeof sf.string>;
	use(undefined as unknown as LeafIsMap satisfies false);

	// Should be false for object schemas
	const ObjectSchema = sf.object("TestObj", { name: sf.string });
	type ObjectIsMap = IsMapSchema<typeof ObjectSchema>;
	use(undefined as unknown as ObjectIsMap satisfies false);
}

// =============================================================================
// SchemaKind type utility
// =============================================================================

{
	// Extract kind from leaf schema
	type LeafKindType = SchemaKind<typeof sf.string>;
	use(undefined as unknown as LeafKindType satisfies typeof NodeKind.Leaf);

	// Extract kind from object schema
	const ObjectSchema = sf.object("TestObj", { name: sf.string });
	type ObjectKindType = SchemaKind<typeof ObjectSchema>;
	use(undefined as unknown as ObjectKindType satisfies typeof NodeKind.Object);

	// Extract kind from map schema
	const MapSchema = sf.map("TestMap", sf.string);
	type MapKindType = SchemaKind<typeof MapSchema>;
	use(undefined as unknown as MapKindType satisfies typeof NodeKind.Map);
}

// =============================================================================
// UnionFromSchemas type utility
// =============================================================================

{
	const PersonSchema = sf.object("Person", {
		name: sf.string,
		age: sf.number,
	});

	const CompanySchema = sf.object("Company", {
		name: sf.string,
		employees: sf.number,
	});

	// Union of object schemas
	type PersonOrCompany = UnionFromSchemas<[typeof PersonSchema, typeof CompanySchema]>;

	// Should accept either schema's shape
	const person: PersonOrCompany = { name: "Alice", age: 30 };
	const company: PersonOrCompany = { name: "Acme", employees: 100 };
	use(person);
	use(company);

	// Union with primitives
	type StringOrNumber = UnionFromSchemas<[typeof sf.string, typeof sf.number]>;
	const str: StringOrNumber = "hello";
	const num: StringOrNumber = 42;
	use(str);
	use(num);

	// @ts-expect-error - boolean not in union
	const wrongUnion: StringOrNumber = true;
	use(wrongUnion);
}

// =============================================================================
// Schema type narrowing with type guards
// =============================================================================

// Conditional types based on schema kind
{
	type ProcessSchema<T> = IsLeafSchema<T> extends true
		? "leaf"
		: IsObjectSchema<T> extends true
			? "object"
			: IsMapSchema<T> extends true
				? "map"
				: "unknown";

	type LeafResult = ProcessSchema<typeof sf.string>;
	use(undefined as unknown as LeafResult satisfies "leaf");

	const ObjSchema = sf.object("Obj", { x: sf.number });
	type ObjectResult = ProcessSchema<typeof ObjSchema>;
	use(undefined as unknown as ObjectResult satisfies "object");

	const MapSchema = sf.map("Map", sf.string);
	type MapResult = ProcessSchema<typeof MapSchema>;
	use(undefined as unknown as MapResult satisfies "map");
}

// =============================================================================
// Generic functions with schema type constraints
// =============================================================================

// Function that only accepts leaf schemas
declare function processLeaf<T extends TypedLeafNodeSchema>(_schema: T): NodeFromSchema<T>;

// Function that only accepts object schemas
declare function processObject<T extends TypedObjectNodeSchema>(_schema: T): NodeFromSchema<T>;

// Function that only accepts map schemas
declare function processMap<T extends TypedMapNodeSchema>(_schema: T): NodeFromSchema<T>;

export function testSchemaConstraints(): void {
	const ObjSchema = sf.object("Obj", { name: sf.string });
	const MapSchema = sf.map("Map", sf.string);

	// Leaf schema works with processLeaf
	const strResult = processLeaf(sf.string);
	use(strResult satisfies string);

	// Object schema works with processObject
	const objResult = processObject(ObjSchema);
	use(objResult.name satisfies string);

	// Map schema works with processMap
	const mapResult = processMap(MapSchema);
	use(mapResult satisfies string);

	// @ts-expect-error - object schema doesn't work with processLeaf
	processLeaf(ObjSchema);

	// @ts-expect-error - leaf schema doesn't work with processObject
	processObject(sf.string);

	// @ts-expect-error - object schema doesn't work with processMap
	processMap(ObjSchema);
}

// Export to ensure the file is included in build
export {};
