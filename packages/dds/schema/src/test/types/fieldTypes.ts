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
 * Type-only tests for field type inference.
 *
 * These tests verify that:
 * - Required and optional field types are correctly inferred
 * - Union types in fields work correctly
 * - Field props don't affect type inference
 * - NormalizeFieldSchema, TypeFromField, and InferFieldKind work correctly
 */

import type {
	NodeFromSchema,
	InferFieldKind,
	InferAllowedTypes,
	NormalizeFieldSchema,
	TypeFromField,
} from "../../index.js";
import { SchemaFactory, FieldKind } from "../../index.js";

/**
 * Helper to "use" a value so TypeScript doesn't complain about unused variables.
 * This ensures the type is actually checked without needing runtime code.
 */
function use<T>(_thing: T): void {}

const sf = new SchemaFactory("test.fields");

// =============================================================================
// Required vs Optional field inference
// =============================================================================

{
	const Schema = sf.object("RequiredVsOptional", {
		// Implicit required (just the schema)
		implicitRequired: sf.string,
		// Explicit required
		explicitRequired: sf.required(sf.string),
		// Optional
		optional: sf.optional(sf.string),
	});

	type Node = NodeFromSchema<typeof Schema>;

	// Required fields must be present
	const valid: Node = {
		implicitRequired: "a",
		explicitRequired: "b",
	};
	use(valid);

	// Optional can be present
	const withOptional: Node = {
		implicitRequired: "a",
		explicitRequired: "b",
		optional: "c",
	};
	use(withOptional);

	// Optional can be undefined
	const withUndefined: Node = {
		implicitRequired: "a",
		explicitRequired: "b",
		optional: undefined,
	};
	use(withUndefined);

	// @ts-expect-error - missing required field
	const missingImplicit: Node = {
		explicitRequired: "b",
	};
	use(missingImplicit);

	// @ts-expect-error - missing required field
	const missingExplicit: Node = {
		implicitRequired: "a",
	};
	use(missingExplicit);
}

// =============================================================================
// InferFieldKind type utility
// =============================================================================

{
	// For TypedFieldSchema, extract the kind
	type OptionalKind = InferFieldKind<ReturnType<typeof sf.optional<typeof sf.string>>>;
	type RequiredKind = InferFieldKind<ReturnType<typeof sf.required<typeof sf.string>>>;

	// Verify kinds match
	use(undefined as unknown as OptionalKind satisfies typeof FieldKind.Optional);
	use(undefined as unknown as RequiredKind satisfies typeof FieldKind.Required);

	// For implicit allowed types (not wrapped in optional/required),
	// InferFieldKind should return Required
	type ImplicitKind = InferFieldKind<typeof sf.string>;
	use(undefined as unknown as ImplicitKind satisfies typeof FieldKind.Required);
}

// =============================================================================
// InferAllowedTypes type utility
// =============================================================================

{
	const optionalString = sf.optional(sf.string);
	const optionalNumber = sf.optional(sf.number);
	const requiredBoolean = sf.required(sf.boolean);

	// Extract allowed types from field schemas
	type StringAllowed = InferAllowedTypes<typeof optionalString>;
	type NumberAllowed = InferAllowedTypes<typeof optionalNumber>;
	type BooleanAllowed = InferAllowedTypes<typeof requiredBoolean>;

	// These should be the leaf schemas
	use(undefined as unknown as StringAllowed satisfies typeof sf.string);
	use(undefined as unknown as NumberAllowed satisfies typeof sf.number);
	use(undefined as unknown as BooleanAllowed satisfies typeof sf.boolean);
}

// =============================================================================
// Union types in fields
// =============================================================================

{
	const Schema = sf.object("UnionFields", {
		// Union of primitives
		stringOrNumber: [sf.string, sf.number],
		// Optional union
		optionalUnion: sf.optional([sf.string, sf.boolean]),
	});

	type Node = NodeFromSchema<typeof Schema>;

	// stringOrNumber accepts string
	const withString: Node = {
		stringOrNumber: "hello",
	};
	use(withString);

	// stringOrNumber accepts number
	const withNumber: Node = {
		stringOrNumber: 42,
	};
	use(withNumber);

	// optionalUnion accepts string
	const unionString: Node = {
		stringOrNumber: "test",
		optionalUnion: "optional string",
	};
	use(unionString);

	// optionalUnion accepts boolean
	const unionBoolean: Node = {
		stringOrNumber: 123,
		optionalUnion: true,
	};
	use(unionBoolean);

	const wrongUnion: Node = {
		// @ts-expect-error - boolean not in stringOrNumber union
		stringOrNumber: true,
	};
	use(wrongUnion);
}

// =============================================================================
// Nested object in fields
// =============================================================================

