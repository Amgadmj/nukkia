import { useEffect, useRef, useState, type ReactNode } from "react";

export function WelcomeFrame({ children, progress }: { children: ReactNode; progress: number }) {
  const [loaded, setLoaded] = useState(false);
  const [docked, setDocked] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!loaded) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const move = window.setTimeout(() => setDocked(true), reduced ? 0 : 1000);
    const reveal = window.setTimeout(
      () => {
        setRevealed(true);
      },
      reduced ? 0 : 1750,
    );
    return () => {
      window.clearTimeout(move);
      window.clearTimeout(reveal);
    };
  }, [loaded]);
  useEffect(() => {
    if (revealed) main.current?.focus({ preventScroll: true });
  }, [revealed]);

  return (
    <div
      className="nukkia-workspace nukkia-welcome dark relative min-h-svh bg-black text-foreground"
      data-docked={docked}
      data-revealed={revealed}
    >
      <div
        className="absolute inset-x-0 top-0 z-10 h-[3px] bg-white/10"
        role="progressbar"
        aria-label="Etapas da apresentação"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
      >
        <div
          className="h-full bg-primary transition-[width] duration-500 motion-reduce:transition-none"
          style={{ width: progress + "%" }}
        />
      </div>
      <div className="nukkia-welcome-logo" role="img" aria-label="Nukkia">
        <img
          src="/nukkia-mark-white.png"
          alt=""
          width={384}
          height={446}
          fetchPriority="high"
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
        />
      </div>
      {!revealed && (
        <span className="sr-only" role="status">
          Bem-vindo à Nukkia
        </span>
      )}
      <main
        ref={main}
        tabIndex={-1}
        inert={!revealed}
        aria-hidden={!revealed}
        className="nukkia-welcome-content mx-auto max-w-5xl px-5 pb-14 outline-none sm:px-8"
      >
        {children}
      </main>
    </div>
  );
}
