# Schema Package Notes

<!--
  Active development notes and open questions.
  For historical design documents, see ./archive/
-->

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
- Scope is unclear or larger than expected
- Blocked by external dependency

**Before starting:** Review task order for dependencies - reorder if needed so dependent tasks come after their prerequisites.

**After completion:** Report summary of:
- ✅ Tasks completed (with commit hashes if available)
- ⏭️ Tasks skipped (with reason)
- 🔄 Tasks partially done (what remains)

---

## Task List (Consolidated)

Implementation tasks from decisions #10-21, ordered by dependency:

### Phase 1: Foundation (no dependencies)

1. **#11 - SchemaValidationError**
   - [ ] Create `ISchemaValidationError` interface
   - [ ] Create `isSchemaValidationError()` type guard
   - [ ] Change class to extend `LoggingError`
   - [ ] Export interface and guard, not class

2. **#20 - Rename types**
   - [ ] Rename `SchematizedView` → `SchemaView`
   - [ ] Rename `SchematizedObject` → `ObjectView`
   - [ ] Update all references

3. **#19 - API visibility audit**
   - [ ] Audit exports - remove any unnecessary ones
   - [ ] Ensure DDS-author APIs are `@internal`
   - [ ] Keep user-facing APIs at `@alpha` until stable

### Phase 2: Initialize API (#10, #21)

4. **#10 - Simplify initialize()**
   - [ ] Change `initialize(content)` to `initialize()` (no parameter)
   - [ ] Update README and docs
   - [ ] Update tests

5. **#21 - Add ignoreStoredSchema escape hatch**
   - [ ] Add `ignoreStoredSchema?: string[]` to `SchemaViewConfiguration`
   - [ ] Update README to clarify initialize is optional
   - [ ] Document that this is an unsafe escape hatch
   - [ ] Validate against `ScopedSchemaName` of stored schema

### Phase 3: Proxy/Reflect refactor (#13, #15, #16)

6. **#13/#15/#16 - Proxy architecture refactor** (largest change)
   - [ ] Change `sf.object()` to return a class
   - [ ] Refactor proxy handlers to use Reflect fallback
   - [ ] Change proxy target to be schema class instance
   - [ ] Ensure `receiver` passed correctly for `this` binding
   - [ ] Remove `getFieldValue()` / `setFieldValue()` from view classes
   - [ ] Proxy handler accesses storage directly
   - [ ] Single proxy instead of viewProxy/dataProxy
   - [ ] Test with schema classes that have custom methods/getters
   - [ ] Update all existing tests for new pattern

### Phase 4: Test relocation (#14)

7. **#14 - Move tests to local-server-tests**
   - [ ] Add `@fluidframework/schema` dependency to local-server-tests
   - [ ] Add `@fluidframework/map` dependency if not present
   - [ ] Create test file in local-server-tests
   - [ ] Move/adapt test cases from e2e
   - [ ] Remove tests from e2e package
   - [ ] Verify tests pass in new location

---

## New Open Questions (December 2025)

### 10. Should `initialize()` take content?

**Current:**
```ts
view.initialize({ name: "Alice", age: 30 })
```

**Concern:** Is having `initialize()` take content the right pattern?

**Alternatives:**
1. Separate initialization from content setting:
   ```ts
   view.initialize()  // Just marks as initialized
   view.root = { name: "Alice", age: 30 }  // Set content separately
   ```
2. Only allow initialization via root setter:
   ```ts
   view.root = { name: "Alice", age: 30 }  // Auto-initializes if needed
   ```

**Decision:** [x] Remove content parameter - `initialize()` only persists schema

**Rationale:**
- `initialize()` means "persist the schema to enable cross-client enforcement"
- Setting data is a separate concern (use `view.root = ...`)
- Clearer separation of concerns
- `initialize()` is optional - only call when you want schema persistence

**Implementation:**
```ts
// New API
view.initialize()  // Persists schema only
view.root = { name: "Alice", age: 30 }  // Set content separately

// Or if you don't need cross-client schema enforcement:
view.root = { name: "Alice", age: 30 }  // Just use it, no initialize needed
```

