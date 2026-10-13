import { useEffect, type RefObject } from "react";

// Scroll-scrubbed scatter for the landing hero stage.
// At rest (top of page) inline transforms are cleared, so atlantic-landing.css
// keeps full control of the composition — visuals are unchanged.
// `base` mirrors each element's resting rotate() in atlantic-landing.css
// (identical at every breakpoint). x/y px, r deg, s scale at full scatter.
type Vector = { base: number; x: number; y: number; r: number; s: number };

const VECTORS: Record<string, Vector> = {
  orbit: { base: -14, x: 0, y: 40, r: -46, s: 1.3 },
  context: { base: -2, x: -360, y: -240, r: -30, s: 1 },
  art: { base: -5, x: -30, y: 170, r: -18, s: 0.9 },
  arch: { base: 0, x: 170, y: -210, r: 32, s: 1 },
  version: { base: 4, x: 400, y: -150, r: 36, s: 1 },
  plan: { base: 2, x: 160, y: 360, r: 16, s: 1 },
  caption: { base: 0, x: 0, y: 150, r: -6, s: 1 },
};

const SCROLL_DISTANCE = 520;
const SMOOTHING = 0.14;

const easeInOutQuad = (p: number) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);

export function useHeroScatter(ref: RefObject<HTMLElement | null>, intensity = 1) {
  useEffect(() => {
    const stage = ref.current;
    if (!stage || typeof window === "undefined") return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const items = Array.from(stage.querySelectorAll<HTMLElement>("[data-scatter]"))
      .map((el) => ({ el, v: VECTORS[el.dataset["scatter"] ?? ""] }))
      .filter((item): item is { el: HTMLElement; v: Vector } => Boolean(item.v));

    let startTop = stage.getBoundingClientRect().top + window.scrollY;
    let current = 0;
    let raf = 0;

    const target = () => {
      if (motion.matches) return 0;
      const scrolled = startTop - stage.getBoundingClientRect().top;
      return Math.min(1, Math.max(0, scrolled / SCROLL_DISTANCE));
    };

    const apply = (p: number) => {
      if (p === 0) {
        for (const { el } of items) el.style.transform = "";
        return;
      }
      const e = easeInOutQuad(p) * intensity;
      for (const { el, v } of items) {
        el.style.transform = `translate(${v.x * e}px, ${v.y * e}px) rotate(${v.base + v.r * e}deg) scale(${1 + (v.s - 1) * e})`;
      }
    };

    const tick = () => {
      const t = target();
      current += (t - current) * SMOOTHING;
      if (Math.abs(t - current) < 0.0005) current = t;
      apply(current);
      raf = current === t ? 0 : requestAnimationFrame(tick);
    };
    const wake = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const onResize = () => {
      startTop = stage.getBoundingClientRect().top + window.scrollY;
      wake();
    };

    window.addEventListener("scroll", wake, { passive: true });
    window.addEventListener("resize", onResize);
    motion.addEventListener("change", wake);
    wake();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", wake);
      window.removeEventListener("resize", onResize);
      motion.removeEventListener("change", wake);
      for (const { el } of items) el.style.transform = "";
    };
  }, [ref, intensity]);
}
