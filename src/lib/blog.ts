export interface BlogPost {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  content: string;
}

export const blogPosts: BlogPost[] = [
  {
    slug: "hello-world",
    title: "Welcome to the MP AI Starter Kit Blog",
    date: "February 11, 2026",
    excerpt:
      "Discover why we built this kit and how it can help you ship your SaaS in days, not months.",
    content: `# Welcome to the MP AI Starter Kit Blog\n\nThis is our first post. We're excited to show you how to build SaaS apps faster.\n\n## Why use this kit?\n- **Speed**: Vite + Convex = 🚀\n- **Type-safety**: TanStack Router + Query = 🛡️\n- **AI**: Built-in chat capabilities.\n\nStay tuned for more updates!`,
  },
  {
    slug: "modern-saas-stack",
    title: "The Modern SaaS Stack in 2026",
    date: "February 10, 2026",
    excerpt:
      "Why the SPA + Serverless Backend approach is winning over traditional SSR frameworks.",
    content: `# The Modern SaaS Stack in 2026\n\nDevelopers are moving away from complex SSR frameworks back to clean SPAs with powerful backends like Convex.\n\n### Benefits\n1. **Developer Experience**: Faster hot reloads.\n2. **Performance**: No hydration mismatches.\n3. **Scalability**: Pure serverless scaling.`,
  },
];
