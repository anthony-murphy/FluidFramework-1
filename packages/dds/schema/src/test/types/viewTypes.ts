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
 * Type-only tests for view types.
 *
 * These tests verify that:
 * - ObjectView and MapView have correctly typed root properties
 * - SchematizedView works generically with both schema types
 * - RootFromSchema correctly infers root types
 * - View lifecycle methods are typed correctly
 */

import type {
	ObjectView,
	MapView,
	SchematizedView,
	RootFromSchema,
	SchematizedViewBase,
	SchemaCompatibilityStatus,
	ObjectViewResult,
	MapViewResult,
	InferMapValueType,
} from "../../index.js";
import { SchemaFactory } from "../../index.js";

/**
 * Helper to "use" a value so TypeScript doesn't complain about unused variables.
 * This ensures the type is actually checked without needing runtime code.
 */
function use<T>(_thing: T): void {}

const sf = new SchemaFactory("test.views");

// =============================================================================
// ObjectView type tests
// =============================================================================

const PersonSchema = sf.object("Person", {
	name: sf.string,
	age: sf.number,
	email: sf.optional(sf.string),
});

// ObjectView should have typed root
export function testObjectView(view: ObjectView<typeof PersonSchema>): void {
	// Root should have correct field types
	view.root.name satisfies string;
	view.root.age satisfies number;
	view.root.email satisfies string | undefined;

	// Should be able to assign to fields
	view.root.name = "Alice";
	view.root.age = 30;
	view.root.email = "alice@example.com";
	view.root.email = undefined;

	// View lifecycle methods
	view.disposed satisfies boolean;
	view.compatibility satisfies SchemaCompatibilityStatus;
	view.initialize();
	view.dispose();

	// @ts-expect-error - nonexistent property
	view.root.nonexistent;

	// @ts-expect-error - wrong type assignment
	view.root.name = 123;
}

// =============================================================================
// MapView type tests
// =============================================================================

const StringMapSchema = sf.map("StringMap", sf.string);
const ObjectMapSchema = sf.map("ObjectMap", PersonSchema);

// MapView with primitive values
export function testStringMapView(view: MapView<typeof StringMapSchema>): void {
	// Map operations should be typed
	view.root.get("key") satisfies string | undefined;
	view.root.set("key", "value");
	view.root.has("key") satisfies boolean;
	view.root.delete("key") satisfies boolean;
	view.root.size satisfies number;
	view.root.clear();

	// Iteration
	for (const [key, value] of view.root) {
		use(key satisfies string);
		use(value satisfies string);
	}

	// View lifecycle
	view.disposed satisfies boolean;
	view.initialize();
	view.dispose();

	// @ts-expect-error - wrong value type
	view.root.set("key", 123);
}

// MapView with object values
export function testObjectMapView(view: MapView<typeof ObjectMapSchema>): void {
	const person = view.root.get("key");
	if (person !== undefined) {
		use(person.name satisfies string);
		use(person.age satisfies number);
	}

	view.root.set("key", { name: "Bob", age: 25 });

	// @ts-expect-error - missing required field
	view.root.set("key", { name: "Charlie" });

	// @ts-expect-error - wrong field type
	view.root.set("key", { name: 123, age: 25 });
}

// =============================================================================
// SchematizedView generic tests
// =============================================================================

// SchematizedView should work with object schemas
export function testSchematizedObjectView(view: SchematizedView<typeof PersonSchema>): void {
	// Root should be the object type
	view.root.name satisfies string;
	view.root.age satisfies number;

	// Lifecycle methods from base
	view.disposed satisfies boolean;
	view.initialize();
}

// SchematizedView should work with map schemas
export function testSchematizedMapView(view: SchematizedView<typeof StringMapSchema>): void {
	// Root should be Map-like
	view.root.get("key") satisfies string | undefined;
	view.root.set("key", "value");
}

// =============================================================================
// RootFromSchema type tests
// =============================================================================

// For object schemas, RootFromSchema should be the object type
export function testObjectRoot(): void {
	type PersonRoot = RootFromSchema<typeof PersonSchema>;

	const personRoot: PersonRoot = { name: "Test", age: 1 };
	use(personRoot.name satisfies string);
	use(personRoot.age satisfies number);

	// @ts-expect-error - object root doesn't have Map methods
	personRoot.get("key");
}

// For map schemas, RootFromSchema should be Map<string, ValueType>
export function testMapRoot(mapRoot: RootFromSchema<typeof StringMapSchema>): void {
	// Verify it has Map methods
	use(mapRoot.get("key") satisfies string | undefined);
	use(mapRoot.set("key", "value"));
	use(mapRoot.has("key") satisfies boolean);

	// @ts-expect-error - wrong value type
	mapRoot.set("key", 123);
}

// For map with object values
export function testObjectMapRoot(mapRoot: RootFromSchema<typeof ObjectMapSchema>): void {
	const value = mapRoot.get("key");
	if (value !== undefined) {
		use(value.name satisfies string);
		use(value.age satisfies number);
	}
}

// =============================================================================
// SchematizedViewBase type tests
// =============================================================================

// SchematizedViewBase is the common interface for all views
export function testViewBase(view: SchematizedViewBase): void {
	// Common properties
	view.disposed satisfies boolean;
	view.compatibility satisfies SchemaCompatibilityStatus;

	// Common methods
	view.initialize();
	view.dispose();
}

// =============================================================================
// View result types
// =============================================================================

// ObjectViewResult has root and lifecycle methods
export function testObjectViewResult(result: ObjectViewResult<typeof PersonSchema>): void {
	// Has typed root
	result.root.name satisfies string;
	result.root.age satisfies number;

	// Has lifecycle methods
	result.disposed satisfies boolean;
	result.compatibility satisfies SchemaCompatibilityStatus;
	result.initialize();
	result.dispose();
}

// MapViewResult is the map view with Map operations
export function testMapViewResult(result: MapViewResult<typeof StringMapSchema>): void {
	// Map operations
	result.get("key") satisfies string | undefined;
	result.set("key", "value");
	result.has("key") satisfies boolean;
	result.delete("key") satisfies boolean;

	// Lifecycle
	result.disposed satisfies boolean;
	result.initialize();
}

// =============================================================================
// View with nested schemas
// =============================================================================

const AddressSchema = sf.object("Address", {
	street: sf.string,
	city: sf.string,
	zip: sf.string,
});

const CompanySchema = sf.object("Company", {
	name: sf.string,
	headquarters: AddressSchema,
});

// Nested object access
export function testNestedObjectView(view: ObjectView<typeof CompanySchema>): void {
	view.root.name satisfies string;
	view.root.headquarters.street satisfies string;
	view.root.headquarters.city satisfies string;
}

// =============================================================================
// InferMapValueType with views
// =============================================================================

// Verify InferMapValueType works for view typing
export function testInferMapValueType(): void {
	type StringValue = InferMapValueType<typeof StringMapSchema>;
	type ObjectValue = InferMapValueType<typeof ObjectMapSchema>;

	const str: StringValue = "hello";
	const obj: ObjectValue = { name: "Test", age: 1 };

	use(str satisfies string);
	use(obj.name satisfies string);
}

// Export to ensure the file is included in build
export {};
