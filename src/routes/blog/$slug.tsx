import { createFileRoute, Link } from "@tanstack/react-router";
import { blogPosts } from "@/lib/blog";
import ReactMarkdown from "react-markdown";
import { buttonVariants } from "@/ui/button-util";
import { ChevronLeft } from "lucide-react";
import { Logo } from "@/ui/logo";

export const Route = createFileRoute("/blog/$slug")({
  component: BlogPost,
});

function BlogPost() {
  const { slug } = Route.useParams();
  const post = blogPosts.find((p) => p.slug === slug);

  if (!post) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold">Post not found</h1>
        <Link to="/blog" className={buttonVariants({ variant: "outline" })}>
          Back to Blog
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2">
            <Logo />
          </Link>
          <Link
            to="/blog"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            Back to Blog
          </Link>
        </div>
      </header>

      <main className="container mx-auto flex-1 px-6 py-12">
        <article className="mx-auto max-w-3xl space-y-8">
          <div className="space-y-4">
            <Link
              to="/blog"
              className="flex items-center text-sm font-medium text-muted-foreground hover:text-primary"
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              All posts
            </Link>
            <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
              {post.title}
            </h1>
            <div className="text-sm text-muted-foreground">{post.date}</div>
          </div>

          <div className="prose prose-neutral dark:prose-invert max-w-none">
            <ReactMarkdown>{post.content}</ReactMarkdown>
          </div>
        </article>
      </main>

      <footer className="border-t py-12 mt-12">
        <div className="container mx-auto px-6 text-center text-sm text-muted-foreground">
          © 2026 Modern Phase. Built with MP AI Starter Kit.
        </div>
      </footer>
    </div>
  );
}
