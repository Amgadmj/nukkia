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
      // Vercel sets VERCEL=1 in its own build environment — auto-select its
      // preset there so a deploy to Vercel doesn't silently produce a
      // Cloudflare Worker bundle it can't serve. NITRO_PRESET still wins if
      // set explicitly (e.g. to force a specific target locally).
      preset:
        process.env["NITRO_PRESET"] || (process.env["VERCEL"] ? "vercel" : "cloudflare-module"),
      // Promo MP4 export (src/lib/promo-video.server.ts) falls back to the
      // ffmpeg-static binary, since Vercel functions have no system ffmpeg.
      // Nitro bundles dependencies by default, which would break the
      // package's __dirname-relative binary path and drop the binary itself.
      // "pkg*" externalizes it and copies the WHOLE package (the ~80 MB
      // binary included) into the server output's node_modules. Only Node
      // presets trace; Workers can't spawn processes anyway. The binary is
      // whatever `npm install` downloaded for the BUILD machine's platform,
      // so on Vercel (Linux build image) it is the linux-x64 build.
      traceDeps: ["ffmpeg-static*"],
      traceOpts: {
        hooks: {
          // nf3 lists a full-trace package's files AND the ones nft traced
          // (index.js, package.json, the binary), so the same destination
          // gets two concurrent copyFile calls — EBUSY on Windows, a silent
          // race elsewhere. De-duplicate before anything is written.
          tracedPackages(packages) {
            for (const pkg of Object.values(packages))
              for (const version of Object.values(pkg.versions))
                version.files = [...new Set(version.files)];
          },
        },
      },
    }),
  ],
});