**TODO:**
- [ ] Change `initialize(content)` to `initialize()` (no parameter)
- [ ] Update README and docs
- [ ] Update tests

---

### 11. SchemaValidationError handling

**Current:** `SchemaValidationError extends Error` with structured `errors: ValidationError[]`

**Problem:** #7 was skipped because `UsageError` is `@internal`, forcing derived classes to be `@internal` too.

**Options:**
1. **FluidError composition** - Use `FluidError` base class via composition rather than inheritance
2. **Logging error** - Just log errors with telemetry, don't throw special type
3. **Keep plain Error** - Keep current pattern with plain Error base class
4. **New error base** - Create public error base class for schema package

**Considerations:**
- Users need to catch `SchemaValidationError` specifically
- Telemetry integration is valuable
- Tree package pattern?

**Decision:** [x] Extend `LoggingError`, expose interface only

**Pattern:**
- Class extends `LoggingError` (`@internal`) - gets all telemetry infrastructure
- Export `ISchemaValidationError` interface (`@alpha`) - public API
- Export `isSchemaValidationError()` type guard (`@alpha`) - for catching
- Class itself is `@internal`

**Implementation:**
```ts
import { LoggingError } from "@fluidframework/telemetry-utils/internal";
import type { IFluidErrorBase } from "@fluidframework/telemetry-utils";

// Public interface (@alpha)
export interface ISchemaValidationError extends IFluidErrorBase {
  readonly errorType: "schemaValidation";
  readonly errors: readonly ValidationError[];
}

// Type guard (@alpha)
export function isSchemaValidationError(error: unknown): error is ISchemaValidationError {
  return (
    error instanceof Error &&
    (error as Partial<ISchemaValidationError>).errorType === "schemaValidation" &&
    Array.isArray((error as Partial<ISchemaValidationError>).errors)
  );
}

// Class (@internal) - extends LoggingError for telemetry
class SchemaValidationError extends LoggingError implements ISchemaValidationError {
  readonly errorType = "schemaValidation" as const;

  constructor(
    message: string,
    public readonly errors: readonly ValidationError[]
  ) {
    super(message, {
      errorCount: errors.length,
      paths: errors.map(e => e.path).join(","),
    });
    this.name = "SchemaValidationError";
  }
}
```

**Usage:**
```ts
try {
  view.initialize();
} catch (e) {
  if (isSchemaValidationError(e)) {
    console.log(e.errors);  // ValidationError[]
  }
}
```

**Benefits:**
- Full telemetry integration via `LoggingError`
- Public interface for users to check errors
- Class can change without breaking public API
- Follows telemetry-utils pattern

**TODO:**
- [ ] Create `ISchemaValidationError` interface
- [ ] Create `isSchemaValidationError()` type guard
- [ ] Change class to extend `LoggingError`
- [ ] Export interface and guard, not class

---

### 12. Proxy architecture - Views vs Proxies redundancy

**Status:** [x] Resolved by #16

**Current architecture:**
- `SchematizedObjectView` class - internal view with all logic
- `createObjectViewProxy()` - creates Proxy that wraps the view
- Similar for `SchematizedMapView` and `createMapViewProxy()`

**Resolution:** Simplify to 2 layers like Tree:
- View class handles lifecycle only (dispose, compatibility, initialize)
- Proxy accesses storage directly via Reflect pattern
- See #13, #15, #16 for implementation details

**Options:**
1. **Simplify proxies** - Make proxies use views more directly, less wrapper code
2. **Merge into proxies** - Put all logic in proxy handlers, eliminate view classes
3. **Keep separate** - Views handle storage, proxies handle property access

