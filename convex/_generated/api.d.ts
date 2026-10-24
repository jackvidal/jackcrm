/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as audio from "../audio.js";
import type * as auth from "../auth.js";
import type * as crm from "../crm.js";
import type * as http from "../http.js";
import type * as leadWebhooks from "../leadWebhooks.js";
import type * as lib_audioFiles from "../lib/audioFiles.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_filters from "../lib/filters.js";
import type * as lib_models from "../lib/models.js";
import type * as lib_store from "../lib/store.js";
import type * as lib_webhookStore from "../lib/webhookStore.js";
import type * as migration from "../migration.js";
import type * as webhooks from "../webhooks.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  audio: typeof audio;
  auth: typeof auth;
  crm: typeof crm;
  http: typeof http;
  leadWebhooks: typeof leadWebhooks;
  "lib/audioFiles": typeof lib_audioFiles;
  "lib/auth": typeof lib_auth;
  "lib/filters": typeof lib_filters;
  "lib/models": typeof lib_models;
  "lib/store": typeof lib_store;
  "lib/webhookStore": typeof lib_webhookStore;
  migration: typeof migration;
  webhooks: typeof webhooks;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
