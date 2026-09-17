import { cn } from "@/lib/utils";

/**
 * The real logomarka lived on Lovable's asset host (/__l5e/assets-v1/...),
 * which only resolves inside Lovable's own hosting/preview proxy — it
 * 404'd on every local run even before the Lovable exit. This inline SVG
 * (a simple brand-gradient node mark) is a placeholder standing in for it,
 * not a final design. Drop the real file at src/assets/nukkia-mark.svg and
 * swap the <svg> below for an <img src="@/assets/nukkia-mark.svg" /> when
 * it's ready — the wordmark next to it stays as-is either way.
 */
function NukkiaMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="nukkia-mark-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--brand-deep)" />
          <stop offset="55%" stopColor="var(--brand-blue)" />
          <stop offset="100%" stopColor="var(--brand-cyan)" />
        </linearGradient>
      </defs>
      <rect width="36" height="36" rx="10" fill="url(#nukkia-mark-gradient)" />
      <circle cx="12" cy="13" r="3" fill="white" fillOpacity="0.95" />
      <circle cx="24" cy="13" r="3" fill="white" fillOpacity="0.95" />
      <circle cx="18" cy="24" r="3" fill="white" fillOpacity="0.95" />
      <path
        d="M12 13 L24 13 M12 13 L18 24 M24 13 L18 24"
        stroke="white"
        strokeWidth="1.5"
        strokeOpacity="0.7"
      />
    </svg>
  );
}

export function NukkiaLogo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <NukkiaMark className="size-9" />
      <span className="font-display text-lg font-bold tracking-tight">
        nukk<span className="text-primary">ia</span>
      </span>
    </span>
  );
}
