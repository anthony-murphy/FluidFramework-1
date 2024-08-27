/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/*
 * THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.
 * Generated by flub generate:typetests in @fluid-tools/build-cli.
 */

import type { TypeOnly, MinimalType, FullType, requireAssignableTo } from "@fluidframework/build-tools";
import type * as old from "@fluidframework/test-utils-previous/internal";

import type * as current from "../../index.js";

declare type MakeUnusedImportErrorsGoAway<T> = TypeOnly<T> | MinimalType<T> | FullType<T> | typeof old | typeof current | requireAssignableTo<true, true>;

/*
 * Validate forward compatibility by using the old type in place of the current type.
 * If this test starts failing, it indicates a change that is not forward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "TypeAlias_ChannelFactoryRegistry": {"forwardCompat": false}
 */
declare type old_as_current_for_TypeAlias_ChannelFactoryRegistry = requireAssignableTo<TypeOnly<old.ChannelFactoryRegistry>, TypeOnly<current.ChannelFactoryRegistry>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "TypeAlias_ChannelFactoryRegistry": {"backCompat": false}
 */
declare type current_as_old_for_TypeAlias_ChannelFactoryRegistry = requireAssignableTo<TypeOnly<current.ChannelFactoryRegistry>, TypeOnly<old.ChannelFactoryRegistry>>

/*
 * Validate forward compatibility by using the old type in place of the current type.
 * If this test starts failing, it indicates a change that is not forward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Enum_DataObjectFactoryType": {"forwardCompat": false}
 */
declare type old_as_current_for_Enum_DataObjectFactoryType = requireAssignableTo<TypeOnly<old.DataObjectFactoryType>, TypeOnly<current.DataObjectFactoryType>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Enum_DataObjectFactoryType": {"backCompat": false}
 */
declare type current_as_old_for_Enum_DataObjectFactoryType = requireAssignableTo<TypeOnly<current.DataObjectFactoryType>, TypeOnly<old.DataObjectFactoryType>>

/*
 * Validate forward compatibility by using the old type in place of the current type.
 * If this test starts failing, it indicates a change that is not forward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Class_EventAndErrorTrackingLogger": {"forwardCompat": false}
 */
declare type old_as_current_for_Class_EventAndErrorTrackingLogger = requireAssignableTo<TypeOnly<old.EventAndErrorTrackingLogger>, TypeOnly<current.EventAndErrorTrackingLogger>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Class_EventAndErrorTrackingLogger": {"backCompat": false}
 */
declare type current_as_old_for_Class_EventAndErrorTrackingLogger = requireAssignableTo<TypeOnly<current.EventAndErrorTrackingLogger>, TypeOnly<old.EventAndErrorTrackingLogger>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "ClassStatics_EventAndErrorTrackingLogger": {"backCompat": false}
 */
declare type current_as_old_for_ClassStatics_EventAndErrorTrackingLogger = requireAssignableTo<TypeOnly<typeof current.EventAndErrorTrackingLogger>, TypeOnly<typeof old.EventAndErrorTrackingLogger>>

/*
 * Validate forward compatibility by using the old type in place of the current type.
 * If this test starts failing, it indicates a change that is not forward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Interface_IDocumentIdStrategy": {"forwardCompat": false}
 */
declare type old_as_current_for_Interface_IDocumentIdStrategy = requireAssignableTo<TypeOnly<old.IDocumentIdStrategy>, TypeOnly<current.IDocumentIdStrategy>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Interface_IDocumentIdStrategy": {"backCompat": false}
 */
declare type current_as_old_for_Interface_IDocumentIdStrategy = requireAssignableTo<TypeOnly<current.IDocumentIdStrategy>, TypeOnly<old.IDocumentIdStrategy>>

/*
 * Validate forward compatibility by using the old type in place of the current type.
 * If this test starts failing, it indicates a change that is not forward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Interface_IEventAndErrorTrackingLogger": {"forwardCompat": false}
 */
