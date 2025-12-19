# SharedString Schema Integration Design

> **Related Documents**:
> - [Schema Extraction Plan](./schema-extraction-plan.md) - Core schema package extraction
> - [Schema DDS Integration Patterns](./schema-dds-integration.md) - General modality patterns
> - [SharedMap Schema Design](./schema-map-design.md) - SharedMap implementation
> - [SharedDirectory Schema Design](./schema-directory-design.md) - SharedDirectory implementation
> - [Open Items & Notes](./schema-open-items.md) - Open questions, risks, and concerns

This document outlines the design considerations for adding schema support to SharedString using a unified `viewWith` API that follows Tree DDS's proven pattern.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Schema Surfaces](#2-schema-surfaces)
3. [Segment Properties](#3-segment-properties)
4. [Segment Subtypes](#4-segment-subtypes)
5. [Interval Collections](#5-interval-collections)
6. [The viewWith API](#6-the-viewwith-api)
7. [Compatibility Status](#7-compatibility-status)
8. [Implementation Considerations](#8-implementation-considerations)
9. [Open Questions](#9-open-questions)

---

## 1. Overview

SharedString is more complex than SharedMap because it has **multiple schema surfaces**:

| Surface | Description | Current State |
|---------|-------------|---------------|
| **Segment Properties** | Key-value properties on text segments and markers | Untyped `PropertySet` |
| **Segment Subtypes** | Different kinds of markers (image, table, etc.) | String-based type field |
| **Interval Collections** | Named collections with typed intervals | Untyped properties |

This complexity suggests SharedString benefits from **persisted schema** (calling `initialize()`) because:
- Segment subtypes need to be understood across clients
- Interval collection schemas should be consistent
- Property schemas benefit from persistence

---

## 2. Schema Surfaces

SharedString has three distinct areas that would benefit from schema:

```
SharedString
├── Text Segments
│   └── Properties (bold, italic, link, custom...)
├── Markers
│   ├── Type (image, table, component...)
│   └── Properties (type-specific: src, rows, etc.)
└── Interval Collections
    ├── Collection Identity (comments, suggestions, highlights...)
    └── Interval Properties (author, text, resolved...)
```

Each surface can have its own schema, and they compose together into a complete SharedString schema.

### Base Types from SharedString

SharedString would define base schema types that consumers extend:

```typescript
// @fluidframework/sequence exports base types:

import { SchemaFactory } from "@fluidframework/schema";

const sf = new SchemaFactory("@fluidframework/sequence");

/**
 * Base schema for text segment properties.
 * Consumers extend this to add their own properties.
 */
export class TextSegmentSchema extends sf.object("TextSegment", {
  // No required fields - consumers add their own
}) {}

/**
 * Base schema for markers.
 * Consumers extend this to define specific marker types.
 */
export class MarkerSchema extends sf.object("Marker", {
  // Base marker has no required fields
  // Consumers define marker subtypes with specific properties
}) {}

/**
 * Base schema for interval properties.
 * Consumers extend this for each interval collection type.
 */
export class IntervalSchema extends sf.object("Interval", {
  // No required fields - consumers add their own
}) {}
```

Consumers then extend these base types:

```typescript
import { TextSegmentSchema, MarkerSchema, IntervalSchema } from "@fluidframework/sequence";

const sf = new SchemaFactory("myApp");

// Extend TextSegmentSchema for text properties
class MyTextProperties extends TextSegmentSchema.extend("MyTextProperties", {
  bold: sf.optional(sf.boolean),
  italic: sf.optional(sf.boolean),
  link: sf.optional(sf.string),
}) {}

// Extend MarkerSchema for specific marker types
class ImageMarker extends MarkerSchema.extend("ImageMarker", {
  src: sf.string,
  alt: sf.optional(sf.string),
}) {}

// Extend IntervalSchema for interval properties
class CommentInterval extends IntervalSchema.extend("CommentInterval", {
  author: sf.string,
  text: sf.string,
  resolved: sf.boolean,
}) {}
```

---

## 3. Segment Properties

Both text segments and markers can have properties. Today these are untyped `PropertySet` objects.

### Current API

```typescript
// Untyped - any properties allowed
sharedString.annotateRange(start, end, { bold: true, customProp: "value" });
const props = sharedString.getPropertiesAtPosition(pos); // PropertySet (untyped)
```

### With Schema

```typescript
import { TextSegmentSchema } from "@fluidframework/sequence";

const sf = new SchemaFactory("myApp");

// Extend the base TextSegmentSchema with app-specific properties
class MyTextProperties extends TextSegmentSchema.extend("MyTextProperties", {
  bold: sf.optional(sf.boolean),
  italic: sf.optional(sf.boolean),
  underline: sf.optional(sf.boolean),
  link: sf.optional(sf.string),
  fontSize: sf.optional(sf.number),
  color: sf.optional(sf.string),
}) {}

// Typed view enforces property schema
const view = sharedString.viewWith({ textProperties: MyTextProperties });

view.annotateRange(start, end, { bold: true });           // ✅ Type-checked
view.annotateRange(start, end, { invalid: "prop" });      // ❌ Compile error
const props = view.getPropertiesAtPosition(pos);          // MyTextProperties
props.bold;  // boolean | undefined (typed!)
```

---

## 4. Segment Subtypes

Markers represent non-text content embedded in the string. Consumers extend the base `MarkerSchema` to define specific marker types.

### Current API

```typescript
// Untyped - marker type is a string, properties are untyped
sharedString.insertMarker(pos, ReferenceType.Simple, {
  markerType: "image",
  src: "photo.jpg",
  width: 100
});
```

### With Schema

```typescript
import { MarkerSchema } from "@fluidframework/sequence";

const sf = new SchemaFactory("myApp");

// Extend MarkerSchema for each marker subtype
class ImageMarker extends MarkerSchema.extend("ImageMarker", {
  src: sf.string,
  alt: sf.optional(sf.string),
  width: sf.optional(sf.number),
  height: sf.optional(sf.number),
}) {}

class TableMarker extends MarkerSchema.extend("TableMarker", {
  rows: sf.number,
  cols: sf.number,
  headerRow: sf.optional(sf.boolean),
}) {}

class ComponentMarker extends MarkerSchema.extend("ComponentMarker", {
  componentType: sf.string,
  props: sf.optional(sf.map("ComponentProps", sf.string)),
}) {}

// Union of allowed marker types
const view = sharedString.viewWith({
  markerTypes: [ImageMarker, TableMarker, ComponentMarker],
});

// Type-safe marker insertion
view.insertMarker(pos, ImageMarker, { src: "photo.jpg", alt: "A photo" });  // ✅
view.insertMarker(pos, TableMarker, { rows: 3, cols: 4 });                   // ✅
view.insertMarker(pos, ImageMarker, { rows: 3 });                            // ❌ Compile error

// Type-safe marker retrieval
const marker = view.getMarkerAtPosition(pos);
if (marker.is(ImageMarker)) {
  marker.src;  // string (typed!)
}
```

---

## 5. Interval Collections

SharedString supports multiple named interval collections. Consumers extend the base `IntervalSchema` to define properties for each collection type.

### Current API

```typescript
// Untyped - collection label is a string, interval properties are untyped
const comments = sharedString.getIntervalCollection("comments");
comments.add({ start, end, props: { author: "alice", text: "Great point!" } });

const interval = comments.getIntervalById(id);
interval.properties.author;  // any (untyped)
```

### With Schema

```typescript
import { IntervalSchema } from "@fluidframework/sequence";

const sf = new SchemaFactory("myApp");

// Extend IntervalSchema for each collection type
class CommentInterval extends IntervalSchema.extend("CommentInterval", {
  author: sf.string,
  text: sf.string,
  timestamp: sf.number,
  resolved: sf.boolean,
  replies: sf.optional(sf.array("Reply", sf.object("Reply", {
    author: sf.string,
    text: sf.string,
    timestamp: sf.number,
  }))),
}) {}

class SuggestionInterval extends IntervalSchema.extend("SuggestionInterval", {
  author: sf.string,
  originalText: sf.string,
  replacementText: sf.string,
  status: sf.string,  // "pending" | "accepted" | "rejected"
}) {}

class HighlightInterval extends IntervalSchema.extend("HighlightInterval", {
  color: sf.string,
  label: sf.optional(sf.string),
}) {}

// Schema maps collection labels to interval schemas
const view = sharedString.viewWith({
  intervalCollections: {
    comments: CommentInterval,
    suggestions: SuggestionInterval,
    highlights: HighlightInterval,
  },
});

// Type-safe collection access
const comments = view.getIntervalCollection("comments");  // TypedIntervalCollection<CommentInterval>
comments.add({ start, end, author: "alice", text: "Great!", timestamp: Date.now(), resolved: false });

const interval = comments.getIntervalById(id);
interval.author;     // string (typed!)
interval.resolved;   // boolean (typed!)
interval.replies;    // Reply[] | undefined (typed!)

// Unknown collection rejected at compile time
view.getIntervalCollection("unknown");  // ❌ Compile error
```

---

## 6. The viewWith API

All schema surfaces compose into a single `viewWith` configuration:

```typescript
import { TextSegmentSchema, MarkerSchema, IntervalSchema } from "@fluidframework/sequence";

const sf = new SchemaFactory("myApp");

// Text property schema (extends base type)
class TextProperties extends TextSegmentSchema.extend("TextProperties", {
  bold: sf.optional(sf.boolean),
  italic: sf.optional(sf.boolean),
  link: sf.optional(sf.string),
}) {}

// Marker schemas (extend base type)
class ImageMarker extends MarkerSchema.extend("ImageMarker", { ... }) {}
class TableMarker extends MarkerSchema.extend("TableMarker", { ... }) {}

// Interval schemas (extend base type)
class CommentInterval extends IntervalSchema.extend("CommentInterval", { ... }) {}
class SuggestionInterval extends IntervalSchema.extend("SuggestionInterval", { ... }) {}

// Complete SharedString schema configuration
interface SharedStringSchemaConfig {
  textProperties?: ObjectNodeSchema;
  markerTypes?: ObjectNodeSchema[];
  intervalCollections?: Record<string, ObjectNodeSchema>;
}

// Usage
const view = sharedString.viewWith({
  textProperties: TextProperties,
  markerTypes: [ImageMarker, TableMarker],
  intervalCollections: {
    comments: CommentInterval,
    suggestions: SuggestionInterval,
  },
});

// Check compatibility and optionally initialize
if (view.compatibility.canInitialize) {
  // Store schema in document - no initial content needed for SharedString
  view.initialize();
}
```

### Type Signature

```typescript
interface ISharedString {
  viewWith<TConfig extends SharedStringSchemaConfig>(
    config: TConfig
  ): TypedSharedStringView<TConfig>;
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

// Return type infers types from config
interface TypedSharedStringView<TConfig> {
  /** Compatibility status of view schema vs stored schema. */
  readonly compatibility: SchemaCompatibilityStatus;

  /** Store schema in document. Only valid when canInitialize is true. */
  initialize(): void;

  /** Extend stored schema to support view schema. Only valid when canUpgrade is true. */
  upgradeSchema(): void;

  // Text operations with typed properties
  annotateRange(start: number, end: number, props: InferTextProps<TConfig>): void;
  getPropertiesAtPosition(pos: number): InferTextProps<TConfig> | undefined;

  // Marker operations with typed markers
  insertMarker<T extends InferMarkerTypes<TConfig>>(
    pos: number,
    schema: T,
    props: NodeFromSchema<T>
  ): void;
  getMarkerAtPosition(pos: number): InferMarkerUnion<TConfig> | undefined;

  // Interval collections with typed intervals
  getIntervalCollection<K extends keyof InferIntervalCollections<TConfig>>(
    label: K
  ): TypedIntervalCollection<InferIntervalCollections<TConfig>[K]>;
}
```

---

## 7. Compatibility Status

The view exposes a `compatibility` object following the same pattern as SharedMap and Tree:

```typescript
const view = sharedString.viewWith({
  textProperties: TextProperties,
  markerTypes: [ImageMarker, TableMarker],
  intervalCollections: { comments: CommentInterval },
});

// Check what's possible
view.compatibility.isEquivalent;   // true if schemas match exactly
view.compatibility.canView;        // true if you can use the view
view.compatibility.canUpgrade;     // true if upgradeSchema() would work
view.compatibility.canInitialize;  // true if no stored schema yet
```

### Handling Different States

```typescript
const view = sharedString.viewWith(config);

if (view.compatibility.canInitialize) {
  // New document - initialize with schema
  view.initialize();
} else if (view.compatibility.canView) {
  // Existing document with compatible schema
  view.annotateRange(0, 10, { bold: true });
} else if (view.compatibility.canUpgrade) {
  // Can extend stored schema (e.g., adding new marker type)
  view.upgradeSchema();
} else {
  // Incompatible schema
  throw new Error("Schema incompatible with document");
}
```

---

## 8. Implementation Considerations

### Complexity vs SharedMap

| Aspect | SharedMap | SharedString |
|--------|-----------|--------------|
| Schema surfaces | 1 (value type) | 3 (properties, markers, intervals) |
| Config type | Single schema | Composite config object |
| Type inference | Straightforward | Multi-dimensional |
| Storage | Single schema in `.attributes` | Multiple schemas to persist |

### Recommended Approach

**Persisted mode** (calling `initialize()`) is recommended for SharedString because:

1. **Cross-client consistency**: Marker subtypes must be understood by all clients
2. **Collection identity**: Interval collections need consistent schemas
3. **Property validation**: Segment properties benefit from persistence

### Storage Design

Schema could be stored in `.attributes` similar to SharedMap, but with a more complex structure:

```json
{
  "type": "https://graph.microsoft.com/types/mergeTree",
  "snapshotFormatVersion": "0.1",
  "schema": {
    "textProperties": { /* encoded schema */ },
    "markerTypes": [
      { /* ImageMarker schema */ },
      { /* TableMarker schema */ }
    ],
    "intervalCollections": {
      "comments": { /* CommentInterval schema */ },
      "suggestions": { /* SuggestionInterval schema */ }
    }
  }
}
```

### Incremental Adoption

SharedString schema can be adopted incrementally:

1. **Phase 1**: Text properties only (`textProperties` config)
2. **Phase 2**: Add marker types (`markerTypes` config)
3. **Phase 3**: Add interval collections (`intervalCollections` config)

Each phase is independently useful and doesn't require the others.

---

## 9. Open Questions

See [Open Items & Notes](./schema-open-items.md) for the full list of open questions, risks, and concerns.

Key SharedString-specific questions:
- Marker type discrimination
- Dynamic vs declared interval collections
- Migration from untyped properties
- Partial schema adoption
