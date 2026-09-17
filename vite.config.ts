// Explicit Vite config — replaces @lovable.dev/vite-tanstack-config as part
// of the full Lovable exit (docs/ENGINEERING_PLAN.md). The wrapper bundled:
// TanStack devtools (dev-only), tanstackStart, viteReact, tailwindcss,
// tsConfigPaths, nitro (build-only, cloudflare preset by default), VITE_*
// env injection, the @ path alias, React/TanStack dedupe, Lovable-preview-
// specific error-logger/asset-proxy plugins, and Lovable-sandbox detection.
//
// Kept here: tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro,
// the dedupe, the @ alias (via tsConfigPaths, which reads tsconfig's
// "paths"), and VITE_* injection (built into Vite itself, and into
// tanstackStart() for server-side process.env access — see
// @tanstack/start-plugin-core's load-env plugin, not something the wrapper
// added).
//
// Deliberately dropped: TanStack devtools overlay (no exact equivalent
// import path confirmed against this Vite/Start version without risking a
// broken build — reintroduce once verified, it's a dev nicety, not a
// requirement), Lovable-preview-only error/asset-proxy plugins (nothing
// left to proxy — the preview iframe integration doesn't exist outside
// Lovable), and Lovable-sandbox port/host forcing (no sandbox anymore; port
// is fixed at 8080 to match every existing doc/reference to this app).
//
// tanstackStart() fully owns file-based route codegen internally (its
// config schema has its own `router: {...}` section covering everything
// @tanstack/router-plugin does) — adding that plugin separately here would
// double-generate routeTree.gen.ts, exactly the "duplicate plugins" failure
// the original wrapper's comment warned about.
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

export default defineConfig({
  server: {
    port: 8080,
    host: true,
  },
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  plugins: [
    tsConfigPaths(),
    tanstackStart({
      // Redirect TanStack Start's bundled server entry to src/server.ts
      // (our SSR error wrapper + security headers).
      server: { entry: "server" },
    }),
    viteReact(),
    tailwindcss(),
    nitro({
      preset: process.env["NITRO_PRESET"] || "cloudflare-module",
    }),
  ],
});
