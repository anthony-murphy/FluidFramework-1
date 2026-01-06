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
 * End-to-end type tests demonstrating idiomatic usage patterns.
 *
 * These tests verify that the types work correctly in real-world scenarios,
 * using the APIs as end users would actually use them (e.g., `map.viewWith(schema)`)
 * rather than testing individual type utilities in isolation.
 *
 * This file focuses on:
 * - Defining schemas with SchemaFactory
 * - Using ObjectView and MapView types
 * - Working with view.root for data access
 * - Common patterns like optional fields, nested objects, etc.
 */

import type { ObjectView, MapView, IViewableStorage } from "../../index.js";
import { SchemaFactory, createViewWith } from "../../index.js";

/**
 * Helper to "use" a value so TypeScript doesn't complain about unused variables.
 * This ensures the type is actually checked without needing runtime code.
 */
function use<T>(_thing: T): void {}

// =============================================================================
// Schema definitions - how users define their data models
// =============================================================================

const sf = new SchemaFactory("com.example.app");

/**
 * A simple user schema - the most common case.
 */
const UserSchema = sf.object("User", {
	name: sf.string,
	email: sf.string,
	age: sf.number,
});

/**
 * Schema with optional fields - common for partial data.
 */
const UserProfileSchema = sf.object("UserProfile", {
	displayName: sf.string,
	bio: sf.optional(sf.string),
	avatarUrl: sf.optional(sf.string),
	website: sf.optional(sf.string),
});

/**
 * Nested schema using constObject - for value objects that should be
 * replaced entirely rather than mutated. All properties become readonly.
 */
const AddressSchema = sf.constObject("Address", {
	street: sf.string,
	city: sf.string,
	state: sf.string,
	zip: sf.string,
	country: sf.string,
});

const CompanySchema = sf.object("Company", {
	name: sf.string,
	headquarters: AddressSchema, // AddressSchema is a constObject, so headquarters.* is readonly
	founded: sf.number,
});

/**
 * Nested schema using regular object - properties are mutable.
 */
const MutableAddressSchema = sf.object("MutableAddress", {
	street: sf.string,
	city: sf.string,
	state: sf.string,
	zip: sf.string,
	country: sf.string,
});

const PersonSchema = sf.object("Person", {
	name: sf.string,
	address: MutableAddressSchema, // MutableAddressSchema is a regular object, so address.* is mutable
});

/**
 * ConstObject that nests a mutable object - the nested object should also be
 * readonly because constObject implies deep immutability.
 */
const ConstPersonSchema = sf.constObject("ConstPerson", {
	name: sf.string,
	address: MutableAddressSchema, // Even though MutableAddressSchema is a regular object, it should be readonly here
});

/**
 * Map schema for collections.
 */
const UsersMapSchema = sf.map("UsersMap", UserSchema);
const SettingsMapSchema = sf.map("SettingsMap", sf.string);

/**
 * Map schema with constObject values - values are readonly.
 */
const AddressBookSchema = sf.map("AddressBook", AddressSchema);

/**
 * Map schema with mutable object values - values are mutable.
 */
const MutableAddressBookSchema = sf.map("MutableAddressBook", MutableAddressSchema);

// =============================================================================
// Idiomatic usage: ObjectView with typed root
// =============================================================================

export function testObjectViewIdiomaticUsage(userView: ObjectView<typeof UserSchema>): void {
	// View.root gives typed access to the data
	userView.root.name satisfies string;
	userView.root.email satisfies string;
	userView.root.age satisfies number;

	// Assignment is typed
	userView.root.name = "Alice";
	userView.root.email = "alice@example.com";
	userView.root.age = 30;

	// @ts-expect-error - wrong type for age
	userView.root.age = "thirty";

	// @ts-expect-error - property doesn't exist
	userView.root.nonexistent = "value";

	// Lifecycle methods are available
	userView.initialize();
	userView.dispose();
}

// =============================================================================
// Idiomatic usage: Optional fields
// =============================================================================