declare type old_as_current_for_Interface_IEventAndErrorTrackingLogger = requireAssignableTo<TypeOnly<old.IEventAndErrorTrackingLogger>, TypeOnly<current.IEventAndErrorTrackingLogger>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Interface_IEventAndErrorTrackingLogger": {"backCompat": false}
 */
declare type current_as_old_for_Interface_IEventAndErrorTrackingLogger = requireAssignableTo<TypeOnly<current.IEventAndErrorTrackingLogger>, TypeOnly<old.IEventAndErrorTrackingLogger>>

/*
 * Validate forward compatibility by using the old type in place of the current type.
 * If this test starts failing, it indicates a change that is not forward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Interface_IOpProcessingController": {"forwardCompat": false}
 */
declare type old_as_current_for_Interface_IOpProcessingController = requireAssignableTo<TypeOnly<old.IOpProcessingController>, TypeOnly<current.IOpProcessingController>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Interface_IOpProcessingController": {"backCompat": false}
 */
declare type current_as_old_for_Interface_IOpProcessingController = requireAssignableTo<TypeOnly<current.IOpProcessingController>, TypeOnly<old.IOpProcessingController>>

/*
 * Validate forward compatibility by using the old type in place of the current type.
 * If this test starts failing, it indicates a change that is not forward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Interface_IProvideTestFluidObject": {"forwardCompat": false}
 */
declare type old_as_current_for_Interface_IProvideTestFluidObject = requireAssignableTo<TypeOnly<old.IProvideTestFluidObject>, TypeOnly<current.IProvideTestFluidObject>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Interface_IProvideTestFluidObject": {"backCompat": false}
 */
declare type current_as_old_for_Interface_IProvideTestFluidObject = requireAssignableTo<TypeOnly<current.IProvideTestFluidObject>, TypeOnly<old.IProvideTestFluidObject>>

/*
 * Validate forward compatibility by using the old type in place of the current type.
 * If this test starts failing, it indicates a change that is not forward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Interface_ITestConfigProvider": {"forwardCompat": false}
 */
declare type old_as_current_for_Interface_ITestConfigProvider = requireAssignableTo<TypeOnly<old.ITestConfigProvider>, TypeOnly<current.ITestConfigProvider>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Interface_ITestConfigProvider": {"backCompat": false}
 */
declare type current_as_old_for_Interface_ITestConfigProvider = requireAssignableTo<TypeOnly<current.ITestConfigProvider>, TypeOnly<old.ITestConfigProvider>>

/*
 * Validate forward compatibility by using the old type in place of the current type.
 * If this test starts failing, it indicates a change that is not forward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Interface_ITestContainerConfig": {"forwardCompat": false}
 */
declare type old_as_current_for_Interface_ITestContainerConfig = requireAssignableTo<TypeOnly<old.ITestContainerConfig>, TypeOnly<current.ITestContainerConfig>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Interface_ITestContainerConfig": {"backCompat": false}
 */
declare type current_as_old_for_Interface_ITestContainerConfig = requireAssignableTo<TypeOnly<current.ITestContainerConfig>, TypeOnly<old.ITestContainerConfig>>

/*
 * Validate forward compatibility by using the old type in place of the current type.
 * If this test starts failing, it indicates a change that is not forward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Interface_ITestFluidObject": {"forwardCompat": false}
 */
declare type old_as_current_for_Interface_ITestFluidObject = requireAssignableTo<TypeOnly<old.ITestFluidObject>, TypeOnly<current.ITestFluidObject>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Interface_ITestFluidObject": {"backCompat": false}
 */
declare type current_as_old_for_Interface_ITestFluidObject = requireAssignableTo<TypeOnly<current.ITestFluidObject>, TypeOnly<old.ITestFluidObject>>

/*
 * Validate forward compatibility by using the old type in place of the current type.
 * If this test starts failing, it indicates a change that is not forward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Interface_ITestObjectProvider": {"forwardCompat": false}
 */
declare type old_as_current_for_Interface_ITestObjectProvider = requireAssignableTo<TypeOnly<old.ITestObjectProvider>, TypeOnly<current.ITestObjectProvider>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Interface_ITestObjectProvider": {"backCompat": false}
 */
