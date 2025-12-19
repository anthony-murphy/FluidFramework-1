# Schema Package API Review

Comparing `@fluidframework/schema` with `@fluidframework/tree` to ensure API consistency and identify gaps.

---

## Execution Instructions

**For each implementation task:**

1. **Use agents** to execute tasks autonomously
2. **Build after every task**: `npm run build` in the schema package
3. **Fix errors** before proceeding - don't leave broken builds
4. **Run tests**: `npm test` to catch regressions
5. **Git commit** after each completed task with message: `schema: <brief description>`
6. **Update task status** in this document as you progress:
   - `[ ]` → `[CODED]` - Implementation written
   - `[CODED]` → `[BUILT]` - Compiles without errors
   - `[BUILT]` → `[TESTED]` - Tests pass
   - `[TESTED]` → `[DONE]` - Committed
   - `[SKIP]` - Skipped with reason noted
7. **If a task is too complex or needs input**: Mark `[SKIP]`, note why, move to next
8. **Don't stop** until all tasks are either `[DONE]` or `[SKIP]`

**Skip criteria:**
- Needs design decision not covered in this document
- Risk of breaking changes that need review
- Scope is unclear or larger than expected

**Before starting:** Review task order for dependencies - reorder if needed so dependent tasks come after their prerequisites.

**After completion:** Report summary of:
- ✅ Tasks completed (with commit hashes if available)
- ⏭️ Tasks skipped (with reason)
- 🔄 Tasks partially done (what remains)

---

## Open Questions

### 1. Should `viewWith()` take a config object like Tree?

**Current (Schema):**
```ts
map.viewWith(schema)  // Schema directly
```

**Tree pattern:**
```ts
tree.viewWith(new TreeViewConfiguration({
  schema,
  enableSchemaValidation?: boolean,
  preventAmbiguity?: boolean
}))
```

**Pros of config object:**
- Extensible - can add options without breaking changes
- Consistent with Tree API
- Could add `enableSchemaValidation` option

**Cons:**
- More verbose for simple cases
- Schema package is meant to be simpler

**Decision:** [x] Add config object - Match Tree pattern

**What is `enableSchemaValidation`?**

In Tree, when enabled it performs **additional runtime validation** that content being inserted matches the schema:
- Default is `false` for performance
- Adds overhead on every insert/edit operation
- Useful for debugging schema violations
- Particularly helpful with dynamic/untyped data

**For Schema package:**
- We already validate on `initialize()`
- Could extend to validate on every property set (`view.name = "new"`)
- Make it opt-in via config for performance

**Implementation:**
```ts
interface SchemaViewConfiguration<TSchema extends RootSchema> {
  schema: TSchema;
  enableSchemaValidation?: boolean;  // default false
}

map.viewWith({ schema: PersonSchema, enableSchemaValidation: true })
// OR shorthand:
map.viewWith(PersonSchema)  // schema only, defaults
```

---

### 2. Should views be disposable?

**Current (Schema):** No `dispose()` method

**Tree pattern:** `TreeView` implements `IDisposable`

**Considerations:**
- Views hold references to storage/map
- Could leak if user creates many views
- Tree requires dispose for cleanup

**Decision:** [x] Add IDisposable - Match Tree pattern

**Implementation:**
- Views implement `IDisposable` from `@fluidframework/core-interfaces`
- `dispose()` cleans up references to storage
- After dispose, accessing view properties throws
- Matches Tree's `TreeView` behavior

---

### 3. Should there be events on the view?

**Current (Schema):** No events

**Tree pattern:**
```ts
view.events.on("rootChanged", () => {})
view.events.on("schemaChanged", () => {})
view.events.on("commitApplied", (metadata, getRevertible) => {})
```

**Considerations:**
- Users may want to react to data changes
- SharedMap already has `valueChanged` event
- Adding view-level events adds complexity

**Decision:** [x] Defer to DDS events

**Rationale:**
- Users can use underlying `map.on("valueChanged", ...)` for now
- Keeps initial API surface small
- Can add view-level events later if needed
- Not a breaking change to add events later

---

### 4. Is direct property access the right pattern?

