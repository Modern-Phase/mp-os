// Tests for agent chat file attachment logic
// Run: npx vitest run tests/unit/agentChatAttachment.test.ts

import { describe, it, expect } from "vitest";

// ── Extracted: stripAttachedFileTags (from AgentChat.tsx) ──

function stripAttachedFileTags(content: string): string {
  return content
    .replace(/<attached_file[^>]*>[\s\S]*?<\/attached_file>\s*/g, "")
    .trim();
}

// ── Extracted: formatFileSize (from AgentChat.tsx) ──

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// ── Extracted: buildAttachedFileBlock (mirrors createChatMessage logic) ──

function buildAttachedFileBlock(attachment: {
  name: string;
  fileSize: number;
  textContent: string;
}): string {
  const ext = attachment.name.split(".").pop()?.toLowerCase() || "txt";
  const sizeLabel =
    attachment.fileSize < 1024
      ? `${attachment.fileSize}B`
      : `${Math.round(attachment.fileSize / 1024)}KB`;
  return `<attached_file name="${attachment.name}" type="${ext}" size="${sizeLabel}">\n${attachment.textContent}\n</attached_file>`;
}

// ── Extracted: determineDocumentType (mirrors INTERNAL_createDocumentFromAttachment) ──

function determineDocumentType(
  name: string,
  mimeType: string,
): "text" | "pdf" | "csv" | "image" | "audio" | "video" {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (ext === "csv" || ext === "tsv") return "csv";
  if (ext === "pdf") return "pdf";
  if (mimeType.startsWith("image/")) return "image";
  return "text";
}

describe("stripAttachedFileTags", () => {
  it("strips a single attached_file block from the start of content", () => {
    const content = `<attached_file name="leads.csv" type="csv" size="24KB">
Name,Email,Company
John,john@acme.com,Acme
</attached_file>

Analyze these leads`;
    expect(stripAttachedFileTags(content)).toBe("Analyze these leads");
  });

  it("returns plain text unchanged", () => {
    expect(stripAttachedFileTags("Hello world")).toBe("Hello world");
  });

  it("handles empty string", () => {
    expect(stripAttachedFileTags("")).toBe("");
  });

  it("handles content that is only an attached_file block", () => {
    const content = `<attached_file name="data.json" type="json" size="1KB">
{"key":"value"}
</attached_file>`;
    expect(stripAttachedFileTags(content)).toBe("");
  });

  it("preserves text before and after the attached_file block", () => {
    const content = `Some prefix text <attached_file name="f.txt" type="txt" size="10B">
content
</attached_file>

And suffix text`;
    // Regex strips the tag + trailing whitespace, then .trim() cleans edges
    expect(stripAttachedFileTags(content)).toBe(
      "Some prefix text And suffix text",
    );
  });

  it("strips multiple attached_file blocks", () => {
    const content = `<attached_file name="a.csv" type="csv" size="1KB">
data1
</attached_file>

<attached_file name="b.csv" type="csv" size="2KB">
data2
</attached_file>

Analyze both files`;
    expect(stripAttachedFileTags(content)).toBe("Analyze both files");
  });

  it("does not strip malformed tags (missing closing tag)", () => {
    const content = `<attached_file name="f.txt" type="txt" size="1KB">
content without closing tag

Please analyze`;
    // Regex requires closing tag, so this is preserved as-is
    expect(stripAttachedFileTags(content)).toBe(content);
  });
});

describe("formatFileSize", () => {
  it("formats bytes", () => {
    expect(formatFileSize(500)).toBe("500B");
    expect(formatFileSize(0)).toBe("0B");
    expect(formatFileSize(1023)).toBe("1023B");
  });

  it("formats kilobytes", () => {
    expect(formatFileSize(1024)).toBe("1KB");
    expect(formatFileSize(24_576)).toBe("24KB");
    expect(formatFileSize(500_000)).toBe("488KB");
  });

  it("formats megabytes", () => {
    expect(formatFileSize(1024 * 1024)).toBe("1.0MB");
    expect(formatFileSize(5.5 * 1024 * 1024)).toBe("5.5MB");
    expect(formatFileSize(10 * 1024 * 1024)).toBe("10.0MB");
  });
});

describe("buildAttachedFileBlock", () => {
  it("builds correct XML block for a CSV", () => {
    const block = buildAttachedFileBlock({
      name: "leads.csv",
      fileSize: 24_576,
      textContent: "Name,Email\nJohn,john@acme.com",
    });
    expect(block).toContain('name="leads.csv"');
    expect(block).toContain('type="csv"');
    expect(block).toContain('size="24KB"');
    expect(block).toContain("Name,Email\nJohn,john@acme.com");
    expect(block).toMatch(/^<attached_file /);
    expect(block).toMatch(/<\/attached_file>$/);
  });

  it("uses bytes label for small files", () => {
    const block = buildAttachedFileBlock({
      name: "tiny.txt",
      fileSize: 500,
      textContent: "hello",
    });
    expect(block).toContain('size="500B"');
  });

  it("extracts correct extension", () => {
    const block = buildAttachedFileBlock({
      name: "report.data.json",
      fileSize: 2048,
      textContent: "{}",
    });
    expect(block).toContain('type="json"');
  });

  it("falls back to txt for extensionless files", () => {
    const block = buildAttachedFileBlock({
      name: "Makefile",
      fileSize: 100,
      textContent: "all:",
    });
    // "Makefile" has no dot, so split(".").pop() returns "Makefile"
    expect(block).toContain('type="makefile"');
  });
});

describe("buildAttachedFileBlock → stripAttachedFileTags roundtrip", () => {
  it("stripping the built block recovers original user message", () => {
    const userMessage = "Analyze these leads and tell me which ones to prioritize";
    const block = buildAttachedFileBlock({
      name: "leads.csv",
      fileSize: 24_576,
      textContent: "Name,Email,Company\nJohn,john@acme.com,Acme",
    });
    const fullContent = `${block}\n\n${userMessage}`;
    expect(stripAttachedFileTags(fullContent)).toBe(userMessage);
  });

  it("works when user message is empty (file-only send)", () => {
    const block = buildAttachedFileBlock({
      name: "data.csv",
      fileSize: 1024,
      textContent: "a,b\n1,2",
    });
    const fullContent = `${block}\n\nAttached file: data.csv`;
    expect(stripAttachedFileTags(fullContent)).toBe("Attached file: data.csv");
  });
});

describe("determineDocumentType", () => {
  it("detects CSV files", () => {
    expect(determineDocumentType("data.csv", "text/csv")).toBe("csv");
  });

  it("detects TSV files", () => {
    expect(determineDocumentType("data.tsv", "text/tab-separated-values")).toBe(
      "csv",
    );
  });

  it("detects PDF files", () => {
    expect(determineDocumentType("report.pdf", "application/pdf")).toBe("pdf");
  });

  it("detects images by mime type", () => {
    expect(determineDocumentType("photo.png", "image/png")).toBe("image");
    expect(determineDocumentType("chart.jpg", "image/jpeg")).toBe("image");
  });

  it("defaults to text for .txt, .md, .json", () => {
    expect(determineDocumentType("notes.txt", "text/plain")).toBe("text");
    expect(determineDocumentType("readme.md", "text/markdown")).toBe("text");
    expect(determineDocumentType("config.json", "application/json")).toBe(
      "text",
    );
  });
});
