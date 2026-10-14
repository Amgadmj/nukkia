import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { CustomersPage } from "@/components/admin/pages/customers";
import { WithAdminData } from "@/components/admin/with-data";

export const Route = createFileRoute("/_authenticated/admin/clientes")({
  validateSearch: z.object({ empresa: z.string().optional() }),
  head: () => ({ meta: [{ title: "Clientes | Admin Nukkia" }] }),
  component: Customers,
});

function Customers() {
  const { empresa } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  return (
    <WithAdminData>
      {(data) => (
        <CustomersPage
          data={data}
          selectedId={empresa}
          onSelect={(id) => void navigate({ search: id ? { empresa: id } : {}, replace: true })}
        />
      )}
    </WithAdminData>
  );
}