{
	const InnerSchema = sf.object("Inner", {
		value: sf.string,
	});

	const OuterSchema = sf.object("Outer", {
		required: InnerSchema,
		optional: sf.optional(InnerSchema),
	});

	type Outer = NodeFromSchema<typeof OuterSchema>;

	// Required nested object must be present
	const valid: Outer = {
		required: { value: "hello" },
	};
	use(valid.required.value satisfies string);

	// Optional nested object can be present
	const withOptional: Outer = {
		required: { value: "hello" },
		optional: { value: "world" },
	};
	use(withOptional.optional?.value satisfies string | undefined);

	// @ts-expect-error - missing required nested object
	const missingRequired: Outer = {};
	use(missingRequired);

	const wrongShape: Outer = {
		// @ts-expect-error - nested object has wrong shape
		required: { wrongField: "hello" },
	};
	use(wrongShape);
}

// =============================================================================
// Field with null type
// =============================================================================

{
	const Schema = sf.object("NullableFields", {
		nullable: sf.null,
		optionalNull: sf.optional(sf.null),
		stringOrNull: [sf.string, sf.null],
	});

	type Node = NodeFromSchema<typeof Schema>;

	const valid: Node = {
		nullable: null,
		stringOrNull: "hello",
	};
	use(valid);

	const withNull: Node = {
		nullable: null,
		stringOrNull: null,
	};
	use(withNull);

	const wrongNull: Node = {
		// @ts-expect-error - undefined is not null
		nullable: undefined,
		stringOrNull: "test",
	};
	use(wrongNull);
}

// =============================================================================
// TypeFromField type utility
// =============================================================================

{
	// Test TypeFromField with various field schemas
	type RequiredStringType = TypeFromField<ReturnType<typeof sf.required<typeof sf.string>>>;
	type OptionalStringType = TypeFromField<ReturnType<typeof sf.optional<typeof sf.string>>>;
	type ImplicitRequiredType = TypeFromField<typeof sf.number>;

	// Required field should not include undefined
	const reqStr: RequiredStringType = "hello";
	use(reqStr);
	// @ts-expect-error - undefined not allowed in required
	const reqStrUndef: RequiredStringType = undefined;
	use(reqStrUndef);

	// Optional field should include undefined
	const optStr: OptionalStringType = "hello";
	const optStrUndef: OptionalStringType = undefined;
	use(optStr);
	use(optStrUndef);

	// Implicit required (just a schema, not wrapped) should be required
	const implicitNum: ImplicitRequiredType = 42;
	use(implicitNum);
	// @ts-expect-error - undefined not allowed
	const implicitUndef: ImplicitRequiredType = undefined;
	use(implicitUndef);
}

// =============================================================================
// NormalizeFieldSchema type utility
// =============================================================================

{
	// For TypedFieldSchema, preserve kind and allowedTypes
	type NormalizedOptional = NormalizeFieldSchema<
		ReturnType<typeof sf.optional<typeof sf.string>>
	>;
	type NormalizedRequired = NormalizeFieldSchema<
		ReturnType<typeof sf.required<typeof sf.number>>
	>;

	// For implicit allowed types, treat as required
	type NormalizedImplicit = NormalizeFieldSchema<typeof sf.boolean>;

	// Verify the structure
	use(
		undefined as unknown as NormalizedOptional satisfies {
			kind: typeof FieldKind.Optional;
			allowedTypes: typeof sf.string;
		},
	);

	use(
		undefined as unknown as NormalizedRequired satisfies {
			kind: typeof FieldKind.Required;
			allowedTypes: typeof sf.number;
		},
	);

	use(
		undefined as unknown as NormalizedImplicit satisfies {
			kind: typeof FieldKind.Required;
			allowedTypes: typeof sf.boolean;
		},
	);
}

// =============================================================================
// Field props don't affect type inference
// =============================================================================

{
	const Schema = sf.object("FieldPropsTest", {
		// Field with key override
		renamed: sf.required(sf.string, { key: "original_name" }),
		// Field with metadata
		documented: sf.optional(sf.number, {
			metadata: { description: "A documented field" },
		}),
	});

	type Node = NodeFromSchema<typeof Schema>;

	// Types should be the same regardless of props
	const valid: Node = {
		renamed: "value",
		documented: 42,
	};
	use(valid.renamed satisfies string);
	use(valid.documented satisfies number | undefined);
}

// =============================================================================
// Complex nested unions
// =============================================================================

{
	const AddressSchema = sf.object("Address", {
		street: sf.string,
		city: sf.string,
	});

	const PhoneSchema = sf.object("Phone", {
		countryCode: sf.string,
		number: sf.string,
	});

	const ContactSchema = sf.object("Contact", {
		// Union of different object schemas
		primaryContact: [AddressSchema, PhoneSchema],
		// Optional union with primitives
		secondaryContact: sf.optional([AddressSchema, PhoneSchema, sf.string]),
	});

	type Contact = NodeFromSchema<typeof ContactSchema>;

	// Can use address as primary
	const withAddress: Contact = {
		primaryContact: { street: "123 Main", city: "Seattle" },
	};
	use(withAddress);

	// Can use phone as primary
	const withPhone: Contact = {
		primaryContact: { countryCode: "+1", number: "555-1234" },
	};
	use(withPhone);

	// Secondary can be string
	const withStringSecondary: Contact = {
		primaryContact: { street: "123 Main", city: "Seattle" },
		secondaryContact: "call me",
	};
	use(withStringSecondary);
}

// Export to ensure the file is included in build
export {};
