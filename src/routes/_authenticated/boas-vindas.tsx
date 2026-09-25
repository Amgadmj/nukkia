import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { AccountOnboarding } from "@/components/account-onboarding";

export const Route = createFileRoute("/_authenticated/boas-vindas")({
  validateSearch: z.object({
    rever: z.boolean().optional(),
    etapa: z.number().int().min(0).max(3).optional(),
  }),
  head: () => ({ meta: [{ title: "Seu primeiro capítulo | Nukkia" }] }),
  component: WelcomePage,
});
function WelcomePage() {
  const { rever, etapa } = Route.useSearch();
  return <AccountOnboarding replay={Boolean(rever)} initialStep={etapa ?? 0} />;
}
