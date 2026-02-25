// src/components/agents/AgentFilesViewer.tsx
// Tree view of agent workspace files synced from VPS

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "~/convex/_generated/api";
import { Id } from "~/convex/_generated/dataModel";
import { cn } from "@/utils/misc";
import {
  File,
  Folder,
  FolderOpen,
  ChevronRight,
  FileText,
  FileCode,
  FileJson,
} from "lucide-react";

interface AgentFilesViewerProps {
  agentId: string;
  orgId: Id<"organizations">;
}

interface FileNode {
  name: string;
  path: string;
  isDir: boolean;
  children?: FileNode[];
  file?: {
    content?: string;
    mimeType: string;
    sizeBytes: number;
    lastModifiedAt: number;
  };
}

function buildFileTree(files: any[]): FileNode[] {
  const root: FileNode[] = [];

  for (const file of files) {
    const parts = file.path.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;

      if (isLast) {
        current.push({
          name: part,
          path: file.path,
          isDir: false,
          file: {
            content: file.content,
            mimeType: file.mimeType,
            sizeBytes: file.sizeBytes,
            lastModifiedAt: file.lastModifiedAt,
          },
        });
      } else {
        let dir = current.find((n) => n.name === part && n.isDir);
        if (!dir) {
          dir = { name: part, path: parts.slice(0, i + 1).join("/"), isDir: true, children: [] };
          current.push(dir);
        }
        current = dir.children!;
      }
    }
  }

  // Sort: directories first, then files alphabetically
  function sortNodes(nodes: FileNode[]) {
    nodes.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const node of nodes) {
      if (node.children) sortNodes(node.children);
    }
  }
  sortNodes(root);

  return root;
}

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "md":
    case "txt":
      return <FileText className="h-3.5 w-3.5 text-blue-500" />;
    case "ts":
    case "js":
    case "py":
    case "sh":
      return <FileCode className="h-3.5 w-3.5 text-green-500" />;
    case "json":
    case "yaml":
    case "yml":
    case "toml":
      return <FileJson className="h-3.5 w-3.5 text-yellow-500" />;
    default:
      return <File className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function TreeNode({
  node,
  depth,
  selectedPath,
  onSelect,
}: {
  node: FileNode;
  depth: number;
  selectedPath: string | null;
  onSelect: (node: FileNode) => void;
}) {
  const [expanded, setExpanded] = useState(depth === 0);
  const isSelected = selectedPath === node.path;

  if (node.isDir) {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className={cn(
            "w-full flex items-center gap-1.5 px-2 py-1 text-left text-xs hover:bg-muted/50 rounded transition-colors",
          )}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          <ChevronRight
            className={cn(
              "h-3 w-3 text-muted-foreground transition-transform shrink-0",
              expanded && "rotate-90",
            )}
          />
          {expanded ? (
            <FolderOpen className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
          ) : (
            <Folder className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
          )}
          <span className="truncate">{node.name}</span>
        </button>
        {expanded &&
          node.children?.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
            />
          ))}
      </div>
    );
  }

  return (
    <button
      onClick={() => onSelect(node)}
      className={cn(
        "w-full flex items-center gap-1.5 px-2 py-1 text-left text-xs hover:bg-muted/50 rounded transition-colors",
        isSelected && "bg-primary/10 text-primary",
      )}
      style={{ paddingLeft: `${depth * 12 + 20}px` }}
    >
      {getFileIcon(node.name)}
      <span className="truncate flex-1">{node.name}</span>
      {node.file && (
        <span className="text-[10px] text-muted-foreground shrink-0">
          {formatSize(node.file.sizeBytes)}
        </span>
      )}
    </button>
  );
}

export function AgentFilesViewer({ agentId, orgId }: AgentFilesViewerProps) {
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);

  const files = useQuery(api.agentSync.getAgentFiles, { orgId, agentId });

  if (!files) {
    return <div className="text-xs text-muted-foreground p-2">Loading files...</div>;
  }

  if (files.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No workspace files synced yet</p>
        <p className="text-xs mt-1">Use "Sync Now" to pull files from the VPS</p>
      </div>
    );
  }

  const tree = buildFileTree(files);

  return (
    <div className="flex h-full min-h-0">
      {/* File tree */}
      <div className="w-56 border-r overflow-y-auto shrink-0">
        {tree.map((node) => (
          <TreeNode
            key={node.path}
            node={node}
            depth={0}
            selectedPath={selectedFile?.path || null}
            onSelect={setSelectedFile}
          />
        ))}
      </div>

      {/* File content preview */}
      <div className="flex-1 overflow-auto min-w-0">
        {selectedFile?.file ? (
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-foreground">{selectedFile.path}</span>
              <span className="text-[10px] text-muted-foreground">
                {formatSize(selectedFile.file.sizeBytes)}
              </span>
            </div>
            <pre className="text-xs text-foreground/80 whitespace-pre-wrap break-words font-mono bg-muted/30 rounded p-3 max-h-[60vh] overflow-y-auto">
              {selectedFile.file.content || "(empty file)"}
            </pre>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            Select a file to preview
          </div>
        )}
      </div>
    </div>
  );
}
