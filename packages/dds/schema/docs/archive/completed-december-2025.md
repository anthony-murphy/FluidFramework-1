# Schema Package - Completed Work Archive

Archived: December 2025

This document contains completed tasks and resolved design decisions that were previously in `notes.md`.

---

## Completed Task List (Phases 1-3)

### Phase 1: Foundation (no dependencies)

1. **#11 - SchemaValidationError** [DONE]
   - [DONE] Create `ISchemaValidationError` interface
   - [DONE] Create `isSchemaValidationError()` type guard
   - [DONE] Change class to extend `LoggingError`
   - [DONE] Export interface and guard, not class

2. **#20 - Rename types** [DONE]
   - [DONE] Rename `SchematizedView` → `SchemaView`
   - [DONE] Rename `SchematizedObject` → `ObjectView`
   - [DONE] Update all references

3. **#19 - API visibility audit** [DONE]
   - [DONE] Audit exports - remove any unnecessary ones
   - [DONE] Ensure DDS-author APIs are `@internal`
   - [DONE] Keep user-facing APIs at `@alpha` until stable

### Phase 2: Initialize API (#10, #21)

4. **#10 - Simplify initialize()** [DONE]
   - [DONE] Change `initialize(content)` to `initialize()` (no parameter)
   - [DONE] Update README and docs
   - [DONE] Update tests

5. **#21 - Add ignoreStoredSchema escape hatch** [DONE]
   - [DONE] Add `ignoreStoredSchema?: string[]` to `SchemaViewConfiguration`
   - [DONE] Update README to clarify initialize is optional
   - [DONE] Document that this is an unsafe escape hatch
   - [DONE] Validate against `ScopedSchemaName` of stored schema

### Phase 3: Proxy/Reflect refactor (#13, #15, #16)

6. **#13/#15/#16 - Proxy architecture refactor** [DONE]

   **Key change: View is NOT proxied, only `root` is proxied**

   - [DONE] Move `root` property (with proxy) into view classes directly
   - [DONE] `viewWith()` returns view class instance, not wrapper object
   - [DONE] Remove `createObjectViewProxy()` / `createMapViewProxy()` functions (proxy.ts deleted)
   - [DONE] Refactor proxy handlers to use Reflect fallback (get uses Reflect.get for non-fields)
   - [DONE] Change `sf.object()` to return a class (for Reflect/inheritance)
     - Created `schemaObjectBase.ts` with `createSchemaClass()` factory
     - Schema classes have static `identifier`, `kind`, `fields` properties
     - Marked with `[isSchemaClass]` symbol for identification
   - [DONE] Change proxy target to be schema class instance
     - `Object.create(schema.prototype)` used when schema is a class
     - Enables `instanceof` to work correctly
   - [DONE] Test with schema classes that have custom methods/getters
     - Custom getters work (e.g., `get fullName()`)
     - Custom methods work (e.g., `increment()`, `canVote()`)
     - Multiple subclasses of same schema work independently
     - `instanceof` correctly identifies schema class instances
   - [DONE] Proxy handler accesses storage directly (optimization)
     - objectView: proxy get/set/has/delete directly call storage methods
     - mapView: proxy get/set/has/delete directly call storage methods
     - Avoids method call overhead for every property access
     - Removed `getFieldValue()` / `setFieldValue()` / `hasField()` public methods
     - All field access now goes through `view.root.fieldName` proxy pattern

---

## Resolved Bugs (December 2025)

**1. Committed .d.ts files in src/ directory** [FIXED]

The following .d.ts files were accidentally committed to git in the src/ directory.
These have been removed via `git rm`.

**2. Export configuration in package.json** [FIXED]

Fixed to match container-loader pattern:
- `./` → `public.d.ts` (public API)
- `./legacy` → `legacy.d.ts` (beta-level legacy)
- `./legacy/alpha` → `legacyAlpha.d.ts` (alpha-level legacy)
- `./internal` → `index.d.ts` (internal API)

**3. Over-export of DDS implementation types** [SKIP - API constraint]

The following types were considered for `@internal` but must remain `@alpha @legacy`:
- `ISchemaStorage` - Referenced by view class constructors
- `ISchemaPersistence` - Referenced by view class constructors
- `IViewableStorage` - Referenced by `createViewWith`
- `StorageResult` - Referenced by `ISchemaStorage`

**Why skipped:** These types are in the public API surface because:
- `SchematizedObjectView` and `SchematizedMapView` constructors take these parameters
- `createViewWith` takes `IViewableStorage`
- API-extractor enforces that `@alpha` APIs can't reference `@internal` types

The following types ARE correctly `@internal` (not exported publicly):
- `createFlatStorageAdapter` - Adapter for DDS implementers
- `createPersistenceAdapter` - Adapter for DDS implementers
- `MapLikeStorage` - Type for DDS implementers
- `SchemaField` - Type for DDS implementers

---

## Resolved Design Decisions (#10-21)

### #10 - Should `initialize()` take content?

**Decision:** Remove content parameter - `initialize()` only persists schema

**Rationale:**
- `initialize()` means "persist the schema to enable cross-client enforcement"
- Setting data is a separate concern (use `view.root = ...`)
- Clearer separation of concerns
- `initialize()` is optional - only call when you want schema persistence

### #11 - SchemaValidationError handling

**Decision:** Extend `LoggingError`, expose interface only

