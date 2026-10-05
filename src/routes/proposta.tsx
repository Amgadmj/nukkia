import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/proposta")({
  beforeLoad: () => {
    throw redirect({ to: "/", replace: true });
  },
});
