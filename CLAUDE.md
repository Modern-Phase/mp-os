# MP AI Starter Kit

An AI-powered SaaS starter kit built by **Modern Phase** — a done-for-you software service business. The goal is to give developers a production-ready foundation so they can focus on building their features instead of boilerplate. Clone it, configure your keys, and start building.

## Tech Stack

- **Frontend:** React 18 + Vite + TanStack Router (file-based) + TanStack Query
- **Backend:** Convex (real-time database, serverless functions, file storage)
- **Auth:** Clerk (JWT tokens validated by Convex via `ConvexProviderWithClerk`)
- **Payments:** Stripe (FREE/PRO plans, checkout, customer portal, webhooks)
- **AI:** TanStack AI + OpenAI (`/api/chat` endpoint in `convex/http.ts`)
- **UI:** shadcn/ui (Radix primitives + Tailwind CSS) with dark mode
- **Email:** Resend for transactional emails
- **i18n:** i18next with en/es translations in `public/locales/`
- **Deployment:** Netlify-ready (`netlify.toml`)

## Project Structure

```
src/
  app.tsx                    # Root providers (Clerk, Convex, QueryClient, Helmet)
  main.tsx                   # Vite entry point
  router.tsx                 # TanStack Router setup
  i18n.ts                    # i18next config
  routes/
    __root.tsx               # Root layout
    index.tsx                # Landing page (/)
    _app/
      _app.tsx               # Preloads current user via convexQuery
      login/                 # Public login (Clerk SignIn component)
      _auth/                 # Protected routes (Clerk auth guard)
        _auth.tsx            # Auth layout — redirects to /login if not signed in, calls ensureUser()
        dashboard/
          _layout.tsx        # Dashboard layout — requires user to exist in Convex
          _layout.index.tsx  # Dashboard home
          _layout.chat.tsx   # AI chat
          _layout.settings.* # User settings + billing
          -ui.navigation.tsx # Nav bar with profile dropdown, sign out, theme/language switchers
        onboarding/          # First-time user flow (username selection)
  components/
    ChatInterface.tsx        # AI chat UI (TanStack AI useChat hook)
  ui/                        # shadcn/ui components (button, input, dropdown, select, switch, etc.)
  lib/
    ai.ts                    # AI provider config
  utils/
    auth.ts                  # useConvexAuthToken() — use for any custom fetch to Convex HTTP actions
    misc.ts                  # cn(), useSignOut(), getLocaleCurrency()
    validators.ts            # Zod form validators

convex/
  schema.ts                  # Database schema: users, plans, subscriptions
  app.ts                     # Core queries/mutations (getCurrentUser, ensureUser, updateUsername, etc.)
  stripe.ts                  # Stripe integration (customer creation, subscriptions, checkout, portal)
  http.ts                    # HTTP endpoints: Stripe webhook + /api/chat
  auth.config.ts             # Clerk OIDC provider config
  email/                     # Resend email sending + subscription email templates
  env.ts                     # Environment variable references
  init.ts                    # Seed Stripe plans

site.config.ts               # Site metadata (title, description, URL)
types.ts                     # User type (extends Convex Doc with avatarUrl + subscription)
errors.ts                    # Error constants
```

## Auth Flow

1. Clerk handles sign-in/sign-up on the frontend
2. `ConvexProviderWithClerk` passes Clerk JWT tokens to Convex
3. Convex validates tokens against Clerk's OIDC issuer (`auth.config.ts`)
4. `ensureUser()` mutation (called in `_auth.tsx`) creates or links a Convex user record by `clerkId`
5. `getCurrentUser()` query looks up the user by `clerkId` and includes subscription data
6. Protected routes render only when both Clerk auth and Convex user exist

## Database Schema

- **users** — `clerkId` (indexed), `email` (indexed), `username`, `image`, `imageId`, `customerId` (Stripe)
- **plans** — `key` (FREE/PRO), `stripeId`, `name`, `description`, nested `prices[interval][currency]`
- **subscriptions** — `userId`, `planId`, `stripeId`, `status`, billing period, `cancelAtPeriodEnd`

## Stripe Billing Flow

- On onboarding, a Stripe customer + free subscription are created automatically
- Users upgrade via Stripe Checkout (`createSubscriptionCheckout`)
- Webhook at `/stripe/webhook` handles: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
- Customer portal for self-service subscription management

## AI Chat

- Frontend: `ChatInterface.tsx` uses `useChat` from `@tanstack/ai-react`
- Backend: `/api/chat` endpoint in `convex/http.ts` calls OpenAI API
- Falls back to mock responses when no API key is configured
- Provider config in `src/lib/ai.ts` and `.env.local`

## Key Environment Variables

### Frontend (`.env.local`)
- `VITE_CLERK_PUBLISHABLE_KEY` — Clerk publishable key
- `VITE_CONVEX_URL` — Convex deployment URL

### Convex Backend (set via `npx convex env set`)
- `CLERK_JWT_ISSUER_DOMAIN` — Clerk issuer URL (e.g. `https://verb-noun-00.clerk.accounts.dev`)
- `STRIPE_SECRET_KEY` — Stripe secret key
- `SITE_URL` — App URL for Stripe redirects
- `AUTH_RESEND_KEY` — Resend API key for emails

### AI (`.env.local`)
- `OPENAI_API_KEY` — OpenAI API key
- `OPENAI_MODEL` — Model name (default: `gpt-4o-mini`)
- `DEFAULT_AI_PROVIDER` — `openai` or `anthropic`

## Commands

- `npm run dev` — Start frontend + Convex backend in parallel
- `npm run build` — Production build
- `npx convex dev` — Push Convex functions and watch for changes
- `npx convex dev --once` — Deploy Convex functions once
- `npx convex env set KEY VALUE` — Set backend environment variable

## Conventions

- File-based routing with TanStack Router — route files in `src/routes/`
- `_layout.tsx` files define layout wrappers; `_layout.index.tsx` is the index route
- `-ui.*.tsx` prefix for route-colocated UI components (not routes themselves)
- `_app` and `_auth` prefixes are layout groups (pathless in the URL)
- Backend functions use `getAuthUserId()` helper to resolve Clerk identity → Convex user ID
- Internal/scheduled Convex functions prefixed with `PREAUTH_` (user ID passed in) or `UNAUTH_` (no auth needed)
- shadcn/ui components live in `src/ui/`, app components in `src/components/`
- Tailwind + `cn()` utility for conditional classnames
- **Custom HTTP requests to Convex** (e.g. fetch to `*.convex.site`): use `useConvexAuthToken()` from `@/utils/auth` to get the JWT; do not use Clerk’s `getToken()` without `{ template: "convex" }` or Convex will reject the request
