import { createFileRoute } from "@tanstack/react-router";
import { handleBrandPreview } from "@/lib/brand-preview.server";
import { userClientFromRequest } from "@/lib/supabase-request.server";
import { collectBrandSite } from "@/lib/public-site.server";
import { synthesizeBrand } from "@/lib/brand-synthesis.server";

export const Route = createFileRoute("/api/brand-preview")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handleBrandPreview(request, import.meta.env.DEV, {
          collect: collectBrandSite,
          authorize: async (incoming) => {
            const client = userClientFromRequest(incoming);
            if (!client) return false;
            const { data, error } = await client.auth.getUser();
            return !error && Boolean(data.user);
          },
          synthesize: async (research, signal) => {
            // Hosted collection is independent of paid synthesis. Do not enable a
            // provider until tenant quota/reservation and deployment are qualified.
            if (!import.meta.env.DEV) throw new Error("Hosted AI synthesis is not enabled");
            return synthesizeBrand(research, signal);
          },
        }),
    },
  },
});
