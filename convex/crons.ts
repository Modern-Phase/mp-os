// convex/crons.ts — Periodic scheduled tasks
// Note: Convex crons run as internal actions, not user-facing actions

import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Process email sequences every hour
crons.interval(
  "process-email-sequences",
  { hours: 1 },
  internal.emailSequences.INTERNAL_processScheduledEmails,
);

// Periodic sync of active agent data every 5 minutes
// This is handled by the auto-sync after each agent response (agentChatWebhook.ts)
// and manual "Sync Now" button. Adding a cron here for background consistency.
// Uncomment when ready to enable:
//
// crons.interval(
//   "sync-active-agents",
//   { minutes: 5 },
//   internal.agentSync.syncAllActiveAgents,
// );

export default crons;
