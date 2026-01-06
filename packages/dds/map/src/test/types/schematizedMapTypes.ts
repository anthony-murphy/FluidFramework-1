/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable jsdoc/require-jsdoc */
/* eslint-disable no-unused-expressions */

/**
 * Type tests for SharedMap.viewWith with constObject schemas.
 *
 * These tests verify that:
 * - constObject schemas produce readonly nested properties
 * - Regular object schemas produce mutable properties
 * - The type inference flows correctly through viewWith
 */

import type { ISchematizedSharedMap } from "../../index.js";
import { SchemaFactory } from "@fluidframework/schema/internal";

/**
 * Helper to "use" a value so TypeScript doesn't complain about unused variables.
 */
function use<T>(_thing: T): void {}

const sf = new SchemaFactory("test.map.types");

// =============================================================================
// Schema definitions
// =============================================================================

/**
 * A constObject schema - produces readonly nested properties.
 */
const AddressSchema = sf.constObject("Address", {
	street: sf.string,
	city: sf.string,
	state: sf.string,
	zip: sf.string,
});

/**
 * A regular object schema with a constObject field.
 */
const PersonSchema = sf.object("Person", {
	name: sf.string,
	age: sf.number,
	address: AddressSchema, // address.* should be readonly
});

/**
 * A regular object schema - produces mutable properties.
 */
const MutableAddressSchema = sf.object("MutableAddress", {
	street: sf.string,
	city: sf.string,
	state: sf.string,
	zip: sf.string,
});

/**
 * A regular object schema with a mutable nested object.
 */
const MutablePersonSchema = sf.object("MutablePerson", {
	name: sf.string,
	age: sf.number,
	address: MutableAddressSchema, // address.* should be mutable
});

/**
 * Map schema with constObject values.
 */
const AddressBookMapSchema = sf.map("AddressBookMap", AddressSchema);

/**
 * Map schema with mutable object values.
 */
const MutableAddressBookMapSchema = sf.map("MutableAddressBookMap", MutableAddressSchema);

// =============================================================================
// Type tests: ObjectView with constObject nested fields
// =============================================================================

export function testObjectViewWithConstObject(map: ISchematizedSharedMap): void {
	const view = map.viewWith(PersonSchema);

	// Top-level fields are mutable
	view.root.name = "Alice";
	view.root.age = 30;

	// Can read nested properties
	view.root.address.street satisfies string;
	view.root.address.city satisfies string;
	view.root.address.state satisfies string;

	// Nested properties are readonly because AddressSchema uses constObject
	// @ts-expect-error - constObject fields are readonly
	view.root.address.street = "123 Main St";
	// @ts-expect-error - constObject fields are readonly
	view.root.address.city = "Seattle";

	// Can replace the entire nested object
	view.root.address = {
		street: "456 Oak Ave",
		city: "Portland",
		state: "OR",
		zip: "97201",
	};
}

// =============================================================================
// Type tests: ObjectView with mutable nested fields
// =============================================================================

export function testObjectViewWithMutableNested(map: ISchematizedSharedMap): void {
	const view = map.viewWith(MutablePersonSchema);

	// Top-level fields are mutable
	view.root.name = "Alice";
	view.root.age = 30;

	// Nested properties ARE mutable because MutableAddressSchema uses regular object()
	view.root.address.street = "123 Main St";
	view.root.address.city = "Seattle";

	// Can also replace the entire nested object
	view.root.address = {
		street: "456 Oak Ave",
		city: "Portland",
		state: "OR",
		zip: "97201",
	};
}

// =============================================================================
// Type tests: MapView with constObject values
// =============================================================================

export function testMapViewWithConstObjectValues(map: ISchematizedSharedMap): void {
	const view = map.viewWith(AddressBookMapSchema);

	// Get returns readonly object
	const home = view.root.get("home");
	if (home !== undefined) {
		// Can read properties
		use(home.street satisfies string);
		use(home.city satisfies string);

		// @ts-expect-error - constObject values are readonly
		home.street = "123 Main St";
		// @ts-expect-error - constObject values are readonly
		home.city = "Seattle";
	}

	// Set requires a complete object
	view.root.set("work", {
		street: "456 Corporate Ave",
		city: "Portland",
		state: "OR",
		zip: "97201",
	});

	// Iteration values are readonly
	for (const [key, address] of view.root) {
		use(key satisfies string);
		use(address.street satisfies string);
		// @ts-expect-error - constObject values from iteration are readonly
		address.city = "Modified";
	}

	// values() returns readonly objects
	for (const address of view.root.values()) {
		use(address.street satisfies string);
		// @ts-expect-error - constObject values from values() are readonly
		address.city = "Modified";
	}
}

