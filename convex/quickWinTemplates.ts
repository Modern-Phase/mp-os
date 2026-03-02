// convex/quickWinTemplates.ts — Quick Win template definitions for deal-to-project conversion

import { AgentId } from "./schema";

export interface QuickWinTemplate {
  id: string;
  name: string;
  description: string;
  agentId: AgentId;
  agentEmoji: string;
  icon: string;
  estimatedHours: number;
}

export const QUICK_WIN_TEMPLATES: QuickWinTemplate[] = [
  {
    id: "website-audit",
    name: "Website Audit",
    description: "Site performance, SEO, and UX report with actionable recommendations",
    agentId: "taylor",
    agentEmoji: "⚡",
    icon: "🔍",
    estimatedHours: 4,
  },
  {
    id: "kickoff-package",
    name: "Kickoff Package",
    description: "Welcome email, project timeline, and creative brief for the client",
    agentId: "oliver",
    agentEmoji: "📋",
    icon: "📦",
    estimatedHours: 2,
  },
  {
    id: "brand-snapshot",
    name: "Brand Snapshot",
    description: "Visual assessment of current brand with improvement suggestions",
    agentId: "taylor",
    agentEmoji: "⚡",
    icon: "🎨",
    estimatedHours: 3,
  },
  {
    id: "competitor-brief",
    name: "Competitor Brief",
    description: "Landscape analysis with competitive opportunities and positioning",
    agentId: "larry",
    agentEmoji: "🤖",
    icon: "📊",
    estimatedHours: 3,
  },
  {
    id: "sow-draft",
    name: "SOW Draft",
    description: "Scope of work with timeline, deliverables, and payment terms",
    agentId: "fiona",
    agentEmoji: "💵",
    icon: "📝",
    estimatedHours: 3,
  },
];

export function getQuickWinTemplate(id: string): QuickWinTemplate | undefined {
  return QUICK_WIN_TEMPLATES.find((t) => t.id === id);
}
