# @fluidframework/schema

<!-- AUTO-GENERATED-CONTENT:START (LIBRARY_README_HEADER:) -->

<!-- prettier-ignore-start -->
<!-- NOTE: This section is automatically generated using @fluid-tools/markdown-magic. Do not update these generated contents directly. -->

## Using Fluid Framework libraries

When taking a dependency on a Fluid Framework library's public APIs, we recommend using a `^` (caret) version range, such as `^1.3.4`.
While Fluid Framework libraries may use different ranges with interdependencies between other Fluid Framework libraries,
library consumers should always prefer `^`.

If using any of Fluid Framework's unstable APIs (for example, its `beta` APIs), we recommend using a more constrained version range, such as `~`.

## Installation

To get started, install the package by running the following command:

```bash
npm i @fluidframework/schema
```

<!-- prettier-ignore-end -->

<!-- AUTO-GENERATED-CONTENT:END -->

## Overview

The `@fluidframework/schema` package provides a shared schema system for Fluid Framework distributed data structures (DDSes).

This schema system allows you to define the structure and types of data stored in DDSes, enabling:

- **Type Safety**: Define schemas that describe the shape of your data
- **Validation**: Validate data against schema definitions
- **Interoperability**: Share schema definitions across different DDSes

## Usage

### Define Schemas

```typescript
import { SchemaFactory } from "@fluidframework/schema";

// Create a schema factory with a unique scope
const sf = new SchemaFactory("com.example.myapp");

// Define an object schema with typed fields
class UserProfile extends sf.object("UserProfile", {
  name: sf.string,
  email: sf.string,
  age: sf.optional(sf.number),  // Optional field
}) {}

// Define a map schema for dynamic keys
const UserMap = sf.map("UserMap", UserProfile);
```

### Use with DDSes

DDSes that support schema (like SharedMap) provide a `viewWith()` method:

```typescript
import type { ISharedMap } from "@fluidframework/map";

const map: ISharedMap = /* from container */;

// Create a typed view - accepts schema directly or config object
const view = map.viewWith(UserMap);
// Or with config: map.viewWith({ schema: UserMap, enableSchemaValidation: true })

// Check compatibility and initialize if needed
if (view.compatibility.canInitialize) {
  view.initialize();  // Persist schema
}

// Access data through the root property
const alice = view.root.get("alice");  // UserProfile | undefined
alice?.name;  // string

// Typed writes
view.root.set("bob", { name: "Bob", email: "bob@example.com", age: 30 });

// Clean up when done
view.dispose();
```

### Object Schemas (Known Keys)

For maps with fixed keys where each key has a different type:

```typescript
class AppSettings extends sf.object("AppSettings", {
  theme: sf.string,
  fontSize: sf.number,
  notifications: sf.boolean,
}) {}

const settings = map.viewWith(AppSettings);

// Property access through root
settings.root.theme;       // string
settings.root.fontSize;    // number
settings.root.theme = "dark";  // Typed setter
```

### Field Options

Fields support additional props:

```typescript
class Document extends sf.object("Document", {
  title: sf.required(sf.string, {
    key: "doc_title",  // Storage key override
    metadata: { description: "Document title" }
  }),
  author: sf.optional(sf.string, {
    metadata: { description: "Optional author name" }
  }),
}) {}
```

### Union Types

Fields can accept multiple types using an array:

```typescript
class FlexibleData extends sf.object("FlexibleData", {
  // Can be string OR number
  value: sf.optional([sf.string, sf.number]),

  // Can be string, number, OR boolean (required field)
  mixedRequired: sf.required([sf.string, sf.number, sf.boolean]),

  // Nullable string (string OR null)
  nullableName: sf.optional([sf.string, sf.null]),
}) {}

// Usage
view.root.value = "hello";  // ✓
view.root.value = 42;       // ✓
view.root.nullableName = null;  // ✓
```

Maps also support union value types:

```typescript
const MixedMap = sf.map("MixedMap", [sf.string, sf.number]);

view.root.set("name", "Alice");  // string value
view.root.set("age", 30);        // number value
```