export function testOptionalFieldsIdiomaticUsage(
	profileView: ObjectView<typeof UserProfileSchema>,
): void {
	// Required field must be set
	profileView.root.displayName = "Alice";

	// Optional fields can be undefined
	profileView.root.bio satisfies string | undefined;
	profileView.root.avatarUrl satisfies string | undefined;

	// Can set optional fields to values
	profileView.root.bio = "Hello, I'm Alice!";
	profileView.root.avatarUrl = "https://example.com/avatar.png";

	// Can set optional fields to undefined
	profileView.root.bio = undefined;
	profileView.root.website = undefined;

	// @ts-expect-error - can't set required field to undefined
	profileView.root.displayName = undefined;
}

// =============================================================================
// Idiomatic usage: Nested objects
// =============================================================================

export function testNestedObjectsIdiomaticUsage(
	companyView: ObjectView<typeof CompanySchema>,
): void {
	// Access nested properties (readonly - can read but not mutate)
	companyView.root.name satisfies string;
	companyView.root.headquarters.street satisfies string;
	companyView.root.headquarters.city satisfies string;
	companyView.root.headquarters.country satisfies string;

	// Set top-level properties
	companyView.root.name = "Acme Corp";
	companyView.root.founded = 1995;

	// Nested properties are readonly because AddressSchema uses sf.constObject().
	// This makes it a value object that must be replaced entirely.
	// For flat storage DDSes like SharedMap, this is the recommended pattern
	// because mutations would hide that the entire value gets replaced (LWW).
	// @ts-expect-error - nested object properties are readonly
	companyView.root.headquarters.street = "123 Main St";
	// @ts-expect-error - nested object properties are readonly
	companyView.root.headquarters.city = "Seattle";

	// Set entire nested object - this is the correct pattern
	companyView.root.headquarters = {
		street: "456 Oak Ave",
		city: "Portland",
		state: "OR",
		zip: "97201",
		country: "USA",
	};

	// @ts-expect-error - nested object missing required fields
	companyView.root.headquarters = {
		street: "789 Pine St",
		city: "Denver",
		// missing state, zip, country
	};
}

// =============================================================================
// Idiomatic usage: Mutable object nested under constObject (should be readonly)
// =============================================================================

export function testMutableNestedUnderConstObjectIdiomaticUsage(
	constPersonView: ObjectView<typeof ConstPersonSchema>,
): void {
	// Even though MutableAddressSchema was defined with sf.object(), when nested
	// under a constObject, the entire structure should be deeply readonly.

	// Can read all properties
	constPersonView.root.name satisfies string;
	constPersonView.root.address.street satisfies string;
	constPersonView.root.address.city satisfies string;

	// Top-level properties are readonly
	// @ts-expect-error - constObject properties are readonly
	constPersonView.root.name = "Alice";

	// Nested mutable object properties should ALSO be readonly because constObject is deep
	// @ts-expect-error - nested object properties are readonly due to parent being constObject
	constPersonView.root.address.street = "123 Main St";
	// @ts-expect-error - nested object properties are readonly due to parent being constObject
	constPersonView.root.address.city = "Seattle";

	// Can replace the entire nested object as readonly value
	// @ts-expect-error - nested object is readonly, cannot reassign
	constPersonView.root.address = {
		street: "456 Oak Ave",
		city: "Portland",
		state: "OR",
		zip: "97201",
		country: "USA",
	};
}

// =============================================================================
// Idiomatic usage: Mutable nested objects (regular sf.object)
// =============================================================================

export function testMutableNestedObjectsIdiomaticUsage(
	personView: ObjectView<typeof PersonSchema>,
): void {
	// Access nested properties - these are mutable (not using constObject)
	personView.root.name satisfies string;
	personView.root.address.street satisfies string;
	personView.root.address.city satisfies string;

	// Set top-level properties
	personView.root.name = "Alice";

	// Nested properties ARE mutable because MutableAddressSchema uses sf.object()
	// (not sf.constObject). This is allowed but may have surprising semantics
	// in flat storage DDSes - the entire parent object gets replaced.
	personView.root.address.street = "123 Main St";
	personView.root.address.city = "Seattle";

	// Can also replace the entire nested object
	personView.root.address = {
		street: "456 Oak Ave",
		city: "Portland",
		state: "OR",
		zip: "97201",
		country: "USA",
	};
}

