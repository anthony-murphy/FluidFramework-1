/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/*
 * THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.
 * Generated by flub generate:typetests in @fluid-tools/build-cli.
 */

import type { TypeOnly, MinimalType, FullType, requireAssignableTo } from "@fluidframework/build-tools";
import type * as old from "@fluidframework/datastore-definitions-previous/internal";

import type * as current from "../../index.js";

declare type MakeUnusedImportErrorsGoAway<T> = TypeOnly<T> | MinimalType<T> | FullType<T> | typeof old | typeof current | requireAssignableTo<true, true>;

/*
 * Validate forward compatibility by using the old type in place of the current type.
 * If this test starts failing, it indicates a change that is not forward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Interface_IChannel": {"forwardCompat": false}
 */
declare type old_as_current_for_Interface_IChannel = requireAssignableTo<TypeOnly<old.IChannel>, TypeOnly<current.IChannel>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Interface_IChannel": {"backCompat": false}
 */
declare type current_as_old_for_Interface_IChannel = requireAssignableTo<TypeOnly<current.IChannel>, TypeOnly<old.IChannel>>

/*
 * Validate forward compatibility by using the old type in place of the current type.
 * If this test starts failing, it indicates a change that is not forward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Interface_IChannelAttributes": {"forwardCompat": false}
 */
declare type old_as_current_for_Interface_IChannelAttributes = requireAssignableTo<TypeOnly<old.IChannelAttributes>, TypeOnly<current.IChannelAttributes>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Interface_IChannelAttributes": {"backCompat": false}
 */
declare type current_as_old_for_Interface_IChannelAttributes = requireAssignableTo<TypeOnly<current.IChannelAttributes>, TypeOnly<old.IChannelAttributes>>

/*
 * Validate forward compatibility by using the old type in place of the current type.
 * If this test starts failing, it indicates a change that is not forward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Interface_IChannelFactory": {"forwardCompat": false}
 */
declare type old_as_current_for_Interface_IChannelFactory = requireAssignableTo<TypeOnly<old.IChannelFactory>, TypeOnly<current.IChannelFactory>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Interface_IChannelFactory": {"backCompat": false}
 */
declare type current_as_old_for_Interface_IChannelFactory = requireAssignableTo<TypeOnly<current.IChannelFactory>, TypeOnly<old.IChannelFactory>>

/*
 * Validate forward compatibility by using the old type in place of the current type.
 * If this test starts failing, it indicates a change that is not forward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Interface_IChannelServices": {"forwardCompat": false}
 */
declare type old_as_current_for_Interface_IChannelServices = requireAssignableTo<TypeOnly<old.IChannelServices>, TypeOnly<current.IChannelServices>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Interface_IChannelServices": {"backCompat": false}
 */
declare type current_as_old_for_Interface_IChannelServices = requireAssignableTo<TypeOnly<current.IChannelServices>, TypeOnly<old.IChannelServices>>

/*
 * Validate forward compatibility by using the old type in place of the current type.
 * If this test starts failing, it indicates a change that is not forward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Interface_IChannelStorageService": {"forwardCompat": false}
 */
declare type old_as_current_for_Interface_IChannelStorageService = requireAssignableTo<TypeOnly<old.IChannelStorageService>, TypeOnly<current.IChannelStorageService>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Interface_IChannelStorageService": {"backCompat": false}
 */
declare type current_as_old_for_Interface_IChannelStorageService = requireAssignableTo<TypeOnly<current.IChannelStorageService>, TypeOnly<old.IChannelStorageService>>

/*
 * Validate forward compatibility by using the old type in place of the current type.
 * If this test starts failing, it indicates a change that is not forward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Interface_IDeltaConnection": {"forwardCompat": false}
 */
declare type old_as_current_for_Interface_IDeltaConnection = requireAssignableTo<TypeOnly<old.IDeltaConnection>, TypeOnly<current.IDeltaConnection>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Interface_IDeltaConnection": {"backCompat": false}
 */
declare type current_as_old_for_Interface_IDeltaConnection = requireAssignableTo<TypeOnly<current.IDeltaConnection>, TypeOnly<old.IDeltaConnection>>

/*
 * Validate forward compatibility by using the old type in place of the current type.
 * If this test starts failing, it indicates a change that is not forward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Interface_IDeltaHandler": {"forwardCompat": false}
 */
declare type old_as_current_for_Interface_IDeltaHandler = requireAssignableTo<TypeOnly<old.IDeltaHandler>, TypeOnly<current.IDeltaHandler>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Interface_IDeltaHandler": {"backCompat": false}
 */
declare type current_as_old_for_Interface_IDeltaHandler = requireAssignableTo<TypeOnly<current.IDeltaHandler>, TypeOnly<old.IDeltaHandler>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Interface_IFluidDataStoreRuntime": {"backCompat": false}
 */
