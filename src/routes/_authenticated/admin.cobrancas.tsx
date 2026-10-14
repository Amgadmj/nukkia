import { createFileRoute } from "@tanstack/react-router";
import { BillingPage } from "@/components/admin/pages/billing";
import { WithAdminData } from "@/components/admin/with-data";

export const Route = createFileRoute("/_authenticated/admin/cobrancas")({
  head: () => ({ meta: [{ title: "Cobranças | Admin Nukkia" }] }),
  component: () => <WithAdminData>{(data) => <BillingPage data={data} />}</WithAdminData>,
});
