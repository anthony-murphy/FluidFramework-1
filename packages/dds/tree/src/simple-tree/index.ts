/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

export {
	typeNameSymbol,
	typeSchemaSymbol,
	type WithType,
	type TreeNodeSchema,
	NodeKind,
	type TreeNodeSchemaClass,
	type TreeNodeSchemaNonClass,
	type TreeNodeSchemaCore,
	type TreeChangeEvents,
	// TreeNode is only type exported, which prevents use of the class object for unsupported use-cases like direct sub-classing and instanceof.
	// See docs on TreeNode for more details.
	type TreeNode,
	type Unhydrated,
	type InternalTreeNode,
	isTreeNode,
	tryDisposeTreeNode,
	HydratedContext,
	SimpleContextSlot,
	getOrCreateInnerNode,
	getKernel,
} from "./core/index.js";
export {
	type ITree,
	type TreeView,
	type ViewableTree,
	type TreeViewEvents,
	TreeViewConfiguration,
	type ITreeViewConfiguration,
	type SchemaCompatibilityStatus,
	type ITreeConfigurationOptions,
	SchemaFactory,
	type SchemaFactoryObjectOptions,
	type ScopedSchemaName,
	type ValidateRecursiveSchema,
	type FixRecursiveArraySchema,
	adaptEnum,
	enumFromStrings,
	singletonSchema,
	test_RecursiveObject,
	test_RecursiveObject_base,
	test_RecursiveObjectPojoMode,
	treeNodeApi,
	type TreeNodeApi,
	cursorFromInsertable,
	createFromInsertable,
	type NodeChangedData,
	TreeBeta,
	type TreeChangeEventsBeta,
	type SimpleTreeIndex,
	type IdentifierIndex,
	createSimpleTreeIndex,
	createIdentifierIndex,
	type SimpleNodeSchemaBase,
	type SimpleTreeSchema,
	type SimpleNodeSchema,
	type SimpleFieldSchema,
	type SimpleLeafNodeSchema,
	type SimpleMapNodeSchema,
	type SimpleArrayNodeSchema,
	type SimpleObjectNodeSchema,
	type JsonSchemaId,
	type JsonSchemaType,
	type JsonObjectNodeSchema,
	type JsonArrayNodeSchema,
	type JsonMapNodeSchema,
	type JsonLeafNodeSchema,
	type JsonSchemaRef,
	type JsonRefPath,
	type JsonNodeSchema,
	type JsonNodeSchemaBase,
	type JsonTreeSchema,
	type JsonFieldSchema,
	type JsonLeafSchemaType,
	getJsonSchema,
	getSimpleSchema,
	type VerboseTreeNode,
	type EncodeOptions,
	type ParseOptions,
	type VerboseTree,
	extractPersistedSchema,
	comparePersistedSchema,
	type ConciseTree,
	comparePersistedSchemaInternal,
	ViewSchema,
	type Unenforced,
	type FieldHasDefaultUnsafe,
	type ObjectFromSchemaRecordUnsafe,
	type TreeObjectNodeUnsafe,
	type TreeFieldFromImplicitFieldUnsafe,
	type TreeNodeFromImplicitAllowedTypesUnsafe,
	type FieldSchemaUnsafe,
	type InsertableTreeNodeFromImplicitAllowedTypesUnsafe,
	type TreeArrayNodeUnsafe,
	type TreeMapNodeUnsafe,
	type InsertableObjectFromSchemaRecordUnsafe,
	type InsertableTreeFieldFromImplicitFieldUnsafe,
	type InsertableTypedNodeUnsafe,
	type NodeBuilderDataUnsafe,
	type NodeFromSchemaUnsafe,
	type ReadonlyMapInlined,
	type TreeNodeSchemaClassUnsafe,
	type TreeNodeSchemaUnsafe,
	type AllowedTypesUnsafe,
	type TreeNodeSchemaNonClassUnsafe,
	type InsertableTreeNodeFromAllowedTypesUnsafe,
	type TreeViewAlpha,
	type TreeBranch,
	type TreeBranchEvents,
	tryGetSchema,
	applySchemaToParserOptions,
	cursorFromVerbose,
	verboseFromCursor,
	conciseFromCursor,
	createFromCursor,
	asTreeViewAlpha,
	customFromCursorStored,
	type CustomTreeNode,
	type CustomTreeValue,
	tryStoredSchemaAsArray,
} from "./api/index.js";
export {
	type NodeFromSchema,
	isTreeNodeSchemaClass,
	type ImplicitFieldSchema,
	type TreeFieldFromImplicitField,
	type ImplicitAllowedTypes,
	type TreeNodeFromImplicitAllowedTypes,
	type InsertableTreeNodeFromImplicitAllowedTypes,
	type TreeLeafValue,
	type AllowedTypes,
	FieldKind,
	FieldSchema,
	type InsertableTreeFieldFromImplicitField,
	type InsertableTypedNode,
	type NodeBuilderData,
	type DefaultProvider,
	type FieldProps,
	normalizeFieldSchema,
	areFieldSchemaEqual,
	areImplicitFieldSchemaEqual,
	type ApplyKind,
	type FieldSchemaMetadata,
	type InsertableField,
	type Insertable,
	type UnsafeUnknownSchema,
	normalizeAllowedTypes,
	type ApplyKindInput,
	type InsertableTreeNodeFromAllowedTypes,
	type Input,
	type ReadableField,
	type ReadSchema,
} from "./schemaTypes.js";
export {
	getTreeNodeForField,
	prepareContentForHydration,
} from "./proxies.js";
export {
	TreeArrayNode,
	IterableTreeArrayContent,
	type ReadonlyArrayNode,
} from "./arrayNode.js";
export {
	type FieldHasDefault,
	type InsertableObjectFromSchemaRecord,
	type ObjectFromSchemaRecord,
	type TreeObjectNode,
	setField,
	createUnknownOptionalFieldPolicy,
} from "./objectNode.js";
export type { TreeMapNode, MapNodeInsertableData } from "./mapNode.js";
export {
	mapTreeFromNodeData,
	type InsertableContent,
	type FactoryContent,
	type FactoryContentObject,
} from "./toMapTree.js";
export { toStoredSchema, getStoredSchema } from "./toStoredSchema.js";
export {
	numberSchema,
	stringSchema,
	booleanSchema,
	handleSchema,
	nullSchema,
} from "./leafNodeSchema.js";
export type { LazyItem, FlexList, FlexListToUnion, ExtractItemType } from "./flexList.js";