**Tree's pattern (for reference):**
```ts
// Tree proxy handler accesses flex-tree directly:
get(target, propertyKey, proxy) {
    const fieldInfo = schema.flexKeyMap.get(propertyKey);
    if (fieldInfo !== undefined) {
        const flexNode = getInnerNode(proxy);  // Direct access
        const field = flexNode.tryGetField(fieldInfo.storedKey);
        return tryGetTreeNodeForField(field);
    }
    return Reflect.get(target, propertyKey, proxy);
}

// Schema's current pattern has extra layer:
get(target, prop) {
    return view.getFieldValue(prop);  // Via view class
}
```

**Key difference:**
- Tree: Proxy → `getInnerNode()` → FlexTreeNode (direct)
- Schema: Proxy → View class → Storage interface (extra layer)

**Decision:** [x] Resolved by #16 - simplify to 2 layers

**Notes:**
- Current works, but may have unnecessary indirection
- Could simplify by having proxy access storage directly
- View class still valuable for lifecycle (dispose, compatibility, initialize)

---

### 13. Proxies should use Reflect

**Current:** Proxy handlers use manual lambdas for property access

**Tree pattern:** Tree proxies use `Reflect` methods

**Example of change:**
```ts
// Current
get(target, prop) {
  if (prop === "name") return view.getField("name")
  // ... manual dispatch
}

// Tree pattern
get(target, prop, receiver) {
  return Reflect.get(target, prop, receiver)
}
```

**Benefits of Reflect:**
- More correct prototype chain handling
- Better handling of inherited properties
- More standard proxy pattern
- Matches Tree implementation

**Example why Reflect is needed:**
```ts
class Dog extends sf.object("Dog", { name: sf.string }) {
    get greeting() { return `Hi, I'm ${this.name}`; }  // uses this.name
}