declare type current_as_old_for_Interface_ITestObjectProvider = requireAssignableTo<TypeOnly<current.ITestObjectProvider>, TypeOnly<old.ITestObjectProvider>>

/*
 * Validate forward compatibility by using the old type in place of the current type.
 * If this test starts failing, it indicates a change that is not forward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Class_LoaderContainerTracker": {"forwardCompat": false}
 */
declare type old_as_current_for_Class_LoaderContainerTracker = requireAssignableTo<TypeOnly<old.LoaderContainerTracker>, TypeOnly<current.LoaderContainerTracker>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Class_LoaderContainerTracker": {"backCompat": false}
 */
declare type current_as_old_for_Class_LoaderContainerTracker = requireAssignableTo<TypeOnly<current.LoaderContainerTracker>, TypeOnly<old.LoaderContainerTracker>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "ClassStatics_LoaderContainerTracker": {"backCompat": false}
 */
declare type current_as_old_for_ClassStatics_LoaderContainerTracker = requireAssignableTo<TypeOnly<typeof current.LoaderContainerTracker>, TypeOnly<typeof old.LoaderContainerTracker>>

/*
 * Validate forward compatibility by using the old type in place of the current type.
 * If this test starts failing, it indicates a change that is not forward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Class_LocalCodeLoader": {"forwardCompat": false}
 */
declare type old_as_current_for_Class_LocalCodeLoader = requireAssignableTo<TypeOnly<old.LocalCodeLoader>, TypeOnly<current.LocalCodeLoader>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Class_LocalCodeLoader": {"backCompat": false}
 */
declare type current_as_old_for_Class_LocalCodeLoader = requireAssignableTo<TypeOnly<current.LocalCodeLoader>, TypeOnly<old.LocalCodeLoader>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "ClassStatics_LocalCodeLoader": {"backCompat": false}
 */
declare type current_as_old_for_ClassStatics_LocalCodeLoader = requireAssignableTo<TypeOnly<typeof current.LocalCodeLoader>, TypeOnly<typeof old.LocalCodeLoader>>

/*
 * Validate forward compatibility by using the old type in place of the current type.
 * If this test starts failing, it indicates a change that is not forward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Interface_SummaryInfo": {"forwardCompat": false}
 */
declare type old_as_current_for_Interface_SummaryInfo = requireAssignableTo<TypeOnly<old.SummaryInfo>, TypeOnly<current.SummaryInfo>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Interface_SummaryInfo": {"backCompat": false}
 */
declare type current_as_old_for_Interface_SummaryInfo = requireAssignableTo<TypeOnly<current.SummaryInfo>, TypeOnly<old.SummaryInfo>>

/*
 * Validate forward compatibility by using the old type in place of the current type.
 * If this test starts failing, it indicates a change that is not forward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "TypeAlias_SupportedExportInterfaces": {"forwardCompat": false}
 */
declare type old_as_current_for_TypeAlias_SupportedExportInterfaces = requireAssignableTo<TypeOnly<old.SupportedExportInterfaces>, TypeOnly<current.SupportedExportInterfaces>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "TypeAlias_SupportedExportInterfaces": {"backCompat": false}
 */
declare type current_as_old_for_TypeAlias_SupportedExportInterfaces = requireAssignableTo<TypeOnly<current.SupportedExportInterfaces>, TypeOnly<old.SupportedExportInterfaces>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Variable_TestContainerRuntimeFactory": {"backCompat": false}
 */
declare type current_as_old_for_Variable_TestContainerRuntimeFactory = requireAssignableTo<TypeOnly<typeof current.TestContainerRuntimeFactory>, TypeOnly<typeof old.TestContainerRuntimeFactory>>

/*
 * Validate forward compatibility by using the old type in place of the current type.
 * If this test starts failing, it indicates a change that is not forward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Class_TestFluidObject": {"forwardCompat": false}
 */
