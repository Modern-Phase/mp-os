// Tests for agent memory parsing logic and migration utilities
// Run: npx vitest run convex/agentMemory.test.ts

import { describe, it, expect } from "vitest";

// ── Extracted: parseMemoryDirectives (from agentChatWebhook.ts) ──

interface MemoryDirective {
  action: "store" | "forget";
  content?: string;
  category?: string;
  importance?: string;
  memoryId?: string;
}

function parseMemoryDirectives(content: string): {
  directives: MemoryDirective[];
  cleanContent: string;
} {
  const regex = /<memory_directives>([\s\S]*?)<\/memory_directives>/g;
  const directives: MemoryDirective[] = [];
  let cleanContent = content;

  let match;
  while ((match = regex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      for (const d of arr) {
        if (d.action && typeof d.action === "string") {
          directives.push(d as MemoryDirective);
        }
      }
    } catch {
      // Malformed JSON — skip silently
    }
    cleanContent = cleanContent.replace(match[0], "");
  }

  return { directives, cleanContent: cleanContent.trim() };
}

// ── Extracted: detectCategory (from agentMemoryMigration.ts) ──

function detectCategory(
  filename: string,
  content: string,
): "fact" | "preference" | "procedure" | "context" | "relationship" {
  const lower = (filename + " " + content).toLowerCase();

  if (lower.includes("prefer") || lower.includes("choice") || lower.includes("style"))
    return "preference";
  if (
    lower.includes("how to") ||
    lower.includes("steps") ||
    lower.includes("process") ||
    lower.includes("procedure")
  )
    return "procedure";
  if (
    lower.includes("person") ||
    lower.includes("team") ||
    lower.includes("contact") ||
    lower.includes("relationship")
  )
    return "relationship";
  if (lower.includes("background") || lower.includes("context") || lower.includes("history"))
    return "context";
  return "fact";
}

// ── Extracted: splitIntoMemories (from agentMemoryMigration.ts) ──

