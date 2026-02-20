// src/components/chat/markdown.tsx
// Shared markdown rendering for all chat interfaces (RAG chat + agent chat)

import React from "react";

/** Extract plain text from React nodes (used for section-header detection) */
export function getTextContent(node: React.ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(getTextContent).join("");
  if (React.isValidElement(node) && node.props?.children) {
    return getTextContent(node.props.children);
  }
  return "";
}

/**
 * Renumber ordered list items sequentially — AI often emits all items as "1."
 * which is valid markdown but causes each to land in its own <ol> starting at 1
 * when blank lines or sub-lists sit between them.
 */
export function fixOrderedListNumbering(text: string): string {
  let counter = 0;
  const lines = text.split("\n");

  for (let i = 0; i < lines.length; i++) {
    if (/^#{1,6}\s/.test(lines[i])) {
      counter = 0;
    } else if (/^\d+\.\s/.test(lines[i])) {
      counter++;
      lines[i] = lines[i].replace(/^\d+\./, `${counter}.`);
    } else if (
      lines[i].trim() !== "" &&
      !/^[-*+]\s/.test(lines[i].trim()) &&
      !/^\s/.test(lines[i])
    ) {
      counter = 0;
    }
  }

  return lines.join("\n");
}

/** ReactMarkdown component overrides for consistent AI message rendering */
export const markdownComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="text-2xl font-bold mt-6 mb-3 text-foreground">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="text-xl font-bold mt-6 mb-3 text-foreground">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="text-lg font-bold mt-5 mb-2 text-foreground">{children}</h3>
  ),
  p: ({ children }: { children?: React.ReactNode }) => {
    const text = getTextContent(children).trim();
    const isSectionHeader =
      text.endsWith(":") && text.length > 5 && text.length < 100;
    return isSectionHeader ? (
      <p className="text-lg font-bold text-foreground mt-6 mb-2 pb-2 border-b border-border/30">
        {children}
      </p>
    ) : (
      <p className="text-base leading-relaxed mb-3 text-foreground">
        {children}
      </p>
    );
  },
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="list-disc pl-5 space-y-2 my-3">{children}</ul>
  ),
  ol: ({ children, start }: { children?: React.ReactNode; start?: number }) => (
    <ol className="list-decimal pl-5 space-y-2 my-3" start={start}>
      {children}
    </ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="text-base leading-relaxed text-foreground">{children}</li>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-bold text-foreground">{children}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => (
    <em className="italic">{children}</em>
  ),
  a: ({ children, href }: { children?: React.ReactNode; href?: string }) => {
    const isSafe = !href || /^(https?:\/\/|mailto:|\/|#|\.)/.test(href);
    if (!isSafe) return <span className="text-primary">{children}</span>;
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:underline"
      >
        {children}
      </a>
    );
  },
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="border-l-4 border-primary/50 bg-muted/30 pl-4 pr-3 py-2 my-3 rounded-r-md text-muted-foreground italic">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-5 border-border" />,
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="bg-muted rounded-lg p-3 overflow-x-auto my-3 text-sm">
      {children}
    </pre>
  ),
  code: ({
    children,
    className,
  }: {
    children?: React.ReactNode;
    className?: string;
  }) =>
    className ? (
      <code className={`${className} text-sm`}>{children}</code>
    ) : (
      <code className="bg-muted px-1.5 py-0.5 rounded text-sm">{children}</code>
    ),
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="my-4 overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => (
    <thead className="bg-muted/60">{children}</thead>
  ),
  tbody: ({ children }: { children?: React.ReactNode }) => (
    <tbody className="divide-y divide-border">{children}</tbody>
  ),
  tr: ({ children }: { children?: React.ReactNode }) => (
    <tr className="border-b border-border last:border-b-0">{children}</tr>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="px-3 py-2 text-left text-xs font-semibold text-foreground/80 uppercase tracking-wider">
      {children}
    </th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="px-3 py-2 text-sm text-foreground">{children}</td>
  ),
};
