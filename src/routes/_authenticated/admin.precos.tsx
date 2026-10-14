import { createFileRoute } from "@tanstack/react-router";
import { PricingPage } from "@/components/admin/pages/pricing";
import { WithAdminData } from "@/components/admin/with-data";

export const Route = createFileRoute("/_authenticated/admin/precos")({
  head: () => ({ meta: [{ title: "Preços | Admin Nukkia" }] }),
  component: () => <WithAdminData>{(data) => <PricingPage data={data} />}</WithAdminData>,
});
