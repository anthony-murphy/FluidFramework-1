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
 * Type-only tests for the schema package.
 *
 * These tests verify that TypeScript correctly infers types for schema definitions
 * and view operations. They don't run at runtime - they only check that the types
 * compile correctly.
 */

import type {
	NodeFromSchema,
	ObjectNodeSchema,
	MapNodeSchema,
	ObjectView,
	MapView,
	SchematizedView,
	RootFromSchema,
	InferMapValueType,
	SchemaCompatibilityStatus,
} from "../../index.js";
import { SchemaFactory } from "../../index.js";

/**
 * Helper to "use" a value so TypeScript doesn't complain about unused variables.
 * This ensures the type is actually checked without needing runtime code.
 */
declare function use<T>(thing: T): void;

const sf = new SchemaFactory("test");

// =============================================================================
// Object schema type inference
// =============================================================================

const PersonSchema = sf.object("Person", {
	name: sf.string,
	age: sf.number,
	active: sf.boolean,
});

// Verify NodeFromSchema infers correct object type
{
	type PersonType = NodeFromSchema<typeof PersonSchema>;

	// These should compile - correct property types
	const person: PersonType = { name: "Alice", age: 30, active: true };
	use(person.name satisfies string);
	use(person.age satisfies number);
	use(person.active satisfies boolean);

	// @ts-expect-error - missing required property 'active'
	const incomplete: PersonType = { name: "Bob", age: 25 };
	use(incomplete);

	// @ts-expect-error - wrong type for 'age'
	const wrongType: PersonType = { name: "Carol", age: "thirty", active: true };
	use(wrongType);
}

// Verify optional fields
{
	const OptionalSchema = sf.object("Optional", {
		required: sf.string,
		optional: sf.optional(sf.number),
	});

	type OptionalType = NodeFromSchema<typeof OptionalSchema>;

	// Should compile - optional field can be omitted
	const withoutOptional: OptionalType = { required: "hello" };
	use(withoutOptional);

	// Should compile - optional field can be provided
	const withOptional: OptionalType = { required: "hello", optional: 42 };

	use(withOptional);

	// @ts-expect-error - optional field has wrong type
	const wrongOptional: OptionalType = { required: "hello", optional: "not a number" };
	use(wrongOptional);
}

// =============================================================================
// Map schema type inference
// =============================================================================

const StringMapSchema = sf.map("StringMap", sf.string);
const NumberMapSchema = sf.map("NumberMap", sf.number);

// Verify InferMapValueType extracts correct value type
{
	type StringValue = InferMapValueType<typeof StringMapSchema>;
	type NumberValue = InferMapValueType<typeof NumberMapSchema>;

	const s: StringValue = "hello";
	const n: NumberValue = 42;
	use(s);
	use(n);

	// @ts-expect-error - wrong value type
	const wrongString: StringValue = 123;
	use(wrongString);

	// @ts-expect-error - wrong value type
	const wrongNumber: NumberValue = "not a number";
	use(wrongNumber);
}

// =============================================================================
// RootFromSchema type inference
// =============================================================================

// For object schemas, RootFromSchema should return the object type
{
	type PersonRoot = RootFromSchema<typeof PersonSchema>;

	const root: PersonRoot = { name: "Test", age: 1, active: false };
	use(root.name satisfies string);

	// @ts-expect-error - object doesn't have Map methods
	use(root.get("key"));
}

// For map schemas, RootFromSchema should return Map<string, ValueType>
export function testMapRoot(mapRoot: RootFromSchema<typeof StringMapSchema>): void {
	mapRoot.get("key") satisfies string | undefined;
	mapRoot.set("key", "value");
	mapRoot.has("key") satisfies boolean;
	mapRoot.delete("key") satisfies boolean;

	// @ts-expect-error - wrong value type for set
	mapRoot.set("key", 123);
}

// =============================================================================
// SchematizedView type inference
// =============================================================================

// ObjectView should have typed root property
export function testObjectView(objectView: ObjectView<typeof PersonSchema>): void {
	objectView.root.name satisfies string;
	objectView.root.age satisfies number;
	objectView.root.active satisfies boolean;

	// @ts-expect-error - property doesn't exist on schema
	objectView.root.nonexistent;

	// View should have lifecycle methods
	objectView.disposed satisfies boolean;
	objectView.compatibility satisfies SchemaCompatibilityStatus;
	objectView.initialize();
	objectView.dispose();
}

// MapView should have typed root with Map operations
export function testMapView(mapView: MapView<typeof StringMapSchema>): void {
	mapView.root.get("key") satisfies string | undefined;
	mapView.root.set("key", "value");

	// @ts-expect-error - wrong value type
	mapView.root.set("key", 123);

	// View should have lifecycle methods
	mapView.disposed satisfies boolean;
	mapView.initialize();
}

// SchematizedView generic should work with both schema types
export function testSchematizedView(
	genericObjectView: SchematizedView<typeof PersonSchema>,
	genericMapView: SchematizedView<typeof StringMapSchema>,
): void {
	genericObjectView.root.name satisfies string;
	genericMapView.root.get("key") satisfies string | undefined;
}

// =============================================================================
// Schema type constraints
// =============================================================================

export declare function acceptObjectSchema<T extends ObjectNodeSchema>(_schema: T): void;

// Should accept object schemas
acceptObjectSchema(PersonSchema);

// @ts-expect-error - map schema is not an object schema
acceptObjectSchema(StringMapSchema);

export declare function acceptMapSchema<T extends MapNodeSchema>(_schema: T): void;

// Should accept map schemas
acceptMapSchema(StringMapSchema);

// @ts-expect-error - object schema is not a map schema
acceptMapSchema(PersonSchema);

// =============================================================================
// Nested object schemas
// =============================================================================

{
	const AddressSchema = sf.object("Address", {
		street: sf.string,
		city: sf.string,
	});

	const PersonWithAddressSchema = sf.object("PersonWithAddress", {
		name: sf.string,
		address: AddressSchema,
	});

	type PersonWithAddress = NodeFromSchema<typeof PersonWithAddressSchema>;

	const person: PersonWithAddress = {
		name: "Alice",
		address: { street: "123 Main St", city: "Springfield" },
	};

	use(person.name satisfies string);
	use(person.address.street satisfies string);
	use(person.address.city satisfies string);
}

// =============================================================================
// Union types in schemas
// =============================================================================

{
	const MixedMapSchema = sf.map("MixedMap", [sf.string, sf.number]);

	type MixedValue = InferMapValueType<typeof MixedMapSchema>;

	// Should accept either type
	const s: MixedValue = "hello";
	const n: MixedValue = 42;
	use(s);
	use(n);

	// @ts-expect-error - boolean is not in the union
	const b: MixedValue = true;
	use(b);
}