**Current (Schema):**
```ts
const view = map.viewWith(PersonSchema);
view.name  // Direct access
view.age = 30  // Direct mutation
```

**Tree pattern:**
```ts
const view = tree.viewWith(config);
view.root.name  // Through root property
view.root.age = 30
```

**Pros of direct access:**
- Simpler, more intuitive
- Less boilerplate
- View IS the data

**Pros of root property:**
- Clear separation of view metadata vs data
- Consistent with Tree
- `view.root = newValue` for full replacement

**Decision:** [x] Add root property - Match Tree pattern

**New API:**
```ts
const view = map.viewWith({ schema: PersonSchema });
view.root.name       // Read
view.root.age = 30   // Write
view.root = { name: "Alice", age: 25 }  // Full replacement
view.compatibility   // View metadata
view.initialize(...) // View method
view.dispose()       // Cleanup
```

---

### 5. Should we support Array schemas?

**Current (Schema):** Only Object and Map schemas supported for root

**Tree supports:** Object, Map, Array as root schemas

**Considerations:**
- Arrays are common data structures
- Would need `SchematizedArray<T>` type
- SharedMap doesn't naturally map to arrays
- Could be added later

**Decision:** [x] Defer

**Rationale:**
- SharedMap is key-value, not naturally array-like
- Object and Map cover most use cases
- Can add later without breaking changes

---

### 6. Should SchemaFactory methods match Tree exactly?

**Differences identified:**

| Method | Schema | Tree |
|--------|--------|------|
| `optional()` | Instance method | Static method |
| `required()` | Instance method | Static method |
| Field props | Not supported | `{ key?, metadata?, defaultProvider? }` |
| Identifier | Not supported | `sf.identifier` |

**Decision:** [x] Partial alignment - Add field props, keep identifier deferred

**Changes to make:**
- Add field props support: `sf.optional(types, { key?, metadata? })`
- Keep `optional`/`required` as instance methods (simpler API)
- Defer `identifier` field type (not needed for SharedMap use case)
- Defer `defaultProvider` (complex, can add later)

---

### 7. Error handling consistency

**Current (Schema):**
```ts
class SchemaValidationError extends Error {
  errors: ValidationError[]
}
interface ValidationError {
  path: string
  message: string
  expected: string
  actual: string
}
```

**Considerations:**
- Is this format useful for users?
- Should match Tree error patterns?

**Decision:** [x] Both - Extend UsageError, keep structured errors

**Changes:**
- `SchemaValidationError` extends `UsageError` (from `@fluidframework/telemetry-utils`)
- Keep the `errors: ValidationError[]` array for detailed validation info
- Gets telemetry integration from Fluid's standard error base class

---

### 8. Are readonly types needed?

**Current (Schema):** Exports `DeepReadonly<T>` and `ReadonlyNodeFromSchema<T>`

**Tree:** Doesn't emphasize readonly types

**Considerations:**
- Useful for function parameters
- Prevents accidental mutation
- Adds complexity to type system
- SharedMap stores nested objects as JSON (copy-on-read) - mutation is silently lost
- SharedDirectory has real nested storage - mutation works

**Decision:** [x] Keep - DDS-specific usage

**Rationale:**
- Schema package exports `DeepReadonly` and `ReadonlyNodeFromSchema` as utilities
- SharedMap's view should return readonly for nested objects (prevents silent bugs)
- SharedDirectory's view returns mutable (mutation actually works)
- Each DDS decides based on its storage model

---

### 9. Should schema package provide reusable helpers for DDSes?

**Current (Map):** SharedMap has ~50+ lines implementing `viewWith()` including:
- Schema type dispatch (`isObjectSchema`, `isMapSchema`)
- View class instantiation
- Proxy creation
- Storage adapter creation
- Persistence adapter creation

**Problem:** Every DDS adopting schema would duplicate this code.

**Proposed helpers:**

