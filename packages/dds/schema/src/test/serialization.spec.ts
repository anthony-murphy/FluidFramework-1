/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { strict as assert } from "node:assert";

import {
	SchemaFactory,
	stringSchema,
	numberSchema,
	booleanSchema,
	nullSchema,
	handleSchema,
	FieldKind,
	NodeKind,
} from "../index.js";
import {
	encodeSchema,
	decodeSchema,
	checkSchemaCompatibility,
	type EncodedSchema,
	type EncodedObjectSchema,
} from "../serialization/index.js";

describe("Schema Serialization", () => {
	const sf = new SchemaFactory("myApp");

	describe("encodeSchema", () => {
		it("encodes leaf schemas correctly", () => {
			const encoded = encodeSchema(stringSchema);

			assert.equal(encoded.version, 1);
			assert.equal(encoded.root.kind, "leaf");
			const root = encoded.root;
			assert.equal(root.identifier, "com.fluidframework.leaf.string");
			assert.equal(root.leafKind, "string");
			assert.equal(encoded.definitions, undefined);
		});

		it("encodes number leaf schema", () => {
			const encoded = encodeSchema(numberSchema);

			assert.equal(encoded.root.kind, "leaf");
			const root = encoded.root;
			assert.equal(root.identifier, "com.fluidframework.leaf.number");
			assert.equal(root.leafKind, "number");
		});

		it("encodes boolean leaf schema", () => {
			const encoded = encodeSchema(booleanSchema);

			assert.equal(encoded.root.kind, "leaf");
			const root = encoded.root;
			assert.equal(root.identifier, "com.fluidframework.leaf.boolean");
			assert.equal(root.leafKind, "boolean");
		});

		it("encodes null leaf schema", () => {
			const encoded = encodeSchema(nullSchema);

			assert.equal(encoded.root.kind, "leaf");
			const root = encoded.root;
			assert.equal(root.identifier, "com.fluidframework.leaf.null");
			assert.equal(root.leafKind, "null");
		});

		it("encodes handle leaf schema", () => {
			const encoded = encodeSchema(handleSchema);

			assert.equal(encoded.root.kind, "leaf");
			const root = encoded.root;
			assert.equal(root.identifier, "com.fluidframework.leaf.handle");
			assert.equal(root.leafKind, "handle");
		});

		it("encodes simple object schema", () => {
			const UserSchema = sf.object("User", {
				name: sf.string,
				age: sf.number,
			});

			const encoded = encodeSchema(UserSchema);

			assert.equal(encoded.version, 1);
			assert.equal(encoded.root.kind, "object");
			const root = encoded.root;
			assert.equal(root.identifier, "myApp.User");

			// Check fields (sorted alphabetically)
			const fieldNames = Object.keys(root.fields);
			assert.deepEqual(fieldNames, ["age", "name"]);

			// Check name field
			const nameField = root.fields.name;
			assert(nameField !== undefined);
			assert.equal(nameField.kind, "required");
			assert.equal(nameField.allowedTypes.length, 1);

			// Check age field
			const ageField = root.fields.age;
			assert(ageField !== undefined);
			assert.equal(ageField.kind, "required");
			assert.equal(ageField.allowedTypes.length, 1);
		});

		it("encodes object schema with optional fields", () => {
			const UserSchema = sf.object("OptionalUser", {
				name: sf.string,
				nickname: sf.optional(sf.string),
			});

			const encoded = encodeSchema(UserSchema);
			const root = encoded.root as EncodedObjectSchema;

			const nameField = root.fields.name;
			assert(nameField !== undefined);
			assert.equal(nameField.kind, "required");

			const nicknameField = root.fields.nickname;
			assert(nicknameField !== undefined);
			assert.equal(nicknameField.kind, "optional");
		});

		it("encodes map schema", () => {
			const ConfigMap = sf.map("Config", sf.string);

			const encoded = encodeSchema(ConfigMap);

			assert.equal(encoded.version, 1);
			assert.equal(encoded.root.kind, "map");
			assert.equal(encoded.root.identifier, "myApp.Config");
		});

		it("produces deterministic output (fields sorted)", () => {
			const Schema1 = sf.object("TestA", {
				zebra: sf.string,
				apple: sf.number,
				mango: sf.boolean,
			});

			const Schema2 = sf.object("TestB", {
				apple: sf.number,
				mango: sf.boolean,
				zebra: sf.string,
			});

			const encoded1 = encodeSchema(Schema1);
			const encoded2 = encodeSchema(Schema2);

			const root1 = encoded1.root as EncodedObjectSchema;
			const root2 = encoded2.root as EncodedObjectSchema;

			// Fields should be sorted alphabetically in both
			assert.deepEqual(Object.keys(root1.fields), ["apple", "mango", "zebra"]);
			assert.deepEqual(Object.keys(root2.fields), ["apple", "mango", "zebra"]);
		});

		it("encodes to valid JSON", () => {
			const UserSchema = sf.object("JsonUser", {
				name: sf.string,
				age: sf.optional(sf.number),
			});

			const encoded = encodeSchema(UserSchema);

			// Should be able to stringify and parse
			const json = JSON.stringify(encoded);
			const parsed = JSON.parse(json) as EncodedSchema;

			assert.equal(parsed.version, 1);
			assert.equal(parsed.root.kind, "object");
		});
	});

	describe("decodeSchema", () => {
		it("decodes leaf schemas correctly", () => {
			const encoded: EncodedSchema = {
				version: 1,
				root: {
					kind: "leaf",
					identifier: "com.fluidframework.leaf.string",
					leafKind: "string",
				},
			};

			const decoded = decodeSchema(encoded);

			assert.equal(decoded.root.kind, NodeKind.Leaf);
			assert.equal(decoded.root.identifier, "com.fluidframework.leaf.string");
			if (decoded.root.kind === NodeKind.Leaf) {
				assert.equal(decoded.root.leafKind, "string");
			}
		});

		it("decodes object schemas correctly", () => {
			const encoded: EncodedSchema = {
				version: 1,
				root: {
					kind: "object",
					identifier: "myApp.User",
					fields: {
						name: {
							kind: "required",
							allowedTypes: [
								{
									kind: "leaf",
									identifier: "com.fluidframework.leaf.string",
									leafKind: "string",
								},
							],
						},
						age: {
							kind: "optional",
							allowedTypes: [
								{
									kind: "leaf",
									identifier: "com.fluidframework.leaf.number",
									leafKind: "number",
								},
							],
						},
					},
				},
			};

			const decoded = decodeSchema(encoded);

			assert.equal(decoded.root.kind, NodeKind.Object);
			assert.equal(decoded.root.identifier, "myApp.User");

			if (decoded.root.kind === NodeKind.Object) {
				const nameField = decoded.root.fields.name;
				assert(nameField !== undefined);
				assert.equal(nameField.kind, FieldKind.Required);
				assert.deepEqual(nameField.allowedTypes, ["com.fluidframework.leaf.string"]);

				const ageField = decoded.root.fields.age;
				assert(ageField !== undefined);
				assert.equal(ageField.kind, FieldKind.Optional);
				assert.deepEqual(ageField.allowedTypes, ["com.fluidframework.leaf.number"]);
			}
		});

		it("decodes map schemas correctly", () => {
			const encoded: EncodedSchema = {
				version: 1,
				root: {
					kind: "map",
					identifier: "myApp.Config",
					allowedTypes: ["com.fluidframework.leaf.string"],
				},
			};

			const decoded = decodeSchema(encoded);

			assert.equal(decoded.root.kind, NodeKind.Map);
			assert.equal(decoded.root.identifier, "myApp.Config");
			if (decoded.root.kind === NodeKind.Map) {
				assert.deepEqual(decoded.root.allowedTypes, ["com.fluidframework.leaf.string"]);
			}
		});

		it("decodes array schemas correctly", () => {
			const encoded: EncodedSchema = {
				version: 1,
				root: {
					kind: "array",
					identifier: "myApp.Numbers",
					allowedTypes: ["com.fluidframework.leaf.number"],
				},
			};

			const decoded = decodeSchema(encoded);

			assert.equal(decoded.root.kind, NodeKind.Array);
			assert.equal(decoded.root.identifier, "myApp.Numbers");
			if (decoded.root.kind === NodeKind.Array) {
				assert.deepEqual(decoded.root.allowedTypes, ["com.fluidframework.leaf.number"]);
			}
		});

		it("populates definitions map", () => {
			const encoded: EncodedSchema = {
				version: 1,
				root: {
					kind: "object",
					identifier: "myApp.User",
					fields: {
						name: {
							kind: "required",
							allowedTypes: [
								{
									kind: "leaf",
									identifier: "com.fluidframework.leaf.string",
									leafKind: "string",
								},
							],
						},
					},
				},
			};

			const decoded = decodeSchema(encoded);

			// Should have the root and the inline leaf in definitions
			assert(decoded.definitions.has("myApp.User"));
			assert(decoded.definitions.has("com.fluidframework.leaf.string"));
		});

		it("throws on unsupported version", () => {
			const encoded = {
				version: 999,
				root: {
					kind: "leaf",
					identifier: "test",
					leafKind: "string",
				},
			} as unknown as EncodedSchema;

			assert.throws(() => decodeSchema(encoded), /Unsupported schema version/);
		});

		it("resolves string references in definitions", () => {
			const encoded: EncodedSchema = {
				version: 1,
				root: {
					kind: "object",
					identifier: "myApp.Container",
					fields: {
						item: {
							kind: "required",
							allowedTypes: ["myApp.Item"],
						},
					},
				},
				definitions: {
					"myApp.Item": {
						kind: "object",
						identifier: "myApp.Item",
						fields: {
							value: {
								kind: "required",
								allowedTypes: [
									{
										kind: "leaf",
										identifier: "com.fluidframework.leaf.string",
										leafKind: "string",
									},
								],
							},
						},
					},
				},
			};

			const decoded = decodeSchema(encoded);

			// Container should reference Item by string
			if (decoded.root.kind === NodeKind.Object) {
				const itemField = decoded.root.fields.item;
				assert(itemField !== undefined);
				assert.deepEqual(itemField.allowedTypes, ["myApp.Item"]);
			}

			// Item should be in definitions
			const itemSchema = decoded.definitions.get("myApp.Item");
			assert(itemSchema !== undefined);
			assert.equal(itemSchema.kind, NodeKind.Object);
		});
	});

	describe("roundtrip", () => {
		it("encodes and decodes leaf schema", () => {
			const encoded = encodeSchema(stringSchema);
			const decoded = decodeSchema(encoded);

			assert.equal(decoded.root.kind, NodeKind.Leaf);
			assert.equal(decoded.root.identifier, stringSchema.identifier);
			if (decoded.root.kind === NodeKind.Leaf) {
				assert.equal(decoded.root.leafKind, stringSchema.leafKind);
			}
		});

		it("encodes and decodes object schema", () => {
			const UserSchema = sf.object("RoundtripUser", {
				name: sf.string,
				age: sf.optional(sf.number),
			});

			const encoded = encodeSchema(UserSchema);
			const decoded = decodeSchema(encoded);

			assert.equal(decoded.root.kind, NodeKind.Object);
			assert.equal(decoded.root.identifier, "myApp.RoundtripUser");

			if (decoded.root.kind === NodeKind.Object) {
				assert.equal(Object.keys(decoded.root.fields).length, 2);

				const nameField = decoded.root.fields.name;
				assert(nameField !== undefined);
				assert.equal(nameField.kind, FieldKind.Required);

				const ageField = decoded.root.fields.age;
				assert(ageField !== undefined);
				assert.equal(ageField.kind, FieldKind.Optional);
			}
		});

		it("encodes and decodes map schema", () => {
			const ConfigMap = sf.map("RoundtripConfig", sf.string);

			const encoded = encodeSchema(ConfigMap);
			const decoded = decodeSchema(encoded);

			assert.equal(decoded.root.kind, NodeKind.Map);
			assert.equal(decoded.root.identifier, "myApp.RoundtripConfig");
		});

		it("preserves schema structure through JSON serialization", () => {
			const UserSchema = sf.object("JsonRoundtrip", {
				name: sf.string,
				active: sf.boolean,
			});

			const encoded = encodeSchema(UserSchema);
			const json = JSON.stringify(encoded);
			const parsed = JSON.parse(json) as EncodedSchema;
			const decoded = decodeSchema(parsed);

			assert.equal(decoded.root.kind, NodeKind.Object);
			assert.equal(decoded.root.identifier, "myApp.JsonRoundtrip");

			if (decoded.root.kind === NodeKind.Object) {
				assert(decoded.root.fields.name !== undefined);
				assert(decoded.root.fields.active !== undefined);
			}
		});
	});

	describe("edge cases", () => {
		it("handles empty object schema", () => {
			const EmptySchema = sf.object("Empty", {});

			const encoded = encodeSchema(EmptySchema);
			const decoded = decodeSchema(encoded);

			assert.equal(decoded.root.kind, NodeKind.Object);
			if (decoded.root.kind === NodeKind.Object) {
				assert.equal(Object.keys(decoded.root.fields).length, 0);
			}
		});

		it("handles schema with all leaf types", () => {
			const AllTypesSchema = sf.object("AllTypes", {
				str: sf.string,
				num: sf.number,
				bool: sf.boolean,
				nul: sf.null,
				handle: sf.handle,
			});

			const encoded = encodeSchema(AllTypesSchema);
			const decoded = decodeSchema(encoded);

			assert.equal(decoded.root.kind, NodeKind.Object);
			if (decoded.root.kind === NodeKind.Object) {
				assert.equal(Object.keys(decoded.root.fields).length, 5);
			}
		});
	});

	describe("checkSchemaCompatibility", () => {
		describe("canInitialize", () => {
			it("returns canInitialize=true when stored is undefined", () => {
				const UserSchema = sf.object("User", {
					name: sf.string,
				});

				const status = checkSchemaCompatibility(undefined, UserSchema);

				assert.equal(status.canInitialize, true);
				assert.equal(status.isEquivalent, false);
				assert.equal(status.canView, false);
				assert.equal(status.canUpgrade, false);
			});

			it("returns canInitialize=false when stored schema exists", () => {
				const UserSchema = sf.object("User2", {
					name: sf.string,
				});

				const stored = encodeSchema(UserSchema);
				const status = checkSchemaCompatibility(stored, UserSchema);

				assert.equal(status.canInitialize, false);
			});
		});

		describe("isEquivalent", () => {
			it("returns isEquivalent=true for identical object schemas", () => {
				const UserSchema = sf.object("User3", {
					name: sf.string,
					age: sf.number,
				});

				const stored = encodeSchema(UserSchema);
				const status = checkSchemaCompatibility(stored, UserSchema);

				assert.equal(status.isEquivalent, true);
				assert.equal(status.canView, true);
				assert.equal(status.canUpgrade, true);
			});

			it("returns isEquivalent=true for identical leaf schemas", () => {
				const stored = encodeSchema(stringSchema);
				const status = checkSchemaCompatibility(stored, stringSchema);

				assert.equal(status.isEquivalent, true);
				assert.equal(status.canView, true);
				assert.equal(status.canUpgrade, true);
			});

			it("returns isEquivalent=true for identical map schemas", () => {
				const ConfigMap = sf.map("Config2", sf.string);

				const stored = encodeSchema(ConfigMap);
				const status = checkSchemaCompatibility(stored, ConfigMap);

				assert.equal(status.isEquivalent, true);
				assert.equal(status.canView, true);
				assert.equal(status.canUpgrade, true);
			});

			it("returns isEquivalent=false when fields differ", () => {
				const UserV1 = sf.object("UserEquiv1", {
					name: sf.string,
				});
				const UserV2 = sf.object("UserEquiv2", {
					name: sf.string,
					age: sf.number,
				});

				const stored = encodeSchema(UserV1);
				const status = checkSchemaCompatibility(stored, UserV2);

				assert.equal(status.isEquivalent, false);
			});

			it("returns isEquivalent=false when field kinds differ (required vs optional)", () => {
				const UserReq = sf.object("UserReq", {
					name: sf.string,
				});
				const UserOpt = sf.object("UserOpt", {
					name: sf.optional(sf.string),
				});

				const stored = encodeSchema(UserReq);
				const status = checkSchemaCompatibility(stored, UserOpt);

				assert.equal(status.isEquivalent, false);
			});
		});

		describe("canView - object schemas", () => {
			it("{a: string} view on {a: string} stored: canView=true", () => {
				const Schema = sf.object("ViewTest1", {
					a: sf.string,
				});

				const stored = encodeSchema(Schema);
				const status = checkSchemaCompatibility(stored, Schema);

				assert.equal(status.canView, true);
			});

			it("{a: string} view on {a: string, b?: number} stored: canView=true (view is subset)", () => {
				const StoredSchema = sf.object("ViewTest2a", {
					a: sf.string,
					b: sf.optional(sf.number),
				});
				const ViewSchema = sf.object("ViewTest2b", {
					a: sf.string,
				});

				const stored = encodeSchema(StoredSchema);
				const status = checkSchemaCompatibility(stored, ViewSchema);

				assert.equal(status.canView, true);
			});

			it("{a: string, b?: number} view on {a: string} stored: canView=true (optional field missing is OK)", () => {
				const StoredSchema = sf.object("ViewTest3a", {
					a: sf.string,
				});
				const ViewSchema = sf.object("ViewTest3b", {
					a: sf.string,
					b: sf.optional(sf.number),
				});

				const stored = encodeSchema(StoredSchema);
				const status = checkSchemaCompatibility(stored, ViewSchema);

				assert.equal(status.canView, true);
			});

			it("{a: string, b: number} view on {a: string} stored: canView=false (required field missing)", () => {
				const StoredSchema = sf.object("ViewTest4a", {
					a: sf.string,
				});
				const ViewSchema = sf.object("ViewTest4b", {
					a: sf.string,
					b: sf.number,
				});

				const stored = encodeSchema(StoredSchema);
				const status = checkSchemaCompatibility(stored, ViewSchema);

				assert.equal(status.canView, false);
			});

			it("{a: number} view on {a: string} stored: canView=false (type changed)", () => {
				const StoredSchema = sf.object("ViewTest5a", {
					a: sf.string,
				});
				const ViewSchema = sf.object("ViewTest5b", {
					a: sf.number,
				});

				const stored = encodeSchema(StoredSchema);
				const status = checkSchemaCompatibility(stored, ViewSchema);

				assert.equal(status.canView, false);
			});

			it("{b: string} view on {a: string} stored: canView=false (field renamed)", () => {
				const StoredSchema = sf.object("ViewTest6a", {
					a: sf.string,
				});
				const ViewSchema = sf.object("ViewTest6b", {
					b: sf.string,
				});

				const stored = encodeSchema(StoredSchema);
				const status = checkSchemaCompatibility(stored, ViewSchema);

				assert.equal(status.canView, false);
			});

			it("{a: string} view on {a: string, b: string} stored: canView=true (ignoring extra stored field)", () => {
				const StoredSchema = sf.object("ViewTest7a", {
					a: sf.string,
					b: sf.string,
				});
				const ViewSchema = sf.object("ViewTest7b", {
					a: sf.string,
				});

				const stored = encodeSchema(StoredSchema);
				const status = checkSchemaCompatibility(stored, ViewSchema);

				assert.equal(status.canView, true);
			});
		});

		describe("canUpgrade - object schemas", () => {
			it("{a: string} to {a: string}: canUpgrade=true (identical)", () => {
				const Schema = sf.object("UpgradeTest1", {
					a: sf.string,
				});

				const stored = encodeSchema(Schema);
				const status = checkSchemaCompatibility(stored, Schema);

				assert.equal(status.canUpgrade, true);
			});

			it("{a: string} to {a: string, b?: number}: canUpgrade=true (adding optional field)", () => {
				const StoredSchema = sf.object("UpgradeTest2a", {
					a: sf.string,
				});
				const ViewSchema = sf.object("UpgradeTest2b", {
					a: sf.string,
					b: sf.optional(sf.number),
				});

				const stored = encodeSchema(StoredSchema);
				const status = checkSchemaCompatibility(stored, ViewSchema);

				assert.equal(status.canUpgrade, true);
			});

			it("{a: string, b?: number} to {a: string}: canUpgrade=false (removing field)", () => {
				const StoredSchema = sf.object("UpgradeTest3a", {
					a: sf.string,
					b: sf.optional(sf.number),
				});
				const ViewSchema = sf.object("UpgradeTest3b", {
					a: sf.string,
				});

				const stored = encodeSchema(StoredSchema);
				const status = checkSchemaCompatibility(stored, ViewSchema);

				assert.equal(status.canUpgrade, false);
			});

			it("{a: string} to {a: number}: canUpgrade=false (type changed)", () => {
				const StoredSchema = sf.object("UpgradeTest4a", {
					a: sf.string,
				});
				const ViewSchema = sf.object("UpgradeTest4b", {
					a: sf.number,
				});

				const stored = encodeSchema(StoredSchema);
				const status = checkSchemaCompatibility(stored, ViewSchema);

				assert.equal(status.canUpgrade, false);
			});

			it("{a: string} to {b: string}: canUpgrade=false (field renamed)", () => {
				const StoredSchema = sf.object("UpgradeTest5a", {
					a: sf.string,
				});
				const ViewSchema = sf.object("UpgradeTest5b", {
					b: sf.string,
				});

				const stored = encodeSchema(StoredSchema);
				const status = checkSchemaCompatibility(stored, ViewSchema);

				assert.equal(status.canUpgrade, false);
			});

			it("{a: string, b: string} to {a: string}: canUpgrade=false (removing required field)", () => {
				const StoredSchema = sf.object("UpgradeTest6a", {
					a: sf.string,
					b: sf.string,
				});
				const ViewSchema = sf.object("UpgradeTest6b", {
					a: sf.string,
				});

				const stored = encodeSchema(StoredSchema);
				const status = checkSchemaCompatibility(stored, ViewSchema);

				assert.equal(status.canUpgrade, false);
			});

			it("{a: string} to {a: string, b: number}: canUpgrade=false (adding required field)", () => {
				const StoredSchema = sf.object("UpgradeTest7a", {
					a: sf.string,
				});
				const ViewSchema = sf.object("UpgradeTest7b", {
					a: sf.string,
					b: sf.number,
				});

				const stored = encodeSchema(StoredSchema);
				const status = checkSchemaCompatibility(stored, ViewSchema);

				assert.equal(status.canUpgrade, false);
			});

			it("{a: string} to {a?: string}: canUpgrade=true (making required field optional)", () => {
				const StoredSchema = sf.object("UpgradeTest8a", {
					a: sf.string,
				});
				const ViewSchema = sf.object("UpgradeTest8b", {
					a: sf.optional(sf.string),
				});

				const stored = encodeSchema(StoredSchema);
				const status = checkSchemaCompatibility(stored, ViewSchema);

				assert.equal(status.canUpgrade, true);
			});

			it("{a?: string} to {a: string}: canUpgrade=false (making optional field required)", () => {
				const StoredSchema = sf.object("UpgradeTest9a", {
					a: sf.optional(sf.string),
				});
				const ViewSchema = sf.object("UpgradeTest9b", {
					a: sf.string,
				});

				const stored = encodeSchema(StoredSchema);
				const status = checkSchemaCompatibility(stored, ViewSchema);

				assert.equal(status.canUpgrade, false);
			});
		});

		describe("canView/canUpgrade - leaf schemas", () => {
			it("string to string: both true", () => {
				const stored = encodeSchema(stringSchema);
				const status = checkSchemaCompatibility(stored, stringSchema);

				assert.equal(status.canView, true);
				assert.equal(status.canUpgrade, true);
			});

			it("string to number: both false", () => {
				const stored = encodeSchema(stringSchema);
				const status = checkSchemaCompatibility(stored, numberSchema);

				assert.equal(status.canView, false);
				assert.equal(status.canUpgrade, false);
			});

			it("boolean to boolean: both true", () => {
				const stored = encodeSchema(booleanSchema);
				const status = checkSchemaCompatibility(stored, booleanSchema);

				assert.equal(status.canView, true);
				assert.equal(status.canUpgrade, true);
			});
		});

		describe("canView/canUpgrade - map schemas", () => {
			it("map<string> to map<string>: both true", () => {
				const MapSchema = sf.map("MapTest1", sf.string);

				const stored = encodeSchema(MapSchema);
				const status = checkSchemaCompatibility(stored, MapSchema);

				assert.equal(status.canView, true);
				assert.equal(status.canUpgrade, true);
			});

			it("map<string> to map<number>: both false (incompatible value types)", () => {
				const MapString = sf.map("MapTest2a", sf.string);
				const MapNumber = sf.map("MapTest2b", sf.number);

				const stored = encodeSchema(MapString);
				const status = checkSchemaCompatibility(stored, MapNumber);

				assert.equal(status.canView, false);
				assert.equal(status.canUpgrade, false);
			});

			it("map<string> to map<string | number>: both true (view accepts superset)", () => {
				const MapString = sf.map("MapTest3a", sf.string);
				const MapStringOrNumber = sf.map("MapTest3b", [sf.string, sf.number]);

				const stored = encodeSchema(MapString);
				const status = checkSchemaCompatibility(stored, MapStringOrNumber);

				assert.equal(status.canView, true);
				assert.equal(status.canUpgrade, true);
			});

			it("map<string | number> to map<string>: canView=false, canUpgrade=false (view is subset)", () => {
				const MapStringOrNumber = sf.map("MapTest4a", [sf.string, sf.number]);
				const MapString = sf.map("MapTest4b", sf.string);

				const stored = encodeSchema(MapStringOrNumber);
				const status = checkSchemaCompatibility(stored, MapString);

				assert.equal(status.canView, false);
				assert.equal(status.canUpgrade, false);
			});
		});

		describe("canView/canUpgrade - schema kind changes", () => {
			it("object to leaf: both false", () => {
				const ObjectSchema = sf.object("KindTest1", {
					a: sf.string,
				});

				const stored = encodeSchema(ObjectSchema);
				const status = checkSchemaCompatibility(stored, stringSchema);

				assert.equal(status.canView, false);
				assert.equal(status.canUpgrade, false);
			});

			it("leaf to object: both false", () => {
				const ObjectSchema = sf.object("KindTest2", {
					a: sf.string,
				});

				const stored = encodeSchema(stringSchema);
				const status = checkSchemaCompatibility(stored, ObjectSchema);

				assert.equal(status.canView, false);
				assert.equal(status.canUpgrade, false);
			});

			it("map to object: both false", () => {
				const MapSchema = sf.map("KindTest3a", sf.string);
				const ObjectSchema = sf.object("KindTest3b", {
					a: sf.string,
				});

				const stored = encodeSchema(MapSchema);
				const status = checkSchemaCompatibility(stored, ObjectSchema);

				assert.equal(status.canView, false);
				assert.equal(status.canUpgrade, false);
			});
		});

		describe("compatibility matrix examples from spec", () => {
			it("{a: string} stored, {a: string} view: canView=true, canUpgrade=true (identical)", () => {
				const Stored = sf.object("Matrix1a", { a: sf.string });
				const View = sf.object("Matrix1b", { a: sf.string });

				const stored = encodeSchema(Stored);
				const status = checkSchemaCompatibility(stored, View);

				assert.equal(status.canView, true);
				assert.equal(status.canUpgrade, true);
			});

			it("{a: string} stored, {a: string, b?: number} view: canView=true, canUpgrade=true", () => {
				const Stored = sf.object("Matrix2a", { a: sf.string });
				const View = sf.object("Matrix2b", { a: sf.string, b: sf.optional(sf.number) });

				const stored = encodeSchema(Stored);
				const status = checkSchemaCompatibility(stored, View);

				assert.equal(status.canView, true);
				assert.equal(status.canUpgrade, true);
			});

			it("{a: string, b?: number} stored, {a: string} view: canView=true, canUpgrade=false", () => {
				const Stored = sf.object("Matrix3a", { a: sf.string, b: sf.optional(sf.number) });
				const View = sf.object("Matrix3b", { a: sf.string });

				const stored = encodeSchema(Stored);
				const status = checkSchemaCompatibility(stored, View);

				assert.equal(status.canView, true);
				assert.equal(status.canUpgrade, false);
			});

			it("{a: string} stored, {a: number} view: canView=false, canUpgrade=false (type changed)", () => {
				const Stored = sf.object("Matrix4a", { a: sf.string });
				const View = sf.object("Matrix4b", { a: sf.number });

				const stored = encodeSchema(Stored);
				const status = checkSchemaCompatibility(stored, View);

				assert.equal(status.canView, false);
				assert.equal(status.canUpgrade, false);
			});

			it("{a: string} stored, {b: string} view: canView=false, canUpgrade=false (field renamed)", () => {
				const Stored = sf.object("Matrix5a", { a: sf.string });
				const View = sf.object("Matrix5b", { b: sf.string });

				const stored = encodeSchema(Stored);
				const status = checkSchemaCompatibility(stored, View);

				assert.equal(status.canView, false);
				assert.equal(status.canUpgrade, false);
			});

			it("{a: string, b: string} stored, {a: string} view: canView=true, canUpgrade=false (removing required field)", () => {
				const Stored = sf.object("Matrix6a", { a: sf.string, b: sf.string });
				const View = sf.object("Matrix6b", { a: sf.string });

				const stored = encodeSchema(Stored);
				const status = checkSchemaCompatibility(stored, View);

				assert.equal(status.canView, true);
				assert.equal(status.canUpgrade, false);
			});
		});
	});
});
