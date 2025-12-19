# SharedMap Schema Integration Design

> **Related Documents**:
> - [Schema Extraction Plan](./schema-extraction-plan.md) - Core schema package extraction
> - [Schema Implementation Plan](./schema-implementation-plan.md) - Detailed implementation steps
> - [Schema DDS Integration Patterns](./schema-dds-integration.md) - General modality patterns
> - [SharedDirectory Schema Design](./schema-directory-design.md) - SharedDirectory implementation
> - [Open Items & Notes](./schema-open-items.md) - Open questions, risks, and concerns

This document provides the detailed design for adding schema support to SharedMap using a unified `viewWith` API that follows Tree DDS's proven pattern.

---

## Table of Contents

1. [Overview](#1-overview)
2. [The viewWith API](#2-the-viewwith-api)
   - [Basic Usage](#basic-usage)
   - [Pattern A: ObjectNodeSchema](#pattern-a-objectnodeschema---known-keys)
   - [Pattern B: MapNodeSchema](#pattern-b-mapnodeschema---dynamic-keys)
3. [Compatibility Status](#3-compatibility-status)
4. [Type Signatures](#4-type-signatures)
5. [Modality 1: Local-Only](#5-modality-1-local-only-no-initialize)
6. [Modality 2: Persisted Schema](#6-modality-2-persisted-schema-call-initialize)
   - [Storage Design](#storage-design)
   - [Schema Evolution](#schema-evolution)
   - [DDS Implementation](#dds-implementation)
7. [Error Handling](#7-error-handling)
8. [Implementation Details](#8-implementation-details)
9. [Comparison with Tree DDS](#9-comparison-with-tree-dds)
10. [Other DDS Examples](#10-other-dds-examples)
11. [Package Responsibilities](#11-package-responsibilities)
12. [Implementation Phases](#12-implementation-phases)

---

## 1. Overview

SharedMap adopts schema through a single unified API: `map.viewWith(schema)`.

The returned view includes a `compatibility` status and optionally an `initialize()` method. Whether you call `initialize()` determines the modality:

| Action | Schema Storage | Compatibility Check | Use Case |
|--------|----------------|---------------------|----------|
| `viewWith()` only | Not persisted | None | Local typing only (Modality 1) |
| `viewWith()` + `initialize()` | In `.attributes` blob | Automatic on load | Type safety + persistence (Modality 2) |

**Key benefit**: Same `viewWith()` API for both modalities—`initialize()` is what stores the schema.

---

## 2. The viewWith API

### Basic Usage

```typescript
import { SchemaFactory } from "@fluidframework/schema";
import { ISharedMap } from "@fluidframework/map";

const sf = new SchemaFactory("myApp");

class UserProfile extends sf.object("UserProfile", {
  name: sf.string,
  email: sf.string,
  age: sf.optional(sf.number),
}) {}

const UserProfileMap = sf.map("UserProfileMap", UserProfile);

// Get a typed view
const map: ISharedMap = /* from container */;
const view = map.viewWith(UserProfileMap);

// Check compatibility status
if (view.compatibility.canInitialize) {
  // No stored schema yet - optionally initialize
  view.initialize(new Map([["alice", { name: "Alice", email: "alice@example.com" }]]));
}

// Typed operations (work whether or not you called initialize)
view.get("alice")?.name;   // string | undefined
view.set("bob", { name: "Bob", email: "bob@example.com" });
```

### Pattern A: ObjectNodeSchema - Known Keys

For maps with a fixed set of keys where each key can have a different type:

```typescript
const sf = new SchemaFactory("myApp");

class AppSettings extends sf.object("AppSettings", {
  theme: sf.string,
  fontSize: sf.number,
  notifications: sf.boolean,
  lastLogin: sf.optional(sf.string),
}) {}

const map: ISharedMap = /* from container */;
const settings = map.viewWith(AppSettings);

// Typed property access for known keys
settings.theme;                     // string (readonly)
settings.fontSize;                  // number (readonly)
settings.theme = "dark";            // ✅ Atomic replacement (setter)
settings.fontSize = 14;             // ✅ Atomic replacement (setter)

// Standard JS object utilities work
Object.keys(settings);              // ["theme", "fontSize", "notifications", "lastLogin"]
Object.entries(settings);           // [["theme", "dark"], ...]
"theme" in settings;                // true
```

### Pattern B: MapNodeSchema - Dynamic Keys

For maps with arbitrary keys where all values have the same type:

```typescript
const sf = new SchemaFactory("myApp");

class UserProfile extends sf.object("UserProfile", {
  name: sf.string,
  email: sf.string,
  age: sf.optional(sf.number),
}) {}

const UserProfileMap = sf.map("UserProfileMap", UserProfile);

const map: ISharedMap = /* from container */;
const view = map.viewWith(UserProfileMap);

// Typed Map interface
const alice = view.get("alice");   // UserProfile | undefined
alice?.name;                        // string
alice?.email;                       // string

// Set accepts plain objects (atomic replacement)
view.set("bob", {
  name: "Bob",
  email: "bob@example.com",
  age: 30,
});

view.set("charlie", { name: 123 }); // ❌ Compile error: name must be string

// Standard Map iteration (typed)
view.size;                          // number
view.has("alice");                  // boolean
for (const [key, profile] of view) {
  console.log(key, profile.name);   // Both typed
}
```

---

## 3. Compatibility Status

The view exposes a `compatibility` object that tells you what operations are valid:

```typescript
const view = map.viewWith(UserProfileMap);

// Check what's possible
view.compatibility.isEquivalent;   // true if schemas match exactly
view.compatibility.canView;        // true if you can use the view
view.compatibility.canUpgrade;     // true if upgradeSchema() would work
view.compatibility.canInitialize;  // true if no stored schema yet
```

### Compatibility Matrix

| Stored Schema | View Schema | canInitialize | canView | canUpgrade | Action |
|---------------|-------------|---------------|---------|------------|--------|
| None | Any | ✅ | ✅ | ❌ | Use view directly, optionally `initialize()` |
| `{ a: string }` | `{ a: string }` | ❌ | ✅ | ✅ | Use view directly |
| `{ a: string }` | `{ a: string, b?: number }` | ❌ | ❌ | ✅ | Call `upgradeSchema()` first |
| `{ a: string, b?: number }` | `{ a: string }` | ❌ | ✅ | ✅ | Use view (subset is fine) |
| `{ a: string }` | `{ a: number }` | ❌ | ❌ | ❌ | Incompatible |

### Handling Different States

```typescript
const view = map.viewWith(UserProfileMap);

if (view.compatibility.canInitialize) {
  // New document - initialize with schema
  view.initialize(new Map([["alice", { name: "Alice", email: "a@b.com" }]]));
} else if (view.compatibility.canView) {
  // Existing document with compatible schema
  const alice = view.get("alice");
} else if (view.compatibility.canUpgrade) {
  // Can extend stored schema
  view.upgradeSchema();
  const alice = view.get("alice");
} else {
  // Incompatible schema
  throw new Error("Schema incompatible with document");
}
```

---

## 4. Type Signatures

```typescript
interface ISharedMap {
  // ... existing methods ...

  /**
   * Creates a typed view of this map with the given schema.
   * Returns a view with compatibility status and typed accessors.
   *
   * @param schema - ObjectNodeSchema for known keys, or MapNodeSchema for dynamic keys
   * @returns A typed view of the map with compatibility status
   */
  viewWith<TSchema extends ObjectNodeSchema>(
    schema: TSchema
  ): SchematizedObjectView<TSchema>;

  viewWith<TSchema extends MapNodeSchema>(
    schema: TSchema
  ): SchematizedMapView<TSchema>;
}

/**
 * Compatibility status returned by viewWith().
 * Follows Tree DDS's proven pattern.
 */
interface SchemaCompatibilityStatus {
  /** True if view schema is exactly equivalent to stored schema (or no stored schema). */
  readonly isEquivalent: boolean;

  /** True if view can read/write the document. */
  readonly canView: boolean;

  /** True if upgradeSchema() can extend stored schema to support view schema. */
  readonly canUpgrade: boolean;

  /** True if document has no stored schema yet. */
  readonly canInitialize: boolean;
}

// Return type for ObjectNodeSchema (known keys)
interface SchematizedObjectView<TSchema extends ObjectNodeSchema> {
  /** Compatibility status of view schema vs stored schema. */
  readonly compatibility: SchemaCompatibilityStatus;

  /** Store schema and set initial content. Only valid when canInitialize is true. */
  initialize(content: InferFields<TSchema>): void;

  /** Extend stored schema to support view schema. Only valid when canUpgrade is true. */
  upgradeSchema(): void;

  // Typed property access
  [K in keyof InferFields<TSchema>]: InferFields<TSchema>[K];
}

// Return type for MapNodeSchema (dynamic keys)
interface SchematizedMapView<TSchema extends MapNodeSchema> {
  /** Compatibility status of view schema vs stored schema. */
  readonly compatibility: SchemaCompatibilityStatus;

  /** Store schema and set initial content. Only valid when canInitialize is true. */
  initialize(content: Map<string, NodeFromSchema<InferValueSchema<TSchema>>>): void;

  /** Extend stored schema to support view schema. Only valid when canUpgrade is true. */
  upgradeSchema(): void;

  // Typed Map interface
  get(key: string): NodeFromSchema<InferValueSchema<TSchema>> | undefined;
  set(key: string, value: NodeFromSchema<InferValueSchema<TSchema>>): this;
  has(key: string): boolean;
  delete(key: string): boolean;
  readonly size: number;
  keys(): IterableIterator<string>;
  values(): IterableIterator<NodeFromSchema<InferValueSchema<TSchema>>>;
  entries(): IterableIterator<[string, NodeFromSchema<InferValueSchema<TSchema>>]>;
  forEach(callback: (value: NodeFromSchema<InferValueSchema<TSchema>>, key: string) => void): void;
  [Symbol.iterator](): IterableIterator<[string, NodeFromSchema<InferValueSchema<TSchema>>]>;
}
```

### Type Utilities (from Schema Package)

```typescript
// @fluidframework/schema exports:

/** Infers plain TypeScript type from any NodeSchema */
type NodeFromSchema<T extends NodeSchema> = /* inferred type */;

/** Infer fields from ObjectNodeSchema */
type InferFields<T extends ObjectNodeSchema> = /* field types */;

/** Infer value schema from MapNodeSchema */
type InferValueSchema<T extends MapNodeSchema> = /* value schema type */;
```

---

## 5. Modality 1: Local-Only (No Initialize)

Use `viewWith()` without calling `initialize()`. Schema is never stored:

**Validation Behavior**:
- **Write validation**: TypeScript enforces types at compile time
- **Read validation**: Runtime validation on every `get()`, throws if data doesn't match schema

```typescript
// Modality 1 usage - just use the view without initializing
const view = map.viewWith(UserProfileMap);

// compatibility.canInitialize = true (no stored schema)
// compatibility.canView = true (can use view immediately)

// WRITES: Compile-time type checking
view.set("alice", { name: "Alice", email: "a@b.com" });  // ✅
view.set("bob", { garbage: true });                       // ❌ Compile error

// READS: Runtime validation
const user = view.get("alice");
// If data is malformed → throws SchemaValidationError
// If valid → returns UserProfile with guaranteed accurate types
```

**Characteristics**:
- Returns typed view immediately
- No schema written to storage
- No cross-client schema consistency
- Different clients can use different schemas
- Full backward compatibility with existing documents

**Why Read Validation?**
Data may not match schema because:
- Written by old clients without schema
- Written via untyped `map.set()` bypassing the view
- Existed before schema was introduced

Without read validation, TypeScript types would be lies.

**Implementation**:
- Creates a proxy/wrapper around the map
- `set()` operations type-checked at compile time
- `get()` operations validate data at runtime, throw on mismatch
- No DDS lifecycle changes needed

**Use when**:
- Adding type safety to existing applications
- Don't need cross-client schema consistency
- Different parts of the app may use different schemas
- You want zero risk of storage format changes

---

## 6. Modality 2: Persisted Schema (Call Initialize)

Call `initialize()` to store the schema in the document. This enables cross-client schema consistency.

### Storage Design

Schema is stored in the existing `.attributes` blob:

```json
{
  "type": "https://graph.microsoft.com/types/map",
  "snapshotFormatVersion": "0.2",
  "packageVersion": "2.0.0",
  "schema": {
    "kind": "map",
    "valueSchema": {
      "kind": "object",
      "identifier": "myApp.UserProfile",
      "fields": {
        "name": { "kind": "leaf", "leafKind": "string" },
        "email": { "kind": "leaf", "leafKind": "string" },
        "age": { "kind": "leaf", "leafKind": "number", "optional": true }
      }
    }
  }
}
```

**Why `.attributes` blob?**
- ✅ Already exists per-DDS instance
- ✅ Backward compatible—old clients ignore unknown fields
- ✅ No additional blob needed
- ✅ Already loaded during `loadCore`

### Schema Evolution

When loading a document with a stored schema:

```typescript
// First client initializes with schema
const view = map.viewWith(UserProfileMap);
if (view.compatibility.canInitialize) {
  view.initialize(new Map([["alice", { name: "Alice", email: "a@b.com" }]]));
}

// Later client loads document
const view = loadedMap.viewWith(UserProfileMap);
// Now canInitialize = false (schema already stored)
// canView depends on compatibility with stored schema
```

**Schema upgrade example**:

```typescript
// Original schema
class UserProfileV1 extends sf.object("UserProfile", {
  name: sf.string,
  email: sf.string,
}) {}

// New schema with optional field (backward compatible)
class UserProfileV2 extends sf.object("UserProfile", {
  name: sf.string,
  email: sf.string,
  phone: sf.optional(sf.string),  // NEW
}) {}

const view = map.viewWith(sf.map("Users", UserProfileV2));

if (!view.compatibility.canView && view.compatibility.canUpgrade) {
  // Stored schema is older - upgrade it to add optional field
  view.upgradeSchema();
}

// Now we can use the view with the new optional field
const alice = view.get("alice");
alice?.phone;  // string | undefined
```

### DDS Implementation

The SharedMap class needs these changes for Modality 2:

```typescript
class SharedMap {
  private _persistedSchema: JsonCompatible | undefined;

  // Read schema during load
  protected async loadCore(storage: IChannelStorageService): Promise<void> {
    // ... existing load logic ...
    const attributes = await this.readAttributes(storage);
    this._persistedSchema = attributes.schema;  // May be undefined
  }

  // Write schema during summarize
  protected summarizeCore(serializer: IFluidSerializer): ISummaryTreeWithStats {
    // ... existing summarize logic ...
    const attributes = {
      type: MapFactory.Type,
      snapshotFormatVersion: "0.2",
      packageVersion: pkgVersion,
      schema: this._persistedSchema,  // Include if set
    };
    builder.addBlob(".attributes", JSON.stringify(attributes));
  }

  // viewWith returns a view with compatibility status
  public viewWith<TSchema extends NodeSchema>(
    schema: TSchema
  ): SchematizedView<TSchema> {
    const encoded = encodeSchema(schema);
    const compatibility = this._persistedSchema === undefined
      ? { isEquivalent: true, canView: true, canUpgrade: false, canInitialize: true }
      : checkSchemaCompatibility(this._persistedSchema, schema);

    return createSchematizedView(this, schema, compatibility, {
      initialize: (content) => {
        if (!compatibility.canInitialize) {
          throw new Error("Cannot initialize - schema already stored");
        }
        this._persistedSchema = encoded;
        // Set initial content...
      },
      upgradeSchema: () => {
        if (!compatibility.canUpgrade) {
          throw new Error("Cannot upgrade - schemas incompatible");
        }
        this._persistedSchema = encoded;
      },
    });
  }
}
```

---

## 7. Error Handling

```typescript
/**
 * Thrown when operations fail due to schema issues.
 */
class SchemaValidationError extends Error {
  /** The schema that data failed to match */
  readonly schema: NodeSchema;

  /** The key where validation failed (for maps) */
  readonly key?: string;

  /** Human-readable reason for failure */
  readonly reason: string;
}
```

### Error Scenarios

```typescript
const view = map.viewWith(UserProfileMap);

// 1. Initialize when schema already stored
if (!view.compatibility.canInitialize) {
  view.initialize(content);  // ❌ Throws: "Cannot initialize - schema already stored"
}

// 2. Use view when incompatible
if (!view.compatibility.canView) {
  view.get("alice");  // ❌ Throws: SchemaCompatibilityError
}

// 3. Read malformed data
const user = view.get("alice");  // ❌ Throws SchemaValidationError if data doesn't match
```

---

## 8. Implementation Details

This section dives deep into how SharedMap will implement schema support.

### 8.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              SharedMap                                   │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                          MapKernel                                 │  │
│  │  • Manages actual map data                                        │  │
│  │  • Handles ops (set, delete, clear)                               │  │
│  │  • No schema awareness (unchanged)                                 │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    Schema Layer (NEW)                              │  │
│  │  • _persistedSchema: JsonCompatible | undefined                   │  │
│  │  • viewWith(schema): SchematizedMapView                           │  │
│  │  • Schema storage in .attributes blob                             │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                   Summarization (Modified)                         │  │
│  │  • summarizeCore: writes schema to .attributes                    │  │
│  │  • loadCore: reads schema from .attributes                        │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                        SchematizedMapView                                │
│  • Wraps SharedMap with typed interface                                 │
│  • compatibility: SchemaCompatibilityStatus                             │
│  • initialize(content): stores schema                                    │
│  • upgradeSchema(): extends schema                                       │
│  • get/set/delete: typed, validated operations                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Load Flow

When a document is loaded, here's the complete flow:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           LOAD FLOW                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. Container loads DDS                                                 │
│     └─→ SharedMap.loadCore(storage)                                     │
│          ├─→ Load map data from snapshot blob                          │
│          └─→ Load schema from .attributes blob                         │
│               └─→ this._persistedSchema = attributes?.schema           │
│                                                                         │
│  2. Application calls viewWith()                                        │
│     └─→ map.viewWith(UserProfileMap)                                    │
│          ├─→ Encode view schema                                        │
│          ├─→ Check compatibility with stored schema                    │
│          │    ├─→ No stored schema? canInitialize = true               │
│          │    └─→ Has stored schema? Check canView, canUpgrade         │
│          └─→ Return SchematizedMapView with compatibility              │
│                                                                         │
│  3. Application checks compatibility and acts                           │
│     └─→ if (view.compatibility.canInitialize)                          │
│          └─→ view.initialize(content)  // First time setup             │
│     └─→ else if (view.compatibility.canView)                           │
│          └─→ view.get("key")  // Normal usage                          │
│     └─→ else if (view.compatibility.canUpgrade)                        │
│          └─→ view.upgradeSchema()  // Extend stored schema             │
│     └─→ else                                                           │
│          └─→ Error: incompatible schema                                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Step 1: DDS Loads Schema from Storage

During `loadCore`, SharedMap reads any persisted schema from the `.attributes` blob:

```typescript
protected async loadCore(storage: IChannelStorageService): Promise<void> {
  // Load map data (existing logic)
  const json = await readAndParse<object>(storage, snapshotFileName);
  this.kernel.populateFromSerializable(json.content);

  // NEW: Load persisted schema from attributes
  const attributes = await this.readAttributes(storage);
  this._persistedSchema = attributes?.schema;  // undefined if no schema stored
}
```

**Key point**: The DDS loads schema eagerly during `loadCore`, before any `viewWith()` calls. This is simpler than Tree's approach where schema is loaded via a separate summarizable.

#### Step 2: Application Calls viewWith()

When the application calls `viewWith()`, compatibility is checked **synchronously**:

```typescript
public viewWith<TSchema extends NodeSchema>(schema: TSchema): SchematizedView<TSchema> {
  // 1. Encode the view schema (for comparison)
  const encoded = encodeSchema(schema);

  // 2. Compute compatibility with stored schema
  const compatibility = this._persistedSchema === undefined
    ? { canView: true, canUpgrade: false, canInitialize: true, isEquivalent: true }
    : checkSchemaCompatibility(this._persistedSchema, encoded);

  // 3. Create storage adapter
  const storage = this.createStorage();
  const persistence = this.createPersistence();

  // 4. Return view with compatibility status
  return createSchematizedView(schema, storage, persistence, compatibility);
}
```

#### Step 3: Application Handles Compatibility

The application checks `view.compatibility` to decide what to do:

```typescript
const view = map.viewWith(UserProfileMap);

// Case A: New document (no stored schema)
if (view.compatibility.canInitialize) {
  view.initialize(new Map([["alice", { name: "Alice", email: "a@b.com" }]]));
}

// Case B: Existing document with compatible schema
else if (view.compatibility.canView) {
  const alice = view.get("alice");  // Works!
}

// Case C: Existing document, schema can be extended
else if (view.compatibility.canUpgrade) {
  view.upgradeSchema();  // Add new optional fields
  // Now canView is true
}

// Case D: Incompatible schema
else {
  throw new Error("Cannot open document - schema incompatible");
}
```

#### Comparison with Tree's Load Flow

| Aspect | Tree DDS | SharedMap |
|--------|----------|-----------|
| **Schema storage** | Separate blob (`indexes/Schema/SchemaString`) | Inside `.attributes` blob |
| **Schema loading** | Via `SchemaSummarizer` (lazy/modular) | Directly in `loadCore` (simple) |
| **Compatibility check** | `SchemaCompatibilityTester` class | `checkSchemaCompatibility()` function |
| **View creation** | `SchematizingSimpleTreeView` | `SchematizedMapView` |
| **Re-check on change** | `storedSchema.events.on("afterSchemaChange")` | `view.onSchemaChanged()` |

Tree's approach is more complex because:
1. Schema is a separate "summarizable" component
2. `TreeStoredSchemaRepository` manages schema with events
3. Views re-evaluate compatibility when schema changes

Our approach is simpler:
1. Schema is just a field in `.attributes`
2. SharedMap holds schema directly (`_persistedSchema`)
3. Views are notified via explicit callback

### 8.3 SharedMap Changes

The SharedMap class needs minimal changes - just adding the schema layer:

```typescript
// packages/dds/map/src/map.ts

import {
  encodeSchema,
  decodeSchema,
  checkSchemaCompatibility,
  type NodeSchema,
  type SchemaCompatibilityStatus,
} from "@fluidframework/schema";

export class SharedMap extends SharedObject<ISharedMapEvents> implements ISharedMap {
  // Existing fields unchanged
  private readonly kernel: MapKernel;

  // NEW: Schema layer
  private _persistedSchema: JsonCompatible | undefined;

  // NEW: Track active views for schema change notifications
  private readonly activeViews = new Set<SchematizedMapView<any>>();

  // Existing constructor - unchanged
  public constructor(
    id: string,
    runtime: IFluidDataStoreRuntime,
    attributes: IChannelAttributes,
  ) {
    super(id, runtime, attributes, "fluid_map_");
    this.kernel = new MapKernel(/* ... */);
  }

  // NEW: viewWith - creates storage adapter and view
  public viewWith<TSchema extends NodeSchema>(
    schema: TSchema
  ): SchematizedView<TSchema> {
    const storage = this.createStorage();
    const persistence = this.createPersistence();
    return createSchematizedView(schema, storage, persistence);
  }

  // Storage adapter - SharedMap always returns values (flat storage)
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

  // Persistence adapter for Modality 2
  private createPersistence(): ISchemaPersistence {
    return {
      getPersistedSchema: () => this._persistedSchema,
      setPersistedSchema: (s) => {
        if (this._persistedSchema !== undefined) {
          throw new UsageError("Cannot initialize - schema already stored");
        }
        this._persistedSchema = s;
        this.dirty();
      },
      upgradePersistedSchema: (s) => {
        this._persistedSchema = s;
        this.dirty();
      },
    };
  }

  private computeCompatibility(
    encoded: JsonCompatible,
    schema: NodeSchema
  ): SchemaCompatibilityStatus {
    if (this._persistedSchema === undefined) {
      // No stored schema - can initialize, can view (local mode)
      return {
        isEquivalent: true,
        canView: true,
        canUpgrade: false,
        canInitialize: true,
      };
    }
    // Check against stored schema
    return checkSchemaCompatibility(this._persistedSchema, schema);
  }

  // NEW: Called by view.initialize()
  internal setPersistedSchema(schema: JsonCompatible): void {
    if (this._persistedSchema !== undefined) {
      throw new UsageError("Cannot initialize - schema already stored");
    }
    this._persistedSchema = schema;
    // Mark dirty for summarization
    this.dirty();
  }

  // NEW: Called by view.upgradeSchema()
  internal upgradePersistedSchema(schema: JsonCompatible): void {
    this._persistedSchema = schema;
    this.dirty();
    // Notify all views of schema change
    for (const view of this.activeViews) {
      view.onSchemaChanged();
    }
  }

  // MODIFIED: Read schema during load
  protected async loadCore(storage: IChannelStorageService): Promise<void> {
    const json = await readAndParse<object>(storage, snapshotFileName);
    const newFormat = json as IMapSerializationFormat;

    // Existing data loading...
    if (Array.isArray(newFormat.blobs)) {
      this.kernel.populateFromSerializable(newFormat.content);
      // ... blob loading ...
    } else {
      this.kernel.populateFromSerializable(json as IMapDataObjectSerializable);
    }

    // NEW: Load schema from attributes
    const attributes = await this.readAttributes(storage);
    this._persistedSchema = attributes?.schema;
  }

  // MODIFIED: Write schema during summarize
  protected summarizeCore(
    serializer: IFluidSerializer,
    telemetryContext?: ITelemetryContext,
  ): ISummaryTreeWithStats {
    const builder = new SummaryTreeBuilder();

    // Existing data summarization...
    const data = this.kernel.getSerializedStorage(serializer);
    // ... partition data into blobs ...

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

  // ... existing methods unchanged ...
}
```

### 8.4 SchematizedMapView Implementation

The view wraps SharedMap with typed, validated operations:

```typescript
// packages/dds/map/src/schematizedMapView.ts

import {
  validateData,
  type NodeSchema,
  type SchemaCompatibilityStatus,
  type SchemaValidationError,
  encodeSchema,
  checkSchemaCompatibility,
} from "@fluidframework/schema";

export class SchematizedMapView<TSchema extends MapNodeSchema>
  implements Iterable<[string, NodeFromSchema<InferValueSchema<TSchema>>]>
{
  private _compatibility: SchemaCompatibilityStatus;
  private _disposed = false;

  constructor(
    private readonly map: SharedMap,
    private readonly schema: TSchema,
    compatibility: SchemaCompatibilityStatus,
    private readonly onDispose: () => void,
  ) {
    this._compatibility = compatibility;

    // Listen for map changes to emit typed events
    this.map.on("valueChanged", this.handleValueChanged);
  }

  // --- Compatibility Status ---

  public get compatibility(): SchemaCompatibilityStatus {
    return this._compatibility;
  }

  // --- Initialize (stores schema) ---

  public initialize(
    content: Map<string, NodeFromSchema<InferValueSchema<TSchema>>>
  ): void {
    this.ensureNotDisposed();

    if (!this._compatibility.canInitialize) {
      throw new UsageError("Cannot initialize - schema already stored");
    }

    // Validate all initial content
    for (const [key, value] of content) {
      this.validateValue(key, value);
    }

    // Store the schema
    const encoded = encodeSchema(this.schema);
    this.map.setPersistedSchema(encoded);

    // Set initial content
    for (const [key, value] of content) {
      this.map.set(key, value);
    }

    // Update compatibility status
    this._compatibility = {
      isEquivalent: true,
      canView: true,
      canUpgrade: true,
      canInitialize: false,
    };
  }

  // --- Upgrade Schema ---

  public upgradeSchema(): void {
    this.ensureNotDisposed();

    if (!this._compatibility.canUpgrade) {
      throw new UsageError("Cannot upgrade - schemas incompatible");
    }

    if (this._compatibility.isEquivalent) {
      return; // No-op if already equivalent
    }

    const encoded = encodeSchema(this.schema);
    this.map.upgradePersistedSchema(encoded);

    this._compatibility = {
      isEquivalent: true,
      canView: true,
      canUpgrade: true,
      canInitialize: false,
    };
  }

  // Called by SharedMap when schema changes
  internal onSchemaChanged(): void {
    const encoded = encodeSchema(this.schema);
    this._compatibility = checkSchemaCompatibility(
      this.map.persistedSchema,
      this.schema
    );
  }

  // --- Typed Map Operations ---

  public get(key: string): NodeFromSchema<InferValueSchema<TSchema>> | undefined {
    this.ensureCanView();
    const value = this.map.get(key);
    if (value === undefined) {
      return undefined;
    }
    // Validate on read - throws SchemaValidationError if malformed
    return this.validateValue(key, value);
  }

  public set(
    key: string,
    value: NodeFromSchema<InferValueSchema<TSchema>>
  ): this {
    this.ensureCanView();
    // TypeScript ensures type safety at compile time
    // Runtime validation is optional but recommended
    this.validateValue(key, value);
    this.map.set(key, value);
    return this;
  }

  public has(key: string): boolean {
    this.ensureCanView();
    return this.map.has(key);
  }

  public delete(key: string): boolean {
    this.ensureCanView();
    return this.map.delete(key);
  }

  public get size(): number {
    this.ensureCanView();
    return this.map.size;
  }

  public keys(): IterableIterator<string> {
    this.ensureCanView();
    return this.map.keys();
  }

  public values(): IterableIterator<NodeFromSchema<InferValueSchema<TSchema>>> {
    this.ensureCanView();
    return this.createValidatingIterator(this.map.values());
  }

  public entries(): IterableIterator<[string, NodeFromSchema<InferValueSchema<TSchema>>]> {
    this.ensureCanView();
    return this.createValidatingEntriesIterator(this.map.entries());
  }

  public [Symbol.iterator](): IterableIterator<[string, NodeFromSchema<InferValueSchema<TSchema>>]> {
    return this.entries();
  }

  public forEach(
    callback: (value: NodeFromSchema<InferValueSchema<TSchema>>, key: string) => void
  ): void {
    this.ensureCanView();
    for (const [key, value] of this) {
      callback(value, key);
    }
  }

  // --- Validation ---

  private validateValue(
    key: string,
    value: unknown
  ): NodeFromSchema<InferValueSchema<TSchema>> {
    // Uses validateData from @fluidframework/schema
    const valueSchema = this.schema.valueSchema;
    const result = validateData(valueSchema, value);
    if (!result.valid) {
      throw new SchemaValidationError(
        valueSchema,
        `Value at key "${key}" does not match schema: ${result.reason}`,
        key
      );
    }
    return value as NodeFromSchema<InferValueSchema<TSchema>>;
  }

  private ensureCanView(): void {
    this.ensureNotDisposed();
    if (!this._compatibility.canView) {
      throw new SchemaCompatibilityError(
        "Cannot access map - schema incompatible with stored schema"
      );
    }
  }

  private ensureNotDisposed(): void {
    if (this._disposed) {
      throw new UsageError("View has been disposed");
    }
  }

  // --- Iterator Helpers ---

  private *createValidatingIterator(
    inner: IterableIterator<unknown>
  ): IterableIterator<NodeFromSchema<InferValueSchema<TSchema>>> {
    let index = 0;
    for (const value of inner) {
      yield this.validateValue(`[${index}]`, value);
      index++;
    }
  }

  private *createValidatingEntriesIterator(
    inner: IterableIterator<[string, unknown]>
  ): IterableIterator<[string, NodeFromSchema<InferValueSchema<TSchema>>]> {
    for (const [key, value] of inner) {
      yield [key, this.validateValue(key, value)];
    }
  }

  // --- Disposal ---

  public dispose(): void {
    if (!this._disposed) {
      this._disposed = true;
      this.map.off("valueChanged", this.handleValueChanged);
      this.onDispose();
    }
  }

  private handleValueChanged = (changed: IValueChanged, local: boolean): void => {
    // Could emit typed events here if needed
  };
}
```

### 8.5 Attributes Blob Format

The `.attributes` blob gains an optional `schema` field:

```typescript
// Current format (unchanged for backward compatibility)
interface IMapAttributes {
  type: string;                    // "https://graph.microsoft.com/types/map"
  snapshotFormatVersion: string;   // "0.2"
  packageVersion: string;          // Package version
}

// Extended format with schema
interface IMapAttributesWithSchema extends IMapAttributes {
  schema?: {
    // Encoded schema from @fluidframework/schema
    kind: "map";
    identifier: string;
    valueSchema: EncodedNodeSchema;
  };
}
```

**Example with schema:**
```json
{
  "type": "https://graph.microsoft.com/types/map",
  "snapshotFormatVersion": "0.2",
  "packageVersion": "2.0.0",
  "schema": {
    "kind": "map",
    "identifier": "myApp.UserProfileMap",
    "valueSchema": {
      "kind": "object",
      "identifier": "myApp.UserProfile",
      "fields": {
        "name": { "kind": "required", "schema": { "kind": "leaf", "leafKind": "string" } },
        "email": { "kind": "required", "schema": { "kind": "leaf", "leafKind": "string" } },
        "age": { "kind": "optional", "schema": { "kind": "leaf", "leafKind": "number" } }
      }
    }
  }
}
```

### 8.6 Backward Compatibility

**Old clients reading new documents:**
- Old clients ignore unknown `schema` field in `.attributes`
- Map data is stored in standard format - fully readable
- No schema enforcement (untyped access works)

**New clients reading old documents:**
- `_persistedSchema` is undefined
- `canInitialize = true`, `canView = true`
- Can use local typing (Modality 1)
- Can call `initialize()` to add schema (Modality 2)

### 8.7 Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Schema in `.attributes` blob | Backward compatible, single location, already loaded |
| Separate view class | Doesn't pollute SharedMap API, clear lifecycle |
| Validation on read | Catches data written by old/untyped clients |
| TypeScript types on write | Compile-time safety, no runtime overhead |
| View tracks compatibility | Can update when schema changes |
| `initialize()` is separate | Clear distinction between local and persisted mode |

### 8.8 How MapNodeSchema Values Work (Pattern B)

A key distinction from Tree DDS: **map values are plain JSON objects, not tree nodes**.

#### The Data Model

```typescript
// Define a schema for user profiles
const UserProfile = sf.object("UserProfile", {
  name: sf.string,
  email: sf.string,
  age: sf.optional(sf.number),
});

const UserProfileMap = sf.map("UserProfileMap", UserProfile);

// What actually gets stored in the map:
{
  "alice": { "name": "Alice", "email": "alice@example.com", "age": 30 },
  "bob": { "name": "Bob", "email": "bob@example.com" }
}
```

The map stores **serialized JSON**, not proxy objects. This means:

| Aspect | Tree DDS | SharedMap with Schema |
|--------|----------|----------------------|
| Value type | Tree node proxy | Plain JSON object |
| In-place mutation | `user.name = "New"` triggers op | Not supported |
| Nested updates | Fine-grained ops | Replace entire object |
| Reactivity | Yes, nodes are observable | No, values are snapshots |

#### Reading Objects

When you call `view.get("alice")`, you receive a **plain object** (copy of stored data):

```typescript
const view = map.viewWith(UserProfileMap);
const user = view.get("alice");

// user is a plain object: { name: "Alice", email: "alice@example.com", age: 30 }
// Type: { name: string; email: string; age?: number }

// Mutating the returned object does NOT affect the map
user.name = "Alicia";  // Only changes local variable
console.log(view.get("alice").name);  // Still "Alice"
```

#### Writing Objects

To update, you must `set` a new object:

```typescript
// Read-modify-write pattern
const user = view.get("alice");
view.set("alice", { ...user, name: "Alicia" });

// Or set entirely new object
view.set("charlie", {
  name: "Charlie",
  email: "charlie@example.com"
});
```

#### Type Safety

The schema provides compile-time type safety:

```typescript
const view = map.viewWith(UserProfileMap);

// ✅ Correct - matches schema
view.set("alice", { name: "Alice", email: "alice@ex.com" });

// ❌ Compile error - missing required field 'email'
view.set("alice", { name: "Alice" });

// ❌ Compile error - wrong type for 'age'
view.set("alice", { name: "Alice", email: "x@y.com", age: "thirty" });

// ❌ Compile error - extra field not in schema
view.set("alice", { name: "Alice", email: "x@y.com", role: "admin" });
```

#### Runtime Validation

The view validates data on read (to catch untyped writes) and optionally on write:

```typescript
// On read - validates data matches schema
const user = view.get("alice");  // Throws SchemaValidationError if stored data is malformed

// On write - TypeScript catches most issues, runtime validation is defense-in-depth
view.set("bob", someUntypedValue as any);  // Runtime validates before storing
```

#### Nested Objects

Schemas can describe nested structures:

```typescript
const Address = sf.object("Address", {
  street: sf.string,
  city: sf.string,
  zip: sf.string,
});

const UserProfile = sf.object("UserProfile", {
  name: sf.string,
  email: sf.string,
  address: sf.optional(Address),
});

const UserProfileMap = sf.map("UserProfileMap", UserProfile);

// Usage
view.set("alice", {
  name: "Alice",
  email: "alice@example.com",
  address: {
    street: "123 Main St",
    city: "Seattle",
    zip: "98101"
  }
});

// The entire object (including nested address) is stored as one JSON value
// To update address, you must replace the whole user object
const user = view.get("alice")!;
view.set("alice", {
  ...user,
  address: { ...user.address!, city: "Bellevue" }
});
```

> **SharedMap uses Flat Storage**: Nested objects are stored as JSON blobs, not as separate containers. This means:
> - **Atomic updates**: Changing `address.city` requires replacing the entire user object
> - **Last-write-wins**: The whole nested structure is a single value for conflict resolution
> - **Simple merge**: No field-level merging within nested objects
>
> For field-level updates within nested structures, use **SharedDirectory** (hierarchical storage where nested objects become subdirectories) or **SharedTree** (fine-grained node-level updates).

#### Union Types

Values can be unions:

```typescript
const StringOrNumber = sf.union([sf.string, sf.number]);
const MixedMap = sf.map("MixedMap", StringOrNumber);

const view = map.viewWith(MixedMap);
view.set("count", 42);           // ✅ number
view.set("label", "Items");      // ✅ string
view.set("flag", true);          // ❌ Compile error - boolean not in union
```

#### Why Plain Objects (Not Proxies)?

1. **Simplicity**: SharedMap's data model is simple key-value pairs
2. **Performance**: No proxy overhead, direct JSON storage
3. **Compatibility**: Existing map data works unchanged
4. **Clarity**: Values are data snapshots, not live references

For reactive, fine-grained nested mutations, use **SharedTree** instead.

---

### 8.9 How ObjectNodeSchema Views Work (Pattern A)

Pattern A uses an `ObjectNodeSchema` to define a **fixed set of keys** where each key can have a different type. This is fundamentally different from Pattern B (MapNodeSchema).

> **Note**: `SchematizedObjectView` lives in `@fluidframework/schema`, not the map package. The schema package provides reusable view implementations that any DDS can use by providing a simple storage adapter.

#### The Data Model

```typescript
const sf = new SchemaFactory("myApp");

class AppSettings extends sf.object("AppSettings", {
  theme: sf.string,           // Required string
  fontSize: sf.number,        // Required number
  notifications: sf.boolean,  // Required boolean
  lastLogin: sf.optional(sf.string),  // Optional string
}) {}

// What gets stored in the map (one key per field):
{
  "theme": "dark",
  "fontSize": 14,
  "notifications": true,
  "lastLogin": "2024-01-15T10:30:00Z"
}
```

**Key insight**: Each schema field becomes a **separate map key** with its own value. This is NOT storing a single object—it's spreading the object's fields across map keys.

#### How It Maps to SharedMap

| Schema Field | Map Key | Map Value |
|--------------|---------|-----------|
| `theme: sf.string` | `"theme"` | `"dark"` |
| `fontSize: sf.number` | `"fontSize"` | `14` |
| `notifications: sf.boolean` | `"notifications"` | `true` |
| `lastLogin: sf.optional(sf.string)` | `"lastLogin"` | `"2024-01-15..."` or absent |

#### SchematizedObjectView Implementation

The view uses a **Proxy** to provide property-style access. It lives in the **schema package** and uses the unified `ISchemaStorage` interface:

```typescript
// packages/dds/schema/src/schematizedObjectView.ts

export class SchematizedObjectView<TSchema extends ObjectNodeSchema> {
  private _compatibility: SchemaCompatibilityStatus;
  private readonly proxy: InferFields<TSchema>;

  constructor(
    private readonly storage: ISchemaStorage,
    private readonly persistence: ISchemaPersistence | undefined,
    private readonly schema: TSchema,
    compatibility: SchemaCompatibilityStatus,
  ) {
    this._compatibility = compatibility;

    // Create a proxy that maps property access to storage operations
    this.proxy = new Proxy({} as InferFields<TSchema>, {
      get: (target, prop: string) => {
        // Handle special properties
        if (prop === "compatibility") return this._compatibility;
        if (prop === "initialize") return this.initialize.bind(this);
        if (prop === "upgradeSchema") return this.upgradeSchema.bind(this);

        // Property access → storage.getField(prop, schema)
        return this.getField(prop);
      },

      set: (target, prop: string, value) => {
        // Property assignment → storage.setField(prop, schema, value)
        this.setField(prop, value);
        return true;
      },

      has: (target, prop: string) => {
        // "prop" in view → check if field exists in schema
        return prop in this.schema.fields;
      },

      ownKeys: () => {
        // Object.keys(view) → return all field names
        return Object.keys(this.schema.fields);
      },

      getOwnPropertyDescriptor: (target, prop: string) => {
        if (prop in this.schema.fields) {
          return {
            configurable: true,
            enumerable: true,
            writable: true,
            value: this.getField(prop),
          };
        }
        return undefined;
      },
    });

    return this.proxy as unknown as this;
  }

  // --- Field Access ---

  private getField(fieldName: string): unknown {
    this.ensureCanView();

    const fieldSchema = this.schema.fields[fieldName];
    if (!fieldSchema) {
      return undefined;  // Unknown field
    }

    // Ask storage for this field - DDS decides how to handle it
    const result = this.storage.getField(fieldName, fieldSchema.schema);

    // Handle missing field
    if (result === undefined) {
      if (fieldSchema.optional) {
        return undefined;  // Valid - optional field not set
      }
      throw new SchemaValidationError(
        fieldSchema.schema,
        `Required field "${fieldName}" is missing`,
        fieldName
      );
    }

    // Handle based on what storage returned
    switch (result.type) {
      case "value":
        // Direct value - validate and return
        const validation = validateData(fieldSchema.schema, result.value);
        if (!validation.valid) {
          throw new SchemaValidationError(
            fieldSchema.schema,
            `Field "${fieldName}" has invalid value: ${validation.reason}`,
            fieldName
          );
        }
        return result.value;

      case "storage":
        // Nested storage - wrap in appropriate view
        if (isObjectSchema(fieldSchema.schema)) {
          return new SchematizedObjectView(result.storage, this.persistence, fieldSchema.schema, this._compatibility);
        } else if (isMapSchema(fieldSchema.schema)) {
          return new SchematizedMapView(result.storage, this.persistence, fieldSchema.schema, this._compatibility);
        }
        throw new Error(`Unexpected storage result for field "${fieldName}"`);
    }
  }

  private setField(fieldName: string, value: unknown): void {
    this.ensureCanView();

    const fieldSchema = this.schema.fields[fieldName];
    if (!fieldSchema) {
      throw new UsageError(`Unknown field: ${fieldName}`);
    }

    // Handle optional fields - undefined means delete
    if (value === undefined) {
      if (fieldSchema.optional) {
        this.storage.deleteField(fieldName);
        return;
      }
      throw new UsageError(`Cannot set required field "${fieldName}" to undefined`);
    }

    // Validate before setting
    const result = validateData(fieldSchema.schema, value);
    if (!result.valid) {
      throw new SchemaValidationError(
        fieldSchema.schema,
        `Invalid value for field "${fieldName}": ${result.reason}`,
        fieldName
      );
    }

    // Let DDS decide how to store it (flat JSON or nested storage)
    this.storage.setField(fieldName, fieldSchema.schema, value);
  }

  // --- Initialize ---

  public initialize(content: InferFields<TSchema>): void {
    if (!this._compatibility.canInitialize) {
      throw new UsageError("Cannot initialize - schema already stored");
    }

    // Validate all fields
    for (const [fieldName, fieldSchema] of Object.entries(this.schema.fields)) {
      const value = content[fieldName as keyof typeof content];

      if (value === undefined && !fieldSchema.optional) {
        throw new UsageError(`Missing required field: ${fieldName}`);
      }

      if (value !== undefined) {
        const result = validateData(fieldSchema.schema, value);
        if (!result.valid) {
          throw new SchemaValidationError(
            fieldSchema.schema,
            `Invalid value for field "${fieldName}": ${result.reason}`,
            fieldName
          );
        }
      }
    }

    // Store schema (if persistence is enabled)
    if (this.persistence) {
      const encoded = encodeSchema(this.schema);
      this.persistence.setPersistedSchema(encoded);
    }

    // Set all fields - DDS decides how to store each one
    for (const [fieldName, value] of Object.entries(content)) {
      const fieldSchema = this.schema.fields[fieldName];
      if (value !== undefined && fieldSchema) {
        this.storage.setField(fieldName, fieldSchema.schema, value);
      }
    }

    this._compatibility = {
      isEquivalent: true,
      canView: true,
      canUpgrade: true,
      canInitialize: false,
    };
  }

  // ... upgradeSchema, ensureCanView similar to SchematizedMapView ...
}
```

#### Usage Examples

```typescript
const settings = map.viewWith(AppSettings);

// Initialize with all required fields
if (settings.compatibility.canInitialize) {
  settings.initialize({
    theme: "light",
    fontSize: 12,
    notifications: true,
    // lastLogin is optional, can omit
  });
}

// Read fields (each is a separate map.get())
console.log(settings.theme);          // "light" - map.get("theme")
console.log(settings.fontSize);       // 12 - map.get("fontSize")
console.log(settings.lastLogin);      // undefined - map.get("lastLogin")

// Write fields (each is a separate map.set())
settings.theme = "dark";              // map.set("theme", "dark")
settings.fontSize = 14;               // map.set("fontSize", 14)
settings.lastLogin = new Date().toISOString();  // map.set("lastLogin", "...")

// Clear optional field
settings.lastLogin = undefined;       // map.delete("lastLogin")

// TypeScript enforces types
settings.theme = 123;                 // ❌ Compile error: number not assignable to string
settings.fontSize = "large";          // ❌ Compile error: string not assignable to number
settings.unknownField = "x";          // ❌ Compile error: property doesn't exist
```

#### Object Utilities

The Proxy implements the necessary traps for JS object utilities:

```typescript
const settings = map.viewWith(AppSettings);

// Object.keys - returns schema field names
Object.keys(settings);                // ["theme", "fontSize", "notifications", "lastLogin"]

// Object.entries - returns [fieldName, value] pairs
Object.entries(settings);             // [["theme", "dark"], ["fontSize", 14], ...]

// Object.values - returns field values
Object.values(settings);              // ["dark", 14, true, undefined]

// "in" operator - checks if field is in schema
"theme" in settings;                  // true
"unknownField" in settings;           // false

// Spread operator
const copy = { ...settings };         // { theme: "dark", fontSize: 14, ... }
```

#### Pattern A vs Pattern B Comparison

| Aspect | Pattern A (ObjectNodeSchema) | Pattern B (MapNodeSchema) |
|--------|------------------------------|---------------------------|
| Keys | Fixed, known at compile time | Dynamic, any string |
| Value types | Different type per key | Same type for all values |
| Access style | `view.fieldName` | `view.get("key")` |
| TypeScript | Property types per field | Single value type |
| Map storage | One key per field | One key per entry |
| Use case | Settings, config objects | Collections, lookups |

#### Stored Schema Format (Pattern A)

```json
{
  "type": "https://graph.microsoft.com/types/map",
  "snapshotFormatVersion": "0.2",
  "packageVersion": "2.0.0",
  "schema": {
    "kind": "object",
    "identifier": "myApp.AppSettings",
    "fields": {
      "theme": { "kind": "required", "schema": { "kind": "leaf", "leafKind": "string" } },
      "fontSize": { "kind": "required", "schema": { "kind": "leaf", "leafKind": "number" } },
      "notifications": { "kind": "required", "schema": { "kind": "leaf", "leafKind": "boolean" } },
      "lastLogin": { "kind": "optional", "schema": { "kind": "leaf", "leafKind": "string" } }
    }
  }
}
```

#### Key Design Decisions for Pattern A

| Decision | Rationale |
|----------|-----------|
| Use Proxy | Enables natural property syntax (`view.field`) |
| Field → Map Key | Each field is independent, can be updated atomically |
| Required field validation | Throws on read if missing, prevents undefined where type says otherwise |
| `undefined` = delete for optional | Natural JS semantics for clearing a field |
| Schema field names = valid keys | Only schema-defined fields are accessible |

---

### 8.10 What the Schema Package Must Provide

For this implementation to work, `@fluidframework/schema` must export:

```typescript
// =============================================================================
// Schema Types
// =============================================================================

export type { NodeSchema, MapNodeSchema, ObjectNodeSchema, ArrayNodeSchema, LeafSchema };
export type { SchemaCompatibilityStatus };
export type { NodeFromSchema, InferValueSchema, InferFields };

// =============================================================================
// Unified Storage Interface
// =============================================================================

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

  /** Delete a field */
  deleteField(key: string): boolean;

  /** Check if a field exists */
  hasField(key: string): boolean;

  /** Iterate over keys (for MapNodeSchema) */
  keys?(): IterableIterator<string>;

  /** Number of entries (for MapNodeSchema) */
  readonly size?: number;
}

/** Schema persistence callbacks for Modality 2 */
export interface ISchemaPersistence {
  getPersistedSchema(): JsonCompatible | undefined;
  setPersistedSchema(schema: JsonCompatible): void;
  upgradePersistedSchema(schema: JsonCompatible): void;
}

// =============================================================================
// Serialization & Compatibility
// =============================================================================

export function encodeSchema(schema: NodeSchema): JsonCompatible;
export function decodeSchema(encoded: JsonCompatible): SimpleNodeSchema;
export function checkSchemaCompatibility(
  stored: JsonCompatible,
  view: NodeSchema
): SchemaCompatibilityStatus;
export function getSchemaKind(schema: NodeSchema): SchemaKind;

// =============================================================================
// Validation
// =============================================================================

export function validateData(
  schema: NodeSchema,
  data: unknown
): { valid: true } | { valid: false; reason: string };

export class SchemaValidationError extends Error { ... }

// =============================================================================
// Reusable View Implementations
// =============================================================================

export class SchematizedObjectView<TSchema extends ObjectNodeSchema> { ... }
export class SchematizedMapView<TSchema extends MapNodeSchema> { ... }

// =============================================================================
// Factory - Creates the right view based on schema kind
// =============================================================================

/**
 * Creates a schematized view for any schema kind.
 * Uses the unified ISchemaStorage interface - DDS controls flat vs hierarchical.
 */
export function createSchematizedView<TSchema extends NodeSchema>(
  schema: TSchema,
  storage: ISchemaStorage,
  persistence?: ISchemaPersistence,
): SchematizedView<TSchema>;
```

---

## 9. Comparison with Tree DDS

This section compares our unified `ISchemaStorage` design with Tree DDS's architecture to show the relationship and key differences.

### 9.1 Architectural Comparison

| Layer | Tree DDS | Schema DDSes (SharedMap, Directory) |
|-------|----------|-------------------------------------|
| **Storage** | Forest (cursors, anchors) | `ISchemaStorage` interface |
| **Schema-Aware** | Flex-Tree (FlexTreeNode) | `SchematizedObjectView` / `SchematizedMapView` |
| **User API** | Simple-Tree (TreeNode proxies) | Same view classes (proxies or wrappers) |
| **Schema** | `ImplicitFieldSchema`, `TreeSchema` | `NodeSchema`, `ObjectNodeSchema`, `MapNodeSchema` |
| **Factory** | `SchemaFactory` | Same `SchemaFactory` |

### 9.2 Key Design Differences

**Tree's Multi-Layer Architecture:**
```
┌─────────────────────────────────────────────────┐
│  Simple-Tree (TreeNode/MapNode/ObjectNode)      │  User-facing proxies
├─────────────────────────────────────────────────┤
│  Flex-Tree (FlexTreeNode, Context, Anchors)     │  Schema-aware navigation
├─────────────────────────────────────────────────┤
│  Forest (ITreeCursor, ChunkedForest)            │  Raw tree storage + identity
└─────────────────────────────────────────────────┘
```

Tree has three layers because it needs:
- **Identity preservation**: Nodes keep identity across edits (anchors)
- **Fine-grained ops**: Individual field edits, not whole-object replacement
- **Lazy hydration**: Nodes created on-demand from cursors

**Our Simplified Architecture:**
```
┌─────────────────────────────────────────────────┐
│  SchematizedObjectView / SchematizedMapView     │  User-facing views
├─────────────────────────────────────────────────┤
│  ISchemaStorage (DDS-provided)                  │  Unified storage interface
└─────────────────────────────────────────────────┘
```

We can use two layers because:
- **No identity tracking**: Values are snapshots, not live nodes
- **Atomic replacement**: Whole objects replaced on set
- **Simpler storage**: Map/Directory already handle conflict resolution

### 9.3 How Tree Handles Nested Values

Tree uses a discriminated approach similar to our `StorageResult`:

```typescript
// Tree's approach (simplified from getTreeNodeForField.ts)
function getFieldValue(field: FlexTreeField) {
  const content = field.content;
  if (isFlexTreeNode(content)) {
    // Nested node → wrap in proxy
    return getOrCreateNodeFromInnerNode(content);
  } else {
    // Leaf value → return directly
    return content;  // string, number, boolean, null, Handle
  }
}
```

**Our analogous approach:**
```typescript
// Our approach (from SchematizedObjectView)
private getField(fieldName: string): unknown {
  const result = this.storage.getField(fieldName, fieldSchema);

  switch (result.type) {
    case "value":
      // Leaf value → return directly (with validation)
      return result.value;

    case "storage":
      // Nested storage → wrap in view
      return new SchematizedObjectView(result.storage, fieldSchema);
  }
}
```

### 9.4 Key Insight: DDS Controls the Strategy

Tree's Forest always stores tree structure, then layers above interpret it. In our design, the **DDS itself decides** how to handle nesting:

| DDS | Strategy | `getField()` Returns |
|-----|----------|---------------------|
| **SharedMap** | Flat (JSON blobs) | Always `{ type: "value" }` |
| **SharedDirectory** | Hierarchical (subdirectories) | `{ type: "storage" }` for nested objects |
| **Hybrid (future)** | Mixed | Depends on field/schema |

This is simpler than Tree's approach because:
1. No need for cursor/anchor machinery
2. Each DDS uses its native storage model
3. Schema package doesn't dictate storage structure

### 9.5 What We Reuse from Tree

| Component | Reused? | Notes |
|-----------|---------|-------|
| `SchemaFactory` | ✅ Yes | Same API for defining schemas |
| `NodeSchema` types | ✅ Yes | `ObjectNodeSchema`, `MapNodeSchema`, etc. |
| Type utilities | ✅ Yes | `NodeFromSchema`, type inference |
| `TreeView` pattern | ✅ Yes | `viewWith()`, `compatibility`, `initialize()` |
| Schema encoding | ✅ Yes | Same format for persistence |
| Compatibility checking | ✅ Yes | Same algorithm |
| Forest/Anchors | ❌ No | DDSes have their own storage |
| Flex-Tree layer | ❌ No | Simplified to `ISchemaStorage` |
| EditManager | ❌ No | DDSes handle their own ops |

---

## 10. Other DDS Examples

### 10.1 SharedDirectory Implementation

SharedDirectory uses **hierarchical storage** where nested objects become subdirectories:

```typescript
// packages/dds/map/src/directory.ts

class SharedDirectory {
  public viewWith<TSchema extends ObjectNodeSchema>(
    schema: TSchema
  ): SchematizedView<TSchema> {
    const storage = this.createStorage();
    const persistence = this.createPersistence();
    return createSchematizedView(schema, storage, persistence);
  }

  private createStorage(): ISchemaStorage {
    return {
      getField: (key, fieldSchema) => {
        if (isObjectSchema(fieldSchema) || isMapSchema(fieldSchema)) {
          // Nested schema → return subdirectory as nested storage
          const subdir = this.getSubDirectory(key);
          if (!subdir) return undefined;
          return { type: "storage", storage: subdir.createStorage() };
        } else {
          // Leaf schema → return value
          const value = this.get(key);
          if (value === undefined) return undefined;
          return { type: "value", value };
        }
      },

      setField: (key, fieldSchema, value) => {
        if (isObjectSchema(fieldSchema) || isMapSchema(fieldSchema)) {
          // Nested schema → create/update subdirectory
          let subdir = this.getSubDirectory(key);
          if (!subdir) {
            subdir = this.createSubDirectory(key);
          }
          populateStorage(subdir.createStorage(), fieldSchema, value);
        } else {
          // Leaf schema → store value
          this.set(key, value);
        }
      },

      deleteField: (key) => {
        return this.delete(key) || this.deleteSubDirectory(key);
      },

      hasField: (key) => this.has(key) || this.hasSubDirectory(key),
    };
  }
}
```

**Usage:**
```typescript
const sf = new SchemaFactory("myApp");

class ProfileSettings extends sf.object("ProfileSettings", {
  avatar: sf.string,
  bio: sf.optional(sf.string),
}) {}

class AppSettings extends sf.object("AppSettings", {
  theme: sf.string,
  profile: ProfileSettings,  // Nested object → becomes subdirectory
}) {}

const view = directory.viewWith(AppSettings);

// Access flat values
view.theme = "dark";            // Stored in root directory

// Access nested values
view.profile.avatar = "pic.jpg"; // Stored in "profile" subdirectory

// Under the hood:
// - directory.set("theme", "dark")
// - directory.getSubDirectory("profile").set("avatar", "pic.jpg")
```

**Benefits of hierarchical storage:**
- Field-level conflict resolution (not last-write-wins on whole object)
- Can have different collaborators editing different nested fields
- Matches directory's natural structure

### 10.2 SharedString Implementation

SharedString has **multiple schema surfaces** with different storage patterns:

```typescript
// packages/dds/sequence/src/sharedString.ts

interface SharedStringSchemaConfig {
  textProperties?: ObjectNodeSchema;
  markerTypes?: ObjectNodeSchema[];
  intervalCollections?: Record<string, ObjectNodeSchema>;
}

class SharedString {
  public viewWith<TConfig extends SharedStringSchemaConfig>(
    config: TConfig
  ): TypedSharedStringView<TConfig> {
    const persistence = this.createPersistence();
    return new TypedSharedStringView(this, config, persistence);
  }
}

class TypedSharedStringView<TConfig> {
  // Text properties - stored on segments (NOT using ISchemaStorage)
  annotateRange(
    start: number,
    end: number,
    props: InferTextProps<TConfig>
  ): void {
    validateData(this.config.textProperties, props);
    this.string.annotateRange(start, end, props as PropertySet);
  }

  getPropertiesAtPosition(pos: number): InferTextProps<TConfig> | undefined {
    const props = this.string.getPropertiesAtPosition(pos);
    if (!props) return undefined;
    validateData(this.config.textProperties, props);
    return props as InferTextProps<TConfig>;
  }

  // Markers - stored in string (NOT using ISchemaStorage)
  insertMarker<T extends InferMarkerTypes<TConfig>>(
    pos: number,
    schema: T,
    props: NodeFromSchema<T>
  ): void {
    validateData(schema, props);
    this.string.insertMarker(pos, ReferenceType.Simple, {
      ...props,
      _schemaType: schema.identifier,  // Store schema type for retrieval
    });
  }

  // Interval collections - each collection could use ISchemaStorage
  getIntervalCollection<K extends keyof InferIntervalCollections<TConfig>>(
    label: K
  ): TypedIntervalCollection<InferIntervalCollections<TConfig>[K]> {
    const collection = this.string.getIntervalCollection(label as string);
    const schema = this.config.intervalCollections[label];
    return new TypedIntervalCollection(collection, schema);
  }
}
```

**Key insight**: SharedString doesn't fit neatly into `ISchemaStorage` because:
- Text properties are on **segments**, not keys
- Markers are embedded **in the string**, not in a map
- Only interval collections could use the storage pattern

This is OK! `ISchemaStorage` is for DDSes with key-value semantics. SharedString uses a custom view that validates against schema but doesn't use the storage interface.

### 10.3 Comparison Table

| Aspect | SharedMap | SharedDirectory | SharedString |
|--------|-----------|-----------------|--------------|
| **Storage Interface** | `ISchemaStorage` | `ISchemaStorage` | Custom |
| **Nested Objects** | JSON blobs (flat) | Subdirectories | N/A |
| **`getField()` Returns** | Always `{ type: "value" }` | `{ type: "storage" }` for nested | N/A |
| **Conflict Resolution** | Last-write-wins (whole value) | Field-level | Segment-based |
| **Schema Surfaces** | 1 (map values) | 1 (directory entries) | 3 (text, markers, intervals) |
| **Uses `SchematizedObjectView`** | ✅ Yes | ✅ Yes | ❌ No |
| **View Implementation** | `SchematizedMapView` | `SchematizedObjectView` | `TypedSharedStringView` |

---

## 11. Package Responsibilities

| Component | Package | Notes |
|-----------|---------|-------|
| **Schema Types** | | |
| `NodeSchema`, `ObjectNodeSchema`, `MapNodeSchema` | `@fluidframework/schema` | Schema types |
| `SchemaFactory` | `@fluidframework/schema` | Schema creation |
| `NodeFromSchema`, `InferFields`, `InferValueSchema` | `@fluidframework/schema` | Type utilities |
| **Storage Interface** | | |
| `ISchemaStorage` | `@fluidframework/schema` | Unified interface for all DDSes |
| `StorageResult` | `@fluidframework/schema` | Discriminated union: `value` or `storage` |
| `ISchemaPersistence` | `@fluidframework/schema` | For Modality 2 |
| **View Implementations** | | |
| `SchematizedObjectView`, `SchematizedMapView` | `@fluidframework/schema` | Reusable view classes |
| `createSchematizedView()` | `@fluidframework/schema` | Factory function |
| **Utilities** | | |
| `encodeSchema`, `decodeSchema` | `@fluidframework/schema` | Serialization |
| `checkSchemaCompatibility` | `@fluidframework/schema` | Compatibility checking |
| `validateData` | `@fluidframework/schema` | Runtime validation |
| `SchemaCompatibilityStatus` | `@fluidframework/schema` | Compatibility interface |
| **DDS Integration** | | |
| `ISharedMap.viewWith()` | `@fluidframework/map` | Returns `{ type: "value" }` for all fields |
| `ISharedDirectory.viewWith()` | `@fluidframework/map` | Returns `{ type: "storage" }` for nested schemas |
| `.attributes` schema field | `@fluidframework/map` | Storage location |

---

## 12. Implementation Phases

### Phase 1: Schema Package Foundation
- Extract schema types from Tree DDS
- Export type utilities (`NodeFromSchema`, etc.)
- Implement `encodeSchema`, `decodeSchema`
- Implement `checkSchemaCompatibility`

### Phase 2: Modality 1 (Local-Only)
- Add `viewWith` method to `ISharedMap`
- Return view with `compatibility` status
- Implement `SchematizedObjectView` (proxy for ObjectNodeSchema)
- Implement `SchematizedMapView` (wrapper for MapNodeSchema)
- No storage changes needed

### Phase 3: Modality 2 (Persistence)
- Add `initialize()` method to views
- Add `upgradeSchema()` method to views
- Extend `.attributes` blob with optional `schema` field
- Update `loadCore` to read schema
- Update `summarizeCore` to write schema

### Phase 4: Polish
- Documentation and examples
- Migration guide for existing applications
