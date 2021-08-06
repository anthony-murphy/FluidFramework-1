/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import * as old from "protocol-definitions-0-1024-0";
import * as current from "../index";

declare function get_old_Quorum(): old.IQuorum;
export const quorum: current.IQuorum = get_old_Quorum();

declare function get_old_MessageType(): old.MessageType;
export const messageType: current.MessageTypes = get_old_MessageType();

declare function  get_old_INackContent(): old.INackContent;
export const nackContent: current.INackContent = get_old_INackContent();