// =============================================================================
// Idiomatic usage: MapView with typed values
// =============================================================================

export function testMapViewIdiomaticUsage(
	settingsView: MapView<typeof SettingsMapSchema>,
): void {
	// Map operations are typed
	settingsView.root.get("theme") satisfies string | undefined;
	settingsView.root.set("theme", "dark");
	settingsView.root.has("theme") satisfies boolean;
	settingsView.root.delete("theme") satisfies boolean;

	// @ts-expect-error - wrong value type
	settingsView.root.set("theme", 123);

	// Iteration
	for (const [key, value] of settingsView.root) {
		use(key satisfies string);
		use(value satisfies string);
	}
}

export function testMapOfObjectsIdiomaticUsage(
	usersView: MapView<typeof UsersMapSchema>,
): void {
	// Get returns typed object or undefined
	const user = usersView.root.get("user-1");
	if (user !== undefined) {
		use(user.name satisfies string);
		use(user.email satisfies string);
		use(user.age satisfies number);
	}

	// Set with typed object
	usersView.root.set("user-2", {
		name: "Bob",
		email: "bob@example.com",
		age: 25,
	});

	// @ts-expect-error - object missing required field
	usersView.root.set("user-3", {
		name: "Charlie",
		email: "charlie@example.com",
		// missing age
	});

	usersView.root.set("user-4", {
		name: "Diana",
		email: "diana@example.com",
		// @ts-expect-error - wrong field type
		age: "twenty-five",
	});
}

// =============================================================================
// Idiomatic usage: MapView with constObject values (readonly)
// =============================================================================

export function testMapOfConstObjectsIdiomaticUsage(
	addressBookView: MapView<typeof AddressBookSchema>,
): void {
	// Get returns readonly object or undefined
	const address = addressBookView.root.get("home");
	if (address !== undefined) {
		// Can read all properties
		use(address.street satisfies string);
		use(address.city satisfies string);
		use(address.state satisfies string);
		use(address.zip satisfies string);
		use(address.country satisfies string);

		// @ts-expect-error - constObject values are readonly
		address.street = "123 Main St";
		// @ts-expect-error - constObject values are readonly
		address.city = "Seattle";
	}

	// Set with a complete object - this is the correct pattern
	addressBookView.root.set("work", {
		street: "456 Corporate Ave",
		city: "Portland",
		state: "OR",
		zip: "97201",
		country: "USA",
	});

	// Iteration - values are readonly
	for (const [key, value] of addressBookView.root) {
		use(key satisfies string);
		use(value.street satisfies string);
		// @ts-expect-error - values from iteration are also readonly
		value.city = "Modified";
	}
}

// =============================================================================
// Idiomatic usage: MapView with mutable object values
// =============================================================================

export function testMapOfMutableObjectsIdiomaticUsage(
	addressBookView: MapView<typeof MutableAddressBookSchema>,
): void {
	// Get returns mutable object or undefined
	const address = addressBookView.root.get("home");
	if (address !== undefined) {
		// Can read all properties
		use(address.street satisfies string);
		use(address.city satisfies string);

		// Regular object values ARE mutable (but see caveat below)
		// Note: In flat storage DDSes, this mutation causes the entire
		// map value to be replaced - other concurrent mutations may be lost.
		address.street = "123 Main St";
		address.city = "Seattle";
	}

	// Set with a complete object
	addressBookView.root.set("work", {
		street: "456 Corporate Ave",
		city: "Portland",
		state: "OR",
		zip: "97201",
		country: "USA",
	});

	// Iteration - values are mutable
	for (const [key, value] of addressBookView.root) {
		use(key satisfies string);
		value.city = "Modified"; // Allowed for regular objects
	}
}

// =============================================================================
// Idiomatic usage: Reading data conditionally
// =============================================================================

export function testConditionalDataAccess(
	profileView: ObjectView<typeof UserProfileSchema>,
): void {
	// Pattern: Check optional fields before use
	if (profileView.root.bio !== undefined) {
		// TypeScript knows bio is string here
		const bioLength = profileView.root.bio.length;
		use(bioLength satisfies number);
	}

	// Pattern: Provide defaults for optional fields
	const avatarUrl = profileView.root.avatarUrl ?? "/default-avatar.png";
	use(avatarUrl satisfies string);

	// Pattern: Destructure with defaults
	const { displayName, bio = "No bio provided" } = profileView.root;
	use(displayName satisfies string);
	use(bio satisfies string);
}

