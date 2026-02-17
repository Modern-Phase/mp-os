import { createFileRoute, Link } from "@tanstack/react-router";
import { blogPosts } from "@/lib/blog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/ui/card";
import { buttonVariants } from "@/ui/button-util";
import { Logo } from "@/ui/logo";

export const Route = createFileRoute("/blog/")({
  component: BlogIndex,
});

function BlogIndex() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2">
            <Logo />
            <span className="text-xl font-bold">Blog</span>
          </Link>
          <Link
            to="/"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            Back to App
          </Link>
        </div>
      </header>

      <main className="container mx-auto flex-1 px-6 py-12">
        <div className="mx-auto max-w-4xl space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
              Latest from the Blog
            </h1>
            <p className="text-xl text-muted-foreground">
              Insights, updates, and guides on building with MP AI Starter Kit.
            </p>
          </div>

          <div className="grid gap-6">
            {blogPosts.map((post) => (
              <Link
                key={post.slug}
                to="/blog/$slug"
                params={{ slug: post.slug }}
                className="group transition-transform active:scale-[0.99]"
              >
                <Card className="overflow-hidden border-primary/5 bg-card transition-colors hover:border-primary/20">
                  <CardHeader>
                    <div className="text-sm text-muted-foreground mb-2">
                      {post.date}
                    </div>
                    <CardTitle className="text-2xl group-hover:text-primary">
                      {post.title}
                    </CardTitle>
                    <CardDescription className="text-base mt-2">
                      {post.excerpt}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <span className="text-sm font-semibold text-primary">
                      Read more →
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </main>

      <footer className="border-t py-12">
        <div className="container mx-auto px-6 text-center text-sm text-muted-foreground">
          © 2026 Modern Phase. Built with MP AI Starter Kit.
        </div>
      </footer>
    </div>
  );
}