**Pattern:**
- Class extends `LoggingError` (`@internal`) - gets all telemetry infrastructure
- Export `ISchemaValidationError` interface (`@alpha`) - public API
- Export `isSchemaValidationError()` type guard (`@alpha`) - for catching
- Class itself is `@internal`

### #12 - Proxy architecture - Views vs Proxies redundancy

**Decision:** Resolved by #16 - Simplify to 2 layers like Tree

### #13 - Proxies should use Reflect

**Decision:** Match Tree - both changes needed
1. Schema factory returns classes (not plain objects)
2. Proxy handlers use Reflect with fallback

### #14 - Test location - local-server-tests vs end-to-end-tests

**Decision:** Move to local-server-tests (still pending implementation)

### #15 - Proxy Handler Implementation Differences

**Decision:** Match Tree - consolidate with #13

### #16 - View Class vs Proxy Only Architecture

**Decision:** Match Tree - simplify to 2 layers
1. View class returned directly (NOT proxied) - has lifecycle methods
2. Only `root` is a proxy - for typed field access

### #17 - Storage Interface Design

**Decision:** Keep - required for multi-DDS support

The storage interface is intentionally different from Tree because Schema serves multiple DDSes while Tree is one DDS.

### #18 - Initialize API Comparison

**Decision:** Resolved by #10

### #19 - API Visibility and Export Organization

**Decision:** Decided
- DDS authors are internal
- Only DDS consumers need public/alpha
- Minimize exports
- Lowest visibility possible

### #20 - Naming Consistency

**Decision:** Shorten names
- `SchematizedView` → `SchemaView`
- `SchematizedObject` → `ObjectView`

### #21 - Clarify `initialize()` is Optional + Add Escape Hatch

**Decision:** Both - update docs + add `ignoreStoredSchema` config option

---

## Resolved Legacy Open Questions (#1-9)

### #1 - Config Object

**Decision:** Add config - Match Tree pattern, extensible, enables `enableSchemaValidation`

### #2 - Disposable

**Decision:** Add IDisposable - Match Tree pattern, prevents leaks, clean lifecycle

### #3 - Events

**Decision:** Defer - Use DDS events for now, add later if needed

### #4 - Root Property

**Decision:** Add root - Match Tree pattern, clear separation of view vs data

### #5 - Array Support

**Decision:** Defer - SharedMap not array-like, add later if needed

### #6 - Method Alignment

**Decision:** Partial alignment - Add field props, defer identifier/defaultProvider

### #7 - Error Handling

**Decision:** Extend UsageError - Keep structured errors, get telemetry integration

### #8 - Readonly Types

**Decision:** Keep - DDS-specific usage (Map uses readonly for nested, Directory doesn't)

### #9 - Reusable Helpers

**Decision:** Add - `createSchematizedView`, `createFlatStorageAdapter`, `createPersistenceAdapter`

---

## Completed Implementation Notes

### #1 - Config Object Implementation [DONE]

- Created `SchemaViewConfiguration<TSchema>` interface
- Updated `viewWith()` signature to accept config or schema directly
- Added `enableSchemaValidation` option (default: false)
- When enabled, validates on property set operations
- Updated API reports

### #2 - IDisposable Implementation [DONE]

- Imported `IDisposable` from `@fluidframework/core-interfaces`
- Added `dispose()` method to `SchematizedObjectView` and `SchematizedMapView`
- Tracks disposed state
- Throws on access after dispose
- Updated proxy handlers to check disposed state
- Updated `SchematizedView` type to extend `IDisposable`

### #4 - Root Property Implementation [DONE]

Completed December 19, 2025:
- Changed view structure: view has `root` property for data access
- `root` getter returns the typed proxy (ObjectProxy or MapProxy)
- `root` setter allows full replacement of data
- Updated `SchematizedObject` and `SchematizedMap` types
- **Breaking change** - API changed from `view.field` to `view.root.field`
- Build passes, all tests pass

### #6 - Field Props Implementation [DONE]

Completed December 19, 2025:
- Added `FieldProps` interface: `{ key?, metadata?: { description?, custom? } }`
- Updated `TypedFieldSchema` interface to include optional `props?: FieldProps`
- Updated `optional()` and `required()` signatures to accept props
- Props stored in returned `TypedFieldSchema` when provided
- Exported `FieldProps` from main index
- Build passes, all tests pass

### #9 - Reusable Helper Functions [DONE]

- Created `view/createView.ts` with `createSchematizedView<TSchema>()`
- Created `storage/adapters.ts` with:
  - `MapLikeStorage` interface
  - `createFlatStorageAdapter()`
  - `SchemaField` interface
  - `createPersistenceAdapter()`
- Reduced exports - DDSes only need minimal imports
- Updated SharedMap to use new helpers

---

## Documentation Updates (Completed)

### Priority 1: Updated with Implementation Reality

| Document | Updates Made |
|----------|--------------|
| **README.md** | Added real usage examples with config object, root property, dispose(), and field props |
| **schema-map-design.md** | Added "Implementation Status" banner. Updated code examples for config object and root property. Added dispose() calls. |
| **schema-dds-integration.md** | Added status banner. Updated examples to match actual API. Updated comparison table. |

### Priority 2: Marked as Historical

| Document | Action |
|----------|--------|
| **schema-implementation-plan.md** | Added "HISTORICAL" header noting implementation is complete. |
| **schema-open-items.md** | Added status banner. Marked SharedMap Q5-6 as resolved. |