// =============================================================================
// Idiomatic usage: Working with arrays of items from map
// =============================================================================

export function testCollectingMapEntries(usersView: MapView<typeof UsersMapSchema>): void {
	// Collect all users into an array
	const allUsers = [...usersView.root.values()];
	for (const user of allUsers) {
		use(user.name satisfies string);
		use(user.email satisfies string);
	}

	// Filter users by some criteria
	const adults = allUsers.filter((user) => user.age >= 18);
	for (const adult of adults) {
		use(adult.age satisfies number);
	}

	// Map to derived data
	const userNames = allUsers.map((user) => user.name);
	for (const name of userNames) {
		use(name satisfies string);
	}
}

// =============================================================================
// Idiomatic usage: Type-safe function parameters
// =============================================================================

/**
 * Function that accepts a user view - demonstrates passing views around.
 */
function displayUser(view: ObjectView<typeof UserSchema>): void {
	console.log(`Name: ${view.root.name}`);
	console.log(`Email: ${view.root.email}`);
	console.log(`Age: ${view.root.age}`);
}

/**
 * Function that accepts a settings map view.
 */
function getTheme(view: MapView<typeof SettingsMapSchema>): string {
	return view.root.get("theme") ?? "light";
}

export function testPassingViewsToFunctions(
	userView: ObjectView<typeof UserSchema>,
	settingsView: MapView<typeof SettingsMapSchema>,
	usersView: MapView<typeof UsersMapSchema>,
): void {
	// Pass views to typed functions
	displayUser(userView);
	const theme = getTheme(settingsView);
	use(theme satisfies string);

	// @ts-expect-error - wrong view type
	displayUser(settingsView);

	// @ts-expect-error - wrong view type
	getTheme(userView);
}

// =============================================================================
// Idiomatic usage: Class-based schemas
// =============================================================================

// Class-based schema definition (extends sf.object)
class TaskSchema extends sf.object("Task", {
	title: sf.string,
	completed: sf.boolean,
	dueDate: sf.optional(sf.number),
}) {}

const TaskListSchema = sf.map("TaskList", TaskSchema);

export function testClassBasedSchemaWithViewTypes(
	taskView: ObjectView<typeof TaskSchema>,
	tasksView: MapView<typeof TaskListSchema>,
): void {
	// Works the same as inline schema definitions
	taskView.root.title satisfies string;
	taskView.root.completed satisfies boolean;
	taskView.root.dueDate satisfies number | undefined;

	taskView.root.title = "Complete type tests";
	taskView.root.completed = true;
	taskView.root.dueDate = Date.now();

	// Map of class-based schema works too
	const task = tasksView.root.get("task-1");
	if (task !== undefined) {
		use(task.title satisfies string);
	}
}

// =============================================================================
// Idiomatic usage: createViewWith for DDS authors
// =============================================================================

/**
 * Example of how a DDS author would use createViewWith.
 * This tests the factory function itself.
 */
export function testCreateViewWithForDDSAuthors(mockStorage: IViewableStorage): void {
	// DDS author implements IViewableStorage and creates viewWith
	const viewWith = createViewWith(mockStorage);

	// The returned function works with object schemas
	const objView = viewWith(UserSchema);
	objView.root.name satisfies string;
	objView.root.email satisfies string;

	// For map schemas, map operations are correctly typed
	const mapView = viewWith(SettingsMapSchema);
	mapView.root.get("theme") satisfies string | undefined;
	mapView.root.set("theme", "dark");

	// Map of objects also works
	const usersMapView = viewWith(UsersMapSchema);
	const user = usersMapView.root.get("user-1");
	if (user !== undefined) {
		// user is correctly typed as { name: string, email: string, age: number }
		use(user.name satisfies string);
	}
}

// Export schemas for other tests to use
export { UserSchema, UserProfileSchema, CompanySchema, AddressSchema, TaskSchema };