// Without Reflect: this.name inside greeting fails (wrong "this")
// With Reflect: receiver (the proxy) becomes "this", so this.name works
```

**Decision:** [x] Match Tree - both changes needed

**Changes required:**

1. **Schema factory returns classes** (not plain objects)
   - `sf.object("Dog", {...})` returns a class that can be extended
   - Enables `class Dog extends sf.object(...)` pattern
   - Matches Tree's API

2. **Proxy handlers use Reflect**
   - Check schema fields first, fall through to Reflect
   - Pass `receiver` (the proxy) so `this` works in getters/methods
   - Matches Tree's implementation

3. **Proxy target is schema class instance**
   - Not `{}` or view instance
   - Enables prototype chain to work correctly

**TODO:**
- [ ] Change `sf.object()` to return a class (major change)
- [ ] Refactor proxy handlers to use Reflect fallback
- [ ] Change proxy target to be schema class instance
- [ ] Ensure `receiver` passed correctly for `this` binding
- [ ] Test with schema classes that have custom methods/getters
- [ ] Update all existing tests for new pattern

---

### 14. Test location - local-server-tests vs end-to-end-tests

**Current:** Tests added to `test-end-to-end-tests` package

**Better location:** `local-server-tests` package

**Rationale:**
- Schema tests don't need real service connectivity
- local-server-tests is faster to run
- More appropriate for unit/integration level tests

**Decision:** [x] Move to local-server-tests

**TODO:**
- [ ] Add `@fluidframework/schema` dependency to local-server-tests
- [ ] Add `@fluidframework/map` dependency if not present
- [ ] Create test file in local-server-tests
- [ ] Move/adapt test cases from e2e
- [ ] Remove tests from e2e package
- [ ] Verify tests pass in new location

---

### 15. Proxy Handler Implementation Differences

**Current (Schema's proxy.ts):**
```ts
const handler: ProxyHandler<SchematizedObjectView<TSchema>> = {
    get(_target, prop, _receiver) {
        if (prop === "root") {
            return dataProxy;  // Returns another proxy
        }
        if (prop === "disposed") {
            return view.disposed;
        }
        // Manual dispatch for each property...
    },
    // ...
};
```

**Tree's objectNode.ts pattern:**
```ts
return {
    get: (target, propertyKey, proxy): unknown => {
        // Check if it's a schema-defined property
        const fieldInfo = flexObjectNodeSchema.fields.get(propertyKey);
        if (fieldInfo !== undefined) {
            // Access the flex-tree field
            return getProxyForField(getKernel(target).getField(fieldInfo.storedKey));
        }
        // Fall through to Reflect for other properties
        return Reflect.get(target, propertyKey, proxy);
    },
    // ...
};
```

**Key Differences:**
1. **Schema uses nested proxies** - `viewProxy` contains `dataProxy`
2. **Tree uses single handler** - One proxy handler handles everything via Reflect fallback
3. **Schema manually dispatches** - Each property type has explicit `if` checks
4. **Tree uses closure over schema** - Handler is created with schema info in closure

**Why Reflect Matters:**
- `Reflect.get(target, propertyKey, receiver)` - receiver is the PROXY, not target
- This is critical for correct prototype chain behavior
- Without proper receiver, inherited getters see wrong `this`

**Decision:** [x] Match Tree - consolidate with #13

**Changes (part of #13 refactor):**
- Single handler instead of nested viewProxy/dataProxy
- Schema map lookup instead of if/else chain
- Always use Reflect fallback for non-schema properties
- Pass receiver correctly for `this` binding

---

### 16. View Class vs Proxy Only Architecture

**Schema has 3 layers:**
1. `SchematizedObjectView` class - manages storage, compatibility, initialize, dispose
2. `createObjectViewProxy()` - creates dataProxy for field access
3. Outer proxy (`viewProxy`) - wraps view with root property returning dataProxy

**Tree has 2 layers:**
1. `SchematizingSimpleTreeView` class - similar to Schema's view (compatibility, initialize, dispose, root getter)
2. For nodes: Only proxies, no intermediate classes - `createProxyHandler()` directly accesses flex-tree

**Analysis:**
- Schema's `SchematizedObjectView.getFieldValue()` duplicates what the proxy does
- Tree's nodes are proxies directly accessing the flex-tree
- Tree's TreeView class is similar to Schema's view class (both manage lifecycle)

**Key Insight:** Schema's duplication is at the node level:
- Schema: View class has `getFieldValue()` → Proxy calls `getFieldValue()` → redundant
- Tree: Proxy handler directly accesses flex-tree → no intermediate class for nodes

**Decision:** [x] Match Tree - simplify to 2 layers

**New architecture:**
1. **View class (lifecycle only):**
   - `dispose()`, `disposed`
   - `compatibility`
   - `initialize()`
   - Holds reference to storage/persistence
   - NO `getFieldValue()` / `setFieldValue()`

2. **Single proxy (direct storage access):**
   - Schema map lookup for fields
   - Accesses storage directly
   - Reflect fallback for inherited methods/getters
   - Returns view for lifecycle properties

**Benefits:**
- Matches Tree architecture
- Less code, less indirection
- Proxy accesses storage directly
- Still in development, OK to refactor

**TODO (part of #13 refactor):**
- [ ] Remove `getFieldValue()` / `setFieldValue()` from view classes
- [ ] Proxy handler accesses storage directly
- [ ] Single proxy instead of viewProxy/dataProxy

---

### 17. Storage Interface Design

**Current `ISchemaStorage` interface:**
```ts
interface ISchemaStorage {
    getField(key: string, fieldSchema: NodeSchema): StorageResult | undefined;
    setField(key: string, fieldSchema: NodeSchema, value: unknown): void;
    deleteField(key: string): boolean;
    hasField(key: string): boolean;
    keys?(): IterableIterator<string>;
    readonly size?: number;
}
```

**Why Schema differs from Tree here:**
```
Tree:      TreeView → Proxy → flex-tree (ONE DDS, controls its own storage)

Schema:    View → Proxy → ISchemaStorage → SharedMap
                                        → SharedDirectory
                                        → SharedString
                                        → (any DDS that implements interface)
