# Schema Package Notes

<!--
  Active development notes and open questions.
  For completed work, see ./archive/completed-december-2025.md
-->

---

## Pending Tasks

### Move tests to local-server-tests

- [DONE] Add `@fluidframework/schema` dependency to local-server-tests
- [DONE] Add `@fluidframework/map` dependency if not present (already present)
- [DONE] Create test file in local-server-tests
- [SKIP] Move/adapt test cases from e2e (no existing e2e tests to move)
- [SKIP] Remove tests from e2e package (no existing e2e tests)
- [DONE] Verify tests pass in new location (tests created, need build to verify)

---

## Open Issues

### Nested Object Field Updates Concatenate Instead of Replace [BUG]

**Problem:** When updating a nested object field from a second client, values get concatenated instead of replaced.

**Reproduction (from local-server-tests/schematizedMap.spec.ts):**
```typescript
// Client 1: Sets nested object
view1.root.address = { street: "123 Main St", city: "Seattle" };

// Client 2: Updates nested field
view2.root.address.city = "Portland";

// Expected on Client 1: "Portland"
// Actual on Client 1: "SeaPorttleand"  // Concatenated!
```

**Likely cause:** The nested object proxy's `set` handler may be incorrectly handling the update, possibly due to how the storage key path is constructed or how the SharedMap `set` operation is being called.

**Files to investigate:**
- `src/view/objectView.ts` - Object proxy handler
- `src/view/mapView.ts` - Storage key path construction

---

### Schema Op for Real-Time Sync [PENDING]

**Problem:** Schema is currently only persisted in snapshots, not synced via ops.

When client 1 calls `view.initialize()`, the schema is stored in `SharedMap._persistedSchema` and written to the next snapshot. However, if client 2 connects before a snapshot is taken, it won't see the schema because:
1. `setPersistedSchema()` only sets a local field
2. There's no op sent to notify other clients
3. Client 2's `canView` returns `false` because it has no stored schema

**Symptoms:**
- E2E tests fail when testing schema sync between two clients
- `view2.compatibility.canView` returns `false` after `view1.initialize()`
- Works correctly after container reload (because snapshot contains schema)

**Solution (NOT YET IMPLEMENTED):**
Add a schema op type to SharedMap:
1. Add `IMapSchemaOperation` to `internalInterfaces.ts`
2. Modify `setPersistedSchema()` to call `submitLocalMessage({ type: "schema", value: schema })`
3. Handle schema ops in `processMessagesCore()`
4. Handle schema ops in `reSubmitCore()` and `applyStashedOp()`

**Why deferred:** Need to consider:
- Op format and versioning implications
- Conflict resolution if two clients initialize with different schemas
- Whether this is the right pattern vs. storing schema as a reserved key in the map

---

## Package Review (December 2025)

### Missing Features (Compared to SharedTree)

**1. Array Schema Not Implemented** [TODO]

`ArrayNodeSchema` is defined and exported but there's no `sf.array()` factory method to create array schemas. The factory only supports `object` and `map`.

- [ ] Add `sf.array(name, itemSchema)` method to SchemaFactory
- [ ] Add `SchematizedArrayView` class
- [ ] Add tests for array schemas
- OR document that arrays are intentionally not supported and why

**2. FieldProps.key Not Implemented** [TODO]

`FieldProps.key` storage key override is documented but the implementation is incomplete:
- The property is defined in `FieldProps` interface
- It's never read by storage operations
- Tests don't cover this feature

- [ ] Implement storage key override in view proxy handlers
- [ ] Add tests for key override
- OR remove if not needed

**3. No Recursive/Self-Referential Schema Support** [SKIP - by design]

SharedTree supports recursive schemas via `SchemaFactory.recursive()`. This is intentionally not supported in the schema package because it adds significant complexity and most DDS use cases don't need it.

**4. No Identifier Field Support** [SKIP - by design]

SharedTree has `sf.identifier` for auto-generated unique IDs. Not implemented here - users can use UUIDs manually if needed.

**5. No AllowUnknownOptionalFields** [SKIP - by design]

SharedTree allows objects to have unknown fields. Not implemented here - strict schema validation is preferred.

### Test Coverage Gaps

**1. Handle Leaf Type** [TODO]
- Limited testing of `handleSchema` / Fluid handles
- Tests exist for other primitives, handles only checked at type level
- [ ] Add runtime tests for handle storage/retrieval

**2. Nested Map Schemas** [TODO]
- Tests exist but limited coverage for `sf.map("Outer", sf.map("Inner", sf.string))`
- [ ] Add deeper nesting tests

**3. Schema Upgrade with Data Migration** [TODO]
- `upgradeSchema()` tested but no tests for actual data transformation
- [ ] Add tests that verify data survives schema upgrades

### Type Inference Casts (Acceptable)

The following `as unknown` casts are in view creation where TypeScript can't infer complex generic relationships. These are acceptable given the type complexity:

| File | Context |
|------|---------|
| src/view/createView.ts:161 | View return type |
| src/view/createView.ts:209 | Map view return type |
| src/view/createView.ts:263,276 | Schematized view |
| src/view/mapView.ts:122 | Nested object view |
| src/view/mapView.ts:149 | Validation call |

### Documentation Gaps

**1. Schema Sync Limitation** [TODO]
- Users aren't warned that `initialize()` doesn't immediately sync schema to other clients
- [ ] Add warning in README about snapshot-only schema sync
- [ ] Document workaround (force snapshot or wait for natural snapshot)

**2. Empty Public API Report** [Expected]
- `api-report/schema.public.api.md` is empty
- This is correct - all APIs are `@alpha @legacy`, none are stable public yet

### Cleanup Opportunities

**1. nodeKinds module redundancy**
- `src/nodeKinds/index.ts` simply re-exports from core module
- Could be removed, imports updated to use core directly
