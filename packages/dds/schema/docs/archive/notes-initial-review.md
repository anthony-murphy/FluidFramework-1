# Schema Package Notes (Historical)

<!-- 
  This file contains historical review notes and completed tasks from initial package setup.
  For current API decisions and implementation tasks, see src/notes.md
-->

# Human Added
- [x] use const object rather than enums
- [x] tag all types intended to be export from the package as @legacy @alpha
- [x] ensure our package.json aligns with other packages, we have very specific requirements around api doc generation, and exports
- [x] put implementations in non-index.ts files. index ts should just be exports.
- [x] keep test code, like MockStorage, and product code separate. test code should live in the test folder
- [x] you copied usage error when you should have just imported it from telemetry utils. might be other similar problems.
- [x] rather than SchematizedView could we have a common type for a root schema that does the same thing, but can be reused, rather than each type building their own.
- [x] we need to add test to the map project that validate the viewWith works
- [x] this package needs a legacy/alpha export, as we are adding legacy alpha types.
- [x] review the schema project and add notes under AI Added heading

---

# AI Added

## Package Review Summary (2025-12-18)

### Build Status
**Build FAILS** due to eslint errors. The TypeScript compilation, api-extractor, and biome formatting all pass.

**Remaining ESLint Errors:** ~150 errors (down from 251 after auto-fixes)
- **Source code errors (5):** All in `schemaFactory.ts` - `consistent-type-assertions` rule violations for phantom type pattern (`as TypedObjectNodeSchema<...>`)
- **Test file errors (~145):** Primarily in `view.spec.ts` with `no-unsafe-*` rules due to intentionally testing `any` types

### Test Status
**All 252 tests PASS** ✅

### Package Structure

The package is well-organized into these modules:

| Module | Purpose | Files |
|--------|---------|-------|
| **core/** | Base schema types and enums | `fieldKind.ts`, `nodeKind.ts`, `nodeSchema.ts`, `typeGuards.ts` |
| **factory/** | SchemaFactory class and leaf schemas | `schemaFactory.ts`, `leafSchemas.ts` |
| **serialization/** | Encode/decode and compatibility checking | `encode.ts`, `decode.ts`, `compatibility.ts`, `format.ts` |
| **storage/** | Storage interfaces | `interfaces.ts` |
| **types/** | TypeScript type inference utilities | `inference.ts` |
| **validation/** | Runtime data validation | `validate.ts` |
| **view/** | Typed views over storage | `objectView.ts`, `mapView.ts`, `proxy.ts`, `errors.ts`, `viewFor.ts` |
| **nodeKinds/** | Re-exports from core (organizational) | `index.ts` |

### Remaining Issues

1. **ESLint `consistent-type-assertions` in schemaFactory.ts:**
   - The pattern `{...} as TypedObjectNodeSchema<...>` is flagged but is intentional for phantom types
   - Could suppress with eslint-disable comments or restructure (not recommended - it's idiomatic)

2. **Test file eslint errors:**
   - `view.spec.ts`: Many `no-unsafe-*` errors from intentionally testing `any` types
   - Various test files: `unicorn/no-null` (tests need null for null-schema validation)
   - `mocha.spec.ts`: `no-void` rule violations (intentional void usage)
   - `schemaFactory.spec.ts`: `no-shadow` for variable `sf`
   - `schemaHelpers.spec.ts`: `no-array-callback-reference` (passing type guards directly)

### Recommendations

1. **For source code:** Add eslint-disable comments to `schemaFactory.ts` for the phantom type assertion pattern (4 locations)

2. **For test files:** Consider:
   - Adding eslint-disable-file comments for test files that intentionally test unsafe patterns
   - Or using `eslint-disable-next-line` for specific violations

3. **Cleanup:** The `nodeKinds/` module only re-exports from `core/` - consider if it's needed or if imports should go directly to `core/`

### Quality Notes
- Good separation of concerns across modules
- Comprehensive test coverage (252 tests)
- TypeScript compilation clean
- API extractor runs successfully
- Biome formatting passes after running `npm run format`
