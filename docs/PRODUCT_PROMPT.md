# Product Builder Prompt

Copy everything below the line into Claude (or any AI assistant) and replace the `[PRODUCT IDEA]` section with your own idea. The AI will generate a full implementation plan and code scaffolding that follows this starter kit's conventions.

---

## Your Product Idea

> **Replace this block with your product idea.** Be as specific as possible — describe who the users are, what problem it solves, and the core features you want.
>
> **Example:** I want to build an AEO (Answer Engine Optimization) and GEO (Generative Engine Optimization) tool for content creators. Users paste in a blog post or article, and the tool analyzes it for AI-search readability — checking things like structured data, question-answer formatting, citation density, and topical authority signals. It gives a score and actionable recommendations. Pro users can track scores over time and optimize multiple pieces of content.

---

## Starter Kit Context

You are building on top of the **MP AI Starter Kit** — a production-ready SaaS foundation. The following is already built and working. Do NOT recreate any of this. Build your features on top of it.

### Tech Stack (already configured)
- **Frontend:** React 18 + Vite + TanStack Router (file-based) + TanStack Query
- **Backend:** Convex (real-time database, serverless functions, file storage)
- **Auth:** Clerk (JWT tokens validated by Convex)
- **Payments:** Stripe (FREE/PRO plans, checkout, customer portal, webhooks)
- **AI:** OpenAI / OpenRouter via Convex HTTP actions with streaming SSE
- **UI:** shadcn/ui (Radix + Tailwind CSS) with dark mode
- **Analytics:** PostHog
- **Email:** Resend

### What's Already Built
- User authentication (Clerk sign-in/up, JWT validation, user creation)
- Protected routes with auth guards
- Dashboard layout with sidebar navigation
- User settings (profile, avatar upload)
- Stripe billing (FREE/PRO plans, checkout, customer portal, webhooks)
- AI chat with streaming responses, RAG, and citations
- Document upload, chunking, and vector embeddings
- Usage tracking and rate limiting
- GDPR consent and audit logs
- Dark mode, i18n (en/es)

### Project Structure
```
src/
  app.tsx                    # Root providers (Clerk, Convex, PostHog, React Query)
  router.tsx                 # TanStack Router setup
  routes/
    __root.tsx               # Root layout (error boundary, pageview tracking)
    index.tsx                # Landing page (/)
    _app/
      _app.tsx               # Preloads current user
      login/                 # Public login
      _auth/                 # Protected routes (auth guard)
        _auth.tsx            # Redirects to /login if not signed in, calls ensureUser()
        dashboard/
          _layout.tsx        # Dashboard layout with nav + header
          _layout.index.tsx  # /dashboard (home)
          _layout.chat.tsx   # /dashboard/chat
          _layout.documents.tsx
          _layout.settings.tsx
          _layout.settings.index.tsx
          _layout.settings.billing.tsx
          -ui.navigation.tsx # Colocated nav component (NOT a route)
        onboarding/          # First-time user flow
  components/                # App-level components (ChatInterface, etc.)
  ui/                        # shadcn/ui primitives (button, input, dialog, etc.)
  utils/
    auth.ts                  # useConvexAuthToken() — for custom HTTP requests to Convex
    misc.ts                  # cn(), useSignOut(), getLocaleCurrency()
    validators.ts            # Zod form validators

convex/
  schema.ts                  # Database schema
  app.ts                     # Core queries/mutations (getCurrentUser, ensureUser, etc.)
  stripe.ts                  # Stripe integration
  http.ts                    # HTTP endpoints (Stripe webhook, /api/chat)
  chat.ts                    # Chat session/message queries/mutations
  rag.ts                     # RAG search (semantic + keyword hybrid)
  ragProcess.ts              # Document chunking + embedding
  documents.ts               # Document CRUD
  usage.ts                   # Usage tracking for billing limits
  rateLimit.ts               # Rate limiting
  env.ts                     # Environment variable references
  _generated/api.d.ts        # Auto-generated API types
```

### Conventions You MUST Follow

**Routing:**
- File-based routing with TanStack Router in `src/routes/`
- `_layout.tsx` = layout wrapper; `_layout.index.tsx` = index route for that layout
- `_layout.{name}.tsx` = named child route (e.g., `_layout.analytics.tsx` → `/dashboard/analytics`)
- `-ui.{name}.tsx` = colocated UI component, NOT a route
- `_app` and `_auth` are pathless layout groups (not in URL)
- New dashboard pages go in `src/routes/_app/_auth/dashboard/`

