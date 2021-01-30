/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import * as main from "@fluidframework/container-loader";
import * as ver33 from "0.33.0-container-loader";
import * as ver32 from "0.32.0-container-loader";

declare const mainLoaderProps: main.ILoaderProps;
declare const ver32LoaderProps: ver32.ILoaderProps;
declare const ver33LoaderProps: ver33.ILoaderProps;


new main.Loader(mainLoaderProps);
new main.Loader(ver32LoaderProps);
new main.Loader(ver33LoaderProps);

new ver32.Loader(mainLoaderProps);
new ver32.Loader(ver32LoaderProps);
new ver32.Loader(ver33LoaderProps);

new ver33.Loader(mainLoaderProps);
new ver33.Loader(ver32LoaderProps);
new ver33.Loader(ver33LoaderProps);