function splitIntoMemories(content: string): string[] {
  const sections = content
    .split(/\n\n+|\n(?=#{1,3}\s)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10 && s.length < 2000);

  if (sections.length === 0 && content.trim().length > 10) {
    return [content.trim()];
  }

  return sections;
}

// ── Extracted: parseTaskDirectives (for combined test) ──

function parseTaskDirectives(content: string): {
  directives: any[];
  cleanContent: string;
} {
  const regex = /<task_directives>([\s\S]*?)<\/task_directives>/g;
  const directives: any[] = [];
  let cleanContent = content;

  let match;
  while ((match = regex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      for (const d of arr) {
        if (d.action && typeof d.action === "string") {
          directives.push(d);
        }
      }
    } catch {
      // skip
    }
    cleanContent = cleanContent.replace(match[0], "");
  }

  return { directives, cleanContent: cleanContent.trim() };
}

// ════════════════════════════════════════════════════════════
// Tests
// ════════════════════════════════════════════════════════════

describe("parseMemoryDirectives", () => {
  it("parses a single store directive", () => {
    const input = `Sure, I'll remember that!

<memory_directives>[{"action":"store","content":"Scott prefers TypeScript over JavaScript","category":"preference","importance":"medium"}]</memory_directives>`;

    const { directives, cleanContent } = parseMemoryDirectives(input);

    expect(directives).toHaveLength(1);
    expect(directives[0].action).toBe("store");
    expect(directives[0].content).toBe("Scott prefers TypeScript over JavaScript");
    expect(directives[0].category).toBe("preference");
    expect(directives[0].importance).toBe("medium");
    expect(cleanContent).toBe("Sure, I'll remember that!");
  });

  it("parses multiple directives in one block", () => {
    const input = `Got it, noted.

<memory_directives>[{"action":"store","content":"Team uses Bun","category":"preference","importance":"high"},{"action":"store","content":"Convex for backend","category":"fact","importance":"medium"}]</memory_directives>`;

    const { directives, cleanContent } = parseMemoryDirectives(input);

    expect(directives).toHaveLength(2);
    expect(directives[0].content).toBe("Team uses Bun");
    expect(directives[1].content).toBe("Convex for backend");
    expect(cleanContent).toBe("Got it, noted.");
  });

  it("parses a forget directive", () => {
    const input = `I've forgotten that.

<memory_directives>[{"action":"forget","memoryId":"abc123"}]</memory_directives>`;

    const { directives, cleanContent } = parseMemoryDirectives(input);

    expect(directives).toHaveLength(1);
    expect(directives[0].action).toBe("forget");
    expect(directives[0].memoryId).toBe("abc123");
    expect(cleanContent).toBe("I've forgotten that.");
  });

  it("handles malformed JSON gracefully", () => {
    const input = `Some response

<memory_directives>not valid json</memory_directives>`;

    const { directives, cleanContent } = parseMemoryDirectives(input);

    expect(directives).toHaveLength(0);
    expect(cleanContent).toBe("Some response");
  });

  it("returns original content when no directives present", () => {
    const input = "Just a regular response with no directives.";

    const { directives, cleanContent } = parseMemoryDirectives(input);

    expect(directives).toHaveLength(0);
    expect(cleanContent).toBe(input);
  });

  it("handles single object (not array)", () => {
    const input = `OK!

<memory_directives>{"action":"store","content":"single item","category":"fact","importance":"low"}</memory_directives>`;

    const { directives, cleanContent } = parseMemoryDirectives(input);

    expect(directives).toHaveLength(1);
    expect(directives[0].content).toBe("single item");
  });

  it("skips entries without action field", () => {
    const input = `<memory_directives>[{"content":"no action"},{"action":"store","content":"has action","category":"fact","importance":"low"}]</memory_directives>`;

    const { directives } = parseMemoryDirectives(input);

    expect(directives).toHaveLength(1);
    expect(directives[0].content).toBe("has action");
  });
});

describe("combined task + memory directive parsing", () => {
  it("strips both task and memory directives from content", () => {
    const input = `Here's what I did and what I learned.

<task_directives>[{"action":"create","title":"Follow up with client","description":"Send proposal","priority":"high","tags":["sales"]}]</task_directives>

<memory_directives>[{"action":"store","content":"Client prefers email over phone","category":"preference","importance":"medium"}]</memory_directives>`;

    // Step 1: Parse task directives (same order as webhook handler)
    const { directives: taskDirectives, cleanContent: taskClean } =
      parseTaskDirectives(input);
    // Step 2: Parse memory directives from task-cleaned content
    const { directives: memoryDirectives, cleanContent: finalClean } =
      parseMemoryDirectives(taskClean);

    expect(taskDirectives).toHaveLength(1);
    expect(taskDirectives[0].title).toBe("Follow up with client");

    expect(memoryDirectives).toHaveLength(1);
    expect(memoryDirectives[0].content).toBe("Client prefers email over phone");

    expect(finalClean).toBe("Here's what I did and what I learned.");
  });

  it("handles response with only memory directives (no tasks)", () => {
    const input = `Understood, I'll keep that in mind.

<memory_directives>[{"action":"store","content":"Deploy schedule is Tuesdays","category":"procedure","importance":"high"}]</memory_directives>`;

    const { directives: taskDirectives, cleanContent: taskClean } =
      parseTaskDirectives(input);
    const { directives: memoryDirectives, cleanContent: finalClean } =
      parseMemoryDirectives(taskClean);

    expect(taskDirectives).toHaveLength(0);
    expect(memoryDirectives).toHaveLength(1);
    expect(finalClean).toBe("Understood, I'll keep that in mind.");
  });
});

describe("detectCategory", () => {
  it("detects preference from content", () => {
    expect(detectCategory("notes.md", "User prefers dark mode")).toBe("preference");
  });

  it("detects procedure from content", () => {
    expect(detectCategory("deploy.md", "How to deploy: steps 1-3")).toBe("procedure");
  });

  it("detects relationship from content", () => {
    expect(detectCategory("team.md", "The team lead is Alice")).toBe("relationship");
  });

  it("detects context from filename", () => {
    expect(detectCategory("background.md", "Some info")).toBe("context");
  });

  it("defaults to fact", () => {
    expect(detectCategory("random.md", "The sky is blue")).toBe("fact");
  });

  it("detects from filename keywords", () => {
    expect(detectCategory("preferences.md", "Something")).toBe("preference");
  });
});

describe("splitIntoMemories", () => {
  it("splits on double newlines", () => {
    const input = `First paragraph about topic A.

Second paragraph about topic B.

Third paragraph about topic C.`;

    const result = splitIntoMemories(input);

    expect(result).toHaveLength(3);
    expect(result[0]).toBe("First paragraph about topic A.");
    expect(result[1]).toBe("Second paragraph about topic B.");
    expect(result[2]).toBe("Third paragraph about topic C.");
  });

  it("splits on markdown headers", () => {
    const input = `# First Section
Details about first section.
## Second Section
Details about second section.`;

    const result = splitIntoMemories(input);

    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it("returns single entry for short content", () => {
    const input = "Just a single line of memory content.";
    const result = splitIntoMemories(input);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(input);
  });

  it("filters out very short fragments", () => {
    const input = `Real content that should be kept.

Too short

Another real piece of content here.`;

    const result = splitIntoMemories(input);

    // "Too short" is under 10 chars, should be filtered
    expect(result).toHaveLength(2);
  });

  it("handles empty content", () => {
    expect(splitIntoMemories("")).toHaveLength(0);
    expect(splitIntoMemories("   ")).toHaveLength(0);
  });
});
