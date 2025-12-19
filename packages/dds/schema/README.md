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
  view.root = new Map([["alice", { name: "Alice", email: "alice@example.com" }]]);
}

// Access data through the root property (breaking change in v2.x)
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
