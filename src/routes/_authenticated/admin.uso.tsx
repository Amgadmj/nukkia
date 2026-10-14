import { createFileRoute } from "@tanstack/react-router";
import { UsagePage } from "@/components/admin/pages/usage";
import { WithAdminData } from "@/components/admin/with-data";

export const Route = createFileRoute("/_authenticated/admin/uso")({
  head: () => ({ meta: [{ title: "Uso e custos | Admin Nukkia" }] }),
  component: () => <WithAdminData>{(data) => <UsagePage data={data} />}</WithAdminData>,
});
