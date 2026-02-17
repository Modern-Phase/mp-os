import { openaiText } from "@tanstack/ai-openai";
import { openRouterText } from "@tanstack/ai-openrouter";

// Model configurations
export const aiConfig = {
  openai: {
    model: process.env.OPENAI_MODEL || "gpt-4o",
    adapter: () =>
      openaiText(
        (process.env.OPENAI_MODEL || "gpt-4o") as "gpt-4o" | "gpt-4o-mini",
      ),
  },
  openrouter: {
    model: "anthropic/claude-3.5-sonnet",
    adapter: () => openRouterText("anthropic/claude-3.5-sonnet"),
  },
};

// Get the default AI configuration
export function getAIConfig() {
  const provider = process.env.DEFAULT_AI_PROVIDER || "openrouter";
  return aiConfig[provider as keyof typeof aiConfig];
}

// System prompt for the AI assistant
export const systemPrompt =
  "You are a helpful business agent. Assist users with business-related questions, advice, and tasks in a professional and knowledgeable manner.";
