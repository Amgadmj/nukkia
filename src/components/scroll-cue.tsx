import { useEffect, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";

const RING = 2 * Math.PI * 24;
const END = 0.985;

// Scroll cue pinned to the viewport. The ring is a slow progress meter for the
// whole page: it fills as you read and completes at the footer. Click glides to
// the next section from wherever you are; at the end the arrow flips and the
// click returns to the top. Motion is off for prefers-reduced-motion.
export function ScrollCue() {
  const ref = useRef<HTMLButtonElement>(null);
  const [atEnd, setAtEnd] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      el.style.setProperty("--cue-p", p.toFixed(4));
      setAtEnd(p >= END);
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
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth";
    if (atEnd) {
      window.scrollTo({ top: 0, behavior });
      return;
    }
    const hero = ref.current?.closest("section");
    const blocks = [
      ...Array.from(hero?.parentElement?.children ?? []),
      ...Array.from(document.querySelectorAll("footer")),
    ];
    const next = blocks.find((b) => b.getBoundingClientRect().top > 24);
    (next ?? document.body).scrollIntoView({ behavior, block: next ? "start" : "end" });
  };

  return (
    <button
      ref={ref}
      type="button"
      className="atl-cue"
      data-end={atEnd ? "true" : "false"}
      onClick={go}
      aria-label={atEnd ? "Voltar ao topo" : "Rolar para ver mais"}
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
        {atEnd ? "Voltar ao topo" : "Role para continuar"}
      </span>
    </button>
  );
}
