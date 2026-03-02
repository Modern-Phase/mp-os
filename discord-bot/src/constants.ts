// discord-bot/src/constants.ts — Agent and channel mapping constants

/**
 * Map of Discord role/mention names to agentIds.
 * These should match role names created in the Discord server.
 */
export const AGENT_MENTION_MAP: Record<string, string> = {
  larry: "larry",
  oliver: "oliver",
  fiona: "fiona",
  taylor: "taylor",
  max: "max",
};

/**
 * Default agent per department.
 * When no @mention is used, the channel's department determines the agent.
 */
export const DEPARTMENT_DEFAULT_AGENTS: Record<string, string> = {
  sales: "larry",
  ops: "oliver",
  finance: "fiona",
  delivery: "taylor",
  management: "max",
};

/**
 * Discord message length limit.
 * Messages longer than this are split across multiple sends.
 */
export const DISCORD_MAX_MESSAGE_LENGTH = 2000;
