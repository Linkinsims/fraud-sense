/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as alerts from "../alerts.js";
import type * as apiKeys from "../apiKeys.js";
import type * as auth from "../auth.js";
import type * as batchIngest from "../batchIngest.js";
import type * as cases from "../cases.js";
import type * as demo from "../demo.js";
import type * as http from "../http.js";
import type * as ingest from "../ingest.js";
import type * as ingestMutation from "../ingestMutation.js";
import type * as organisations from "../organisations.js";
import type * as router from "../router.js";
import type * as rules from "../rules.js";
import type * as transactions from "../transactions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  alerts: typeof alerts;
  apiKeys: typeof apiKeys;
  auth: typeof auth;
  batchIngest: typeof batchIngest;
  cases: typeof cases;
  demo: typeof demo;
  http: typeof http;
  ingest: typeof ingest;
  ingestMutation: typeof ingestMutation;
  organisations: typeof organisations;
  router: typeof router;
  rules: typeof rules;
  transactions: typeof transactions;
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
