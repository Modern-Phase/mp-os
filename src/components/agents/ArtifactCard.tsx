// src/components/agents/ArtifactCard.tsx
// Claude-style file artifact cards with side panel preview

import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { useConvex } from "convex/react";
import { api } from "~/convex/_generated/api";
import type { Id } from "~/convex/_generated/dataModel";
import { Button } from "@/ui/button";
import { Download, FileCode, FileText, File, Loader2, Copy, Check, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { markdownComponents, fixOrderedListNumbering } from "@/components/chat/markdown";

// ── Types ──

interface Artifact {
  fileId: string;
  filename: string;
  path: string;
  mimeType: string;
  sizeBytes: number;
}

interface ArtifactCardProps {
  artifacts: Artifact[];
}

// ── Context for side panel (lives at chat level) ──

interface ArtifactPanelContextValue {
  openArtifact: Artifact | null;
  setOpenArtifact: (artifact: Artifact | null) => void;
}

const ArtifactPanelContext = createContext<ArtifactPanelContextValue>({
  openArtifact: null,
  setOpenArtifact: () => {},
});

export function ArtifactPanelProvider({ children }: { children: React.ReactNode }) {
  const [openArtifact, setOpenArtifact] = useState<Artifact | null>(null);
  return (
    <ArtifactPanelContext.Provider value={{ openArtifact, setOpenArtifact }}>
      {children}
    </ArtifactPanelContext.Provider>
  );
}

export function useArtifactPanel() {
  return useContext(ArtifactPanelContext);
}

// ── Helpers (exported for unit tests) ──

const MIME_LABELS: Record<string, string> = {
  "text/x-typescript": "TypeScript",
  "text/typescript": "TypeScript",
  "text/javascript": "JavaScript",
  "application/javascript": "JavaScript",
  "text/x-python": "Python",
  "application/json": "JSON",
  "text/html": "HTML",
  "text/css": "CSS",
  "text/markdown": "Markdown",
  "text/x-rust": "Rust",
  "text/x-go": "Go",
  "text/x-java": "Java",
  "text/x-c": "C",
  "text/x-c++": "C++",
  "text/yaml": "YAML",
  "application/x-yaml": "YAML",
  "text/x-toml": "TOML",
  "application/xml": "XML",
  "text/xml": "XML",
  "text/x-shellscript": "Shell",
  "text/x-sql": "SQL",
  "text/plain": "Text",
};

const EXT_LABELS: Record<string, string> = {
  ts: "TypeScript",
  tsx: "TypeScript",
  js: "JavaScript",
  jsx: "JavaScript",
  py: "Python",
  json: "JSON",
  html: "HTML",
  css: "CSS",
  md: "Markdown",
  rs: "Rust",
  go: "Go",
  java: "Java",
  c: "C",
  cpp: "C++",
  h: "C Header",
  yaml: "YAML",
  yml: "YAML",
  toml: "TOML",
  xml: "XML",
  sh: "Shell",
  bash: "Shell",
  sql: "SQL",
  txt: "Text",
  csv: "CSV",
  env: "Environment",
  dockerfile: "Dockerfile",
};

export function getFileLabel(filename: string, mimeType: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return EXT_LABELS[ext] || MIME_LABELS[mimeType] || "File";
}

export function getFileIcon(filename: string, mimeType: string) {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const codeExts = new Set([
    "ts", "tsx", "js", "jsx", "py", "rs", "go", "java", "c", "cpp", "h",
    "sh", "bash", "sql", "html", "css", "yaml", "yml", "toml", "xml",
  ]);
  if (codeExts.has(ext) || mimeType.includes("javascript") || mimeType.includes("typescript")) {
    return FileCode;
  }
  const textExts = new Set(["txt", "md", "csv", "json", "env"]);
  if (textExts.has(ext) || mimeType.startsWith("text/")) {
    return FileText;
  }
  return File;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isMarkdownFile(filename: string, mimeType: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return ext === "md" || ext === "mdx" || mimeType === "text/markdown";
}

function triggerBrowserDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Inline Card (compact, Claude-style) ──

function ArtifactItem({ artifact }: { artifact: Artifact }) {
  const convex = useConvex();
  const { setOpenArtifact } = useArtifactPanel();
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (downloading) return;
    setDownloading(true);
    try {
      const file = await convex.query(api.agentSync.getAgentFileById, {
        fileId: artifact.fileId as Id<"agentFiles">,
      });
      if (file?.content) {
        triggerBrowserDownload(file.content, artifact.filename, artifact.mimeType);
      }
    } catch (err) {
      console.error("[ArtifactCard] Download failed:", err);
    } finally {
      setDownloading(false);
    }
  };

  const Icon = getFileIcon(artifact.filename, artifact.mimeType);
  const label = getFileLabel(artifact.filename, artifact.mimeType);

  return (
    <div
      className="inline-flex items-center gap-2.5 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer px-3 py-2.5 max-w-sm"
      onClick={() => setOpenArtifact(artifact)}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground leading-tight">
          {artifact.filename}
        </p>
        <p className="text-xs text-muted-foreground leading-tight">
          {label}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0 h-7 w-7"
        onClick={handleDownload}
        disabled={downloading}
        title="Download"
      >
        {downloading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Download className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  );
}

// ── Inline Card List (rendered inside chat messages) ──

export function ArtifactCard({ artifacts }: ArtifactCardProps) {
  if (!artifacts || artifacts.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {artifacts.map((artifact) => (
        <ArtifactItem key={artifact.fileId} artifact={artifact} />
      ))}
    </div>
  );
}

// ── Side Panel (rendered at chat layout level, slides in from right) ──

export function ArtifactSidePanel() {
  const convex = useConvex();
  const { openArtifact, setOpenArtifact } = useArtifactPanel();
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Fetch file content when panel opens
  useEffect(() => {
    if (!openArtifact) {
      setContent(null);
      return;
    }
    setLoading(true);
    convex
      .query(api.agentSync.getAgentFileById, {
        fileId: openArtifact.fileId as Id<"agentFiles">,
      })
      .then((file) => setContent(file?.content ?? ""))
      .catch(() => setContent(null))
      .finally(() => setLoading(false));
  }, [openArtifact, convex]);

  const handleDownload = useCallback(async () => {
    if (!openArtifact || downloading) return;
    setDownloading(true);
    try {
      triggerBrowserDownload(content ?? "", openArtifact.filename, openArtifact.mimeType);
    } finally {
      setDownloading(false);
    }
  }, [openArtifact, content, downloading]);

  const handleCopy = useCallback(async () => {
    if (!content) return;
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [content]);

  if (!openArtifact) return null;

  const Icon = getFileIcon(openArtifact.filename, openArtifact.mimeType);
  const label = getFileLabel(openArtifact.filename, openArtifact.mimeType);

  return (
    <div className="w-[480px] border-l bg-background flex flex-col h-full shrink-0 animate-in slide-in-from-right-4 duration-200">
      {/* Panel Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-muted">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {openArtifact.filename}
          </p>
          <p className="text-xs text-muted-foreground">
            {label} &middot; {formatSize(openArtifact.sizeBytes)}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleCopy}
            disabled={!content}
            title={copied ? "Copied!" : "Copy"}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleDownload}
            disabled={downloading || loading}
            title="Download"
          >
            {downloading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setOpenArtifact(null)}
            title="Close"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Panel Content */}
      <div className="flex-1 min-h-0 overflow-auto bg-muted/30">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : content !== null ? (
          isMarkdownFile(openArtifact.filename, openArtifact.mimeType) ? (
            <div className="p-4 prose-artifact">
              <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
                {fixOrderedListNumbering(content)}
              </ReactMarkdown>
            </div>
          ) : (
            <pre className="p-4 text-sm font-mono text-foreground whitespace-pre overflow-x-auto leading-relaxed">
              <code>{content}</code>
            </pre>
          )
        ) : (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            Failed to load file content
          </div>
        )}
      </div>
    </div>
  );
}
