// convex/agentMemoryMigration.ts — Migrate agent memory files from VPS to Convex

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { AGENT_IDS, agentIdValidator } from "./schema";
import { VPS_ORCHESTRATOR_URL, VPS_API_KEY } from "./env";

// Category detection from filename or content keywords
function detectCategory(
  filename: string,
  content: string,
): "fact" | "preference" | "procedure" | "context" | "relationship" {
  const lower = (filename + " " + content).toLowerCase();

  if (lower.includes("prefer") || lower.includes("choice") || lower.includes("style"))
    return "preference";
  if (lower.includes("how to") || lower.includes("steps") || lower.includes("process") || lower.includes("procedure"))
    return "procedure";
  if (lower.includes("person") || lower.includes("team") || lower.includes("contact") || lower.includes("relationship"))
    return "relationship";
  if (lower.includes("background") || lower.includes("context") || lower.includes("history"))
    return "context";
  return "fact";
}

// Split content into individual memory entries (one per paragraph or section)
function splitIntoMemories(content: string): string[] {
  // Split on double newlines (paragraphs) or markdown headers
  const sections = content
    .split(/\n\n+|\n(?=#{1,3}\s)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10 && s.length < 2000);

  // If content is short enough, treat as single memory
  if (sections.length === 0 && content.trim().length > 10) {
    return [content.trim()];
  }

  return sections;
}

// Migrate memory files for a single agent
export const migrateAgentMemory = internalAction({
  args: {
    agentId: agentIdValidator,
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    if (!VPS_ORCHESTRATOR_URL || !VPS_API_KEY) {
      console.log("[migration] VPS Orchestrator not configured, skipping");
      return { migrated: 0, skipped: 0 };
    }

    try {
      // Fetch memory files from VPS
      const response = await fetch(
        `${VPS_ORCHESTRATOR_URL}/api/instances/${args.agentId}/workspace/memory`,
        {
          headers: { "X-API-Key": VPS_API_KEY },
        },
      );

      if (!response.ok) {
        console.log(`[migration] Memory endpoint returned ${response.status} for ${args.agentId}`);
        return { migrated: 0, skipped: 0 };
      }

      const data = await response.json();
      if (!data.files || data.files.length === 0) {
        console.log(`[migration] No memory files found for ${args.agentId}`);
        return { migrated: 0, skipped: 0 };
      }

      console.log(`[migration] Found ${data.files.length} memory file(s) for ${args.agentId}`);

      let migrated = 0;
      let skipped = 0;

      for (const file of data.files) {
        // Check for idempotency — skip if already migrated
        const alreadyMigrated = await ctx.runQuery(
          internal.agentMemory.hasMigratedMemory,
          {
            agentId: args.agentId,
            migratedFrom: file.path,
          },
        );

        if (alreadyMigrated) {
          skipped++;
          continue;
        }

        // Split file into individual memory entries
        const memories = splitIntoMemories(file.content);
        const category = detectCategory(file.path, file.content);

        for (const memoryContent of memories) {
          try {
            await ctx.runAction(internal.agentMemory.storeMemory, {
              orgId: args.orgId as string,
              agentId: args.agentId,
              content: memoryContent,
              category,
              importance: "medium",
              source: "migration",
              migratedFrom: file.path,
            });
            migrated++;
          } catch (error) {
            console.error(`[migration] Failed to store memory from ${file.path}:`, error);
          }
        }
      }

      console.log(
        `[migration] Agent ${args.agentId}: migrated=${migrated}, skipped=${skipped}`,
      );
      return { migrated, skipped };
    } catch (error) {
      console.error(`[migration] Failed for ${args.agentId}:`, error);
      return { migrated: 0, skipped: 0 };
    }
  },
});

// Migrate all agents' memory files
export const migrateAllAgents = internalAction({
  args: {
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const agentIds = Object.values(AGENT_IDS);
    let totalMigrated = 0;
    let totalSkipped = 0;

    for (const agentId of agentIds) {
      const result = await ctx.runAction(
        internal.agentMemoryMigration.migrateAgentMemory,
        {
          agentId: agentId as any,
          orgId: args.orgId,
        },
      );
      totalMigrated += result.migrated;
      totalSkipped += result.skipped;
    }

    console.log(
      `[migration] Complete: migrated=${totalMigrated}, skipped=${totalSkipped} across ${agentIds.length} agents`,
    );
    return { totalMigrated, totalSkipped, agentCount: agentIds.length };
  },
});
