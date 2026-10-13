import { cn } from "@/lib/utils";

export function NukkiaLogo({
  className,
  compact = false,
  symbolWidth = 30,
}: {
  className?: string;
  compact?: boolean;
  symbolWidth?: number;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        className="nukkia-logo-mark relative block shrink-0"
        style={{ width: symbolWidth, height: symbolWidth * 1.175 }}
        aria-hidden="true"
      >
        <img
          src="/nukkia-mark-white.png"
          alt=""
          width="384"
          height="446"
          className="hidden h-full w-full object-contain dark:block"
        />
        <span className="block h-full w-full overflow-hidden mix-blend-multiply dark:hidden">
          <img
            src="/nukkia-official.jpg"
            alt=""
            width="2000"
            height="2000"
            className="absolute max-w-none [filter:grayscale(1)_invert(1)_brightness(2)_contrast(1.4)_invert(1)]"
            style={{ width: "275%", height: "auto", left: "-87.5%", top: "-43.5%" }}
          />
        </span>
      </span>
      {!compact && <span className="font-display text-xl font-bold tracking-tight">nukkia</span>}
    </span>
  );
}
