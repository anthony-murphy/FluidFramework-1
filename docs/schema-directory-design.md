# SharedDirectory Schema Integration Design

> **Related Documents**:
> - [Schema Extraction Plan](./schema-extraction-plan.md) - Core schema package extraction
> - [Schema DDS Integration Patterns](./schema-dds-integration.md) - General modality patterns
> - [SharedMap Schema Design](./schema-map-design.md) - SharedMap implementation
> - [SharedString Schema Design](./schema-string-design.md) - SharedString implementation
> - [Open Items & Notes](./schema-open-items.md) - Open questions, risks, and concerns

This document provides the detailed design for adding schema support to SharedDirectory using a unified `viewWith` API that follows Tree DDS's proven pattern.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Implementation Detail: Separate Namespaces](#2-implementation-detail-separate-namespaces)
3. [Current API](#3-current-api)
4. [Schema Design: Tree-Like Node Model](#4-schema-design-tree-like-node-model)
5. [The viewWith API](#5-the-viewwith-api)
6. [Examples](#6-examples)
7. [Type Signatures](#7-type-signatures)
8. [Local vs Persisted Mode](#8-local-vs-persisted-mode)
9. [Open Questions](#9-open-questions)

---

## 1. Overview

SharedDirectory should be modeled like **Tree**: just nodes, where some values can be other nodes (subdirectories).

```
Tree Model:
  ObjectNode
    ├── field: LeafNode (primitive)
    ├── field: ObjectNode (nested object)
    └── field: MapNode (dynamic children)

Directory Model (analogous):
  Directory
    ├── key: value (primitive or serializable)
    └── key: Directory (subdirectory = nested node)
```

The key insight: **a subdirectory is just a value that happens to be another directory node**. This is exactly how Tree works—some fields point to leaf values, some point to other nodes.

---

## 2. Implementation Detail: Separate Namespaces

**Note**: SharedDirectory currently maintains separate namespaces for storage vs subdirectories. This is an implementation detail that may influence how we expose schema, but conceptually we should think of it as a unified namespace where values can be either primitives or subdirectory nodes.

```typescript
// Current implementation (two separate maps)
class SubDirectory {
  private readonly sequencedStorageData = new Map<string, unknown>();
  private readonly _sequencedSubdirectories = new Map<string, SubDirectory>();
}
```

For schema purposes, we can model this as a single unified namespace, or expose both—see [Open Questions](#8-open-questions).

---

## 3. Current API

```typescript
const dir = container.create(SharedDirectory);

// Primitive values
dir.set("name", "Alice");
dir.set("age", 30);

// Subdirectories (nested nodes)
const profile = dir.createSubDirectory("profile");
profile.set("avatar", "photo.jpg");

// Nested subdirectories
const settings = profile.createSubDirectory("preferences");
settings.set("theme", "dark");
```

---

## 4. Schema Design: Tree-Like Node Model

### Core Concept

A directory schema defines what keys exist and what type each key holds. A key's type can be:
- A **primitive/leaf** (string, number, boolean, serializable object)
- A **subdirectory** (another directory node with its own schema)

This mirrors Tree exactly:
- Tree `ObjectNode` has fields that can be leaves or other nodes
- Directory has keys that can be values or subdirectories

### Schema Definition

```typescript
import { SchemaFactory } from "@fluidframework/schema";

const sf = new SchemaFactory("myApp");

// A subdirectory is just another node type
class ProfileDirectory extends sf.object("ProfileDirectory", {
  displayName: sf.string,
  avatar: sf.optional(sf.string),
  bio: sf.optional(sf.string),
}) {}

class SettingsDirectory extends sf.object("SettingsDirectory", {
  theme: sf.string,
  language: sf.string,
  notifications: sf.boolean,
}) {}

// Root directory schema - some fields are primitives, some are subdirectories
class AppDirectory extends sf.object("AppDirectory", {
  // Primitive values
  appName: sf.string,
  version: sf.number,

  // Subdirectories (nested nodes)
  profile: ProfileDirectory,
  settings: SettingsDirectory,
}) {}
```

### Usage

```typescript
const view = directory.viewWith(AppDirectory);

// Check compatibility status
if (view.compatibility.canInitialize) {
  // No stored schema yet - optionally initialize
  view.initialize({
    appName: "My App",
    version: 1,
    profile: { displayName: "User", avatar: undefined, bio: undefined },
    settings: { theme: "dark", language: "en", notifications: true },
  });
}

// Primitive access (like Tree)
view.appName;              // string
view.version;              // number

// Subdirectory access (like Tree nested nodes)
view.profile.displayName;  // string
view.profile.avatar;       // string | undefined

view.settings.theme;       // string
view.settings.notifications; // boolean

// Type errors
view.unknown;              // ❌ Compile error
view.profile.invalid;      // ❌ Compile error
```

### Dynamic Keys (Map-like directories)

For directories with dynamic keys (like a "users" directory):

```typescript
class UserProfile extends sf.object("UserProfile", {
  name: sf.string,
  email: sf.string,
}) {}

// Map-like directory: dynamic keys, all values same type
class UsersDirectory extends sf.map("UsersDirectory", UserProfile) {}

class AppDirectory extends sf.object("AppDirectory", {
  appName: sf.string,
  users: UsersDirectory,  // Map-like subdirectory
}) {}

// Usage
const view = directory.viewWith(AppDirectory);
view.users.get("alice");  // UserProfile | undefined
view.users.set("bob", { name: "Bob", email: "bob@example.com" });
```

### Recursive Structures

For file-system-like trees:

```typescript
class FileInfo extends sf.object("FileInfo", {
  name: sf.string,
  size: sf.number,
  mimeType: sf.string,
}) {}

// Recursive: folder contains files and other folders
class FolderDirectory extends sf.object("FolderDirectory", {
  files: sf.map("Files", FileInfo),
  folders: sf.map("Folders", sf.lazy(() => FolderDirectory)),
}) {}

// Usage
const view = directory.viewWith(FolderDirectory);
view.files.get("readme.txt");           // FileInfo
view.folders.get("docs").files.get("guide.pdf");  // FileInfo (nested)
```

---

## 5. The viewWith API

SharedDirectory uses the same `viewWith` pattern as SharedMap and Tree:

```typescript
const view = directory.viewWith(AppDirectory);
```

This returns a view with:
- **`compatibility`** - Status of view schema vs stored schema
- **`initialize(content)`** - Set schema and initial content (when `canInitialize` is true)
- **`upgradeSchema()`** - Extend stored schema (when `canUpgrade` is true)
- **Typed accessors** - Property access for known keys, or Map interface for dynamic keys

### Compatibility Status

```typescript
const view = directory.viewWith(AppDirectory);

// Check what's possible
view.compatibility.isEquivalent;   // true if schemas match exactly
view.compatibility.canView;        // true if you can use the view
view.compatibility.canUpgrade;     // true if upgradeSchema() would work
view.compatibility.canInitialize;  // true if no stored schema yet
```

### Handling Different States

```typescript
const view = directory.viewWith(AppDirectory);

if (view.compatibility.canInitialize) {
  // New document - initialize with schema and content
  view.initialize({
    appName: "My App",
    version: 1,
    profile: { displayName: "User" },
    settings: { theme: "dark", language: "en", notifications: true },
  });
} else if (view.compatibility.canView) {
  // Existing document with compatible schema
  const theme = view.settings.theme;
} else if (view.compatibility.canUpgrade) {
  // Can extend stored schema
  view.upgradeSchema();
} else {
  // Incompatible schema
  throw new Error("Schema incompatible with document");
}
```

---

## 6. Examples

### Example 1: Simple App State

```typescript
const sf = new SchemaFactory("myApp");

class AppState extends sf.object("AppState", {
  currentUser: sf.optional(sf.string),
  isLoggedIn: sf.boolean,
  lastSync: sf.optional(sf.number),
}) {}

const view = directory.viewWith(AppState);

if (view.compatibility.canInitialize) {
  view.initialize({ currentUser: undefined, isLoggedIn: false, lastSync: undefined });
}

view.isLoggedIn;     // boolean
view.currentUser;    // string | undefined
```

### Example 2: Nested Configuration

```typescript
const sf = new SchemaFactory("myApp");

class ThemeSettings extends sf.object("ThemeSettings", {
  mode: sf.string,  // "light" | "dark"
  accentColor: sf.string,
}) {}

class EditorSettings extends sf.object("EditorSettings", {
  fontSize: sf.number,
  fontFamily: sf.string,
  tabSize: sf.number,
}) {}

class UserPreferences extends sf.object("UserPreferences", {
  theme: ThemeSettings,
  editor: EditorSettings,
}) {}

const view = directory.viewWith(UserPreferences);
view.theme.mode;           // string
view.editor.fontSize;      // number
```

### Example 3: User Directory with Dynamic Children

```typescript
const sf = new SchemaFactory("myApp");

class UserData extends sf.object("UserData", {
  displayName: sf.string,
  email: sf.string,
  role: sf.string,
}) {}

class UsersDirectory extends sf.map("UsersDirectory", UserData) {}

class AdminDirectory extends sf.object("AdminDirectory", {
  organizationName: sf.string,
  users: UsersDirectory,
}) {}

const view = directory.viewWith(AdminDirectory);
view.organizationName;                    // string
view.users.get("alice")?.displayName;     // string | undefined
view.users.set("bob", { displayName: "Bob", email: "bob@co.com", role: "member" });
```

---

## 7. Type Signatures

```typescript
interface ISharedDirectory {
  /**
   * Get a typed view of this directory.
   * Same pattern as SharedMap and Tree.
   */
  viewWith<TSchema extends ObjectNodeSchema | MapNodeSchema>(
    schema: TSchema
  ): DirectoryView<TSchema>;
}

/**
 * Compatibility status returned by viewWith().
 */
interface SchemaCompatibilityStatus {
  readonly isEquivalent: boolean;
  readonly canView: boolean;
  readonly canUpgrade: boolean;
  readonly canInitialize: boolean;
}

/**
 * DirectoryView provides Tree-like access to directory contents.
 * For ObjectNodeSchema: property access for known fields
 * For MapNodeSchema: get/set/delete for dynamic keys
 */
type DirectoryView<TSchema> =
  TSchema extends ObjectNodeSchema ? ObjectDirectoryView<TSchema> :
  TSchema extends MapNodeSchema ? MapDirectoryView<TSchema> :
  never;

// Object-like directory (known keys)
interface ObjectDirectoryView<TSchema extends ObjectNodeSchema> {
  /** Compatibility status of view schema vs stored schema. */
  readonly compatibility: SchemaCompatibilityStatus;

  /** Store schema and set initial content. Only valid when canInitialize is true. */
  initialize(content: InferFields<TSchema>): void;

  /** Extend stored schema to support view schema. Only valid when canUpgrade is true. */
  upgradeSchema(): void;

  // Typed property access for each field
  [K in keyof FieldsOf<TSchema>]: FieldView<FieldsOf<TSchema>[K]>;
}

// Map-like directory (dynamic keys)
interface MapDirectoryView<TSchema extends MapNodeSchema> {
  /** Compatibility status of view schema vs stored schema. */
  readonly compatibility: SchemaCompatibilityStatus;

  /** Store schema and set initial content. Only valid when canInitialize is true. */
  initialize(content: Map<string, ValueTypeOf<TSchema>>): void;

  /** Extend stored schema to support view schema. Only valid when canUpgrade is true. */
  upgradeSchema(): void;

  // Typed Map interface
  get(key: string): ValueView<ValueTypeOf<TSchema>> | undefined;
  set(key: string, value: ValueTypeOf<TSchema>): void;
  delete(key: string): boolean;
  has(key: string): boolean;
  keys(): IterableIterator<string>;
  values(): IterableIterator<ValueView<ValueTypeOf<TSchema>>>;
  entries(): IterableIterator<[string, ValueView<ValueTypeOf<TSchema>>]>;
}

// Field view: primitive or nested directory
type FieldView<TField> =
  TField extends ObjectNodeSchema ? ObjectDirectoryView<TField> :
  TField extends MapNodeSchema ? MapDirectoryView<TField> :
  TField;  // primitive
```

---

## 8. Local vs Persisted Mode

| Action | Schema Storage | Compatibility Check | Use Case |
|--------|----------------|---------------------|----------|
| `viewWith()` only | Not persisted | None | Local typing only (Modality 1) |
| `viewWith()` + `initialize()` | In `.attributes` blob | Automatic on load | Type safety + persistence (Modality 2) |

### Local-Only Mode (No Initialize)

Use `viewWith()` without calling `initialize()`. Schema is never stored:

```typescript
const view = directory.viewWith(AppDirectory);

// canInitialize = true, canView = true
// Just use the view - schema is not stored
view.settings.theme;  // Typed access
```

### Persisted Mode (Call Initialize)

Call `initialize()` to store the schema in the document:

```typescript
const view = directory.viewWith(AppDirectory);

if (view.compatibility.canInitialize) {
  // Store schema and initial content
  view.initialize({
    appName: "My App",
    version: 1,
    profile: { displayName: "User" },
    settings: { theme: "dark", language: "en", notifications: true },
  });
}

// Now schema is persisted - future clients check compatibility
```

### Recommendation

**Persisted mode** (calling `initialize()`) is recommended for SharedDirectory:

1. All clients agree on directory structure
2. Subdirectory schemas are consistent
3. Schema evolution is tracked via `upgradeSchema()`

---

## 9. Open Questions

1. **Unified vs separate namespaces**: Should schema expose the underlying two-namespace implementation, or present a unified namespace where subdirectories are just a special value type?

2. **Mutable structure**: Tree objects have fixed fields. Should schematized directories allow adding/removing fields at runtime, or be fixed like Tree?

3. **Existing data migration**: How do existing directories (created without schema) migrate to schematized directories?

4. **Mixed schemas**: Can a directory have some typed fields and some untyped "extra" fields?

5. **Property access vs method access**: Should `view.profile` be direct property access (like Tree) or `view.getSubDirectory("profile")`?
