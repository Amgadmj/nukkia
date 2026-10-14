import { createFileRoute } from "@tanstack/react-router";
import { ExplorerPage } from "@/components/admin/pages/explorer";

export const Route = createFileRoute("/_authenticated/admin/dados")({
  head: () => ({ meta: [{ title: "Dados | Admin Nukkia" }] }),
  component: ExplorerPage,
});