declare type old_as_current_for_Class_TestFluidObject = requireAssignableTo<TypeOnly<old.TestFluidObject>, TypeOnly<current.TestFluidObject>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Class_TestFluidObject": {"backCompat": false}
 */
declare type current_as_old_for_Class_TestFluidObject = requireAssignableTo<TypeOnly<current.TestFluidObject>, TypeOnly<old.TestFluidObject>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "ClassStatics_TestFluidObject": {"backCompat": false}
 */
declare type current_as_old_for_ClassStatics_TestFluidObject = requireAssignableTo<TypeOnly<typeof current.TestFluidObject>, TypeOnly<typeof old.TestFluidObject>>

/*
 * Validate forward compatibility by using the old type in place of the current type.
 * If this test starts failing, it indicates a change that is not forward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Class_TestFluidObjectFactory": {"forwardCompat": false}
 */
declare type old_as_current_for_Class_TestFluidObjectFactory = requireAssignableTo<TypeOnly<old.TestFluidObjectFactory>, TypeOnly<current.TestFluidObjectFactory>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Class_TestFluidObjectFactory": {"backCompat": false}
 */
declare type current_as_old_for_Class_TestFluidObjectFactory = requireAssignableTo<TypeOnly<current.TestFluidObjectFactory>, TypeOnly<old.TestFluidObjectFactory>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "ClassStatics_TestFluidObjectFactory": {"backCompat": false}
 */
declare type current_as_old_for_ClassStatics_TestFluidObjectFactory = requireAssignableTo<TypeOnly<typeof current.TestFluidObjectFactory>, TypeOnly<typeof old.TestFluidObjectFactory>>

/*
 * Validate forward compatibility by using the old type in place of the current type.
 * If this test starts failing, it indicates a change that is not forward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Class_TestObjectProvider": {"forwardCompat": false}
 */
declare type old_as_current_for_Class_TestObjectProvider = requireAssignableTo<TypeOnly<old.TestObjectProvider>, TypeOnly<current.TestObjectProvider>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Class_TestObjectProvider": {"backCompat": false}
 */
declare type current_as_old_for_Class_TestObjectProvider = requireAssignableTo<TypeOnly<current.TestObjectProvider>, TypeOnly<old.TestObjectProvider>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "ClassStatics_TestObjectProvider": {"backCompat": false}
 */
declare type current_as_old_for_ClassStatics_TestObjectProvider = requireAssignableTo<TypeOnly<typeof current.TestObjectProvider>, TypeOnly<typeof old.TestObjectProvider>>

/*
 * Validate forward compatibility by using the old type in place of the current type.
 * If this test starts failing, it indicates a change that is not forward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Class_TestObjectProviderWithVersionedLoad": {"forwardCompat": false}
 */
declare type old_as_current_for_Class_TestObjectProviderWithVersionedLoad = requireAssignableTo<TypeOnly<old.TestObjectProviderWithVersionedLoad>, TypeOnly<current.TestObjectProviderWithVersionedLoad>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Class_TestObjectProviderWithVersionedLoad": {"backCompat": false}
 */
declare type current_as_old_for_Class_TestObjectProviderWithVersionedLoad = requireAssignableTo<TypeOnly<current.TestObjectProviderWithVersionedLoad>, TypeOnly<old.TestObjectProviderWithVersionedLoad>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "ClassStatics_TestObjectProviderWithVersionedLoad": {"backCompat": false}
 */
declare type current_as_old_for_ClassStatics_TestObjectProviderWithVersionedLoad = requireAssignableTo<TypeOnly<typeof current.TestObjectProviderWithVersionedLoad>, TypeOnly<typeof old.TestObjectProviderWithVersionedLoad>>

/*
 * Validate forward compatibility by using the old type in place of the current type.
 * If this test starts failing, it indicates a change that is not forward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Interface_TimeoutDurationOption": {"forwardCompat": false}
 */
declare type old_as_current_for_Interface_TimeoutDurationOption = requireAssignableTo<TypeOnly<old.TimeoutDurationOption>, TypeOnly<current.TimeoutDurationOption>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Interface_TimeoutDurationOption": {"backCompat": false}
 */
