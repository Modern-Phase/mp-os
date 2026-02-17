import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "../ui/logo";
import { cn } from "@/utils/misc";
import { buttonVariants } from "@/ui/button-util";
import { Loader2, CheckCircle, Shield, Zap, Brain, Bot, ExternalLink } from "lucide-react";
import { ThemeSwitcherHome } from "@/ui/theme-switcher";
import ShadowPNG from "/images/shadow.png";
import { useAuth } from "@clerk/clerk-react";
import { Route as AuthLoginRoute } from "@/routes/_app/login/_layout.index";
import { Route as DashboardRoute } from "@/routes/_app/_auth/dashboard/_layout.index";

export const Route = createFileRoute("/")({
  component: Index,
});

const PURCHASE_URL = "#";

function Index() {
  const { isLoaded, isSignedIn } = useAuth();
  const isLoading = !isLoaded;
  const isAuthenticated = isSignedIn;
  const theme = "dark";

  return (
    <div className="relative flex h-full w-full flex-col bg-card">
      {/* Navigation */}
      <div className="sticky top-0 z-50 mx-auto flex w-full max-w-screen-lg items-center justify-between p-6 py-3 backdrop-blur-md bg-card/80">
        <Link to="/" className="flex h-10 items-center gap-1">
          <Logo />
        </Link>
        <div className="flex items-center gap-4">
          <a
            href="https://modernphase.io"
            target="_blank"
            rel="noreferrer"
            className={cn(
              buttonVariants({ variant: "link", size: "sm" }),
              "group flex gap-3 px-0 text-primary/80 hover:text-primary hover:no-underline",
            )}
          >
            Modern Phase
          </a>
          <Link
            to={
              isAuthenticated
                ? DashboardRoute.fullPath
                : AuthLoginRoute.fullPath
            }
            className={buttonVariants({ size: "sm" })}
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="animate-spin w-16 h-4" />}
            {!isLoading && isAuthenticated && "Dashboard"}
            {!isLoading && !isAuthenticated && "Get Started"}
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="z-10 mx-auto flex w-full max-w-screen-lg flex-col px-6">

        {/* ===== SECTION 1: Pattern Interrupt Headline ===== */}
        <section className="flex flex-col items-center justify-center gap-6 py-20 md:py-32 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-4 py-1.5 text-sm font-semibold text-yellow-500 dark:text-yellow-400">
            <Zap className="h-4 w-4" />
            STOP. Read This First.
          </div>
          <h1 className="max-w-4xl text-4xl font-extrabold leading-[1.1] tracking-tight text-primary md:text-5xl lg:text-6xl">
            WARNING: Do Not Write Another Line of Boilerplate Code.
          </h1>
          <h2 className="max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
            How to skip the 40-hour "Setup Trap" and launch your SaaS this weekend.
            <br className="hidden md:inline" />
            Built on{" "}
            <span className="font-bold text-primary">TanStack Start & Convex</span>.
            The stack that makes Next.js feel slow.
          </h2>
          <a
            href={PURCHASE_URL}
            className="mt-4 inline-flex h-14 items-center justify-center rounded-lg bg-primary px-10 text-lg font-bold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.02] active:scale-[0.98]"
          >
            Get The Revenue Engine ($249)
          </a>
          <p className="text-sm text-muted-foreground">
            One-time payment. Instant access. No subscriptions.
          </p>
        </section>

        {/* ===== SECTION 2: Agitation — "Dear Technical Founder" ===== */}
        <section className="mx-auto w-full max-w-2xl py-16 md:py-24">
          <h2 className="mb-8 text-3xl font-extrabold tracking-tight text-primary md:text-4xl">
            Dear Technical Founder,
          </h2>
          <div className="space-y-6 text-lg leading-relaxed text-primary/80">
            <p>Let me guess where you are right now.</p>
            <p>
              You have a great idea. But instead of building it, you spent the last 3 days
              fighting with <span className="font-bold text-primary">Auth Middleware</span>.
            </p>
            <p>
              Then you spent another 2 days trying to figure out why your{" "}
              <span className="font-bold text-primary">Database Migrations</span> failed.
            </p>
            <p>
              And don't get me started on{" "}
              <span className="font-bold text-primary">Caching</span>.
            </p>
            <p className="text-xl font-semibold text-primary">
              You aren't building a business. You are wrestling with config files.
            </p>
            <p>
              It's not your fault. The modern web has become too complex.
            </p>
            <p className="text-xl font-bold text-primary">
              You need a cheat code.
            </p>
          </div>
        </section>

        {/* ===== SECTION 3: The "Cheat Code" Architecture ===== */}
        <section className="py-16 md:py-24">
          <h2 className="mb-4 text-center text-3xl font-extrabold tracking-tight text-primary md:text-4xl">
            The "Cheat Code" Architecture.
          </h2>
          <p className="mx-auto mb-12 max-w-xl text-center text-lg text-muted-foreground">
            Three pillars that eliminate every headache you've ever had with web dev.
          </p>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* Card 1: TanStack Start */}
            <div className="group relative flex flex-col gap-4 rounded-xl border border-border bg-card p-8 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-primary">
                TanStack Start
              </h3>
              <p className="text-sm font-semibold uppercase tracking-wider text-primary/60">
                The Speed
              </p>
              <p className="leading-relaxed text-primary/80">
                <span className="font-bold text-primary">Forget Loading Spinners.</span>{" "}
                We use Server-Side Rendering (SSR) that loads instantly. No complex caching rules. It just works.
              </p>
            </div>

            {/* Card 2: Convex */}
            <div className="group relative flex flex-col gap-4 rounded-xl border border-border bg-card p-8 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Brain className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-primary">
                Convex
              </h3>
              <p className="text-sm font-semibold uppercase tracking-wider text-primary/60">
                The Brain
              </p>
              <p className="leading-relaxed text-primary/80">
                <span className="font-bold text-primary">Forget SQL Nightmares.</span>{" "}
                The database is real-time. You change a line of code, and the data updates on your screen instantly. No migrations. No downtime.
              </p>
            </div>

            {/* Card 3: Foreman Files */}
            <div className="group relative flex flex-col gap-4 rounded-xl border border-border bg-card p-8 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Bot className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-primary">
                The "Foreman" Files
              </h3>
              <p className="text-sm font-semibold uppercase tracking-wider text-primary/60">
                The Secret Weapon
              </p>
              <p className="leading-relaxed text-primary/80">
                <span className="font-bold text-primary">Forget Bad AI Code.</span>{" "}
                Includes my private <code className="rounded bg-primary/10 px-1.5 py-0.5 text-sm font-mono text-primary">.cursorrules</code> file. Drag it into Cursor, and the AI writes code exactly like I do. It's like hiring a Senior Architect for free.
              </p>
            </div>
          </div>
        </section>

        {/* ===== SECTION 4: Undeniable Proof — Demo Section ===== */}
        <section className="py-16 md:py-24">
          <h2 className="mb-4 text-center text-3xl font-extrabold tracking-tight text-primary md:text-4xl">
            Don't Believe Me? Break My Demos.
          </h2>
          <p className="mx-auto mb-16 max-w-xl text-center text-lg text-muted-foreground">
            I built these to prove this stack is production-ready. Try to break them. I dare you.
          </p>

          {/* Demo 1: Turf Wars */}
          <div className="mb-12 flex flex-col gap-8 rounded-xl border border-border bg-card p-8 md:flex-row md:items-center md:p-12">
            <div className="flex-1 space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-red-500/10 px-3 py-1 text-sm font-semibold text-red-500 dark:text-red-400">
                STRESS TEST
              </div>
              <h3 className="text-2xl font-bold text-primary md:text-3xl">
                "Turf Wars" — The Multiplayer War Game
              </h3>
              <p className="text-lg leading-relaxed text-primary/80">
                I built a Multiplayer War Game to prove this stack is bulletproof.
              </p>
              <ul className="space-y-3 text-primary/80">
                <li className="flex items-start gap-3">
                  <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" />
                  <span><span className="font-bold text-primary">The Test:</span> 1,000 clicks per second.</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" />
                  <span><span className="font-bold text-primary">The Result:</span> 0ms lag.</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" />
                  <span><span className="font-bold text-primary">The Lesson:</span> If it can handle a war, it can handle your SaaS.</span>
                </li>
              </ul>
              <a
                href={PURCHASE_URL}
                className="inline-flex items-center gap-2 text-lg font-bold text-primary underline underline-offset-4 transition-colors hover:text-primary/80"
              >
                Play Turf Wars <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Demo 2: B2B Dashboard */}
          <div className="flex flex-col gap-8 rounded-xl border border-border bg-card p-8 md:flex-row-reverse md:items-center md:p-12">
            <div className="flex-1 space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/10 px-3 py-1 text-sm font-semibold text-blue-500 dark:text-blue-400">
                BUSINESS LOGIC
              </div>
              <h3 className="text-2xl font-bold text-primary md:text-3xl">
                The B2B Dashboard — The Money Maker
              </h3>
              <p className="text-lg leading-relaxed text-primary/80">
                I built a boring Enterprise Dashboard to prove it handles business logic.
              </p>
              <ul className="space-y-3 text-primary/80">
                <li className="flex items-start gap-3">
                  <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" />
                  <span><span className="font-bold text-primary">The Test:</span> Complex data tables, Admin permissions, and Stripe payments.</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" />
                  <span><span className="font-bold text-primary">The Result:</span> Production-ready code you can copy-paste.</span>
                </li>
              </ul>
              <a
                href={PURCHASE_URL}
                className="inline-flex items-center gap-2 text-lg font-bold text-primary underline underline-offset-4 transition-colors hover:text-primary/80"
              >
                View Dashboard <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        </section>

        {/* ===== SECTION 5: Grand Slam Offer ===== */}
        <section className="py-16 md:py-24">
          <h2 className="mb-12 text-center text-3xl font-extrabold tracking-tight text-primary md:text-4xl">
            Everything You Need To Ship on Friday.
          </h2>

          <div className="mx-auto max-w-2xl overflow-hidden rounded-2xl border-2 border-primary/20 bg-card shadow-2xl shadow-primary/5">
            {/* Offer Header */}
            <div className="bg-primary px-8 py-6 text-center">
              <h3 className="text-2xl font-extrabold text-primary-foreground md:text-3xl">
                The Revenue Engine
              </h3>
              <p className="mt-1 text-primary-foreground/80">
                Everything. One kit. Ship this weekend.
              </p>
            </div>

            {/* Offer Body */}
            <div className="space-y-5 p-8 md:p-10">
              <div className="flex items-start gap-4">
                <CheckCircle className="mt-0.5 h-6 w-6 flex-shrink-0 text-green-500" />
                <div>
                  <p className="text-lg font-bold text-primary">The Source Code</p>
                  <p className="text-primary/70">TanStack Start + Convex + Clerk + Stripe. Fully wired. Ready to deploy.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <CheckCircle className="mt-0.5 h-6 w-6 flex-shrink-0 text-green-500" />
                <div>
                  <p className="text-lg font-bold text-primary">The "Foreman" AI Brain</p>
                  <p className="text-primary/70">The exact instructions I give my AI to write perfect code. Drop into Cursor and go.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <CheckCircle className="mt-0.5 h-6 w-6 flex-shrink-0 text-green-500" />
                <div>
                  <p className="text-lg font-bold text-primary">The Demo Library</p>
                  <p className="text-primary/70">Full source code for "Turf Wars" and the Enterprise Dashboard.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <CheckCircle className="mt-0.5 h-6 w-6 flex-shrink-0 text-green-500" />
                <div>
                  <p className="text-lg font-bold text-primary">The Zero-to-One Video</p>
                  <p className="text-primary/70">Watch me deploy a live app in 15 minutes. Follow along step by step.</p>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-border" />

              {/* Price */}
              <div className="text-center">
                <p className="text-lg text-muted-foreground line-through">
                  Value: $2,500
                </p>
                <p className="mt-2 text-5xl font-extrabold tracking-tight text-primary">
                  $249
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  One-time payment. Yours forever.
                </p>
              </div>

              <a
                href={PURCHASE_URL}
                className="flex h-14 w-full items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.02] active:scale-[0.98]"
              >
                Get The Revenue Engine ($249)
              </a>
              <p className="text-center text-sm text-muted-foreground">
                Instant Access via GitHub
              </p>
            </div>
          </div>
        </section>

        {/* ===== SECTION 6: Risk Reversal / Guarantee ===== */}
        <section className="py-16 md:py-24">
          <div className="mx-auto max-w-2xl rounded-xl border border-green-500/20 bg-green-500/5 p-8 text-center md:p-12">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
              <Shield className="h-8 w-8 text-green-500" />
            </div>
            <h2 className="mb-4 text-2xl font-extrabold tracking-tight text-primary md:text-3xl">
              My "Bug-Free" Guarantee.
            </h2>
            <p className="text-lg leading-relaxed text-primary/80">
              If you find a configuration bug in this kit within 30 days, I will fix it personally.
              If I can't, I will refund 100% of your money.
            </p>
            <p className="mt-4 text-xl font-bold text-green-600 dark:text-green-400">
              You take zero risk.
            </p>
          </div>
        </section>

        {/* ===== SECTION 7: Final CTA ===== */}
        <section className="flex flex-col items-center justify-center gap-6 py-20 md:py-32 text-center">
          <h2 className="max-w-3xl text-3xl font-extrabold tracking-tight text-primary md:text-4xl lg:text-5xl">
            Stop Wrestling Config Files.
            <br />
            Start Shipping.
          </h2>
          <a
            href={PURCHASE_URL}
            className="mt-4 inline-flex h-16 items-center justify-center rounded-lg bg-primary px-12 text-xl font-bold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.02] active:scale-[0.98]"
          >
            Download The Revenue Engine Now ($249)
          </a>
          <p className="text-sm text-muted-foreground">
            Instant Access via GitHub. One-time payment. 30-day guarantee.
          </p>
        </section>
      </div>

      {/* Footer */}
      <footer className="z-10 flex w-full flex-col items-center justify-center gap-8 py-6">
        <ThemeSwitcherHome />

        <div className="flex flex-col items-center gap-2 sm:flex-row">
          <p className="flex items-center whitespace-nowrap text-center text-sm font-medium text-primary/60">
            Built by&nbsp;
            <a
              href="https://modernphase.io"
              target="_blank"
              rel="noreferrer"
              className="flex items-center text-primary hover:text-primary hover:underline"
            >
              Modern Phase
            </a>
          </p>
          <span className="hidden text-primary/30 sm:inline">&middot;</span>
          <Link
            to="/blog"
            className="flex items-center text-primary hover:text-primary hover:underline text-sm font-medium"
          >
            Blog
          </Link>
        </div>
      </footer>

      {/* Background */}
      <img
        src={ShadowPNG}
        alt="Hero"
        className={`fixed left-0 top-0 z-0 h-full w-full opacity-60 ${theme === "dark" ? "invert" : ""}`}
      />
      <div className="base-grid fixed h-screen w-screen opacity-40" />
      <div className="fixed bottom-0 h-screen w-screen bg-gradient-to-t from-[hsl(var(--card))] to-transparent" />
    </div>
  );
}
