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
/* eslint-disable @rushstack/no-new-null */
/* eslint-disable unicorn/no-null */

/**
 * Type-only tests for class-based object schema.
 *
 * These tests verify that:
 * - Class-based schemas properly extend sf.object()
 * - The class has correct static schema properties (identifier, kind, fields)
 * - NodeFromSchema correctly infers types for class-based schemas
 * - SchemaClassConstructor type is satisfied
 *
 * Note: The class-based pattern in this schema package is primarily for
 * defining schema metadata with a class syntax. Custom instance methods
 * would be provided by a higher-level view layer, not the raw schema.
 */

import type {
	NodeFromSchema,
	ObjectNodeSchema,
	TypedObjectNodeSchema,
	SchemaClassConstructor,
} from "../../index.js";
import { SchemaFactory } from "../../index.js";
// Internal helper for testing
import { isSchemaClassConstructor } from "../../factory/index.js";

/**
 * Helper to "use" a value so TypeScript doesn't complain about unused variables.
 * This ensures the type is actually checked without needing runtime code.
 */
function use<T>(_thing: T): void {}

const sf = new SchemaFactory("test.class");

// =============================================================================
// Basic class-based schema
// =============================================================================

// Class extends sf.object() to get schema statics
class Person extends sf.object("Person", {
	name: sf.string,
	age: sf.number,
}) {}

// Verify the class has schema statics
{
	// Person.identifier should be the scoped schema name
	use(Person.identifier satisfies string);

	// Person should be assignable to ObjectNodeSchema
	use(Person satisfies ObjectNodeSchema);

	// Person should be a schema class constructor
	use(isSchemaClassConstructor(Person) satisfies boolean);
}

// Verify NodeFromSchema infers the correct type
{
	type PersonNode = NodeFromSchema<typeof Person>;

	// Should have schema-defined fields
	const person: PersonNode = { name: "Alice", age: 30 };
	use(person.name satisfies string);
	use(person.age satisfies number);

	// @ts-expect-error - missing required field
	const incomplete: PersonNode = { name: "Bob" };
	use(incomplete);

	// @ts-expect-error - wrong type for age
	const wrongType: PersonNode = { name: "Carol", age: "thirty" };
	use(wrongType);
}

// =============================================================================
// Schema class with optional fields
// =============================================================================

class UserProfile extends sf.object("UserProfile", {
	username: sf.string,
	email: sf.string,
	bio: sf.optional(sf.string),
	avatarUrl: sf.optional(sf.string),
}) {}

// Verify NodeFromSchema correctly handles optional fields
{
	type UserProfileNode = NodeFromSchema<typeof UserProfile>;

	// Required fields must be present
	const minimal: UserProfileNode = {
		username: "alice",
		email: "alice@example.com",
	};
	use(minimal);

	// Optional fields can be included
	const full: UserProfileNode = {
		username: "bob",
		email: "bob@example.com",
		bio: "Hello world",
		avatarUrl: "https://example.com/avatar.png",
	};
	use(full);

	// @ts-expect-error - missing required field 'email'
	const missingRequired: UserProfileNode = { username: "charlie" };
	use(missingRequired);
}

// =============================================================================
// Schema class with nested objects
// =============================================================================

const AddressSchema = sf.object("Address", {
	street: sf.string,
	city: sf.string,
	country: sf.string,
});

class Company extends sf.object("Company", {
	name: sf.string,
	headquarters: AddressSchema,
	yearFounded: sf.number,
}) {}

// Verify nested object types
{
	type CompanyNode = NodeFromSchema<typeof Company>;

	const company: CompanyNode = {
		name: "Acme Corp",
		headquarters: {
			street: "123 Main St",
			city: "Seattle",
			country: "USA",
		},
		yearFounded: 1995,
	};

	use(company.name satisfies string);
	use(company.headquarters.city satisfies string);
	use(company.yearFounded satisfies number);

	const wrongNested: CompanyNode = {
		name: "Bad Corp",
		// @ts-expect-error - missing city and country fields
		headquarters: {
			street: "123 Main St",
		},
		yearFounded: 2000,
	};
	use(wrongNested);
}

