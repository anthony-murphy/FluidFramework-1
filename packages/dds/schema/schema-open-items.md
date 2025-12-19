# Schema Integration - Open Items & Notes

> **Related Documents**:
> - [Schema Extraction Plan](./schema-extraction-plan.md) - Core schema package extraction
> - [Schema DDS Integration Patterns](./schema-dds-integration.md) - General modality patterns
> - [SharedMap Schema Design](./schema-map-design.md) - SharedMap implementation
> - [SharedDirectory Schema Design](./schema-directory-design.md) - SharedDirectory implementation
> - [SharedString Schema Design](./schema-string-design.md) - SharedString implementation

This document tracks open questions, design notes, risks, and concerns for the schema extraction and DDS integration work.

---

## Table of Contents

1. [Open Questions](#1-open-questions)
2. [Design Notes](#2-design-notes)
3. [Risks & Concerns](#3-risks--concerns)
4. [Future Considerations](#4-future-considerations)

---

## 1. Open Questions

### SharedString

1. **Marker type discrimination**: How do we identify which schema a marker uses? Store schema identifier in marker properties?

2. **Dynamic collections**: Should `intervalCollections` allow arbitrary collection names, or require all collections to be declared upfront?

3. **Migration**: How do existing documents with untyped properties migrate to typed schemas?

4. **Partial schemas**: Can you schema just text properties without scheming markers/intervals?

### SharedMap

5. **Key constraints**: Should SharedMap schema support key pattern validation (e.g., regex for allowed keys)?

6. **Heterogeneous values**: How do we handle maps where different keys have different value types?

### SharedDirectory

7. **Unified vs separate namespaces**: Should schema expose the underlying two-namespace implementation (storage vs subdirectories), or present a unified namespace where subdirectories are just a special value type?

8. **Mutable structure**: Tree objects have fixed fields. Should schematized directories allow adding/removing fields at runtime, or be fixed like Tree?

9. **Existing data migration**: How do existing directories (created without schema) migrate to schematized directories?

10. **Mixed schemas**: Can a directory have some typed fields and some untyped "extra" fields?

11. **Property access vs method access**: Should `view.profile` be direct property access (like Tree) or `view.getSubDirectory("profile")`?

### General

12. **Schema versioning**: How do we handle schema evolution across document versions?

13. **Cross-DDS schemas**: Can schemas reference types from other DDSes in the same container?

---

## 2. Design Notes

### Resolved Decisions

| Decision | Resolution | Document |
|----------|------------|----------|
| Property inheritance pattern | SharedString provides base types (`TextSegmentSchema`, `MarkerSchema`, `IntervalSchema`) that consumers extend | [schema-string-design.md](./schema-string-design.md) |
| Unified API for modalities | Single `viewWith(schema, { persist: true/false })` API works for both Modality 1 and 2 | [schema-map-design.md](./schema-map-design.md) |
| Schema storage location | `.attributes` blob for backward compatibility | [schema-map-design.md](./schema-map-design.md) |

### Implementation Notes

1. **`SharedStringSchemaConfig` interface** uses `ObjectNodeSchema` rather than specific base types - this is appropriate since all extended types are still `ObjectNodeSchema`

2. **Storage design** for SharedString shows JSON structure but doesn't specify how inheritance is encoded - this is an implementation detail for later

3. **Type inference** for SharedString is multi-dimensional (text props, markers, intervals) vs single-dimensional for SharedMap

---

## 3. Risks & Concerns

### Technical Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Schema package size | Extracting schema could significantly increase bundle size for non-Tree users | Careful tree-shaking, lazy loading |
| Breaking changes | Schema extraction may require API changes | Maintain backward compatibility layer |
| Performance overhead | Runtime validation adds CPU cost | Make validation opt-in, optimize hot paths |

### Adoption Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Migration complexity | Existing untyped code must be updated | Provide codemods, gradual adoption path |
| Learning curve | New API patterns for existing DDS users | Good documentation, examples |
| Ecosystem fragmentation | Some users on typed, some on untyped | Clear deprecation timeline |

### Compatibility Concerns

1. **Document compatibility**: Documents created with schema must be openable by clients without schema support (graceful degradation)

2. **Schema mismatch**: What happens when two clients have different schemas for the same document?

3. **Rollback scenarios**: If a schema upgrade fails, can we roll back?

---

## 4. Future Considerations

### Potential Enhancements

1. **Schema inference**: Automatically infer schema from existing document data

2. **Schema diffing**: Tools to compare schemas and detect breaking changes

3. **Runtime schema discovery**: Query what schema a document uses without loading the full schema

4. **Cross-container schemas**: Share schema definitions across multiple containers

### Modality 3 for Existing DDSes

**Goal**: Bring Tree's "schema-driven storage" benefits to SharedMap, SharedDirectory, SharedString.

**Key benefit**: Reading data at rest without loading full DDS runtime - enables debugging tools, data migration, analytics, backup verification.

**Design considerations for Modality 2 that enable future Modality 3**:

| Consideration | Why It Matters |
|---------------|----------------|
| Schema encoding format | Should be rich enough to decode data, not just check compatibility |
| Schema format consistency | Same encoding as Tree enables shared tooling |
| Extensible storage | `.attributes` may have limitations that don't work for Modality 3 |

**Migration path**:
```
Modality 2 → Modality 3:
1. Read existing native format
2. Write schema-driven JSON format on summarize
3. Support dual-format during transition
4. Provide migration tools for existing documents
```

**Open questions**:
- Can we share Tree's encoding infrastructure for Modality 3 in other DDSes?
- What's the performance impact of schema-driven encoding for simple DDSes?
- How do we handle DDSes like SharedString with complex internal structure (segments, markers, intervals)?

### Tooling Opportunities

1. **Schema IDE extension**: IntelliSense for schema definitions
2. **Migration generator**: Auto-generate migration code for schema changes
3. **Schema validator CLI**: Validate documents against schemas offline
4. **Documentation generator**: Generate API docs from schema definitions
5. **Data inspector**: Read data at rest using schema (Modality 3 benefit)

---

## 5. Decision Log

| Date | Decision | Rationale | Alternatives Considered |
|------|----------|-----------|------------------------|
| 2024-12 | Use inheritance for SharedString base types | Cleaner API, explicit relationship | Composition, mixins |
| 2024-12 | Unified `viewWith` API for both modalities | Single API to learn, easy to switch | Separate APIs per modality |
| 2024-12 | Store schema in `.attributes` | Backward compatible, single location | Separate blob, inline in data |

---

## 6. References

- [Tree DDS Schema Implementation](../packages/dds/tree/) - Current schema implementation
- [SharedString Implementation](../packages/dds/sequence/) - Current SharedString
- [SharedMap Implementation](../packages/dds/map/) - Current SharedMap
