# Schema View Typing Design

## Problem Statement

The schema package provides typed views over DDS data (SharedMap initially). We're encountering TypeScript "excessively deep and possibly infinite" type instantiation errors when integrating with SharedMap.

## Current State

### Current Architecture

```
ObjectView<TSchema>     - Interface for object schema views
MapView<TSchema>        - Interface for map schema views
SchemaView<TSchema>     - Conditional type: ObjectView | MapView based on schema
SchematizedView<TSchema> - Alias for SchemaView

SchematizedObjectView   - Implementation class for ObjectView
SchematizedMapView      - Implementation class for MapView
BaseSchematizedView     - Shared base class (just refactored)
```

### The Recursion Problem

When `SharedMap` implements `ISchematizedSharedMap`:

```typescript
export interface ISchematizedSharedMap extends ISharedMap {
  viewWith<TSchema extends RootSchema>(schema: TSchema): SchematizedView<TSchema>;
}

export class SharedMap implements ISchematizedSharedMap {
  // ERROR: Type instantiation is excessively deep and possibly infinite
}
```

Even simplifying `SchematizedView` to `{ root: unknown }` doesn't fix it. The error occurs at the class declaration level, suggesting the issue is in how TypeScript processes the generic constraint `TSchema extends RootSchema` when checking class-interface compatibility.

### What Causes the Recursion

The `TypeFromImplicitAllowedTypes` type is self-referential for maps:

```typescript
type TypeFromImplicitAllowedTypes<T> =
  T extends TypedLeafNodeSchema ? ValueFromLeafSchema<T> :
  T extends TypedObjectNodeSchema<string, infer TFields> ? ObjectFromFields<TFields> :
  T extends TypedMapNodeSchema<string, infer TValueSchema>
    ? TypeFromImplicitAllowedTypes<TValueSchema>  // <-- RECURSIVE
    : ...
```

This recursion is valid and terminates, but TypeScript's type checker has depth limits when evaluating in certain contexts (like generic class declarations).

## SharedTree's Approach

SharedTree successfully handles similar complexity. Key observations:

### Single View Type
```typescript
// One unified TreeView interface
interface TreeView<TSchema extends ImplicitFieldSchema> {
  readonly root: TreeFieldFromImplicitField<TSchema>;
  // ... other members
}
```

### Conditional on Property, Not Interface
The conditional type is on the `root` property type, not selecting between different interface types:

```typescript
// SharedTree does NOT do this:
type TreeView<T> = T extends ObjectSchema ? ObjectView<T> : MapView<T>;

// It DOES do this:
interface TreeView<T> {
  root: TreeFieldFromImplicitField<T>;  // Conditional here
}
```

### One Implementation Class
`SchematizingSimpleTreeView` handles all schema types internally.

## Design Options

### Option 1: Unified View Type (SharedTree Pattern)

Create a single `SchematizedView<TSchema>` interface with a conditional `root` type:

```typescript
export type SchematizedView<TSchema extends RootSchema> = IDisposable & {
  readonly root: RootFromSchema<TSchema>;
  readonly compatibility: SchemaCompatibilityStatus;
  initialize: () => void;
  upgradeSchema: () => void;
};

type RootFromSchema<TSchema> =
  TSchema extends ObjectNodeSchema ? NodeFromSchema<TSchema> :
  TSchema extends MapNodeSchema ? Map<string, InferMapValueType<TSchema>> :
  never;
```

**Pros:**
- Simpler API surface (one type, not two)
- Matches SharedTree pattern
- May avoid some recursion issues

**Cons:**
- Still has conditional types that may cause recursion
- Tested this approach - still got recursion errors

### Option 2: Function Overloads (No Generics in Return Type)

Use overloads to avoid generic return types entirely:

```typescript
export interface ISchematizedSharedMap extends ISharedMap {
  viewWith<T extends ObjectNodeSchema>(schema: T): ObjectView<T>;
  viewWith<T extends MapNodeSchema>(schema: T): MapView<T>;
}
```

