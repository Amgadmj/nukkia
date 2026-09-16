import logoAsset from "@/assets/nukkia-logo.jpg.asset.json";
import { cn } from "@/lib/utils";

export function NukkiaLogo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <img
        src={logoAsset.url}
        alt="Nukkia"
        className="size-9 rounded-lg object-cover object-top"
        loading="eager"
      />
      <span className="font-display text-lg font-bold tracking-tight">
        nukk<span className="text-primary">ia</span>
      </span>
    </span>
  );
}