declare type current_as_old_for_Interface_TimeoutDurationOption = requireAssignableTo<TypeOnly<current.TimeoutDurationOption>, TypeOnly<old.TimeoutDurationOption>>

/*
 * Validate forward compatibility by using the old type in place of the current type.
 * If this test starts failing, it indicates a change that is not forward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Interface_TimeoutWithError": {"forwardCompat": false}
 */
declare type old_as_current_for_Interface_TimeoutWithError = requireAssignableTo<TypeOnly<old.TimeoutWithError>, TypeOnly<current.TimeoutWithError>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Interface_TimeoutWithError": {"backCompat": false}
 */
declare type current_as_old_for_Interface_TimeoutWithError = requireAssignableTo<TypeOnly<current.TimeoutWithError>, TypeOnly<old.TimeoutWithError>>

/*
 * Validate forward compatibility by using the old type in place of the current type.
 * If this test starts failing, it indicates a change that is not forward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Interface_TimeoutWithValue": {"forwardCompat": false}
 */
declare type old_as_current_for_Interface_TimeoutWithValue = requireAssignableTo<TypeOnly<old.TimeoutWithValue>, TypeOnly<current.TimeoutWithValue>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Interface_TimeoutWithValue": {"backCompat": false}
 */
declare type current_as_old_for_Interface_TimeoutWithValue = requireAssignableTo<TypeOnly<current.TimeoutWithValue>, TypeOnly<old.TimeoutWithValue>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Function_createAndAttachContainer": {"backCompat": false}
 */
declare type current_as_old_for_Function_createAndAttachContainer = requireAssignableTo<TypeOnly<typeof current.createAndAttachContainer>, TypeOnly<typeof old.createAndAttachContainer>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Variable_createContainerRuntimeFactoryWithDefaultDataStore": {"backCompat": false}
 */
declare type current_as_old_for_Variable_createContainerRuntimeFactoryWithDefaultDataStore = requireAssignableTo<TypeOnly<typeof current.createContainerRuntimeFactoryWithDefaultDataStore>, TypeOnly<typeof old.createContainerRuntimeFactoryWithDefaultDataStore>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Variable_createDocumentId": {"backCompat": false}
 */
declare type current_as_old_for_Variable_createDocumentId = requireAssignableTo<TypeOnly<typeof current.createDocumentId>, TypeOnly<typeof old.createDocumentId>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Function_createLoader": {"backCompat": false}
 */
declare type current_as_old_for_Function_createLoader = requireAssignableTo<TypeOnly<typeof current.createLoader>, TypeOnly<typeof old.createLoader>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Function_createSummarizer": {"backCompat": false}
 */
declare type current_as_old_for_Function_createSummarizer = requireAssignableTo<TypeOnly<typeof current.createSummarizer>, TypeOnly<typeof old.createSummarizer>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Function_createSummarizerCore": {"backCompat": false}
 */
declare type current_as_old_for_Function_createSummarizerCore = requireAssignableTo<TypeOnly<typeof current.createSummarizerCore>, TypeOnly<typeof old.createSummarizerCore>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Function_createSummarizerFromFactory": {"backCompat": false}
 */
declare type current_as_old_for_Function_createSummarizerFromFactory = requireAssignableTo<TypeOnly<typeof current.createSummarizerFromFactory>, TypeOnly<typeof old.createSummarizerFromFactory>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Variable_createTestConfigProvider": {"backCompat": false}
 */
declare type current_as_old_for_Variable_createTestConfigProvider = requireAssignableTo<TypeOnly<typeof current.createTestConfigProvider>, TypeOnly<typeof old.createTestConfigProvider>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Variable_createTestContainerRuntimeFactory": {"backCompat": false}
 */
declare type current_as_old_for_Variable_createTestContainerRuntimeFactory = requireAssignableTo<TypeOnly<typeof current.createTestContainerRuntimeFactory>, TypeOnly<typeof old.createTestContainerRuntimeFactory>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Variable_defaultTimeoutDurationMs": {"backCompat": false}
 */