**Pros:**
- Avoids conditional types
- Clear, explicit signatures

**Cons:**
- Still has generics that may trigger recursion
- Tested this - still got recursion errors at class level

### Option 3: Non-Generic Interface + Cast in Implementation

Remove generics from the interface entirely:

```typescript
export interface ISchematizedSharedMap extends ISharedMap {
  viewWith(schema: RootSchema): SchematizedView<RootSchema>;
}

// In map.ts - use internal overloads
class SharedMap {
  viewWith(schema: RootSchema): SchematizedView<RootSchema> {
    // Implementation casts internally
  }
}

// Consumers cast or use type guards
const view = map.viewWith(MySchema) as SchematizedView<typeof MySchema>;
```

**Pros:**
- Completely avoids type-level recursion
- Simple interface

**Cons:**
- Loss of type inference at call site
- Requires consumer casts
- Poor developer experience

### Option 4: Branded Types / Opaque Types

Use branded types to break the recursion chain:

```typescript
type ViewToken<TSchema> = { __brand: TSchema };

interface ISchematizedSharedMap {
  viewWith<T extends RootSchema>(schema: T): ViewToken<T>;
}

// Separate function to "open" the token
function getViewRoot<T extends ObjectNodeSchema>(view: ViewToken<T>): NodeFromSchema<T>;
function getViewRoot<T extends MapNodeSchema>(view: ViewToken<T>): Map<string, InferMapValueType<T>>;
```

**Pros:**
- Defers type computation until needed
- May avoid class-level recursion

**Cons:**
- Awkward API
- Extra step for consumers

### Option 5: Factory Functions (Not Class Methods)

Don't put `viewWith` on the interface at all:

```typescript
// Standalone factory function
function viewWith<T extends ObjectNodeSchema>(map: ISharedMap, schema: T): ObjectView<T>;
function viewWith<T extends MapNodeSchema>(map: ISharedMap, schema: T): MapView<T>;

// Usage
const view = viewWith(map, MySchema);
```

**Pros:**
- No interface/class interaction issues
- Overloads work better on standalone functions
- Can be tree-shaken if not used

**Cons:**
- Different pattern than SharedTree's `tree.viewWith()`
- Less discoverable API

### Option 6: Investigate Root Cause

The recursion happens even with `SchematizedView<TSchema> = { root: unknown }`. This suggests:

1. The issue may be in `RootSchema` definition itself
2. Or in how TypeScript checks class implements interface with generics
3. Or a circular import issue creating type cycles

Need to:
- Create minimal reproduction
- Try with completely fresh types (no imports from schema package)
- Check if issue is specific to SharedMap class structure

## Questions to Answer

1. **Do we need separate ObjectView/MapView types?**
   - SharedTree has one `TreeView` where `root` type varies
   - Our ObjectView.root is `{ field: value }`, MapView.root is `Map<string, value>`
   - Could unify: `root: NodeFromSchema<TSchema> | Map<...>` with type narrowing

2. **Can views be unexported implementation details?**
   - Yes, if we provide factory functions
   - Implementation classes already unexported (`@internal`)
   - Public types could be minimal interfaces

3. **Should DDS use factory functions instead of methods?**
   - Pro: Avoids interface generic issues
   - Con: Different from SharedTree pattern
   - Con: Less OOP-familiar API

4. **Is the root cause actually in the schema types, not view types?**
   - Need minimal repro to confirm
   - TypeScript has known issues with complex mapped types in class contexts

## Next Steps

1. Create minimal reproduction to isolate the exact cause
2. Try factory function approach to see if it avoids issues
3. Consider if we can simplify the schema type hierarchy
4. Look more closely at SharedTree's type structure to understand why it works
5. Consider filing TypeScript issue if this is a compiler limitation

## References

- SharedTree view implementation: `packages/dds/tree/src/shared-tree/schematizingTreeView.ts`
- SharedTree types: `packages/dds/tree/src/simple-tree/`
- TypeScript issue on deep instantiation: https://github.com/microsoft/TypeScript/issues/34933