// =============================================================================
// Schema class used as field type
// =============================================================================

class Employee extends sf.object("Employee", {
	name: sf.string,
	company: Company, // Using another schema class as field type
}) {}

// Verify class schema can be used as field type
{
	type EmployeeNode = NodeFromSchema<typeof Employee>;

	const employee: EmployeeNode = {
		name: "John Doe",
		company: {
			name: "Acme Corp",
			headquarters: {
				street: "123 Main St",
				city: "Seattle",
				country: "USA",
			},
			yearFounded: 1995,
		},
	};

	use(employee.name satisfies string);
	use(employee.company.name satisfies string);
	use(employee.company.headquarters.city satisfies string);
}

// =============================================================================
// Schema class with all primitive types
// =============================================================================

class AllPrimitives extends sf.object("AllPrimitives", {
	stringField: sf.string,
	numberField: sf.number,
	booleanField: sf.boolean,
	nullField: sf.null,
	optionalString: sf.optional(sf.string),
	optionalNumber: sf.optional(sf.number),
	optionalBoolean: sf.optional(sf.boolean),
}) {}

{
	type AllPrimitivesNode = NodeFromSchema<typeof AllPrimitives>;

	const allFields: AllPrimitivesNode = {
		stringField: "hello",
		numberField: 42,
		booleanField: true,
		nullField: null,
		optionalString: "optional",
		optionalNumber: 123,
		optionalBoolean: false,
	};
	use(allFields);

	// Minimal required fields only
	const minimalFields: AllPrimitivesNode = {
		stringField: "hello",
		numberField: 42,
		booleanField: true,
		nullField: null,
	};
	use(minimalFields);

	const wrongString: AllPrimitivesNode = {
		// @ts-expect-error - wrong type for stringField
		stringField: 123,
		numberField: 42,
		booleanField: true,
		nullField: null,
	};
	use(wrongString);
}

// =============================================================================
// Schema class type constraints
// =============================================================================

// Verify schema class satisfies SchemaClassConstructor
{
	use(Person satisfies SchemaClassConstructor);
	use(UserProfile satisfies SchemaClassConstructor);
	use(Company satisfies SchemaClassConstructor);
}

// Verify schema class satisfies TypedObjectNodeSchema
{
	// This verifies the class has the expected structure
	const acceptTypedSchema = <T extends TypedObjectNodeSchema>(_schema: T): void => {};
	acceptTypedSchema(Person);
	acceptTypedSchema(UserProfile);
	acceptTypedSchema(Company);
}

// =============================================================================
// Multiple inheritance levels via composition
// =============================================================================

// Schema composition pattern - embedding one schema in another
const BaseEntityFields = {
	id: sf.string,
	createdAt: sf.number,
	updatedAt: sf.number,
} as const;

class Document extends sf.object("Document", {
	...BaseEntityFields,
	title: sf.string,
	content: sf.string,
}) {}

class Article extends sf.object("Article", {
	...BaseEntityFields,
	title: sf.string,
	content: sf.string,
	author: sf.string,
	publishedAt: sf.optional(sf.number),
}) {}

{
	type DocumentNode = NodeFromSchema<typeof Document>;
	type ArticleNode = NodeFromSchema<typeof Article>;

	const doc: DocumentNode = {
		id: "doc-1",
		createdAt: 1000,
		updatedAt: 2000,
		title: "Hello",
		content: "World",
	};
	use(doc.id satisfies string);
	use(doc.createdAt satisfies number);

	const article: ArticleNode = {
		id: "article-1",
		createdAt: 1000,
		updatedAt: 2000,
		title: "News",
		content: "Breaking news...",
		author: "Reporter",
		publishedAt: 3000,
	};
	use(article.author satisfies string);
	use(article.publishedAt satisfies number | undefined);
}

// Export to ensure the file is included in build and tests are checked
export { Person, UserProfile, Company, Employee, AllPrimitives, Document, Article };
