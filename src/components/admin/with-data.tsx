import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useAdminData } from "@/lib/admin/data";
import type { AdminData } from "@/lib/admin/types";
import { Empty, LoadingGrid } from "./ui";

/** Loads the admin snapshot once and hands it to a page, with loading and error states. */
export function WithAdminData({ children }: { children: (data: AdminData) => ReactNode }) {
  const query = useAdminData();
  if (query.isPending) return <LoadingGrid />;
  if (query.isError || !query.data) {
    return (
      <div className="rounded-xl border bg-card">
        <Empty
          title="Não foi possível carregar os dados"
          hint="Confira a conexão e a permissão de administrador. Nenhum dado foi alterado."
        />
        <div className="flex justify-center pb-8">
          <Button variant="outline" onClick={() => void query.refetch()}>
            Tentar de novo
          </Button>
        </div>
      </div>
    );
  }
  return <>{children(query.data)}</>;
}