| Helper | Purpose | Lines Saved |
|--------|---------|-------------|
| `createSchematizedView()` | Dispatch + proxy creation | ~15 lines |
| `createFlatStorageAdapter()` | Wrap Map-like interface | ~20 lines |
| `createPersistenceAdapter()` | Wrap schema field access | ~15 lines |
| `unwrapStorageResult()` | Handle value vs nested storage | ~15 lines (internal) |
| `getNodeSchemaFromField()` | Extract NodeSchema from FieldSchema | ~5 lines (internal) |
| `assertCanView/Initialize/Upgrade()` | Guard helpers | ~10 lines (internal) |

**Decision:** [x] Add helpers - Consolidate reusable logic

**After consolidation, DDS viewWith() becomes:**
```ts
public viewWith<TSchema extends RootSchema>(schema: TSchema): SchematizedView<TSchema> {
    return createSchematizedView(
        this.createSchemaStorage(),
        schema,
        this.createSchemaPersistence(),
    );
}
```

---

## Decisions Log

| # | Question | Decision | Rationale |
|---|----------|----------|-----------|
| 1 | Config object | **Add config** | Match Tree, extensible, enables `enableSchemaValidation` |
| 2 | Disposable | **Add IDisposable** | Match Tree, prevents leaks, clean lifecycle |
| 3 | Events | **Defer** | Use DDS events for now, add later if needed |
| 4 | Direct access | **Add root** | Match Tree, clear separation of view vs data |
| 5 | Array support | **Defer** | SharedMap not array-like, add later if needed |
| 6 | Method alignment | **Partial** | Add field props, defer identifier/defaultProvider |
| 7 | Error handling | **Extend UsageError** | Keep structured errors, get telemetry integration |
| 8 | Readonly types | **Keep** | DDS-specific: Map uses readonly for nested, Directory doesn't |
| 9 | Reusable helpers | **Add** | `createSchematizedView`, `createFlatStorageAdapter`, `createPersistenceAdapter` |

---

## Implementation Notes

### #1 - Config Object Implementation

TODO:
- [ ] Create `SchemaViewConfiguration<TSchema>` interface
- [ ] Update `viewWith()` signature to accept config or schema directly
- [ ] Add `enableSchemaValidation` option (default: false)
- [ ] When enabled, validate on property set operations
- [ ] Update API reports

### #2 - IDisposable Implementation

TODO:
- [ ] Import `IDisposable` from `@fluidframework/core-interfaces`
- [ ] Add `dispose()` method to `SchematizedObjectView` and `SchematizedMapView`
- [ ] Track disposed state
- [ ] Throw on access after dispose
- [ ] Update proxy handlers to check disposed state
- [ ] Update `SchematizedView` type to extend `IDisposable`

### #4 - Root Property Implementation

TODO:
- [ ] Change view structure: view has `root` property, not direct data access
- [ ] `root` getter returns the typed proxy (ObjectProxy or MapProxy)
- [ ] `root` setter allows full replacement
- [ ] Update `SchematizedObject` and `SchematizedMap` types
- [ ] Update tests to use `view.root.field` pattern
- [ ] **Breaking change** - update all existing usage

### #6 - Field Props Implementation

TODO:
- [ ] Add `FieldProps` interface: `{ key?: string, metadata?: { description?: string, custom?: unknown } }`
- [ ] Update `optional()` signature: `optional<T>(types: T, props?: FieldProps)`
- [ ] Update `required()` signature: `required<T>(types: T, props?: FieldProps)`
- [ ] Store props in `TypedFieldSchema`
- [ ] Use `key` for storage key remapping (if different from field name)

### #7 - Error Handling Implementation

TODO:
- [ ] Import `UsageError` from `@fluidframework/telemetry-utils`
- [ ] Change `SchemaValidationError extends Error` to `extends UsageError`
- [ ] Keep `errors: ValidationError[]` property
- [ ] Update constructor to call `super()` correctly for UsageError
- [ ] Add telemetry-utils as dependency if not present

### #8 - Readonly Types (DDS-specific)

TODO (in map package, not schema):
- [ ] SharedMap view returns `DeepReadonly` for nested object fields
- [ ] Prevents silent mutation bugs (nested objects are JSON copies)
- [ ] SharedDirectory view returns mutable (nested storage actually works)
- [ ] Schema package just exports the utility types

### #9 - Reusable Helper Functions