```

**Pros:**
- Clean abstraction over SharedMap/SharedDirectory/etc.
- Schema-aware - DDS knows if field should be value or nested storage
- Consistent interface for all DDSes
- Enables schema reuse across DDSes

**Decision:** [x] Keep - required for multi-DDS support

**Notes:**
- This is intentionally different from Tree
- Tree is one DDS; Schema serves many DDSes
- Proxy refactor (#13, #15, #16) changes caller (proxy vs view), not the interface
- Each DDS implements `ISchemaStorage` to adapt its storage model

---

### 18. Initialize API Comparison

**Status:** [x] Resolved by #10

**Schema's initialize:**
```ts
public initialize(content: NodeFromSchema<TSchema>): void {
    this.ensureNotDisposed();
    if (!this.compatibility.canInitialize) {
        throw new UsageError("Cannot initialize - schema already stored");
    }
    // Persist schema
    if (this.persistence) {
        const encoded = encodeSchema(this.schema);
        this.persistence.setPersistedSchema(encoded);
    }
    // Store content field by field
    for (const [fieldName, fieldSchema] of this.fields) {
        const value = (content as Record<string, unknown>)[fieldName];
        // ... validation and storage
    }
}
```

**Tree's initialize:**
```ts
public initialize(content: InsertableField<TRootSchema>): void {
    this.ensureUndisposed();
    if (!this.compatibility.canInitialize) {
        throw new UsageError("Tree cannot be initialized more than once.");
    }
    this.runSchemaEdit(() => {
        const schema = toInitialSchema(this.config.schema);
        const mapTree = prepareForInsertionContextless(content, ...);
        this.checkout.transaction.start();
        initialize(this.checkout, schema, initializerFromChunk(...));
        this.checkout.transaction.commit();
    });
}
```

**Original concern:** Schema stores field-by-field without transactions, risking partial state on failure.

**Resolution:** #10 removes content parameter from `initialize()`. Now it only persists schema (single operation), eliminating atomicity concern. Content is set separately via normal field access.

**Future note:** If SharedMap gains transaction support, consider using it.

**Decision:** [ ] Future - Add transaction support when SharedMap supports it

---

### 19. API Visibility and Export Organization

**Status:** [x] Decided

**Guiding principles:**
1. **DDS authors are internal** - `ISchemaStorage`, `ISchemaPersistence`, etc. stay `@internal`
2. **Only DDS consumers need public/alpha** - `SchemaFactory`, `viewWith()` result types
3. **Minimize exports** - don't export unless necessary
4. **Lowest visibility possible** - prefer `@internal` → `@alpha` → `@beta` → `@public`

**Visibility tiers:**

| Audience | Visibility | Examples |
|----------|------------|----------|
| DDS authors (us) | `@internal` | `ISchemaStorage`, `ISchemaPersistence`, `createSchematizedView` |
| Early adopters | `@alpha` | `SchemaFactory`, `SchematizedView`, user-facing types |
| Stable API | `@public` | (future, after validation) |

**Current state is correct:**
- Most types `@internal` - good
- User-facing types `@alpha` - appropriate for new package
- Small API surface - intentional

**TODO:**
- [ ] Audit exports - remove any unnecessary ones
- [ ] Ensure DDS-author APIs are `@internal`
- [ ] Keep user-facing APIs at `@alpha` until stable

---

### 20. Naming Consistency

**Status:** [x] Decided - shorten names

**Current → New:**
- `SchematizedView` → `SchemaView`
- `SchematizedObject` → `ObjectView` (or similar)
- `SchemaViewConfiguration` - already short, keep

**Rationale:**
- Shorter is better for frequently used types
- "Schema" prefix already clear in context
- Matches Tree's concise naming (`TreeView`, not `TreeifiedView`)

**TODO:**
- [ ] Rename `SchematizedView` → `SchemaView`
- [ ] Rename `SchematizedObject` → `ObjectView`
- [ ] Update all references

---

### 21. Clarify `initialize()` is Optional + Add Escape Hatch

**Current:** README shows `initialize()` as if always needed

**Reality:** `initialize()` is only needed when you want to:
1. Persist the schema to the document
2. Enforce schema across all clients
3. Enable schema compatibility checks

**Without initialize:**
- View works fine for local typed access
- No cross-client schema enforcement
- No persisted schema in document

**Escape hatch: `ignoreStoredSchema` config option**

Users who accidentally initialized a schema they want to change incompatibly need a way out.

```ts
// User initialized with SchemaV1, now wants incompatible SchemaV2
const view = map.viewWith({
  schema: SchemaV2,
  ignoreStoredSchema: ["com.example.myapp.SchemaV1"]  // Ignore specific stored schemas
})

