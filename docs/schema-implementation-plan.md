# Schema Package Implementation Plan

> **Related Documents**:
> - [Schema Extraction Plan](./schema-extraction-plan.md) - Architecture and scope
> - [Schema Map Design](./schema-map-design.md) - SharedMap detailed design
> - [Schema DDS Integration](./schema-dds-integration.md) - General patterns
> - [Open Items](./schema-open-items.md) - Risks and concerns

This document provides a detailed, risk-mitigated implementation plan for creating `@fluidframework/schema` and integrating it with SharedMap.

---

## Table of Contents

1. [Implementation Strategy](#1-implementation-strategy)
2. [Phase 1: Schema Package Foundation](#2-phase-1-schema-package-foundation)
3. [Phase 2: Schema Encoding & Compatibility](#3-phase-2-schema-encoding--compatibility)
4. [Phase 3: View Implementation](#4-phase-3-view-implementation)
5. [Phase 4: SharedMap Integration](#5-phase-4-sharedmap-integration)
6. [Phase 5: End-to-End Testing](#6-phase-5-end-to-end-testing)
7. [Risk Register](#7-risk-register)
8. [Success Criteria](#8-success-criteria)

---

## 1. Implementation Strategy

### 1.1 Core Principles

| Principle | Rationale |
|-----------|-----------|
| **Validate early** | Each phase has a "checkpoint" to verify assumptions before proceeding |
| **Isolate risk** | Extract Tree code in isolation, test before integrating |
| **Incremental value** | Each phase delivers testable functionality |
| **Backward compatible** | SharedMap changes must not break existing documents |

### 1.2 Phase Overview

```
Phase 1: Schema Package Foundation (Week 1)
    │
    ├─→ Checkpoint: SchemaFactory creates schemas, types work
    │
Phase 2: Schema Encoding & Compatibility (Week 1-2)
    │
    ├─→ Checkpoint: encode/decode round-trips, compatibility checks work
    │
Phase 3: View Implementation (Week 2)
    │
    ├─→ Checkpoint: Views work with mock storage
    │
Phase 4: SharedMap Integration (Week 2-3)
    │
    ├─→ Checkpoint: viewWith() works, schema persists
    │
Phase 5: End-to-End Testing (Week 3)
    │
    └─→ Checkpoint: All scenarios pass, ready for review
```

### 1.3 Key Decision Points

| Decision Point | Trigger | Options |
|----------------|---------|---------|
| **Copy vs. Import from Tree** | Phase 1 extraction | Copy (preferred) or create adapter |
| **Encoding format** | Phase 2 design | Match Tree format or simplified |
| **Compatibility algorithm** | Phase 2 design | Full Tree algorithm or simplified |
| **Handle support** | Phase 1 extraction | Include or defer |

---

## 2. Phase 1: Schema Package Foundation

**Goal**: Create `@fluidframework/schema` with working `SchemaFactory` and type system.

### 2.1 Tasks

#### Task 1.1: Create Package Scaffold
```
packages/dds/schema/
├── package.json
├── tsconfig.json
├── api-extractor.json
├── src/
│   └── index.ts
└── src/test/
    └── schemaFactory.spec.ts
```

**package.json** key fields:
```json
{
  "name": "@fluidframework/schema",
  "version": "2.0.0",
  "main": "lib/index.js",
  "types": "lib/index.d.ts",
  "dependencies": {
    "@fluidframework/core-interfaces": "workspace:~",
    "@fluidframework/core-utils": "workspace:~"
  }
}
```

#### Task 1.2: Extract Core Types

Copy from `packages/dds/tree/src/simple-tree/`:

| Source File | Target | Changes |
|-------------|--------|---------|
| `core/treeNodeSchema.ts` | `core/nodeSchema.ts` | Rename `TreeNodeSchema` → `NodeSchema` |
| `fieldSchema.ts` | `core/fieldSchema.ts` | Remove `Identifier` kind |
| `leafNodeSchema.ts` | `core/leafSchema.ts` | Keep as-is |
| `node-kinds/*.ts` | `nodeKinds/*.ts` | Keep structure |

**Risk Mitigation**: Copy files individually, run `tsc` after each to catch dependency issues early.

#### Task 1.3: Extract SchemaFactory

Copy `schemaFactory.ts` with modifications:

```typescript
// packages/dds/schema/src/schemaFactory.ts

export class SchemaFactory {
  public constructor(public readonly scope: string) {}

  // Leaf types
  public readonly string = stringSchema;
  public readonly number = numberSchema;
  public readonly boolean = booleanSchema;
  public readonly null = nullSchema;
  public readonly handle = handleSchema;

  // Object schema
  public object<const Name extends string, const T extends RestrictiveStringRecord<ImplicitFieldSchema>>(
    name: Name,
    fields: T,
  ): ObjectNodeSchema<...> { ... }

  // Map schema
  public map<const Name extends string, const T extends ImplicitAllowedTypes>(
    name: Name,
    allowedTypes: T,
  ): MapNodeSchema<...> { ... }

  // Optional field wrapper
  public optional<const T extends ImplicitAllowedTypes>(t: T): FieldSchema<FieldKind.Optional, T> { ... }

  // Required field wrapper
  public required<const T extends ImplicitAllowedTypes>(t: T): FieldSchema<FieldKind.Required, T> { ... }
}
```

**Key Exclusions** (defer to avoid complexity):
- `SchemaFactory.identifier` - coupled to Tree's ID generation
- `SchemaFactoryAlpha` - alpha features can come later
- Recursive schema (`sf.lazy()`) - add in later phase

#### Task 1.4: Extract Type Inference Utilities

Create `types/inference.ts`:

```typescript
/**
 * Infers the TypeScript type from a NodeSchema.
 * For ObjectNodeSchema: { field1: T1, field2?: T2, ... }
 * For MapNodeSchema: Map operations with value type
 * For LeafSchema: The primitive type
 */
export type NodeFromSchema<T extends NodeSchema> =
  T extends ObjectNodeSchema<infer Name, infer Fields> ? InferObjectType<Fields> :
  T extends MapNodeSchema<infer Name, infer ValueSchema> ? InferMapType<ValueSchema> :
  T extends LeafNodeSchema<infer Kind> ? LeafValueType<Kind> :
  never;

/**
 * Infers field types from an ObjectNodeSchema.
 */
export type InferFields<T extends ObjectNodeSchema> = T extends ObjectNodeSchema<any, infer Fields> ? Fields : never;

/**
 * Infers value schema from a MapNodeSchema.
 */
export type InferValueSchema<T extends MapNodeSchema> = T extends MapNodeSchema<any, infer V> ? V : never;
```

#### Task 1.5: Write Foundation Tests

```typescript
// packages/dds/schema/src/test/schemaFactory.spec.ts

describe("SchemaFactory", () => {
  const sf = new SchemaFactory("test");

  it("creates leaf schemas", () => {
    expect(sf.string).toBeDefined();
    expect(sf.number).toBeDefined();
    expect(sf.boolean).toBeDefined();
  });

  it("creates object schemas", () => {
    class Person extends sf.object("Person", {
      name: sf.string,
      age: sf.number,
    }) {}

    expect(Person.identifier).toBe("test.Person");
    expect(Person.fields).toHaveProperty("name");
    expect(Person.fields).toHaveProperty("age");
  });

  it("creates map schemas", () => {
    const StringMap = sf.map("StringMap", sf.string);
    expect(StringMap.identifier).toBe("test.StringMap");
  });

  it("infers correct types", () => {
    class User extends sf.object("User", {
      name: sf.string,
      email: sf.optional(sf.string),
    }) {}

    // Type test - this should compile
    type UserType = NodeFromSchema<typeof User>;
    const user: UserType = { name: "Alice" };  // email optional
  });
});
```

### 2.2 Checkpoint 1

**Criteria**:
- [ ] `pnpm build` succeeds
- [ ] `pnpm test` passes all foundation tests
- [ ] `SchemaFactory` creates object and map schemas
- [ ] Type inference works (compile-time verification)
- [ ] No circular dependencies with Tree package

**Risk Check**: If Tree dependencies leak in, STOP and evaluate:
- Option A: Copy more utilities
- Option B: Create minimal adapter layer

---

## 3. Phase 2: Schema Encoding & Compatibility

**Goal**: Implement `encodeSchema()`, `decodeSchema()`, and `checkSchemaCompatibility()`.

### 3.1 Tasks

#### Task 2.1: Define Encoding Format

The encoding format must be:
1. **Self-describing** - Can decode without external schema
2. **Deterministic** - Same schema always produces same encoding
3. **Compact** - Reasonable size for `.attributes` blob
4. **Extensible** - Can add fields without breaking old decoders

```typescript
// packages/dds/schema/src/serialization/format.ts

/**
 * Encoded schema format (JSON-compatible).
 */
export interface EncodedSchema {
  /** Format version for forward compatibility */
  version: 1;
  /** The root schema definition */
  root: EncodedNodeSchema;
  /** All referenced schemas by identifier */
  definitions?: Record<string, EncodedNodeSchema>;
}

export type EncodedNodeSchema =
  | EncodedObjectSchema
  | EncodedMapSchema
  | EncodedLeafSchema;

export interface EncodedObjectSchema {
  kind: "object";
  identifier: string;
  fields: Record<string, EncodedFieldSchema>;
}

export interface EncodedMapSchema {
  kind: "map";
  identifier: string;
  valueSchema: EncodedNodeSchema | string;  // string = reference to definitions
}

export interface EncodedLeafSchema {
  kind: "leaf";
  leafKind: "string" | "number" | "boolean" | "null" | "handle";
}

export interface EncodedFieldSchema {
  kind: "required" | "optional";
  schema: EncodedNodeSchema | string;  // string = reference to definitions
}
```

**Example Encoding**:
```typescript
// Schema:
class UserProfile extends sf.object("UserProfile", {
  name: sf.string,
  age: sf.optional(sf.number),
}) {}

// Encoded:
{
  "version": 1,
  "root": {
    "kind": "object",
    "identifier": "myApp.UserProfile",
    "fields": {
      "name": { "kind": "required", "schema": { "kind": "leaf", "leafKind": "string" } },
      "age": { "kind": "optional", "schema": { "kind": "leaf", "leafKind": "number" } }
    }
  }
}
```

#### Task 2.2: Implement Encoder

```typescript
// packages/dds/schema/src/serialization/encode.ts

export function encodeSchema(schema: NodeSchema): EncodedSchema {
  const definitions: Record<string, EncodedNodeSchema> = {};
  const root = encodeNodeSchema(schema, definitions);

  return {
    version: 1,
    root,
    definitions: Object.keys(definitions).length > 0 ? definitions : undefined,
  };
}

function encodeNodeSchema(
  schema: NodeSchema,
  definitions: Record<string, EncodedNodeSchema>,
): EncodedNodeSchema {
  if (isLeafSchema(schema)) {
    return { kind: "leaf", leafKind: schema.leafKind };
  }

  if (isObjectSchema(schema)) {
    // Check if already encoded (for recursive schemas)
    if (definitions[schema.identifier]) {
      return schema.identifier;  // Reference
    }

    const encoded: EncodedObjectSchema = {
      kind: "object",
      identifier: schema.identifier,
      fields: {},
    };

    // Add to definitions first (for recursion)
    definitions[schema.identifier] = encoded;

    for (const [name, fieldSchema] of Object.entries(schema.fields)) {
      encoded.fields[name] = encodeFieldSchema(fieldSchema, definitions);
    }

    return encoded;
  }

  if (isMapSchema(schema)) {
    return {
      kind: "map",
      identifier: schema.identifier,
      valueSchema: encodeNodeSchema(schema.valueSchema, definitions),
    };
  }

  throw new Error(`Unknown schema kind`);
}
```

#### Task 2.3: Implement Decoder

```typescript
// packages/dds/schema/src/serialization/decode.ts

export function decodeSchema(encoded: EncodedSchema): SimpleNodeSchema {
  if (encoded.version !== 1) {
    throw new Error(`Unknown schema version: ${encoded.version}`);
  }

  const definitions = encoded.definitions ?? {};
  return decodeNodeSchema(encoded.root, definitions);
}

function decodeNodeSchema(
  encoded: EncodedNodeSchema | string,
  definitions: Record<string, EncodedNodeSchema>,
): SimpleNodeSchema {
  // Handle references
  if (typeof encoded === "string") {
    const def = definitions[encoded];
    if (!def) throw new Error(`Unknown schema reference: ${encoded}`);
    return decodeNodeSchema(def, definitions);
  }

  switch (encoded.kind) {
    case "leaf":
      return { kind: "leaf", leafKind: encoded.leafKind };

    case "object":
      return {
        kind: "object",
        identifier: encoded.identifier,
        fields: Object.fromEntries(
          Object.entries(encoded.fields).map(([name, field]) => [
            name,
            decodeFieldSchema(field, definitions),
          ])
        ),
      };

    case "map":
      return {
        kind: "map",
        identifier: encoded.identifier,
        valueSchema: decodeNodeSchema(encoded.valueSchema, definitions),
      };
  }
}
```

#### Task 2.4: Implement Compatibility Checker

```typescript
// packages/dds/schema/src/serialization/compatibility.ts

export interface SchemaCompatibilityStatus {
  /** True if schemas are functionally identical */
  isEquivalent: boolean;
  /** True if the view can read all stored data */
  canView: boolean;
  /** True if stored schema can be upgraded to view schema */
  canUpgrade: boolean;
  /** True if no stored schema exists yet */
  canInitialize: boolean;
}

/**
 * Check compatibility between stored schema and view schema.
 */
export function checkSchemaCompatibility(
  stored: EncodedSchema | undefined,
  view: NodeSchema,
): SchemaCompatibilityStatus {
  // No stored schema - can initialize
  if (stored === undefined) {
    return {
      isEquivalent: true,
      canView: true,
      canUpgrade: false,
      canInitialize: true,
    };
  }

  const viewEncoded = encodeSchema(view);

  // Check if view can read stored data
  const canView = checkCanView(stored, viewEncoded);

  // Check if stored can be upgraded to view
  const canUpgrade = checkCanUpgrade(stored, viewEncoded);

  // Equivalent if both directions work
  const isEquivalent = canView && schemasEqual(stored, viewEncoded);

  return {
    isEquivalent,
    canView,
    canUpgrade,
    canInitialize: false,
  };
}

/**
 * View can read stored data if:
 * - View schema is a superset of stored schema (has all fields stored has)
 * - View field types are compatible with stored field types
 */
function checkCanView(stored: EncodedSchema, view: EncodedSchema): boolean {
  return checkSchemaSuperset(view.root, stored.root, stored.definitions ?? {}, view.definitions ?? {});
}

/**
 * Can upgrade if:
 * - All new fields in view are optional
 * - No existing fields changed type
 */
function checkCanUpgrade(stored: EncodedSchema, view: EncodedSchema): boolean {
  // View adds optional fields only
  return checkSchemaExtension(stored.root, view.root, stored.definitions ?? {}, view.definitions ?? {});
}
```

#### Task 2.5: Write Encoding Tests

```typescript
// packages/dds/schema/src/test/serialization.spec.ts

describe("Schema Serialization", () => {
  const sf = new SchemaFactory("test");

  describe("encodeSchema", () => {
    it("encodes leaf schemas", () => {
      const encoded = encodeSchema(sf.string);
      expect(encoded).toEqual({
        version: 1,
        root: { kind: "leaf", leafKind: "string" },
      });
    });

    it("encodes object schemas", () => {
      class Person extends sf.object("Person", {
        name: sf.string,
        age: sf.optional(sf.number),
      }) {}

      const encoded = encodeSchema(Person);
      expect(encoded.root.kind).toBe("object");
      expect(encoded.root.identifier).toBe("test.Person");
      expect(encoded.root.fields.name.kind).toBe("required");
      expect(encoded.root.fields.age.kind).toBe("optional");
    });

    it("round-trips through decode", () => {
      class User extends sf.object("User", { name: sf.string }) {}
      const encoded = encodeSchema(User);
      const decoded = decodeSchema(encoded);
      expect(decoded.kind).toBe("object");
      expect(decoded.identifier).toBe("test.User");
    });
  });

  describe("checkSchemaCompatibility", () => {
    it("returns canInitialize for undefined stored", () => {
      class Schema extends sf.object("S", { x: sf.string }) {}
      const result = checkSchemaCompatibility(undefined, Schema);
      expect(result.canInitialize).toBe(true);
      expect(result.canView).toBe(true);
    });

    it("returns canView for identical schemas", () => {
      class Schema extends sf.object("S", { x: sf.string }) {}
      const encoded = encodeSchema(Schema);
      const result = checkSchemaCompatibility(encoded, Schema);
      expect(result.canView).toBe(true);
      expect(result.isEquivalent).toBe(true);
    });

    it("returns canUpgrade when adding optional field", () => {
      class V1 extends sf.object("S", { x: sf.string }) {}
      class V2 extends sf.object("S", { x: sf.string, y: sf.optional(sf.number) }) {}
      const stored = encodeSchema(V1);
      const result = checkSchemaCompatibility(stored, V2);
      expect(result.canView).toBe(false);  // V2 expects field V1 doesn't have
      expect(result.canUpgrade).toBe(true);
    });

    it("returns incompatible for type change", () => {
      class V1 extends sf.object("S", { x: sf.string }) {}
      class V2 extends sf.object("S", { x: sf.number }) {}  // Changed type!
      const stored = encodeSchema(V1);
      const result = checkSchemaCompatibility(stored, V2);
      expect(result.canView).toBe(false);
      expect(result.canUpgrade).toBe(false);
    });
  });
});
```

### 3.2 Checkpoint 2

**Criteria**:
- [ ] `encodeSchema()` produces valid JSON
- [ ] `decodeSchema(encodeSchema(s))` round-trips correctly
- [ ] `checkSchemaCompatibility()` handles all cases in compatibility matrix
- [ ] Encoding format is documented

**Risk Check**: If compatibility algorithm is too complex:
- Option A: Simplify to exact-match only (upgrade requires explicit migration)
- Option B: Copy Tree's algorithm directly

---

## 4. Phase 3: View Implementation

**Goal**: Implement `SchematizedObjectView` and `SchematizedMapView` that work with `ISchemaStorage`.

### 4.1 Tasks

#### Task 3.1: Define Storage Interfaces

```typescript
// packages/dds/schema/src/storage/schemaStorage.ts

/**
 * Result of getting a field from storage.
 * DDS decides whether each field is a value or nested storage.
 */
export type StorageResult =
  | { type: "value"; value: unknown }
  | { type: "storage"; storage: ISchemaStorage };

/**
 * Unified storage interface that all DDSes implement.
 */
export interface ISchemaStorage {
  getField(key: string, fieldSchema: NodeSchema): StorageResult | undefined;
  setField(key: string, fieldSchema: NodeSchema, value: unknown): void;
  deleteField(key: string): boolean;
  hasField(key: string): boolean;
  keys?(): IterableIterator<string>;
  readonly size?: number;
}

/**
 * Schema persistence for Modality 2.
 */
export interface ISchemaPersistence {
  getPersistedSchema(): EncodedSchema | undefined;
  setPersistedSchema(schema: EncodedSchema): void;
  upgradePersistedSchema(schema: EncodedSchema): void;
}
```

#### Task 3.2: Implement Validation

```typescript
// packages/dds/schema/src/validation/validate.ts

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  path: string;
  message: string;
  expected: string;
  actual: string;
}

/**
 * Validate data against a schema.
 */
export function validateData(schema: NodeSchema, data: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  validateNode(schema, data, "", errors);
  return { valid: errors.length === 0, errors };
}

function validateNode(
  schema: NodeSchema,
  data: unknown,
  path: string,
  errors: ValidationError[],
): void {
  if (isLeafSchema(schema)) {
    validateLeaf(schema, data, path, errors);
  } else if (isObjectSchema(schema)) {
    validateObject(schema, data, path, errors);
  } else if (isMapSchema(schema)) {
    validateMap(schema, data, path, errors);
  }
}

function validateLeaf(
  schema: LeafNodeSchema,
  data: unknown,
  path: string,
  errors: ValidationError[],
): void {
  const expectedType = schema.leafKind;
  const actualType = typeof data;

  switch (expectedType) {
    case "string":
      if (typeof data !== "string") {
        errors.push({ path, message: "Expected string", expected: "string", actual: actualType });
      }
      break;
    case "number":
      if (typeof data !== "number") {
        errors.push({ path, message: "Expected number", expected: "number", actual: actualType });
      }
      break;
    case "boolean":
      if (typeof data !== "boolean") {
        errors.push({ path, message: "Expected boolean", expected: "boolean", actual: actualType });
      }
      break;
    case "null":
      if (data !== null) {
        errors.push({ path, message: "Expected null", expected: "null", actual: actualType });
      }
      break;
    case "handle":
      // Handle validation - check for IFluidHandle interface
      if (!isFluidHandle(data)) {
        errors.push({ path, message: "Expected IFluidHandle", expected: "handle", actual: actualType });
      }
      break;
  }
}

function validateObject(
  schema: ObjectNodeSchema,
  data: unknown,
  path: string,
  errors: ValidationError[],
): void {
  if (typeof data !== "object" || data === null) {
    errors.push({ path, message: "Expected object", expected: "object", actual: typeof data });
    return;
  }

  const obj = data as Record<string, unknown>;

  // Check required fields exist
  for (const [fieldName, fieldSchema] of Object.entries(schema.fields)) {
    const fieldPath = path ? `${path}.${fieldName}` : fieldName;
    const value = obj[fieldName];

    if (value === undefined) {
      if (fieldSchema.kind === FieldKind.Required) {
        errors.push({ path: fieldPath, message: "Required field missing", expected: "value", actual: "undefined" });
      }
    } else {
      validateNode(fieldSchema.schema, value, fieldPath, errors);
    }
  }

  // Check for extra fields (optional - could be lenient)
  for (const key of Object.keys(obj)) {
    if (!(key in schema.fields)) {
      errors.push({ path: `${path}.${key}`, message: "Unknown field", expected: "none", actual: "present" });
    }
  }
}
```

#### Task 3.3: Implement SchematizedObjectView

```typescript
// packages/dds/schema/src/view/schematizedObjectView.ts

/**
 * A view that provides typed property access over ISchemaStorage.
 * Used when the schema is an ObjectNodeSchema.
 */
export class SchematizedObjectView<TSchema extends ObjectNodeSchema> {
  constructor(
    private readonly storage: ISchemaStorage,
    private readonly schema: TSchema,
    private readonly persistence?: ISchemaPersistence,
  ) {}

  /** Compatibility status */
  public get compatibility(): SchemaCompatibilityStatus {
    const stored = this.persistence?.getPersistedSchema();
    return checkSchemaCompatibility(stored, this.schema);
  }

  /** Initialize with schema and content */
  public initialize(content: NodeFromSchema<TSchema>): void {
    const compat = this.compatibility;
    if (!compat.canInitialize) {
      throw new UsageError("Cannot initialize - schema already stored");
    }

    // Validate content
    const validation = validateData(this.schema, content);
    if (!validation.valid) {
      throw new SchemaValidationError("Invalid initial content", validation.errors);
    }

    // Store schema
    if (this.persistence) {
      this.persistence.setPersistedSchema(encodeSchema(this.schema));
    }

    // Set all fields
    for (const [fieldName, fieldSchema] of Object.entries(this.schema.fields)) {
      const value = (content as Record<string, unknown>)[fieldName];
      if (value !== undefined) {
        this.storage.setField(fieldName, fieldSchema.schema, value);
      }
    }
  }

  /** Upgrade stored schema */
  public upgradeSchema(): void {
    const compat = this.compatibility;
    if (!compat.canUpgrade) {
      throw new UsageError("Cannot upgrade - schemas incompatible");
    }
    if (this.persistence) {
      this.persistence.upgradePersistedSchema(encodeSchema(this.schema));
    }
  }

  /** Get a field value */
  private getField(fieldName: string): unknown {
    const fieldSchema = this.schema.fields[fieldName];
    if (!fieldSchema) {
      throw new UsageError(`Unknown field: ${fieldName}`);
    }

    const result = this.storage.getField(fieldName, fieldSchema.schema);
    if (result === undefined) {
      if (fieldSchema.kind === FieldKind.Required) {
        throw new SchemaValidationError(`Required field "${fieldName}" is missing`);
      }
      return undefined;
    }

    switch (result.type) {
      case "value":
        return result.value;
      case "storage":
        // Nested storage - wrap in appropriate view
        if (isObjectSchema(fieldSchema.schema)) {
          return new SchematizedObjectView(result.storage, fieldSchema.schema);
        } else if (isMapSchema(fieldSchema.schema)) {
          return new SchematizedMapView(result.storage, fieldSchema.schema);
        }
        throw new Error("Unexpected storage result for non-object/map schema");
    }
  }

  /** Set a field value */
  private setField(fieldName: string, value: unknown): void {
    const fieldSchema = this.schema.fields[fieldName];
    if (!fieldSchema) {
      throw new UsageError(`Unknown field: ${fieldName}`);
    }

    // Handle undefined for optional fields
    if (value === undefined) {
      if (fieldSchema.kind === FieldKind.Optional) {
        this.storage.deleteField(fieldName);
        return;
      }
      throw new UsageError(`Cannot set required field "${fieldName}" to undefined`);
    }

    // Validate
    const validation = validateData(fieldSchema.schema, value);
    if (!validation.valid) {
      throw new SchemaValidationError(`Invalid value for field "${fieldName}"`, validation.errors);
    }

    this.storage.setField(fieldName, fieldSchema.schema, value);
  }
}

/**
 * Create a Proxy that provides property access to SchematizedObjectView.
 */
export function createObjectViewProxy<TSchema extends ObjectNodeSchema>(
  view: SchematizedObjectView<TSchema>,
  schema: TSchema,
): NodeFromSchema<TSchema> & { compatibility: SchemaCompatibilityStatus; initialize: Function; upgradeSchema: Function } {
  return new Proxy({} as any, {
    get(target, prop) {
      if (prop === "compatibility") return view.compatibility;
      if (prop === "initialize") return view.initialize.bind(view);
      if (prop === "upgradeSchema") return view.upgradeSchema.bind(view);
      if (typeof prop === "string" && prop in schema.fields) {
        return view["getField"](prop);
      }
      return undefined;
    },
    set(target, prop, value) {
      if (typeof prop === "string" && prop in schema.fields) {
        view["setField"](prop, value);
        return true;
      }
      return false;
    },
    has(target, prop) {
      return typeof prop === "string" && prop in schema.fields;
    },
    ownKeys() {
      return Object.keys(schema.fields);
    },
    getOwnPropertyDescriptor(target, prop) {
      if (typeof prop === "string" && prop in schema.fields) {
        return { enumerable: true, configurable: true };
      }
      return undefined;
    },
  });
}
```

#### Task 3.4: Implement SchematizedMapView

```typescript
// packages/dds/schema/src/view/schematizedMapView.ts

/**
 * A view that provides Map-like access over ISchemaStorage.
 * Used when the schema is a MapNodeSchema.
 */
export class SchematizedMapView<TSchema extends MapNodeSchema>
  implements Iterable<[string, NodeFromSchema<InferValueSchema<TSchema>>]>
{
  constructor(
    private readonly storage: ISchemaStorage,
    private readonly schema: TSchema,
    private readonly persistence?: ISchemaPersistence,
  ) {}

  public get compatibility(): SchemaCompatibilityStatus {
    const stored = this.persistence?.getPersistedSchema();
    return checkSchemaCompatibility(stored, this.schema);
  }

  public initialize(content: Map<string, NodeFromSchema<InferValueSchema<TSchema>>>): void {
    const compat = this.compatibility;
    if (!compat.canInitialize) {
      throw new UsageError("Cannot initialize - schema already stored");
    }

    // Validate all content
    for (const [key, value] of content) {
      const validation = validateData(this.schema.valueSchema, value);
      if (!validation.valid) {
        throw new SchemaValidationError(`Invalid value for key "${key}"`, validation.errors);
      }
    }

    // Store schema
    if (this.persistence) {
      this.persistence.setPersistedSchema(encodeSchema(this.schema));
    }

    // Set all values
    for (const [key, value] of content) {
      this.storage.setField(key, this.schema.valueSchema, value);
    }
  }

  public upgradeSchema(): void {
    const compat = this.compatibility;
    if (!compat.canUpgrade) {
      throw new UsageError("Cannot upgrade - schemas incompatible");
    }
    if (this.persistence) {
      this.persistence.upgradePersistedSchema(encodeSchema(this.schema));
    }
  }

  public get(key: string): NodeFromSchema<InferValueSchema<TSchema>> | undefined {
    this.ensureCanView();
    const result = this.storage.getField(key, this.schema.valueSchema);
    if (result === undefined) return undefined;

    switch (result.type) {
      case "value":
        return result.value as NodeFromSchema<InferValueSchema<TSchema>>;
      case "storage":
        // Wrap nested storage
        if (isObjectSchema(this.schema.valueSchema)) {
          return new SchematizedObjectView(result.storage, this.schema.valueSchema) as any;
        }
        throw new Error("Unexpected storage result");
    }
  }

  public set(key: string, value: NodeFromSchema<InferValueSchema<TSchema>>): this {
    this.ensureCanView();
    const validation = validateData(this.schema.valueSchema, value);
    if (!validation.valid) {
      throw new SchemaValidationError(`Invalid value for key "${key}"`, validation.errors);
    }
    this.storage.setField(key, this.schema.valueSchema, value);
    return this;
  }

  public delete(key: string): boolean {
    this.ensureCanView();
    return this.storage.deleteField(key);
  }

  public has(key: string): boolean {
    this.ensureCanView();
    return this.storage.hasField(key);
  }

  public get size(): number {
    this.ensureCanView();
    return this.storage.size ?? 0;
  }

  public keys(): IterableIterator<string> {
    this.ensureCanView();
    return this.storage.keys?.() ?? [][Symbol.iterator]();
  }

  public *values(): IterableIterator<NodeFromSchema<InferValueSchema<TSchema>>> {
    for (const key of this.keys()) {
      const value = this.get(key);
      if (value !== undefined) yield value;
    }
  }

  public *entries(): IterableIterator<[string, NodeFromSchema<InferValueSchema<TSchema>>]> {
    for (const key of this.keys()) {
      const value = this.get(key);
      if (value !== undefined) yield [key, value];
    }
  }

  public [Symbol.iterator]() {
    return this.entries();
  }

  private ensureCanView(): void {
    if (!this.compatibility.canView) {
      throw new UsageError("Cannot use view - schema incompatible. Check view.compatibility first.");
    }
  }
}
```

#### Task 3.5: Write View Tests with Mock Storage

```typescript
// packages/dds/schema/src/test/view.spec.ts

describe("SchematizedObjectView", () => {
  const sf = new SchemaFactory("test");

  class User extends sf.object("User", {
    name: sf.string,
    age: sf.optional(sf.number),
  }) {}

  function createMockStorage(): ISchemaStorage {
    const data = new Map<string, unknown>();
    return {
      getField: (key) => {
        const value = data.get(key);
        return value !== undefined ? { type: "value", value } : undefined;
      },
      setField: (key, schema, value) => { data.set(key, value); },
      deleteField: (key) => data.delete(key),
      hasField: (key) => data.has(key),
      keys: () => data.keys(),
      size: data.size,
    };
  }

  it("gets and sets fields", () => {
    const storage = createMockStorage();
    const view = new SchematizedObjectView(storage, User);
    const proxy = createObjectViewProxy(view, User);

    proxy.name = "Alice";
    expect(proxy.name).toBe("Alice");

    proxy.age = 30;
    expect(proxy.age).toBe(30);
  });

  it("validates on set", () => {
    const storage = createMockStorage();
    const view = new SchematizedObjectView(storage, User);
    const proxy = createObjectViewProxy(view, User);

    expect(() => { (proxy as any).name = 123; }).toThrow(SchemaValidationError);
  });

  it("handles optional fields", () => {
    const storage = createMockStorage();
    const view = new SchematizedObjectView(storage, User);
    const proxy = createObjectViewProxy(view, User);

    expect(proxy.age).toBeUndefined();
    proxy.age = 30;
    expect(proxy.age).toBe(30);
    proxy.age = undefined;
    expect(proxy.age).toBeUndefined();
  });
});

describe("SchematizedMapView", () => {
  const sf = new SchemaFactory("test");
  const StringMap = sf.map("StringMap", sf.string);

  it("gets and sets values", () => {
    const storage = createMockStorage();
    const view = new SchematizedMapView(storage, StringMap);

    view.set("key1", "value1");
    expect(view.get("key1")).toBe("value1");
    expect(view.has("key1")).toBe(true);
    expect(view.size).toBe(1);
  });

  it("validates values", () => {
    const storage = createMockStorage();
    const view = new SchematizedMapView(storage, StringMap);

    expect(() => view.set("key", 123 as any)).toThrow(SchemaValidationError);
  });

  it("iterates entries", () => {
    const storage = createMockStorage();
    const view = new SchematizedMapView(storage, StringMap);

    view.set("a", "1");
    view.set("b", "2");

    const entries = [...view];
    expect(entries).toEqual([["a", "1"], ["b", "2"]]);
  });
});
```

### 4.2 Checkpoint 3

**Criteria**:
- [ ] `SchematizedObjectView` works with mock storage
- [ ] `SchematizedMapView` works with mock storage
- [ ] Proxy enables property access for objects
- [ ] Validation catches type mismatches
- [ ] `compatibility` status is correct

**Risk Check**: If Proxy has issues:
- Option A: Use explicit get/set methods instead of property access
- Option B: Generate typed wrapper classes

---

## 5. Phase 4: SharedMap Integration

**Goal**: Add `viewWith()` to SharedMap, wire up storage and persistence.

### 5.1 Tasks

#### Task 4.1: Add Schema Dependencies to @fluidframework/map

```json
// packages/dds/map/package.json
{
  "dependencies": {
    "@fluidframework/schema": "workspace:~",
    // ... existing
  }
}
```

#### Task 4.2: Add Schema Storage to SharedMap

```typescript
// packages/dds/map/src/map.ts

import {
  type NodeSchema,
  type ISchemaStorage,
  type ISchemaPersistence,
  type EncodedSchema,
  type SchemaCompatibilityStatus,
  createSchematizedView,
  encodeSchema,
  checkSchemaCompatibility,
} from "@fluidframework/schema";

export class SharedMap extends SharedObject<ISharedMapEvents> implements ISharedMap {
  // Existing code...

  // NEW: Schema storage
  private _persistedSchema: EncodedSchema | undefined;

  // NEW: Create storage adapter for schema views
  private createSchemaStorage(): ISchemaStorage {
    return {
      getField: (key, fieldSchema) => {
        const value = this.kernel.get(key);
        if (value === undefined) return undefined;
        return { type: "value", value };
      },
      setField: (key, fieldSchema, value) => {
        this.set(key, value);
      },
      deleteField: (key) => this.delete(key),
      hasField: (key) => this.has(key),
      keys: () => this.keys(),
      get size() { return this.size; },
    };
  }

  // NEW: Create persistence adapter
  private createSchemaPersistence(): ISchemaPersistence {
    return {
      getPersistedSchema: () => this._persistedSchema,
      setPersistedSchema: (schema) => {
        if (this._persistedSchema !== undefined) {
          throw new UsageError("Cannot initialize - schema already stored");
        }
        this._persistedSchema = schema;
        this.dirty();
      },
      upgradePersistedSchema: (schema) => {
        this._persistedSchema = schema;
        this.dirty();
      },
    };
  }

  // NEW: viewWith API
  public viewWith<TSchema extends NodeSchema>(
    schema: TSchema
  ): SchematizedView<TSchema> {
    const storage = this.createSchemaStorage();
    const persistence = this.createSchemaPersistence();
    return createSchematizedView(schema, storage, persistence);
  }
}
```

#### Task 4.3: Update Load/Summarize for Schema Persistence

```typescript
// packages/dds/map/src/map.ts

export class SharedMap extends SharedObject<ISharedMapEvents> implements ISharedMap {
  // MODIFIED: Load schema from attributes
  protected async loadCore(storage: IChannelStorageService): Promise<void> {
    // Existing data loading...
    const json = await readAndParse<object>(storage, snapshotFileName);
    // ... existing kernel population ...

    // NEW: Load schema from attributes
    try {
      const attributesBlob = await storage.readBlob(".attributes");
      const attributesJson = bufferToString(attributesBlob, "utf-8");
      const attributes = JSON.parse(attributesJson);
      this._persistedSchema = attributes.schema;
    } catch {
      // No attributes blob or no schema - that's OK
      this._persistedSchema = undefined;
    }
  }

  // MODIFIED: Write schema to attributes
  protected summarizeCore(
    serializer: IFluidSerializer,
    telemetryContext?: ITelemetryContext,
  ): ISummaryTreeWithStats {
    const builder = new SummaryTreeBuilder();

    // Existing data summarization...
    // ... existing kernel serialization ...

    // MODIFIED: Include schema in attributes
    const attributes = {
      type: MapFactory.Type,
      snapshotFormatVersion: "0.2",
      packageVersion: pkgVersion,
      schema: this._persistedSchema,  // NEW: Include if set
    };
    builder.addBlob(".attributes", JSON.stringify(attributes));

    return builder.getSummaryTree();
  }
}
```

#### Task 4.4: Add viewWith to ISharedMap Interface

```typescript
// packages/dds/map/src/interfaces.ts

import type { NodeSchema, SchematizedView } from "@fluidframework/schema";

export interface ISharedMap extends Map<string, unknown> {
  // Existing methods...

  /**
   * Get a typed, schematized view of this map.
   * @param schema - The schema to use for the view
   * @returns A view with typed access and compatibility status
   */
  viewWith<TSchema extends NodeSchema>(schema: TSchema): SchematizedView<TSchema>;
}
```

#### Task 4.5: Write Integration Tests

```typescript
// packages/dds/map/src/test/schematizedMap.spec.ts

describe("SharedMap.viewWith", () => {
  const sf = new SchemaFactory("test");

  class UserProfile extends sf.object("UserProfile", {
    name: sf.string,
    email: sf.string,
    age: sf.optional(sf.number),
  }) {}

  const UserMap = sf.map("UserMap", UserProfile);

  let map: SharedMap;

  beforeEach(() => {
    map = createLocalMap("test-map");
  });

  describe("Modality 1 (no initialize)", () => {
    it("provides typed access without persistence", () => {
      const view = map.viewWith(UserMap);

      expect(view.compatibility.canInitialize).toBe(true);
      expect(view.compatibility.canView).toBe(true);

      view.set("alice", { name: "Alice", email: "alice@test.com" });
      const alice = view.get("alice");
      expect(alice?.name).toBe("Alice");
    });

    it("validates on set", () => {
      const view = map.viewWith(UserMap);

      expect(() => {
        view.set("bad", { name: 123 as any, email: "x" });
      }).toThrow(SchemaValidationError);
    });
  });

  describe("Modality 2 (with initialize)", () => {
    it("stores schema on initialize", async () => {
      const view = map.viewWith(UserMap);

      expect(view.compatibility.canInitialize).toBe(true);
      view.initialize(new Map([["alice", { name: "Alice", email: "a@b.com" }]]));
      expect(view.compatibility.canInitialize).toBe(false);

      // Simulate reload
      const summary = map.getAttachSummary();
      const map2 = await loadMapFromSummary(summary);
      const view2 = map2.viewWith(UserMap);

      expect(view2.compatibility.canInitialize).toBe(false);
      expect(view2.compatibility.canView).toBe(true);
      expect(view2.get("alice")?.name).toBe("Alice");
    });

    it("detects schema mismatch on load", async () => {
      const view = map.viewWith(UserMap);
      view.initialize(new Map());

      // Simulate reload with different schema
      const summary = map.getAttachSummary();
      const map2 = await loadMapFromSummary(summary);

      class DifferentSchema extends sf.object("Different", { x: sf.number }) {}
      const DifferentMap = sf.map("DifferentMap", DifferentSchema);

      const view2 = map2.viewWith(DifferentMap);
      expect(view2.compatibility.canView).toBe(false);
    });
  });

  describe("ObjectNodeSchema pattern", () => {
    class AppSettings extends sf.object("AppSettings", {
      theme: sf.string,
      fontSize: sf.number,
    }) {}

    it("provides property access", () => {
      const view = map.viewWith(AppSettings);

      view.theme = "dark";
      view.fontSize = 14;

      expect(view.theme).toBe("dark");
      expect(view.fontSize).toBe(14);
    });
  });
});
```

### 5.2 Checkpoint 4

**Criteria**:
- [ ] `map.viewWith(schema)` returns typed view
- [ ] Modality 1 works (no persistence)
- [ ] Modality 2 works (schema persists through summary/load)
- [ ] ObjectNodeSchema pattern works (property access)
- [ ] MapNodeSchema pattern works (Map-like access)
- [ ] Existing SharedMap tests still pass
- [ ] No breaking changes to existing API

**Risk Check**: If SharedMap changes break tests:
- Option A: Make `viewWith` return a separate view object (not modify map behavior)
- Option B: Add feature flag for schema support

---

## 6. Phase 5: End-to-End Testing

**Goal**: Verify all scenarios work correctly in realistic conditions.

### 6.1 Test Scenarios

#### Scenario 1: New Document Creation
```typescript
// Create new document with schema
const map = container.create(SharedMap);
const view = map.viewWith(UserMap);

expect(view.compatibility.canInitialize).toBe(true);
view.initialize(new Map([["alice", { name: "Alice", email: "a@b.com" }]]));

// Verify data
expect(view.get("alice")?.name).toBe("Alice");
```

#### Scenario 2: Load Existing Document (Compatible)
```typescript
// Load document created with same schema
const map = await container.load(SharedMap, documentId);
const view = map.viewWith(UserMap);

expect(view.compatibility.isEquivalent).toBe(true);
expect(view.compatibility.canView).toBe(true);
```

#### Scenario 3: Load Existing Document (Upgradeable)
```typescript
// Original: { name: string }
// New: { name: string, email?: string }
const map = await container.load(SharedMap, documentId);
const view = map.viewWith(UserMapV2);

expect(view.compatibility.canView).toBe(false);  // Missing optional field in stored
expect(view.compatibility.canUpgrade).toBe(true);

view.upgradeSchema();
expect(view.compatibility.canView).toBe(true);
```

#### Scenario 4: Load Existing Document (Incompatible)
```typescript
// Original: { name: string }
// New: { name: number }  // Type changed!
const map = await container.load(SharedMap, documentId);
const view = map.viewWith(IncompatibleSchema);

expect(view.compatibility.canView).toBe(false);
expect(view.compatibility.canUpgrade).toBe(false);
```

#### Scenario 5: Concurrent Editing
```typescript
// Two clients with same schema
const [client1, client2] = await createConnectedClients();

const view1 = client1.map.viewWith(UserMap);
const view2 = client2.map.viewWith(UserMap);

view1.set("alice", { name: "Alice", email: "a@b.com" });
await synchronize();

expect(view2.get("alice")?.name).toBe("Alice");
```

#### Scenario 6: Backward Compatibility
```typescript
// Old client without schema support
const oldClient = createOldVersionClient();
const map = await oldClient.load(documentId);

// Should still work - schema is just metadata in .attributes
expect(map.get("alice")).toEqual({ name: "Alice", email: "a@b.com" });
```

### 6.2 Checkpoint 5

**Criteria**:
- [ ] All 6 scenarios pass
- [ ] No regressions in existing SharedMap behavior
- [ ] Performance acceptable (< 10% overhead for schematized operations)
- [ ] Bundle size increase acceptable (< 50KB for schema package)

---

## 7. Risk Register

| Risk | Likelihood | Impact | Mitigation | Contingency |
|------|------------|--------|------------|-------------|
| **Tree dependencies leak** | Medium | High | Copy utilities, test isolation | Create adapter layer |
| **Type inference complexity** | Medium | Medium | Start with simple types, iterate | Simplify to explicit generics |
| **Compatibility algorithm too complex** | Medium | Medium | Simplify to exact-match | Copy Tree's algorithm |
| **Proxy issues in older runtimes** | Low | Medium | Test in target environments | Fall back to explicit methods |
| **Performance overhead** | Low | Medium | Benchmark early | Add caching, lazy validation |
| **Breaking existing tests** | Low | High | Run full test suite each phase | Feature flag for schema support |
| **Schema encoding format changes** | Medium | High | Version field, migration support | Dual-format support |
| **IFluidHandle serialization** | Medium | Medium | Test handle round-trip early | Defer handle support |

---

## 8. Success Criteria

### MVP (Minimum Viable Product)

- [ ] `@fluidframework/schema` package exists and builds
- [ ] `SchemaFactory` creates object and map schemas
- [ ] `map.viewWith(schema)` works for Modality 1 (no persistence)
- [ ] Type inference provides compile-time safety
- [ ] All existing SharedMap tests pass

### Full Implementation

- [ ] Modality 2 works (schema persists)
- [ ] Schema compatibility checking works
- [ ] Schema upgrade (`upgradeSchema()`) works
- [ ] ObjectNodeSchema pattern (property access) works
- [ ] MapNodeSchema pattern (Map-like access) works
- [ ] All end-to-end scenarios pass
- [ ] Documentation complete

### Stretch Goals

- [ ] SharedDirectory integration
- [ ] `sf.lazy()` for recursive schemas
- [ ] JSON Schema export
- [ ] Schema migration tools

---

## Appendix A: File Checklist

### Schema Package Files

```
packages/dds/schema/
├── package.json
├── tsconfig.json
├── api-extractor.json
├── src/
│   ├── index.ts
│   ├── core/
│   │   ├── nodeSchema.ts
│   │   ├── fieldSchema.ts
│   │   ├── leafSchema.ts
│   │   └── index.ts
│   ├── nodeKinds/
│   │   ├── objectSchema.ts
│   │   ├── mapSchema.ts
│   │   └── index.ts
│   ├── factory/
│   │   ├── schemaFactory.ts
│   │   └── index.ts
│   ├── storage/
│   │   ├── schemaStorage.ts
│   │   ├── schemaPersistence.ts
│   │   └── index.ts
│   ├── serialization/
│   │   ├── format.ts
│   │   ├── encode.ts
│   │   ├── decode.ts
│   │   ├── compatibility.ts
│   │   └── index.ts
│   ├── validation/
│   │   ├── validate.ts
│   │   └── index.ts
│   ├── view/
│   │   ├── schematizedObjectView.ts
│   │   ├── schematizedMapView.ts
│   │   ├── createSchematizedView.ts
│   │   └── index.ts
│   ├── types/
│   │   ├── inference.ts
│   │   └── index.ts
│   └── test/
│       ├── schemaFactory.spec.ts
│       ├── serialization.spec.ts
│       └── view.spec.ts
└── README.md
```

### SharedMap Changes

```
packages/dds/map/
├── package.json              # Add @fluidframework/schema dependency
└── src/
    ├── interfaces.ts         # Add viewWith to ISharedMap
    ├── map.ts                # Add viewWith implementation, update load/summarize
    └── test/
        └── schematizedMap.spec.ts  # New test file
```
