import { useEffect, useRef } from "react";
import { ArrowDown } from "lucide-react";

const RING = 2 * Math.PI * 24;

// Hero "scroll down" cue, pinned to the viewport so it shows on any screen
// height. The ring fills and the cue fades as you scroll, the arrow nudges on
// hover, and a click glides to the section after the hero. Motion is off for prefers-reduced-motion.
export function ScrollCue() {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const el = ref.current;
    const hero = el?.closest("section");
    if (!el || !hero) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const span = Math.max(1, Math.min(hero.offsetHeight * 0.5, 360));
      const p = Math.min(1, Math.max(0, window.scrollY / span));
      el.style.setProperty("--cue-p", p.toFixed(3));
      el.dataset["gone"] = p >= 1 ? "true" : "false";
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const go = () => {
    const hero = ref.current?.closest("section");
    const next = hero?.nextElementSibling;
    if (!next) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    next.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  return (
    <button
      ref={ref}
      type="button"
      className="atl-cue"
      data-gone="false"
      onClick={go}
      aria-label="Rolar para ver mais"
    >
      <svg className="atl-cue-ring" viewBox="0 0 56 56" aria-hidden="true">
        <circle className="atl-cue-track" cx="28" cy="28" r="24" />
        <circle
          className="atl-cue-progress"
          cx="28"
          cy="28"
          r="24"
          strokeDasharray={RING}
          style={{ strokeDashoffset: `calc(${RING} * (1 - var(--cue-p, 0)))` }}
        />
      </svg>
      <ArrowDown className="atl-cue-arrow" size={20} aria-hidden="true" />
      <span className="atl-cue-label" aria-hidden="true">
        Role para continuar
      </span>
    </button>
  );
}
