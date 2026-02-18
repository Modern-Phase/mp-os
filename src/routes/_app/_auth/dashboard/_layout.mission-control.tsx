import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute(
  "/_app/_auth/dashboard/_layout/mission-control",
)({
  beforeLoad: () => {
    throw redirect({ to: "/" })
  },
  component: () => null,
})
