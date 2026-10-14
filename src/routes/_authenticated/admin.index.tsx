import { createFileRoute } from "@tanstack/react-router";
import { OverviewPage } from "@/components/admin/pages/overview";
import { WithAdminData } from "@/components/admin/with-data";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: () => <WithAdminData>{(data) => <OverviewPage data={data} />}</WithAdminData>,
});