### Schema Lifecycle

When working with schematized views, the `compatibility` property tells you what operations are valid:

| Property | When true |
|----------|-----------|
| `canInitialize` | No schema is stored yet. Call `initialize()` to persist your schema. |
| `canView` | The stored schema is compatible for reading data with your view. |
| `canUpgrade` | The stored schema can be upgraded to your view's schema. |
| `isEquivalent` | Schemas are structurally identical. |

**Typical flow:**

1. **Create a view** with your schema
2. **Check `compatibility`** to determine the current state
3. **Initialize or upgrade** if needed, then use the view

```typescript
const view = map.viewWith(UserSchema);

if (view.compatibility.canInitialize) {
  // No schema stored yet - persist ours
  view.initialize();
} else if (view.compatibility.canUpgrade) {
  // Stored schema is older but compatible - upgrade it
  view.upgradeSchema();
} else if (!view.compatibility.canView) {
  // Incompatible schema - cannot proceed safely
  throw new Error("Schema incompatible with stored data");
}

// Now safe to use the view
view.root.name = "Alice";
console.log(view.root.name);

// Clean up when done
view.dispose();
```

**Key behaviors:**

- **`initialize()`**: Throws `UsageError` if a schema is already stored (`canInitialize` is false)
- **`upgradeSchema()`**: Throws `UsageError` if schemas are incompatible (`canUpgrade` is false)
- **`dispose()`**: Releases resources; accessing the view after disposal throws an error
- Accessing `root` when `canView` is false may result in runtime errors or unexpected behavior

### Ignoring Stored Schema (Unsafe Escape Hatch)

In development or migration scenarios where you need to bypass incompatible schema checks, you can use the `ignoreStoredSchema` option:

```typescript
// ⚠️ UNSAFE: Use with caution - existing data may not match the new schema!
const view = map.viewWith({
  schema: NewSchemaV2,
  ignoreStoredSchema: ["com.example.myapp.OldSchemaV1"]
});

// When the stored schema's identifier matches one in the list,
// it will be ignored and the view will act as if no schema was stored
if (view.compatibility.canInitialize) {
  view.initialize();  // Re-initialize with the new schema
}
```

**Warning:** This is an escape hatch for development/migration scenarios only. Use with extreme caution as existing data may not conform to the new schema structure.

## API Documentation

API documentation for **@fluidframework/schema** is available at <https://fluidframework.com/docs/apis/schema>.

<!-- AUTO-GENERATED-CONTENT:START (README_FOOTER) -->

<!-- prettier-ignore-start -->
<!-- NOTE: This section is automatically generated using @fluid-tools/markdown-magic. Do not update these generated contents directly. -->

## Contribution Guidelines

There are many ways to [contribute](https://github.com/microsoft/FluidFramework/blob/main/CONTRIBUTING.md) to Fluid.

- Participate in Q&A in our [GitHub Discussions](https://github.com/microsoft/FluidFramework/discussions).
- [Submit bugs](https://github.com/microsoft/FluidFramework/issues) and help us verify fixes as they are checked in.
- Review the [source code changes](https://github.com/microsoft/FluidFramework/pulls).
- [Contribute bug fixes](https://github.com/microsoft/FluidFramework/blob/main/CONTRIBUTING.md).

Detailed instructions for working in the repo can be found in the [Wiki](https://github.com/microsoft/FluidFramework/wiki).

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

This project may contain Microsoft trademarks or logos for Microsoft projects, products, or services.
Use of these trademarks or logos must follow Microsoft's [Trademark & Brand Guidelines](https://www.microsoft.com/trademarks).
Use of Microsoft trademarks or logos in modified versions of this project must not cause confusion or imply Microsoft sponsorship.

## Help

Not finding what you're looking for in this README? Check out [fluidframework.com](https://fluidframework.com/docs/).

Still not finding what you're looking for? Please [file an issue](https://github.com/microsoft/FluidFramework/wiki/Submitting-Bugs-and-Feature-Requests).

Thank you!

<!-- prettier-ignore-end -->

<!-- AUTO-GENERATED-CONTENT:END -->
