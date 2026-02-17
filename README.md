# MP AI Starter Kit

A production-ready, AI-powered SaaS starter kit built by [Modern Phase](https://modernphase.io). Clone it, configure your keys, and start building your product.

## Features

- **AI Chat** — OpenAI-powered chat with streaming responses
- **Authentication** — Clerk (social logins, email, MFA)
- **Payments** — Stripe subscriptions (FREE/PRO plans, customer portal, webhooks)
- **Real-time Backend** — Convex (database, serverless functions, file storage)
- **Frontend** — React + Vite + TanStack Router + TanStack Query
- **UI** — shadcn/ui + Tailwind CSS with dark mode
- **Analytics** — PostHog product analytics with automatic pageview tracking
- **Email** — Resend for transactional emails
- **File Uploads** — Profile picture uploads via Convex storage
- **i18n** — Internationalization (English + Spanish)
- **Deployment** — Netlify-ready

## Getting Started

### Prerequisites

- Node.js 18+
- A [Clerk](https://clerk.com) account
- A [Convex](https://convex.dev) account
- A [Stripe](https://stripe.com) account (test mode)
- A [PostHog](https://posthog.com) account (free tier available)

### 1. Clone and install

```bash
git clone https://github.com/Modern-Phase/mp-ai-starter-kit.git
cd mp-ai-starter-kit
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env.local` and fill in your keys:

```bash
cp .env.example .env.local
```

**Frontend** (`.env.local`):
- `VITE_CLERK_PUBLISHABLE_KEY` — from [Clerk Dashboard](https://dashboard.clerk.com)
- `VITE_CONVEX_URL` — set automatically by `npx convex dev`
- `VITE_POSTHOG_KEY` — Project API key from [PostHog](https://us.posthog.com/settings/project#variables) (Settings > Project > Project API Key)
- `VITE_POSTHOG_HOST` — PostHog ingest host (defaults to `https://us.i.posthog.com`)

**Convex Backend** (set via `npx convex env set KEY VALUE`):
- `CLERK_JWT_ISSUER_DOMAIN` — Clerk issuer URL
- `STRIPE_SECRET_KEY` — Stripe secret key
- `STRIPE_WEBHOOK_SECRET` — Stripe webhook signing secret
- `SITE_URL` — Your app URL (e.g. `http://localhost:5173`)
- `AUTH_RESEND_KEY` — Resend API key (optional)
- `OPENAI_API_KEY` — OpenAI API key (optional, falls back to mock responses)

### 3. Set up Clerk JWT template

In your Clerk Dashboard, create a JWT template named **`convex`** with the Convex template preset. This is required for Clerk + Convex integration.

### 4. Run the app

```bash
npm run dev
```

This starts both the Vite frontend and the Convex backend.

### 5. Set up Stripe (optional)

```bash
# Listen for webhooks locally
stripe listen --forward-to $(npx convex site-url)/stripe/webhook
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start frontend + Convex backend |
| `npm run build` | Production build |
| `npx convex dev` | Push Convex functions (watch mode) |
| `npx convex env set KEY VALUE` | Set a backend environment variable |

## Project Structure

```
src/
  routes/          # TanStack Router file-based routes
    index.tsx      # Landing page
    _app/
      login/       # Clerk sign-in
      _auth/       # Protected routes (auth guard)
        dashboard/ # Dashboard, settings, billing, AI chat
        onboarding/# First-time user flow
  components/      # App components (ChatInterface)
  ui/              # shadcn/ui components
  utils/           # Helpers (cn, validators, signOut)

convex/
  schema.ts        # Database schema (users, plans, subscriptions)
  app.ts           # Core queries/mutations
  stripe.ts        # Stripe integration
  http.ts          # HTTP endpoints (Stripe webhook, /api/chat)
  auth.config.ts   # Clerk OIDC config
  email/           # Resend email templates
```

## Credits

Built on top of the open source [Convex SaaS](https://github.com/get-convex/convex-saas) template, originally ported from [Remix SaaS](https://github.com/dev-xo/remix-saas) by [Daniel Kanem](https://twitter.com/DanielKanem).

## License

MIT