// =============================================================================
// Type tests: MapView with mutable object values
// =============================================================================

export function testMapViewWithMutableObjectValues(map: ISchematizedSharedMap): void {
	const view = map.viewWith(MutableAddressBookMapSchema);

	// Get returns mutable object
	const home = view.root.get("home");
	if (home !== undefined) {
		// Can read properties
		use(home.street satisfies string);
		use(home.city satisfies string);

		// Regular object values ARE mutable
		home.street = "123 Main St";
		home.city = "Seattle";
	}

	// Set with a complete object
	view.root.set("work", {
		street: "456 Corporate Ave",
		city: "Portland",
		state: "OR",
		zip: "97201",
	});

	// Iteration values are mutable
	for (const [key, address] of view.root) {
		use(key satisfies string);
		address.city = "Modified"; // Allowed for regular objects
	}

	// values() returns mutable objects
	for (const address of view.root.values()) {
		address.city = "Modified"; // Allowed for regular objects
	}
}

// =============================================================================
// Type tests: Direct constObject view
// =============================================================================

export function testDirectConstObjectView(map: ISchematizedSharedMap): void {
	const view = map.viewWith(AddressSchema);

	// All properties are readonly because this is a constObject
	view.root.street satisfies string;
	view.root.city satisfies string;

	// @ts-expect-error - constObject root properties are readonly
	view.root.street = "123 Main St";
	// @ts-expect-error - constObject root properties are readonly
	view.root.city = "Seattle";
}

// =============================================================================
// Type tests: Direct mutable object view
// =============================================================================

export function testDirectMutableObjectView(map: ISchematizedSharedMap): void {
	const view = map.viewWith(MutableAddressSchema);

	// All properties are mutable
	view.root.street satisfies string;
	view.root.city satisfies string;

	// Regular object properties are mutable
	view.root.street = "123 Main St";
	view.root.city = "Seattle";
}

// =============================================================================
// Type tests: Mutable object nested under constObject (deep immutability)
// =============================================================================

/**
 * ConstObject with a mutable object nested - the nested object should also be
 * deeply readonly because constObject implies deep immutability.
 */
const ConstPersonWithMutableAddressSchema = sf.constObject("ConstPersonWithMutableAddress", {
	name: sf.string,
	age: sf.number,
	address: MutableAddressSchema, // Even though defined with sf.object(), should be readonly here
});

/**
 * Map with constObject values that have mutable nested objects.
 */
const DeepConstMapSchema = sf.map("DeepConstMap", ConstPersonWithMutableAddressSchema);

export function testDeepConstObjectView(map: ISchematizedSharedMap): void {
	const view = map.viewWith(ConstPersonWithMutableAddressSchema);

	// Can read all properties
	view.root.name satisfies string;
	view.root.age satisfies number;
	view.root.address.street satisfies string;
	view.root.address.city satisfies string;

	// Top-level properties are readonly
	// @ts-expect-error - constObject properties are readonly
	view.root.name = "Alice";
	// @ts-expect-error - constObject properties are readonly
	view.root.age = 30;

	// Even though MutableAddressSchema was defined with sf.object(), when nested
	// under a constObject, the entire structure should be deeply readonly
	// @ts-expect-error - nested mutable object is readonly under constObject
	view.root.address.street = "123 Main St";
	// @ts-expect-error - nested mutable object is readonly under constObject
	view.root.address.city = "Seattle";

	// Cannot even reassign the nested object itself
	// @ts-expect-error - nested object property is readonly
	view.root.address = {
		street: "456 Oak Ave",
		city: "Portland",
		state: "OR",
		zip: "97201",
	};
}

export function testDeepConstMapView(map: ISchematizedSharedMap): void {
	const view = map.viewWith(DeepConstMapSchema);

	const person = view.root.get("alice");
	if (person !== undefined) {
		// Can read all properties
		use(person.name satisfies string);
		use(person.address.street satisfies string);

		// All properties are readonly because the value type is a constObject
		// @ts-expect-error - constObject value properties are readonly
		person.name = "Bob";
		// @ts-expect-error - nested mutable object under constObject is readonly
		person.address.street = "123 Main St";
		// @ts-expect-error - nested object itself is readonly
		person.address = {
			street: "456 Oak Ave",
			city: "Portland",
			state: "OR",
			zip: "97201",
		};
	}
}
