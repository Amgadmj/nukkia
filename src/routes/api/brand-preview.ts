import { createFileRoute } from "@tanstack/react-router";
import { handleBrandPreview } from "@/lib/brand-preview.server";

export const Route = createFileRoute("/api/brand-preview")({
  server: { handlers: { POST: ({ request }) => handleBrandPreview(request, import.meta.env.DEV) } },
});