**Database (Convex):**
- Define tables in `convex/schema.ts` using `defineTable()` and `v` validators
- Always add indexes for fields you query by
- Use `v.id("tableName")` for foreign keys

**Backend Functions:**
- Use `getAuthUserId(ctx)` helper to resolve Clerk identity → Convex user ID in public queries/mutations
- Throw `"Authentication required"` if `getAuthUserId` returns null
- Prefix internal functions: `PREAUTH_` (user ID passed in) or `UNAUTH_` (no auth)
- Internal functions use `internalMutation`/`internalAction`/`internalQuery`
- Public functions use `query`/`mutation`/`action`

**HTTP Endpoints:**
- Define in `convex/http.ts` using `httpRouter()` and `httpAction()`
- Authenticate via `ctx.auth.getUserIdentity()`
- Return streaming SSE for AI responses (see existing `/api/chat` pattern)
- Always handle CORS for webhook endpoints

**Frontend Components:**
- UI primitives in `src/ui/` (shadcn/ui pattern — forwardRef, CVA variants, `cn()`)
- App components in `src/components/`
- Use `useQuery(convexQuery(api.module.functionName, args))` for reads
- Use `useMutation({ mutationFn: useConvexMutation(api.module.functionName) })` for writes
- Use conditional queries: pass `"skip"` as args to disable a query
- Invalidate queries on mutation success: `queryClient.invalidateQueries()`

**Styling:**
- Tailwind CSS + `cn()` for conditional classes
- Use semantic colors: `bg-background`, `bg-card`, `text-primary`, `text-muted-foreground`, `border-border`
- Use `dark:` prefix for dark mode overrides

**Auth in Custom Fetch Requests:**
- Use `useConvexAuthToken()` from `@/utils/auth` to get the JWT
- Attach as `Authorization: Bearer ${token}` header
- Never use `getToken()` directly without `{ template: "convex" }`

**Billing/Usage:**
- Check subscription tier via `getCurrentUser()` → `user.subscription.planKey` ("free" | "pro")
- Track usage in `usage` table; check limits before expensive operations
- Gate features by plan in both UI (hide/disable) and backend (enforce)

---

## Instructions

Given the product idea above and the starter kit context, generate a **complete implementation plan and code** following these phases:

### Phase 1: Data Model
- Define new tables to add to `convex/schema.ts`
- Show the exact `defineTable()` calls with all fields, validators, and indexes
- Explain relationships to existing tables (especially `users`)
- Do NOT modify existing tables unless absolutely necessary

### Phase 2: Backend Functions
- Create new Convex files in `convex/` for each feature domain (e.g., `convex/analyses.ts`)
- Write queries, mutations, and actions following the `getAuthUserId()` pattern
- Include input validation using `v` validators
- Add usage tracking/rate limiting where appropriate
- If the feature needs external API calls, use `action` or `httpAction`

### Phase 3: HTTP Endpoints (if needed)
- Add new routes to `convex/http.ts`
- Follow the existing streaming SSE pattern for any AI-powered endpoints
- Handle auth, rate limiting, and error responses

### Phase 4: Frontend Routes
- Create new route files in `src/routes/_app/_auth/dashboard/`
- Follow the `_layout.{name}.tsx` naming convention
- Add the new page to the dashboard navigation in `-ui.navigation.tsx`
- Use existing UI components from `src/ui/` wherever possible

### Phase 5: Frontend Components
- Build feature components in `src/components/`
- Use `useQuery` / `useMutation` with the Convex APIs from Phase 2
- Follow the existing component patterns (memo, form handling, loading states)
- Gate pro features behind subscription checks

### Phase 6: Environment Variables (if needed)
- List any new API keys or config values needed
- Specify whether they go in `.env.local` (frontend) or Convex env (backend)
- Add them to `.env.example` with comments

### Output Format
For each phase, provide:
1. **File path** — exact path of the file to create or modify
2. **Full code** — complete, copy-pasteable code (not snippets or pseudocode)
3. **Explanation** — brief note on what it does and why

Start with Phase 1 and work through each phase sequentially. Ask clarifying questions about the product idea before generating code if anything is ambiguous.
