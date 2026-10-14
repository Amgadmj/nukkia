import { createFileRoute } from "@tanstack/react-router";
import { RevenuePage } from "@/components/admin/pages/revenue";
import { WithAdminData } from "@/components/admin/with-data";

export const Route = createFileRoute("/_authenticated/admin/receita")({
  head: () => ({ meta: [{ title: "Receita e margem | Admin Nukkia" }] }),
  component: () => <WithAdminData>{(data) => <RevenuePage data={data} />}</WithAdminData>,
});