declare type current_as_old_for_Variable_defaultTimeoutDurationMs = requireAssignableTo<TypeOnly<typeof current.defaultTimeoutDurationMs>, TypeOnly<typeof old.defaultTimeoutDurationMs>>

/*
 * Validate forward compatibility by using the old type in place of the current type.
 * If this test starts failing, it indicates a change that is not forward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "TypeAlias_fluidEntryPoint": {"forwardCompat": false}
 */
declare type old_as_current_for_TypeAlias_fluidEntryPoint = requireAssignableTo<TypeOnly<old.fluidEntryPoint>, TypeOnly<current.fluidEntryPoint>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "TypeAlias_fluidEntryPoint": {"backCompat": false}
 */
declare type current_as_old_for_TypeAlias_fluidEntryPoint = requireAssignableTo<TypeOnly<current.fluidEntryPoint>, TypeOnly<old.fluidEntryPoint>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Function_getContainerEntryPointBackCompat": {"backCompat": false}
 */
declare type current_as_old_for_Function_getContainerEntryPointBackCompat = requireAssignableTo<TypeOnly<typeof current.getContainerEntryPointBackCompat>, TypeOnly<typeof old.getContainerEntryPointBackCompat>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Function_getDataStoreEntryPointBackCompat": {"backCompat": false}
 */
declare type current_as_old_for_Function_getDataStoreEntryPointBackCompat = requireAssignableTo<TypeOnly<typeof current.getDataStoreEntryPointBackCompat>, TypeOnly<typeof old.getDataStoreEntryPointBackCompat>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Function_getUnexpectedLogErrorException": {"backCompat": false}
 */
declare type current_as_old_for_Function_getUnexpectedLogErrorException = requireAssignableTo<TypeOnly<typeof current.getUnexpectedLogErrorException>, TypeOnly<typeof old.getUnexpectedLogErrorException>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Variable_retryWithEventualValue": {"backCompat": false}
 */
declare type current_as_old_for_Variable_retryWithEventualValue = requireAssignableTo<TypeOnly<typeof current.retryWithEventualValue>, TypeOnly<typeof old.retryWithEventualValue>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Function_summarizeNow": {"backCompat": false}
 */
declare type current_as_old_for_Function_summarizeNow = requireAssignableTo<TypeOnly<typeof current.summarizeNow>, TypeOnly<typeof old.summarizeNow>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Function_timeoutAwait": {"backCompat": false}
 */
declare type current_as_old_for_Function_timeoutAwait = requireAssignableTo<TypeOnly<typeof current.timeoutAwait>, TypeOnly<typeof old.timeoutAwait>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Function_timeoutPromise": {"backCompat": false}
 */
declare type current_as_old_for_Function_timeoutPromise = requireAssignableTo<TypeOnly<typeof current.timeoutPromise>, TypeOnly<typeof old.timeoutPromise>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Function_waitForContainerConnection": {"backCompat": false}
 */
declare type current_as_old_for_Function_waitForContainerConnection = requireAssignableTo<TypeOnly<typeof current.waitForContainerConnection>, TypeOnly<typeof old.waitForContainerConnection>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Function_wrapDocumentService": {"backCompat": false}
 */
declare type current_as_old_for_Function_wrapDocumentService = requireAssignableTo<TypeOnly<typeof current.wrapDocumentService>, TypeOnly<typeof old.wrapDocumentService>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Function_wrapDocumentServiceFactory": {"backCompat": false}
 */
declare type current_as_old_for_Function_wrapDocumentServiceFactory = requireAssignableTo<TypeOnly<typeof current.wrapDocumentServiceFactory>, TypeOnly<typeof old.wrapDocumentServiceFactory>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Function_wrapDocumentStorageService": {"backCompat": false}
 */
declare type current_as_old_for_Function_wrapDocumentStorageService = requireAssignableTo<TypeOnly<typeof current.wrapDocumentStorageService>, TypeOnly<typeof old.wrapDocumentStorageService>>
