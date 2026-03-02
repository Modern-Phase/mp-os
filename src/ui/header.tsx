import { useRouter } from "@tanstack/react-router";

export function Header() {
  const router = useRouter();
  const matches = router.state.matches;
  const lastMatch = matches[matches.length - 1];
  const routeContext = lastMatch?.context as
    | { headerTitle?: string; headerDescription?: string }
    | undefined;

  if (!routeContext?.headerTitle) return null;

  return (
    <header className="z-10 flex w-full flex-col border-b border-border bg-card/50 backdrop-blur-sm">
      <div className="flex w-full items-center justify-between py-8 px-4 lg:px-6">
        <div className="flex flex-col items-start gap-2">
          <h1 className="text-2xl lg:text-3xl font-semibold text-foreground">
            {routeContext?.headerTitle}
          </h1>
          {routeContext?.headerDescription && (
            <p className="text-sm lg:text-base text-muted-foreground">
              {routeContext?.headerDescription}
            </p>
          )}
        </div>
      </div>
    </header>
  );
}
