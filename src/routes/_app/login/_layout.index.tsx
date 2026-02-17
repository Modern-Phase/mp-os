import { createFileRoute } from "@tanstack/react-router";
import { SignIn } from "@clerk/clerk-react";
import { Route as DashboardRoute } from "@/routes/_app/_auth/dashboard/_layout.index";

export const Route = createFileRoute("/_app/login/_layout/")({
  component: Login,
});

function Login() {
  return (
    <div className="mx-auto flex h-full w-full flex-col items-center justify-center">
      <SignIn routing="hash" fallbackRedirectUrl={DashboardRoute.fullPath} />
    </div>
  );
}
