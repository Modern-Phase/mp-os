// src/components/agents/AgentMemoryViewer.tsx
// View and search agent persistent memories from the agentMemory table

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "~/convex/_generated/api";
import { Id } from "~/convex/_generated/dataModel";
import { Badge } from "@/ui/badge";
import { Input } from "@/ui/input";
import { cn } from "@/utils/misc";
import { Brain, Search, Tag, AlertTriangle } from "lucide-react";

interface AgentMemoryViewerProps {
  agentId: string;
  orgId: Id<"organizations">;
}

const CATEGORY_COLORS: Record<string, string> = {
  fact: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  preference: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  procedure: "bg-green-500/10 text-green-700 dark:text-green-400",
  context: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  relationship: "bg-pink-500/10 text-pink-700 dark:text-pink-400",
};

const IMPORTANCE_COLORS: Record<string, string> = {
  high: "text-red-500",
  medium: "text-yellow-500",
  low: "text-muted-foreground",
};

export function AgentMemoryViewer({ agentId, orgId }: AgentMemoryViewerProps) {
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  const memories = useQuery(api.agentSync.getAgentMemories, { orgId, agentId });

  const filteredMemories = useMemo(() => {
    if (!memories) return [];
    let filtered = memories;

    if (filterCategory) {
      filtered = filtered.filter((m: any) => m.category === filterCategory);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter((m: any) =>
        m.content.toLowerCase().includes(q),
      );
    }

    return filtered;
  }, [memories, search, filterCategory]);

  const categories = useMemo(() => {
    if (!memories) return [];
    const counts = new Map<string, number>();
    for (const m of memories) {
      counts.set(m.category, (counts.get(m.category) || 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [memories]);

  if (!memories) {
    return <div className="text-xs text-muted-foreground p-2">Loading memories...</div>;
  }

  if (memories.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No memories stored yet</p>
        <p className="text-xs mt-1">
          Agents build memories from conversations automatically
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search + category filter */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search memories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-xs pl-8"
          />
        </div>
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap gap-1">
        <button
          onClick={() => setFilterCategory(null)}
          className={cn(
            "px-2 py-0.5 rounded-full text-[10px] transition-colors",
            !filterCategory
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80",
          )}
        >
          All ({memories.length})
        </button>
        {categories.map(([cat, count]) => (
          <button
            key={cat}
            onClick={() =>
              setFilterCategory(filterCategory === cat ? null : cat)
            }
            className={cn(
              "px-2 py-0.5 rounded-full text-[10px] transition-colors",
              filterCategory === cat
                ? "bg-primary text-primary-foreground"
                : CATEGORY_COLORS[cat] || "bg-muted text-muted-foreground",
            )}
          >
            {cat} ({count})
          </button>
        ))}
      </div>

      {/* Memory list */}
      <div className="space-y-2 max-h-[50vh] overflow-y-auto">
        {filteredMemories.map((memory: any) => (
          <div
            key={memory._id}
            className="border border-border/50 rounded-md p-2.5 space-y-1.5"
          >
            <p className="text-xs text-foreground leading-relaxed">
              {memory.content}
            </p>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge
                className={cn(
                  "text-[10px]",
                  CATEGORY_COLORS[memory.category] || "",
                )}
              >
                <Tag className="h-2.5 w-2.5 mr-0.5" />
                {memory.category}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                <AlertTriangle
                  className={cn(
                    "h-2.5 w-2.5 mr-0.5",
                    IMPORTANCE_COLORS[memory.importance] || "",
                  )}
                />
                {memory.importance}
              </Badge>
              <span className="text-[10px] text-muted-foreground ml-auto">
                {memory.source}
              </span>
            </div>
          </div>
        ))}

        {filteredMemories.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            No memories match your search
          </p>
        )}
      </div>
    </div>
  );
}
