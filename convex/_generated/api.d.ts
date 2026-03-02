/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as agentChat from "../agentChat.js";
import type * as agentChatWebhook from "../agentChatWebhook.js";
import type * as agentHealth from "../agentHealth.js";
import type * as agentMemory from "../agentMemory.js";
import type * as agentMemoryMigration from "../agentMemoryMigration.js";
import type * as agentSync from "../agentSync.js";
import type * as agents from "../agents.js";
import type * as app from "../app.js";
import type * as auditLog from "../auditLog.js";
import type * as chat from "../chat.js";
import type * as collections from "../collections.js";
import type * as contracts from "../contracts.js";
import type * as crm from "../crm.js";
import type * as crons from "../crons.js";
import type * as discord from "../discord.js";
import type * as doclingParse from "../doclingParse.js";
import type * as documents from "../documents.js";
import type * as docuseal from "../docuseal.js";
import type * as email_index from "../email/index.js";
import type * as email_templates_contractEmail from "../email/templates/contractEmail.js";
import type * as email_templates_invoiceEmail from "../email/templates/invoiceEmail.js";
import type * as email_templates_proposalEmail from "../email/templates/proposalEmail.js";
import type * as email_templates_subscriptionEmail from "../email/templates/subscriptionEmail.js";
import type * as emailSequences from "../emailSequences.js";
import type * as env from "../env.js";
import type * as finances from "../finances.js";
import type * as gatewayIntegration from "../gatewayIntegration.js";
import type * as gdpr from "../gdpr.js";
import type * as helicone from "../helicone.js";
import type * as http from "../http.js";
import type * as init from "../init.js";
import type * as instantly from "../instantly.js";
import type * as invoices from "../invoices.js";
import type * as largeUpload from "../largeUpload.js";
import type * as largeUploadMutations from "../largeUploadMutations.js";
import type * as llamaParse from "../llamaParse.js";
import type * as notifications from "../notifications.js";
import type * as organizations from "../organizations.js";
import type * as outboundEmail from "../outboundEmail.js";
import type * as processingJobs from "../processingJobs.js";
import type * as projectTemplates from "../projectTemplates.js";
import type * as promptSecurity from "../promptSecurity.js";
import type * as proposals from "../proposals.js";
import type * as quickWinTemplates from "../quickWinTemplates.js";
import type * as quickbooks from "../quickbooks.js";
import type * as rag from "../rag.js";
import type * as ragLarge from "../ragLarge.js";
import type * as ragLargeMutations from "../ragLargeMutations.js";
import type * as ragProcess from "../ragProcess.js";
import type * as rateLimit from "../rateLimit.js";
import type * as retellCalls from "../retellCalls.js";
import type * as stripe from "../stripe.js";
import type * as templates from "../templates.js";
import type * as usage from "../usage.js";
import type * as utils_auth from "../utils/auth.js";
import type * as vpsOrchestrator from "../vpsOrchestrator.js";
import type * as waitlist from "../waitlist.js";
import type * as workflows from "../workflows.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  agentChat: typeof agentChat;
  agentChatWebhook: typeof agentChatWebhook;
  agentHealth: typeof agentHealth;
  agentMemory: typeof agentMemory;
  agentMemoryMigration: typeof agentMemoryMigration;
  agentSync: typeof agentSync;
  agents: typeof agents;
  app: typeof app;
  auditLog: typeof auditLog;
  chat: typeof chat;
  collections: typeof collections;
  contracts: typeof contracts;
  crm: typeof crm;
  crons: typeof crons;
  discord: typeof discord;
  doclingParse: typeof doclingParse;
  documents: typeof documents;
  docuseal: typeof docuseal;
  "email/index": typeof email_index;
  "email/templates/contractEmail": typeof email_templates_contractEmail;
  "email/templates/invoiceEmail": typeof email_templates_invoiceEmail;
  "email/templates/proposalEmail": typeof email_templates_proposalEmail;
  "email/templates/subscriptionEmail": typeof email_templates_subscriptionEmail;
  emailSequences: typeof emailSequences;
  env: typeof env;
  finances: typeof finances;
  gatewayIntegration: typeof gatewayIntegration;
  gdpr: typeof gdpr;
  helicone: typeof helicone;
  http: typeof http;
  init: typeof init;
  instantly: typeof instantly;
  invoices: typeof invoices;
  largeUpload: typeof largeUpload;
  largeUploadMutations: typeof largeUploadMutations;
  llamaParse: typeof llamaParse;
  notifications: typeof notifications;
  organizations: typeof organizations;
  outboundEmail: typeof outboundEmail;
  processingJobs: typeof processingJobs;
  projectTemplates: typeof projectTemplates;
  promptSecurity: typeof promptSecurity;
  proposals: typeof proposals;
  quickWinTemplates: typeof quickWinTemplates;
  quickbooks: typeof quickbooks;
  rag: typeof rag;
  ragLarge: typeof ragLarge;
  ragLargeMutations: typeof ragLargeMutations;
  ragProcess: typeof ragProcess;
  rateLimit: typeof rateLimit;
  retellCalls: typeof retellCalls;
  stripe: typeof stripe;
  templates: typeof templates;
  usage: typeof usage;
  "utils/auth": typeof utils_auth;
  vpsOrchestrator: typeof vpsOrchestrator;
  waitlist: typeof waitlist;
  workflows: typeof workflows;
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