declare type current_as_old_for_Interface_IFluidDataStoreRuntime = requireAssignableTo<TypeOnly<current.IFluidDataStoreRuntime>, TypeOnly<old.IFluidDataStoreRuntime>>

/*
 * Validate forward compatibility by using the old type in place of the current type.
 * If this test starts failing, it indicates a change that is not forward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Interface_IFluidDataStoreRuntimeEvents": {"forwardCompat": false}
 */
declare type old_as_current_for_Interface_IFluidDataStoreRuntimeEvents = requireAssignableTo<TypeOnly<old.IFluidDataStoreRuntimeEvents>, TypeOnly<current.IFluidDataStoreRuntimeEvents>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Interface_IFluidDataStoreRuntimeEvents": {"backCompat": false}
 */
declare type current_as_old_for_Interface_IFluidDataStoreRuntimeEvents = requireAssignableTo<TypeOnly<current.IFluidDataStoreRuntimeEvents>, TypeOnly<old.IFluidDataStoreRuntimeEvents>>

/*
 * Validate forward compatibility by using the old type in place of the current type.
 * If this test starts failing, it indicates a change that is not forward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Interface_Internal_InterfaceOfJsonableTypesWith": {"forwardCompat": false}
 */
declare type old_as_current_for_Interface_Internal_InterfaceOfJsonableTypesWith = requireAssignableTo<TypeOnly<old.Internal_InterfaceOfJsonableTypesWith<never>>, TypeOnly<current.Internal_InterfaceOfJsonableTypesWith<never>>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "Interface_Internal_InterfaceOfJsonableTypesWith": {"backCompat": false}
 */
declare type current_as_old_for_Interface_Internal_InterfaceOfJsonableTypesWith = requireAssignableTo<TypeOnly<current.Internal_InterfaceOfJsonableTypesWith<never>>, TypeOnly<old.Internal_InterfaceOfJsonableTypesWith<never>>>

/*
 * Validate forward compatibility by using the old type in place of the current type.
 * If this test starts failing, it indicates a change that is not forward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "TypeAlias_IDeltaManagerErased": {"forwardCompat": false}
 */
declare type old_as_current_for_TypeAlias_IDeltaManagerErased = requireAssignableTo<TypeOnly<old.IDeltaManagerErased>, TypeOnly<current.IDeltaManagerErased>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "TypeAlias_IDeltaManagerErased": {"backCompat": false}
 */
declare type current_as_old_for_TypeAlias_IDeltaManagerErased = requireAssignableTo<TypeOnly<current.IDeltaManagerErased>, TypeOnly<old.IDeltaManagerErased>>

/*
 * Validate forward compatibility by using the old type in place of the current type.
 * If this test starts failing, it indicates a change that is not forward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "TypeAlias_Jsonable": {"forwardCompat": false}
 */
declare type old_as_current_for_TypeAlias_Jsonable = requireAssignableTo<TypeOnly<old.Jsonable<never>>, TypeOnly<current.Jsonable<never>>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "TypeAlias_Jsonable": {"backCompat": false}
 */
declare type current_as_old_for_TypeAlias_Jsonable = requireAssignableTo<TypeOnly<current.Jsonable<never>>, TypeOnly<old.Jsonable<never>>>

/*
 * Validate forward compatibility by using the old type in place of the current type.
 * If this test starts failing, it indicates a change that is not forward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "TypeAlias_JsonableTypeWith": {"forwardCompat": false}
 */
declare type old_as_current_for_TypeAlias_JsonableTypeWith = requireAssignableTo<TypeOnly<old.JsonableTypeWith<never>>, TypeOnly<current.JsonableTypeWith<never>>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "TypeAlias_JsonableTypeWith": {"backCompat": false}
 */
declare type current_as_old_for_TypeAlias_JsonableTypeWith = requireAssignableTo<TypeOnly<current.JsonableTypeWith<never>>, TypeOnly<old.JsonableTypeWith<never>>>

/*
 * Validate forward compatibility by using the old type in place of the current type.
 * If this test starts failing, it indicates a change that is not forward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "TypeAlias_Serializable": {"forwardCompat": false}
 */
declare type old_as_current_for_TypeAlias_Serializable = requireAssignableTo<TypeOnly<old.Serializable<never>>, TypeOnly<current.Serializable<never>>>

/*
 * Validate backward compatibility by using the current type in place of the old type.
 * If this test starts failing, it indicates a change that is not backward compatible.
 * To acknowledge the breaking change, add the following to package.json under
 * typeValidation.broken:
 * "TypeAlias_Serializable": {"backCompat": false}
 */
declare type current_as_old_for_TypeAlias_Serializable = requireAssignableTo<TypeOnly<current.Serializable<never>>, TypeOnly<old.Serializable<never>>>