// Can list multiple schemas to ignore (useful during migrations)
const view = map.viewWith({
  schema: SchemaV3,
  ignoreStoredSchema: [
    "com.example.myapp.SchemaV1",
    "com.example.myapp.SchemaV2"
  ]
})
```

**Behavior:**
- If stored schema identifier is in the list, ignore it
- Acts as if no schema was ever initialized (for those schemas)
- Existing data remains (may not match new schema!)
- User is responsible for data migration
- Intentionally unsafe - escape hatch for development/mistakes
- Explicit list makes intent clear and limits scope
- Empty array or omitted = normal validation

**Decision:** [x] Do both - update docs + add config option with list of identifiers

**TODO:**
- [ ] Update README to clarify initialize is optional
- [ ] Add `ignoreStoredSchema?: string[]` to `SchemaViewConfiguration`
- [ ] Document that this is an unsafe escape hatch
- [ ] Validate against `ScopedSchemaName` of stored schema

---

## Open Questions (Legacy)

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
- [DONE] Create `SchemaViewConfiguration<TSchema>` interface
- [DONE] Update `viewWith()` signature to accept config or schema directly
- [DONE] Add `enableSchemaValidation` option (default: false)
- [DONE] When enabled, validate on property set operations
- [DONE] Update API reports

### #2 - IDisposable Implementation

TODO:
- [DONE] Import `IDisposable` from `@fluidframework/core-interfaces`
- [DONE] Add `dispose()` method to `SchematizedObjectView` and `SchematizedMapView`
- [DONE] Track disposed state
- [DONE] Throw on access after dispose
- [DONE] Update proxy handlers to check disposed state
- [DONE] Update `SchematizedView` type to extend `IDisposable`

### #4 - Root Property Implementation

[DONE] **Completed December 19, 2025**

Implementation summary:
- ✅ Changed view structure: view has `root` property for data access
- ✅ `root` getter returns the typed proxy (ObjectProxy or MapProxy)
- ✅ `root` setter allows full replacement of data
- ✅ Updated `SchematizedObject` and `SchematizedMap` types in `proxyTypes.ts`
- ✅ Updated `ObjectViewResult` and `MapViewResult` interfaces in `createView.ts`
- ✅ Updated `createObjectViewProxy` and `createMapViewProxy` in `proxy.ts`
- ✅ Updated all tests in `view.spec.ts` to use `view.root.field` pattern
- ✅ **Breaking change** - API changed from `view.field` to `view.root.field`
- ✅ Build passes, all 253 tests pass

### #6 - Field Props Implementation

[DONE] **Completed December 19, 2025**

Implementation summary:
- ✅ Added `FieldProps` interface in `schemaFactory.ts`: `{ key?: string, metadata?: { description?: string, custom?: unknown } }`
- ✅ Updated `TypedFieldSchema` interface to include optional `props?: FieldProps`
- ✅ Updated `optional()` signature: `optional<T>(types: T, props?: FieldProps)`
- ✅ Updated `required()` signature: `required<T>(types: T, props?: FieldProps)`
- ✅ Props stored in returned `TypedFieldSchema` when provided
- ✅ Exported `FieldProps` from `factory/index.ts` and main `index.ts`
- ✅ Build passes, all 252 tests pass

### #7 - Error Handling Implementation

[SKIP] **Reason:** UsageError is `@internal` in telemetry-utils, so extending it forces SchemaValidationError to be `@internal` too. This would remove it from the public API, preventing users from catching the specific error type. Need design decision on:
- Keep `@alpha` with plain Error (current)
- Accept `@internal` visibility (lose public type)
- Use composition instead of inheritance

Original TODO (not implemented):
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
- [DONE] Create `view/createView.ts` with `createSchematizedView<TSchema>(storage, schema, persistence?)`
- [DONE] Create `storage/adapters.ts` with:
  - [DONE] `MapLikeStorage` interface (get, set, delete, has, keys, size)
  - [DONE] `createFlatStorageAdapter(source: MapLikeStorage): ISchemaStorage`
  - [DONE] `SchemaField` interface (get, set)
  - [DONE] `createPersistenceAdapter(field: SchemaField): ISchemaPersistence`
- [SKIP] Refactor internal code (already exists in view classes, low value):
  - [SKIP] `unwrapStorageResult()` - consolidate from objectView.ts and mapView.ts
  - [SKIP] `wrapNestedStorage()` - create view for nested storage results
  - [SKIP] `getNodeSchemaFromField()` - extract NodeSchema from FieldSchema
  - [SKIP] `assertCanView/Initialize/Upgrade()` - guard functions
- [DONE] **Reduce exports** - DDSes only need to import:
  - [ ] `createSchematizedView` - the main helper
  - [ ] `ISchemaStorage`, `ISchemaPersistence` - interfaces to implement
  - [ ] `RootSchema`, `SchematizedView` - types
  - [ ] Remove need to export: `SchematizedObjectView`, `SchematizedMapView`, `createObjectViewProxy`, `createMapViewProxy`, `isObjectSchema`, `isMapSchema`
- [ ] Export public helpers from index.ts (internal entrypoint for DDSes)
- [ ] Update SharedMap to use new helpers (reduces ~50 lines to ~5)
- [ ] Document for other DDS authors

---

## Documentation Updates

The following design documents have been updated to reflect implementation decisions.

### Priority 1: Updated with Implementation Reality

| Document | Updates Made |
|----------|--------------|
| **README.md** | [DONE] Added real usage examples with config object, root property, dispose(), and field props |
| **schema-map-design.md** | [DONE] Added "Implementation Status" banner. Updated code examples for config object and root property. Added dispose() calls. |
| **schema-dds-integration.md** | [DONE] Added status banner. Updated examples to match actual API (config object, root property, dispose). Updated comparison table. |

### Priority 2: Marked as Historical

| Document | Action |
|----------|--------|
| **schema-implementation-plan.md** | [DONE] Added "HISTORICAL" header noting implementation is complete. Links to actual code. |
| **schema-extraction-plan.md** | Defer - still relevant as architecture reference |
| **schema-open-items.md** | [DONE] Added status banner. Marked SharedMap Q5-6 as resolved. |

### Priority 3: Future Work Documents

| Document | Action |
|----------|--------|
| **schema-directory-design.md** | Unchanged - marked as "future" in related docs links |
| **schema-string-design.md** | Unchanged - marked as "future" in related docs links |

### Specific Updates Completed

#### README.md
- [DONE] Add working example from actual tests
- [DONE] Document `viewWith()` API with config object
- [DONE] Show ObjectNodeSchema vs MapNodeSchema patterns
- [DONE] Show field props usage

#### schema-map-design.md
- [DONE] Add status banner: "✅ Implementation complete"
- [DONE] Update viewWith signature to use config object (Decision #1)
- [DONE] Update view access pattern to use `view.root.field` (Decision #4)
- [DONE] Add dispose() calls to examples

#### schema-dds-integration.md
- [DONE] Add status banner
- [DONE] Update config object signature
- [DONE] Update root property access pattern
- [DONE] Update comparison table with dispose()
- [DONE] Add note about `createSchematizedView` helper

#### schema-open-items.md
- [DONE] Add status banner
- [DONE] SharedMap Q5-6: Mark resolved (we support both Object and Map schemas)

#### schema-implementation-plan.md
- [DONE] Add header: "📜 HISTORICAL: Implementation Plan (Completed)"
- [DONE] Add link to actual implementation