TODO:
- [ ] Create `view/createView.ts` with `createSchematizedView<TSchema>(storage, schema, persistence?)`
- [ ] Create `storage/adapters.ts` with:
  - [ ] `MapLikeStorage` interface (get, set, delete, has, keys, size)
  - [ ] `createFlatStorageAdapter(source: MapLikeStorage): ISchemaStorage`
  - [ ] `SchemaField` interface (get, set)
  - [ ] `createPersistenceAdapter(field: SchemaField): ISchemaPersistence`
- [ ] Refactor internal code:
  - [ ] `unwrapStorageResult()` - consolidate from objectView.ts and mapView.ts
  - [ ] `wrapNestedStorage()` - create view for nested storage results
  - [ ] `getNodeSchemaFromField()` - extract NodeSchema from FieldSchema
  - [ ] `assertCanView/Initialize/Upgrade()` - guard functions
- [ ] **Reduce exports** - DDSes only need to import:
  - [ ] `createSchematizedView` - the main helper
  - [ ] `ISchemaStorage`, `ISchemaPersistence` - interfaces to implement
  - [ ] `RootSchema`, `SchematizedView` - types
  - [ ] Remove need to export: `SchematizedObjectView`, `SchematizedMapView`, `createObjectViewProxy`, `createMapViewProxy`, `isObjectSchema`, `isMapSchema`
- [ ] Export public helpers from index.ts (internal entrypoint for DDSes)
- [ ] Update SharedMap to use new helpers (reduces ~50 lines to ~5)
- [ ] Document for other DDS authors

---

## Documentation Updates

The following design documents need updates to reflect implementation decisions and remove outdated content.

### Priority 1: Update with Implementation Reality

| Document | Updates Needed |
|----------|----------------|
| **README.md** | Add real usage examples now that we have working code. Remove placeholder text. |
| **schema-map-design.md** | ✅ Implementation complete. Add "Implementation Status" section at top. Trim code blocks to reference actual files. Remove speculative "future" sections. |
| **schema-dds-integration.md** | Update examples to match actual API (config object, root property). Mark Modality 3 as "future consideration". |

### Priority 2: Archive or Mark as Historical

| Document | Action |
|----------|--------|
| **schema-implementation-plan.md** | Add "HISTORICAL" header - this was the plan, implementation is done. Link to actual code. |
| **schema-extraction-plan.md** | Add "HISTORICAL" header - extraction complete. Keep for context on why decisions were made. |
| **schema-open-items.md** | Review each item - mark resolved ones, move unresolved to notes.md or GitHub issues. |

### Priority 3: Future Work Documents

| Document | Action |
|----------|--------|
| **schema-directory-design.md** | Mark as "FUTURE" - not yet implemented. Review for consistency with decisions here. |
| **schema-string-design.md** | Mark as "FUTURE" - not yet implemented. Very speculative, may need major revision. |

### Specific Updates

#### README.md
- [ ] Add working example from actual tests
- [ ] Document `viewWith()` API with config object
- [ ] Show ObjectNodeSchema vs MapNodeSchema patterns
- [ ] Add link to API docs

#### schema-map-design.md
- [ ] Add status banner: "✅ Implemented in v2.x"
- [ ] Update viewWith signature to use config object (Decision #1)
- [ ] Update view access pattern to use `view.root.field` (Decision #4)
- [ ] Remove 900+ lines of implementation detail - link to actual source instead
- [ ] Keep high-level patterns and compatibility matrix

#### schema-dds-integration.md
- [ ] Update config object signature
- [ ] Update root property access pattern
- [ ] Add note about `createSchematizedView` helper (Decision #9)
- [ ] Mark Modality 3 sections as "Future Consideration"

#### schema-open-items.md
- [ ] SharedMap Q5-6: Mark resolved (we support both Object and Map schemas)
- [ ] SharedDirectory Q7-11: Move to directory-design.md
- [ ] General Q12-13: Keep as future work
- [ ] Update Risks section with actual mitigations taken

#### schema-implementation-plan.md
- [ ] Add header: "# HISTORICAL: Implementation Plan (Completed)"
- [ ] Add link to actual implementation
- [ ] Keep phases for historical reference on how we got here
