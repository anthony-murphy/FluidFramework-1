# Schema DDS Integration Patterns

> **Related Documents**:
> - [Schema Extraction Plan](./schema-extraction-plan.md) - Core schema package extraction from Tree DDS
> - [Schema Implementation Plan](./schema-implementation-plan.md) - Detailed implementation steps
> - [SharedMap Schema Design](./schema-map-design.md) - Detailed SharedMap implementation
> - [SharedDirectory Schema Design](./schema-directory-design.md) - Detailed SharedDirectory implementation
> - [SharedString Schema Design](./schema-string-design.md) - Detailed SharedString implementation
> - [Open Items & Notes](./schema-open-items.md) - Open questions, risks, and concerns

This document describes the general patterns for how DDSes can adopt the shared `@fluidframework/schema` package.

---

## Table of Contents

1. [Overview](#1-overview)
2. [The `viewWith` API](#2-the-viewwith-api)
3. [Compatibility Status](#3-compatibility-status)
4. [Usage Patterns](#4-usage-patterns)
5. [Local vs Persisted](#5-local-vs-persisted-when-to-use-each)
6. [Full Integration - Schema-Driven Storage](#6-full-integration---schema-driven-storage-modality-3)
7. [Cross-DDS Schema Consistency](#7-cross-dds-schema-consistency)
8. [Schema Package Requirements for DDS Integration](#8-schema-package-requirements-for-dds-integration)
9. [Future Extensions](#9-future-extensions)

---

## 1. Overview

The `@fluidframework/schema` package provides a shared schema definition system that can be adopted by any DDS. This enables:

- **Type Safety**: Compile-time type checking for DDS operations
- **Validation**: Runtime validation of data against schema
- **Compatibility**: Schema versioning and compatibility checking
- **Consistency**: Same schema definitions work across different DDSes

### Three Levels of Integration

| Modality | Schema Storage | Data Storage | Description |
|----------|----------------|--------------|-------------|
| **1: Local** | None | Native DDS format | `viewWith()` without `initialize()` - local typing only |
| **2: Persisted** | In `.attributes` | Native DDS format | `viewWith()` with `initialize()` - schema stored |
| **3: Schema-Driven** | Dedicated blob | Schema-aware JSON | Data format driven by schema (Tree DDS) |

Modalities 1 and 2 share the same `viewWith()` API - the difference is whether you call `initialize()`. Modality 3 is a fundamentally different architecture where schema drives storage.

---

## 2. The `viewWith` API

DDSes that support schema provide a `viewWith` method that follows Tree DDS's proven pattern:

```typescript
const view = map.viewWith(schema);
```

This returns a view with:
- **`compatibility`** - Status of view schema vs stored schema
- **`initialize(content)`** - Set schema and initial content (when `canInitialize` is true)
- **`upgradeSchema()`** - Extend stored schema (when `canUpgrade` is true)
- **Typed accessors** - `get()`, `set()`, etc. with schema-derived types

### How Schema Gets Stored

Schema is stored when you call `initialize()`:

```typescript
const view = map.viewWith(UserProfile);

if (view.compatibility.canInitialize) {
  // Document has no schema yet - this stores it
  view.initialize(new Map([["alice", { name: "Alice", email: "a@b.com" }]]));
}
```

After `initialize()`:
- Schema is persisted in the DDS's `.attributes` blob
- Future `viewWith()` calls check compatibility against stored schema
- `canInitialize` becomes false

### Storage Design

Schema is stored in the existing `.attributes` blob:
```json
{
  "type": "https://graph.microsoft.com/types/map",
  "snapshotFormatVersion": "0.2",
  "packageVersion": "2.0.0",
  "schema": {
    "version": 1,
    "root": { /* encoded schema */ }
  }
}
```

---

## 3. Compatibility Status

The view exposes a `compatibility` object that tells you what operations are valid:

```typescript
interface SchemaCompatibilityStatus {
  /**
   * True if view schema is exactly equivalent to stored schema.
   * When true, canView and canUpgrade are also true.
   * Also true when there is no stored schema (local-only mode).
   */
  readonly isEquivalent: boolean;

  /**
   * True if view schema can read/write the document.
   * This is true when:
   * - There is no stored schema (local-only mode), OR
   * - The stored schema supports all content the view schema expects
   */
  readonly canView: boolean;

  /**
   * True if upgradeSchema() can extend stored schema to support view schema.
   * This is possible when view schema is a compatible superset (e.g., adds optional fields).
   */
  readonly canUpgrade: boolean;

  /**
   * True if document has no stored schema yet.
   * Call initialize() to store the schema, or just use the view without storing.
   */
  readonly canInitialize: boolean;
}
```

### Compatibility Matrix

| Stored Schema | View Schema | canInitialize | canView | canUpgrade | Notes |
|---------------|-------------|---------------|---------|------------|-------|
| None | Any | ✅ | ✅ | ❌ | Local-only mode - can use view, optionally `initialize()` |
| `{ a: string }` | `{ a: string }` | ❌ | ✅ | ✅ | Exact match |
| `{ a: string }` | `{ a: string, b?: number }` | ❌ | ❌ | ✅ | `upgradeSchema()` to add optional field |
| `{ a: string, b?: number }` | `{ a: string }` | ❌ | ✅ | ✅ | View is subset of stored |
| `{ a: string }` | `{ a: number }` | ❌ | ❌ | ❌ | Incompatible |

### Two Ways to Use `viewWith`

**Local-Only (never initialize)**:
```typescript
const view = map.viewWith(UserProfile);

// canInitialize = true, canView = true
// Just use the view - schema is not stored
view.set("alice", { name: "Alice", email: "a@b.com" });
const alice = view.get("alice");  // Typed, validated
```

**Persisted (call initialize)**:
```typescript
const view = map.viewWith(UserProfile);

if (view.compatibility.canInitialize) {
  // Store the schema in the document
  view.initialize(new Map([["alice", { name: "Alice", email: "a@b.com" }]]));
}
// Now canInitialize = false, schema is persisted
// Future clients will check compatibility against stored schema
```

---

## 4. Usage Patterns

### Local-Only Mode (No Persistence)

Use `viewWith` without calling `initialize()`. Schema is never stored:

```typescript
const view = map.viewWith(UserProfile);

// canInitialize = true, canView = true
// Schema exists only in this client's code

view.set("alice", { name: "Alice", email: "alice@example.com" });
const alice = view.get("alice");  // Typed as UserProfile, validated on read
```

**Characteristics**:
- Schema not stored in document
- No cross-client schema consistency
- Different clients can use different schemas
- Good for: prototyping, gradual adoption, existing documents

### Persisted Mode (Call Initialize)

Call `initialize()` to store the schema in the document:

```typescript
const view = map.viewWith(UserProfile);

if (view.compatibility.canInitialize) {
  // Store schema and initial content
  view.initialize(new Map([
    ["alice", { name: "Alice", email: "alice@example.com" }]
  ]));
}

// Now schema is persisted - future clients check compatibility
const alice = view.get("alice");  // Typed as UserProfile
```

**Characteristics**:
- Schema stored in `.attributes` blob
- Cross-client schema consistency enforced
- Future `viewWith()` calls check compatibility
- Good for: production applications, schema evolution

### Existing Document with Stored Schema

```typescript
const view = map.viewWith(UserProfile);

// canInitialize = false (schema already stored)
// canView depends on compatibility with stored schema
assert(view.compatibility.canView);
const alice = view.get("alice");  // Typed as UserProfile
```

### Schema Evolution - Adding Optional Field

```typescript
// New version adds optional 'avatar' field
const view = map.viewWith(UserProfileV2);

if (!view.compatibility.canView && view.compatibility.canUpgrade) {
  // Stored schema is older - upgrade it
  view.upgradeSchema();
}

// Now we can use the view
const alice = view.get("alice");
alice.avatar;  // string | undefined (new optional field)
```

### Incompatible Schema

```typescript
const view = map.viewWith(IncompatibleSchema);

if (!view.compatibility.canView && !view.compatibility.canUpgrade) {
  // Cannot use this schema with this document
  throw new Error("Schema incompatible with document");
}
```

### Validation Behavior

```typescript
const view = map.viewWith(UserProfile);

// WRITES: TypeScript enforces types at compile time
view.set("alice", { name: "Alice", email: "a@b.com" });  // ✅ Compiles
view.set("bob", { garbage: true });                      // ❌ Compile error

// READS: Runtime validation, throws on malformed data
const user = view.get("alice");
// If data doesn't match UserProfile schema → throws SchemaValidationError
// If valid → returns typed UserProfile, guaranteed accurate

user.name;  // string - guaranteed, or we would have thrown
```

---

## 5. Local vs Persisted: When to Use Each

| Aspect | Local-Only (no `initialize()`) | Persisted (`initialize()` called) |
|--------|--------------------------------|-----------------------------------|
| Schema storage | ❌ Not stored | ✅ Stored in `.attributes` |
| Cross-client consistency | ❌ Each client uses own schema | ✅ All clients check against stored |
| Schema evolution | N/A | ✅ `upgradeSchema()` available |
| Existing documents | ✅ Works with any document | Requires migration |
| Use case | Prototyping, gradual adoption | Production, multi-client apps |

### When to Use Local-Only

- **Prototyping**: Quick typed access during development
- **Gradual adoption**: Add typing to existing documents without migration
- **Single-client apps**: No need for cross-client consistency
- **Mixed schemas**: Different parts of app use different schemas

### When to Persist Schema

- **Multi-client collaboration**: All clients need same schema
- **Schema evolution**: Need `upgradeSchema()` for compatible changes
- **Data integrity**: Prevent incompatible writes from other clients
- **Long-lived documents**: Schema versioning and compatibility

---

## 6. Full Integration - Schema-Driven Storage (Modality 3)

Modalities 1 and 2 add schema as a **layer on top** of an existing DDS - the underlying data format doesn't change. Modality 3 is fundamentally different: the schema **drives the data storage format itself**.

### The Key Difference

| Aspect | Modality 1 & 2 | Modality 3 |
|--------|----------------|------------|
| Data format | Native DDS format | Schema-driven JSON |
| Schema role | Typing/validation layer | Defines storage structure |
| Serialization | Unchanged from base DDS | Schema-aware encoding |
| DDS changes | Add `viewWith()` API | Complete redesign |

### How Tree DDS Works (Modality 3)

Tree DDS stores data as schema-aware serialized JSON:

```typescript
// Schema defines the storage structure
const view = tree.viewWith(new TreeViewConfiguration({ schema: MySchema }));

// Data is stored according to schema
view.root.someField = value;  // Serialized based on schema
```

**Characteristics**:
- Schema is required, not optional
- Data format depends on schema structure
- Schema stored in dedicated blob (not `.attributes`)
- Schema-aware serialization/deserialization
- Chunking, compression, and encoding based on schema
- Full compatibility matrix for schema evolution

### Key Benefit: Reading Data at Rest

One of Tree's powerful features is that schema enables reading data at rest without loading the full DDS runtime:

- **Debugging tools**: Inspect document contents without running the app
- **Data migration**: Transform data between versions
- **Analytics**: Query documents without full Fluid infrastructure
- **Backup verification**: Validate document integrity

### When to Use Modality 3

Modality 3 makes sense for:
- **New DDSes** with no legacy format to maintain
- **Complex nested structures** that benefit from schema-driven storage
- **Performance-critical** scenarios where schema-aware encoding helps
- **Applications requiring** full Tree-style schema evolution

For existing DDSes (SharedMap, SharedDirectory, SharedString), Modalities 1 and 2 are appropriate because:
- Backward compatibility with existing documents
- Native format is already efficient for their use case
- Schema is additive, not fundamental

### Future: Modality 3 for Existing DDSes

We may eventually want Modality 3's benefits (schema-driven storage, reading data at rest) for existing DDSes like SharedMap. This would require:

1. **Data format migration**: Read old native format, write new schema-driven format on summarize
2. **Dual-format support**: Handle documents in either format during transition
3. **Tooling**: Migration utilities to convert existing documents

**Design considerations for Modality 2 that enable future Modality 3**:

- **Schema encoding**: Encode schema with enough detail to decode data (not just for compatibility)
- **Schema format consistency**: Use same encoding as Tree so tools work across DDSes
- **Extensible storage**: Don't rely on `.attributes` limitations that might not work for Modality 3

This is not an immediate priority, but we should avoid design decisions in Modality 2 that would make Modality 3 migration harder later.

---

## 7. Cross-DDS Schema Consistency

With a shared schema package, the **same schema definitions work across all DDSes**:

```typescript
import { SchemaFactory } from "@fluidframework/schema";

const sf = new SchemaFactory("myApp");

// Define schema once
class Task extends sf.object("Task", {
  title: sf.string,
  completed: sf.boolean,
  priority: sf.optional(sf.number),
}) {}

const TaskMap = sf.map("TaskMap", Task);

// Use with Tree DDS
const taskTree = tree.viewWith(new TreeViewConfiguration({ schema: Task }));
if (taskTree.compatibility.canInitialize) {
  taskTree.initialize({ title: "Buy milk", completed: false });
}

// Use with SharedMap - same pattern!
const taskMap = map.viewWith(TaskMap);
if (taskMap.compatibility.canInitialize) {
  taskMap.initialize(new Map([["task1", { title: "Buy milk", completed: false }]]));
}

// Same schema, same patterns across DDSes
```

### Consistent Patterns Across DDSes

Following Tree's pattern means all schema-enabled DDSes work the same way:

| Operation | Tree DDS | SharedMap |
|-----------|----------|-----------|
| Get view | `tree.viewWith(config)` | `map.viewWith(schema)` |
| Check status | `view.compatibility.canView` | `view.compatibility.canView` |
| Initialize | `view.initialize(content)` | `view.initialize(content)` |
| Upgrade | `view.upgradeSchema()` | `view.upgradeSchema()` |
| Access data | `view.root` | `view.get(key)` |

This enables:
- **Shared type definitions** across your application
- **Consistent patterns** - same compatibility model everywhere
- **Schema reuse** between different data structures
- **Predictable behavior** - developers learn one pattern

---

## 8. Schema Package Requirements for DDS Integration

The `@fluidframework/schema` package needs to provide these types and utilities for DDSes to implement the `viewWith` pattern:

### Unified Storage Interface

Rather than separate interfaces for flat vs hierarchical DDSes, we use a **single interface** where the DDS controls how each field is stored. The DDS returns a discriminated union indicating whether a field is a leaf value or a nested storage container:

```typescript
/**
 * Result of getting a field from storage.
 * DDS decides whether each field is a value or nested storage.
 */
export type StorageResult =
  | { type: "value"; value: unknown }
  | { type: "storage"; storage: ISchemaStorage };

/**
 * Unified storage interface that all DDSes implement.
 * The DDS controls how nested schemas are handled via getField().
 */
export interface ISchemaStorage {
  /**
   * Get a field, with the DDS deciding how to handle it based on schema.
   * @param key - The field key
   * @param fieldSchema - The schema for this field (so DDS knows if it's nested)
   * @returns Value for leaf schemas, or nested storage for object/map schemas
   */
  getField(key: string, fieldSchema: NodeSchema): StorageResult | undefined;

  /**
   * Set a field value. For nested schemas, the value is the full object.
   * DDS decides whether to store as JSON or create nested storage.
   */
  setField(key: string, fieldSchema: NodeSchema, value: unknown): void;

  /**
   * Delete a field.
   */
  deleteField(key: string): boolean;

  /**
   * Check if a field exists.
   */
  hasField(key: string): boolean;

  /**
   * Iterate over keys (for MapNodeSchema).
   */
  keys?(): IterableIterator<string>;

  /**
   * Number of entries (for MapNodeSchema).
   */
  readonly size?: number;
}

/**
 * Callbacks for schema persistence (Modality 2).
 */
export interface ISchemaPersistence {
  getPersistedSchema(): JsonCompatible | undefined;
  setPersistedSchema(schema: JsonCompatible): void;
  upgradePersistedSchema(schema: JsonCompatible): void;
}
```

### How DDSes Implement This

**SharedMap (flat storage)** - always returns values, nested objects as JSON:

```typescript
class SharedMap {
  private createStorage(): ISchemaStorage {
    return {
      getField: (key, fieldSchema) => {
        const value = this.kernel.get(key);
        if (value === undefined) return undefined;
        // Always return as value - nested objects are JSON blobs
        return { type: "value", value };
      },

      setField: (key, fieldSchema, value) => {
        // Always store as value - nested objects serialized as JSON
        this.set(key, value);
      },

      deleteField: (key) => this.delete(key),
      hasField: (key) => this.has(key),
      keys: () => this.keys(),
      size: this.size,
    };
  }
}
```

**SharedDirectory (hierarchical storage)** - returns nested storage for object schemas:

```typescript
class SharedDirectory {
  private createStorage(): ISchemaStorage {
    return {
      getField: (key, fieldSchema) => {
        if (isObjectSchema(fieldSchema) || isMapSchema(fieldSchema)) {
          // Nested schema → return subdirectory as nested storage
          const subdir = this.getSubDirectory(key);
          if (!subdir) return undefined;
          return { type: "storage", storage: subdir.createStorage() };
        } else {
          // Leaf schema → return value from storage namespace
          const value = this.get(key);
          if (value === undefined) return undefined;
          return { type: "value", value };
        }
      },

      setField: (key, fieldSchema, value) => {
        if (isObjectSchema(fieldSchema) || isMapSchema(fieldSchema)) {
          // Nested schema → create subdirectory and populate it
          let subdir = this.getSubDirectory(key);
          if (!subdir) {
            subdir = this.createSubDirectory(key);
          }
          // Recursively set fields in subdirectory
          populateStorage(subdir.createStorage(), fieldSchema, value);
        } else {
          // Leaf schema → store as value
          this.set(key, value);
        }
      },

      deleteField: (key) => {
        // Try both namespaces
        return this.delete(key) || this.deleteSubDirectory(key);
      },

      hasField: (key) => this.has(key) || this.hasSubDirectory(key),
      keys: () => this.keys(),  // Or combine both namespaces
      size: this.size,
    };
  }
}
```

### How the Schema Package Uses This

The view implementation checks the result type and acts accordingly:

```typescript
// packages/dds/schema/src/schematizedObjectView.ts

class SchematizedObjectView<TSchema extends ObjectNodeSchema> {
  constructor(
    private readonly storage: ISchemaStorage,
    private readonly schema: TSchema,
  ) {}

  private getField(fieldName: string): unknown {
    const fieldSchema = this.schema.fields[fieldName];
    if (!fieldSchema) return undefined;

    const result = this.storage.getField(fieldName, fieldSchema.schema);
    if (result === undefined) {
      if (!fieldSchema.optional) {
        throw new SchemaValidationError(`Required field "${fieldName}" is missing`);
      }
      return undefined;
    }

    switch (result.type) {
      case "value":
        // Validate and return the value directly
        validateData(fieldSchema.schema, result.value);
        return result.value;

      case "storage":
        // Wrap nested storage in appropriate view
        if (isObjectSchema(fieldSchema.schema)) {
          return new SchematizedObjectView(result.storage, fieldSchema.schema);
        } else if (isMapSchema(fieldSchema.schema)) {
          return new SchematizedMapView(result.storage, fieldSchema.schema);
        }
        throw new Error(`Unexpected storage result for schema kind`);
    }
  }

  private setField(fieldName: string, value: unknown): void {
    const fieldSchema = this.schema.fields[fieldName];
    if (!fieldSchema) {
      throw new UsageError(`Unknown field: ${fieldName}`);
    }

    // Validate the value
    validateData(fieldSchema.schema, value);

    // Let the DDS decide how to store it
    this.storage.setField(fieldName, fieldSchema.schema, value);
  }
}
```

### Why This Design?

| Benefit | Explanation |
|---------|-------------|
| **DDS control** | DDS decides per-field whether to use flat or nested storage |
| **Single interface** | One `ISchemaStorage` for all DDSes |
| **Flat is a subset** | Flat DDSes always return `{ type: "value" }` |
| **Schema-aware** | DDS receives schema info to make intelligent decisions |
| **Flexible** | DDS could even mix strategies (some fields flat, some nested) |

### Storage Strategy Examples

```typescript
// SharedMap: Always flat
getField(key, schema) → { type: "value", value: jsonBlob }

// SharedDirectory: Nested for objects, flat for leaves
getField(key, objectSchema) → { type: "storage", storage: subdirStorage }
getField(key, leafSchema) → { type: "value", value: primitiveValue }

// Hybrid DDS (hypothetical): Could choose per-field
getField("bigObject", schema) → { type: "storage", ... }  // Fine-grained merge
getField("smallConfig", schema) → { type: "value", ... }  // Atomic replacement
```

### Merge Semantics Follow Storage Choice

The DDS's choice of `value` vs `storage` determines merge behavior:

| Storage Result | Merge Behavior | Use When |
|----------------|----------------|----------|
| `{ type: "value" }` | Last-write-wins on whole value | Small objects, atomic updates preferred |
| `{ type: "storage" }` | Field-level merge in nested storage | Large objects, concurrent field edits |

### Complete Flow Example

```typescript
// User code
const view = directory.viewWith(AppSchema);
view.settings.theme = "dark";

// What happens:
// 1. Proxy intercepts `view.settings`
// 2. Calls storage.getField("settings", SettingsSchema)
// 3. SharedDirectory returns { type: "storage", storage: settingsSubdirStorage }
// 4. View creates SchematizedObjectView over settingsSubdirStorage
// 5. Proxy intercepts `.theme = "dark"`
// 6. Calls settingsSubdirStorage.setField("theme", leafSchema, "dark")
// 7. SharedDirectory stores "dark" in settings subdirectory's value namespace
```

### Summary

| Component | Responsibility |
|-----------|----------------|
| **ISchemaStorage** | Single interface, DDS implements `getField(key, schema) → StorageResult` |
| **DDS** | Decides per-field: return `{ type: "value" }` or `{ type: "storage" }` |
| **Schema Package** | Handles `value` results directly, wraps `storage` results in nested views |
| **Flat DDSes** | Always return `{ type: "value" }` - nested schemas are JSON blobs |
| **Hierarchical DDSes** | Return `{ type: "storage" }` for nested schemas - field-level updates |
| Serialization | `encodeSchema()`, `decodeSchema()` |
| All view implementations | `SchematizedObjectView`, `SchematizedMapView`, etc. |
| Factory function | `createSchematizedView()` |

**Result**: DDSes write ~10-15 lines of adapter code. Schema package handles everything else.

### Required Types

```typescript
/**
 * Compatibility status returned by viewWith().
 * All DDSes return this same interface.
 */
export interface SchemaCompatibilityStatus {
  /** True if view schema is exactly equivalent to stored schema (or no stored schema). */
  readonly isEquivalent: boolean;

  /** True if view can read/write the document. */
  readonly canView: boolean;

  /** True if upgradeSchema() can extend stored schema to support view schema. */
  readonly canUpgrade: boolean;

  /** True if document has no stored schema yet (initialize() is valid). */
  readonly canInitialize: boolean;

  /** Human-readable reason for incompatibility, if any. */
  readonly reason?: string;
}

/**
 * Thrown when data doesn't match the expected schema.
 * Used by all DDSes for read validation.
 */
export class SchemaValidationError extends Error {
  /** The schema that data failed to match. */
  readonly schema: NodeSchema;

  /** Human-readable reason for failure. */
  readonly reason: string;

  /** Path to the invalid data (e.g., key name, field path). */
  readonly path?: string;
}
```

### Required Utilities

| Utility | Purpose | Used By |
|---------|---------|---------|
| `encodeSchema(schema)` | Serialize schema for storage in `.attributes` | All DDSes (Modality 2) |
| `decodeSchema(encoded)` | Deserialize schema from storage | All DDSes (Modality 2) |
| `checkSchemaCompatibility(stored, view)` | Compare schemas, return `SchemaCompatibilityStatus` | All DDSes |
| `validateData(schema, data)` | Runtime validation, throws `SchemaValidationError` | All DDSes (read validation) |
| `createSchematizedView(schema, storage, persistence)` | Factory for view creation | All DDSes |

### Package Responsibilities

| Component | Package | Notes |
|-----------|---------|-------|
| `SchemaFactory` | `@fluidframework/schema` | Schema definition |
| `NodeSchema`, `ObjectNodeSchema`, `MapNodeSchema` | `@fluidframework/schema` | Schema types |
| `SchemaCompatibilityStatus` | `@fluidframework/schema` | Shared interface |
| `SchemaValidationError` | `@fluidframework/schema` | Shared error class |
| `encodeSchema`, `decodeSchema` | `@fluidframework/schema` | Serialization |
| `checkSchemaCompatibility` | `@fluidframework/schema` | Compatibility checking |
| `validateData` | `@fluidframework/schema` | Runtime validation |
| `NodeFromSchema`, `InferFields` | `@fluidframework/schema` | Type utilities |
| `IKeyValueStorage`, `ISchemaPersistence` | `@fluidframework/schema` | Storage adapter interfaces |
| `SchematizedObjectView`, `SchematizedMapView` | `@fluidframework/schema` | **Reusable view implementations** |
| `createSchematizedView` | `@fluidframework/schema` | Factory function |
| `ISharedMap.viewWith()` | `@fluidframework/map` | Wires up adapters |
| `ISharedDirectory.viewWith()` | `@fluidframework/map` | Wires up adapters |
| `ISharedString.viewWith()` | `@fluidframework/sequence` | Wires up adapters |

---

## 9. Future Extensions

### Potential DDS Adoptions

| DDS | Integration Ideas | Design Document |
|-----|-------------------|-----------------|
| **SharedMap** | Value schema typing | [SharedMap Schema Design](./schema-map-design.md) |
| **SharedDirectory** | Nested schema for subdirectories | [SharedDirectory Schema Design](./schema-directory-design.md) |
| **SharedString** | Segment properties, marker subtypes, interval collections | [SharedString Schema Design](./schema-string-design.md) |

### Schema Package Extensions

- **Schema Registry**: Centralized schema management across DDSes
- **Schema Versioning**: Built-in version management with migration support
- **Code Generation**: Generate TypeScript interfaces from schema definitions
- **Schema Diff**: Detailed schema comparison tools for debugging
- **JSON Schema Import**: Create Fluid schema from JSON Schema definitions
- **Schema Composition**: Utilities for combining and extending schemas

---

## Appendix: Document Relationships

```
┌─────────────────────────────────┐
│   schema-extraction-plan.md    │  ← What to extract from Tree DDS
│   (Core schema package)        │
└───────────────┬─────────────────┘
                │
                ▼
┌─────────────────────────────────┐
│   schema-dds-integration.md    │  ← General adoption patterns (this doc)
│   (viewWith API)               │
└───────────────┬─────────────────┘
                │
        ┌───────┼───────┐
        ▼       ▼       ▼
┌───────────┐ ┌─────────────┐ ┌───────────┐
│ schema-   │ │ schema-     │ │ schema-   │
│ map-      │ │ directory-  │ │ string-   │
│ design.md │ │ design.md   │ │ design.md │
└───────────┘ └─────────────┘ └───────────┘
```

**Recommended reading order**:
1. [Schema Extraction Plan](./schema-extraction-plan.md) - understand the schema package
2. This document - understand the `viewWith` API pattern
3. Individual DDS design docs for implementation details
