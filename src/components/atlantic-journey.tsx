import { Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import {
  ArrowUpRight,
  Brain,
  CalendarDays,
  Check,
  Copy,
  FileText,
  Library,
  PenLine,
  Play,
} from "lucide-react";
import { NukkiaLogo } from "@/components/nukkia-logo";

// Scroll-driven journey: one piece travels Contexto → Criação → Biblioteca → Planejamento.
// Each element has a keyframe per stage: [x, y, rotate, scale, opacity] from the visual centre.
// p0 at stage 3 is resolved at runtime to the Oct 20 calendar cell.
type Frame = [number, number, number, number, number];
const K: Record<string, (Frame | null)[]> = {
  brand: [
    [0, -92, 0, 1, 1],
    [0, -70, 0, 0.6, 0],
    [0, -70, 0, 0.6, 0],
    [0, -70, 0, 0.6, 0],
  ],
  c0: [
    [0, 28, 0, 1, 1],
    [-185, 0, -7, 0.35, 0],
    [-185, 0, -7, 0.35, 0],
    [-185, 0, -7, 0.35, 0],
  ],
  c1: [
    [0, 88, 0, 1, 1],
    [0, -14, 0, 0.35, 0],
    [0, -14, 0, 0.35, 0],
    [0, -14, 0, 0.35, 0],
  ],
  c2: [
    [0, 148, 0, 1, 1],
    [185, 0, 7, 0.35, 0],
    [185, 0, 7, 0.35, 0],
    [185, 0, 7, 0.35, 0],
  ],
  p0: [[0, 40, 0, 0.45, 0], [-226, -22, -5, 0.98, 1], [-92, 24, -3, 0.8, 1], null],
  p1: [
    [0, 60, 0, 0.45, 0],
    [0, -40, 0, 1.04, 1],
    [-120, 0, -8, 0.76, 1],
    [-120, 0, -8, 0.5, 0],
  ],
  p2: [
    [0, 80, 0, 0.45, 0],
    [226, -22, 5, 0.98, 1],
    [-148, -26, -13, 0.72, 1],
    [-148, -26, -13, 0.5, 0],
  ],
  list: [
    [230, 0, 6, 0.9, 0],
    [230, 0, 6, 0.9, 0],
    [150, 0, 0, 1, 1],
    [150, 40, 0, 0.92, 0],
  ],
  cal: [
    [0, 40, 0, 0.94, 0],
    [0, 40, 0, 0.94, 0],
    [0, 40, 0, 0.94, 0],
    [0, -40, 0, 1, 1],
  ],
  plan: [
    [70, 230, 2, 0.95, 0],
    [70, 230, 2, 0.95, 0],
    [70, 230, 2, 0.95, 0],
    [80, 168, 2, 1, 1],
  ],
};
const STAGE_VH = 90;
const DWELL = 0.3;
const VIDEO_SECONDS = 10;
const CAROUSEL_MS = 2600;

const tabs = [
  { label: "Contexto", icon: Brain },
  { label: "Criação", icon: PenLine },
  { label: "Biblioteca", icon: Library },
  { label: "Planejamento", icon: CalendarDays },
];
const copy = [
  [
    "Começa com o que torna sua clínica única.",
    "Reúna público, serviços e identidade. Um ponto de partida que acompanha cada conteúdo.",
  ],
  [
    "Uma ideia. Diferentes formas de contar.",
    "Compare abordagens e ajuste a arte, as páginas e a legenda. A palavra final continua com você.",
  ],
  [
    "Seu trabalho continua de onde parou.",
    "Guarde versões, retome uma peça e crie uma cópia. O que você salvou continua disponível para comparar.",
  ],
  [
    "Dê ao mês uma visão de conjunto.",
    "Escolha a versão, a data e o canal pretendidos. Organize a próxima entrega com clareza.",
  ],
];
const contextRows = [
  { icon: Check, text: "Público · Pessoas conhecendo a clínica" },
  { icon: FileText, text: "Mensagem · Atendimento e equipe" },
  { icon: FileText, text: "Tom · Claro, próximo e informativo" },
];
const slides = [
  {
    tone: "mint",
    eyebrow: "ANTES DA PRIMEIRA CONSULTA",
    title: ["Conheça", "quem cuida", "de você."],
  },
  { tone: "teal", eyebrow: "O QUE PREPARAR", title: ["Leve seus", "exames e", "dúvidas."] },
  { tone: "sky", eyebrow: "COMO CHEGAR", title: ["Estamos", "perto de", "você."] },
];
const scenes = [
  ["1", "Boas-vindas na recepção", "5s"],
  ["2", "Quem cuida de você", "8s"],
  ["3", "Como agendar", "4s"],
];
// October 2026 starts on a Thursday (Sunday-first grid).
const days: (number | null)[] = [
  null,
  null,
  null,
  null,
  ...Array.from({ length: 31 }, (_, i) => i + 1),
];

const clamp = (n: number, a = 0, b = 1) => Math.min(b, Math.max(a, n));

export function AtlanticJourney() {
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const q = <T extends HTMLElement>(s: string) => Array.from(track.querySelectorAll<T>(s));
    const els = q("[data-k]").map((el) => ({ el, key: el.dataset["k"]! }));
    const copies = q("[data-copy]");
    const plabels = q("[data-plabel]");
    const tabEls = q<HTMLButtonElement>("[data-tab]");
    const pill = track.querySelector<HTMLElement>("[data-pill]")!;
    const fill = track.querySelector<HTMLElement>("[data-fill]")!;
    const vwrap = track.querySelector<HTMLElement>("[data-vwrap]")!;
    const vinner = track.querySelector<HTMLElement>("[data-vinner]")!;
    const cal = track.querySelector<HTMLElement>('[data-k="cal"]')!;
    const glow = track.querySelector<HTMLElement>("[data-cellglow]");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let cellPos: Frame = [0, 0, 0, 0.13, 1];
    let tabRects: [number, number][] = [];
    let cur = 0;
    let raf = 0;

    const measure = () => {
      track.style.height = `calc(100vh + ${3 * STAGE_VH}vh)`;
      const k = Math.min(
        1,
        vwrap.clientWidth / 560,
        Math.max(0.55, (window.innerHeight - 260) / 480),
      );
      vinner.style.transform = `scale(${k})`;
      vwrap.style.height = `${480 * k}px`;
      const cell = track.querySelector<HTMLElement>('[data-cell="20"]');
      if (cell) {
        let x = cell.offsetLeft + cell.offsetWidth / 2;
        let y = cell.offsetTop + cell.offsetHeight / 2;
        let n = cell.offsetParent as HTMLElement | null;
        while (n && n !== cal) {
          x += n.offsetLeft;
          y += n.offsetTop;
          n = n.offsetParent as HTMLElement | null;
        }
        const c = K["cal"]?.[3];
        if (!c) return;
        cellPos = [
          c[0] + x - cal.offsetWidth / 2 + 8,
          c[1] + y - cal.offsetHeight / 2 + 2,
          0,
          0.13,
          1,
        ];
      }
      tabRects = tabEls.map((t) => [t.offsetLeft, t.offsetWidth]);
    };

    const target = () => {
      const r = track.getBoundingClientRect();
      const range = r.height - window.innerHeight;
      return range > 0 ? clamp(-r.top / range) * 3 : 0;
    };

    const apply = (p: number) => {
      const seg = Math.min(2, Math.floor(p));
      const lin = clamp((p - seg - DWELL / 2) / (1 - DWELL));
      const e = lin * lin * (3 - 2 * lin);
      const pe = seg + e;
      const frame = (key: string, i: number) => (key === "p0" && i === 3 ? cellPos : K[key]![i]!);
      for (const { el, key } of els) {
        if (!K[key]) continue;
        const a = frame(key, seg);
        const b = frame(key, seg + 1);
        const v = a.map((n, j) => n + (b[j]! - n) * e);
        el.style.transform = `translate(-50%,-50%) translate(${v[0]}px,${v[1]}px) rotate(${v[2]}deg) scale(${v[3]})`;
        el.style.opacity = String(v[4]);
        el.style.pointerEvents = v[4]! < 0.1 ? "none" : "";
      }
      copies.forEach((el, i) => {
        const d = pe - i;
        el.style.opacity = String(Math.max(0, 1 - Math.abs(d) * 2.4));
        el.style.transform = `translateY(${-d * 28}px)`;
        el.setAttribute("aria-hidden", Math.round(pe) === i ? "false" : "true");
      });
      const lo = String(Math.max(0, 1 - Math.abs(pe - 1) * 2.5));
      plabels.forEach((el) => (el.style.opacity = lo));
      if (glow) glow.style.opacity = String(clamp((pe - 2.7) / 0.3));
      if (tabRects.length === 4) {
        const i0 = Math.min(2, Math.floor(pe));
        const f = pe - i0;
        const A = tabRects[i0]!;
        const B = tabRects[i0 + 1]!;
        pill.style.transform = `translateX(${A[0] + (B[0] - A[0]) * f}px)`;
        pill.style.width = `${A[1] + (B[1] - A[1]) * f}px`;
      }
      const active = Math.round(pe);
      tabEls.forEach((el, i) => el.setAttribute("aria-selected", i === active ? "true" : "false"));
      fill.style.width = `${(pe / 3) * 100}%`;
    };

    const tick = () => {
      const t = target();
      cur = reduced ? t : cur + (t - cur) * 0.12;
      if (Math.abs(t - cur) < 0.0004) cur = t;
      apply(cur);
      raf = cur === t ? 0 : requestAnimationFrame(tick);
    };
    const wake = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const onResize = () => {
      measure();
      wake();
    };

    measure();
    apply(target());
    cur = target();
    document.fonts?.ready.then(onResize);
    window.addEventListener("scroll", wake, { passive: true });
    window.addEventListener("resize", onResize);

    const goTo = (i: number) => {
      const range = track.offsetHeight - window.innerHeight;
      const top = track.getBoundingClientRect().top + window.scrollY + (i / 3) * range;
      window.scrollTo({ top, behavior: reduced ? "auto" : "smooth" });
    };
    const tabHandlers = tabEls.map((el, i) => {
      const h = () => goTo(i);
      el.addEventListener("click", h);
      return () => el.removeEventListener("click", h);
    });

    // Video: muted, first 10 seconds on repeat.
    const video = track.querySelector<HTMLVideoElement>("video");
    const onTime = () => {
      if (video && video.currentTime >= VIDEO_SECONDS) {
        video.currentTime = 0;
        void video.play().catch(() => {});
      }
    };
    if (video) {
      video.muted = true;
      video.addEventListener("timeupdate", onTime);
      if (!reduced) void video.play().catch(() => {});
    }

    // Carousel card: auto-slide through 3 pages.
    const car = track.querySelector<HTMLElement>("[data-car]");
    const carBar = track.querySelector<HTMLElement>("[data-carbar]");
    const dots = q("[data-cardot]");
    let slide = 0;
    const carIv = reduced
      ? 0
      : window.setInterval(() => {
          slide = (slide + 1) % 3;
          if (car) car.style.transform = `translateX(-${slide * 33.3333}%)`;
          carBar?.setAttribute("data-on-dark", slide === 1 ? "true" : "false");
          dots.forEach((d, i) => d.setAttribute("data-active", i === slide ? "true" : "false"));
        }, CAROUSEL_MS);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", wake);
      window.removeEventListener("resize", onResize);
      tabHandlers.forEach((off) => off());
      video?.removeEventListener("timeupdate", onTime);
      if (carIv) window.clearInterval(carIv);
    };
  }, []);

  return (
    <div className="atl-journey" ref={trackRef}>
      <div className="atl-journey-sticky">
        <div className="atl-demo">
          <div
            className="atl-demo-tabs atl-journey-tabs"
            role="tablist"
            aria-label="Explore a jornada"
          >
            <span className="atl-journey-pill" data-pill aria-hidden="true" />
            {tabs.map(({ label, icon: Icon }, i) => (
              <button key={label} type="button" role="tab" data-tab={i} aria-selected={i === 0}>
                <Icon size={18} />
                <span className="atl-journey-tablabel">{label}</span>
              </button>
            ))}
            <span className="atl-journey-progress" aria-hidden="true">
              <span data-fill />
            </span>
          </div>

          <div className="atl-demo-panel atl-journey-panel">
            <div className="atl-demo-copy">
              <div className="atl-journey-copies">
                {copy.map(([title, description], i) => (
                  <div key={title} data-copy={i} style={i ? { opacity: 0 } : undefined}>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </div>
                ))}
              </div>
              <Link to="/auth" search={{ modo: "cadastro" }} className="atl-text-link">
                Começar agora
                <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
            </div>

            <div className="atl-journey-visual" data-vwrap aria-hidden="true">
              <div className="atl-journey-stage" data-vinner>
                <div className="atl-j atl-j-cal" data-k="cal">
                  <div className="atl-j-cal-head">
                    <div>
                      <span className="atl-eyebrow">OUTUBRO · PLANEJAMENTO ILUSTRATIVO</span>
                      <h4>Seu próximo conteúdo</h4>
                    </div>
                    <CalendarDays size={18} />
                  </div>
                  <div className="atl-j-cal-week">
                    {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
                      <span key={i}>{d}</span>
                    ))}
                  </div>
                  <div className="atl-j-cal-grid">
                    {days.map((d, i) =>
                      d === null ? (
                        <div key={i} className="atl-j-cal-blank" />
                      ) : (
                        <div
                          key={i}
                          className="atl-j-cal-day"
                          data-cell={d === 20 ? "20" : undefined}
                        >
                          {d === 20 && <span className="atl-j-cal-glow" data-cellglow />}
                          <span>{d}</span>
                        </div>
                      ),
                    )}
                  </div>
                </div>

                <div className="atl-j atl-j-list" data-k="list">
                  <div className="atl-j-list-head">
                    <span className="atl-eyebrow">BIBLIOTECA · EXEMPLO FICTÍCIO</span>
                    <h4>Apresentação da clínica</h4>
                  </div>
                  <div className="atl-j-list-row is-active">
                    <span className="atl-preview-mark">
                      <Check size={15} />
                    </span>
                    <span>
                      <strong>Versão 2</strong> · Texto revisado
                    </span>
                  </div>
                  <div className="atl-j-list-row">
                    <span className="atl-preview-mark">
                      <FileText size={15} />
                    </span>
                    <span>Versão 1 · Primeira proposta</span>
                  </div>
                  <div className="atl-j-list-row">
                    <span className="atl-preview-mark">
                      <Copy size={15} />
                    </span>
                    <span>Cópia · Uma nova direção</span>
                  </div>
                </div>

                <div className="atl-j atl-j-brand" data-k="brand">
                  <div className="atl-window-bar">
                    <span>
                      <NukkiaLogo compact markOnly /> Contexto
                    </span>
                    <small>CLÍNICA FICTÍCIA</small>
                  </div>
                  <div className="atl-j-brand-body">
                    <span className="atl-eyebrow">Contexto da marca</span>
                    <h4>Clínica Horizonte</h4>
                  </div>
                </div>

                {contextRows.map(({ icon: Icon, text }, i) => (
                  <div key={text} className="atl-j atl-j-row" data-k={`c${i}`}>
                    <span className="atl-preview-mark">
                      <Icon size={16} />
                    </span>
                    <span>{text}</span>
                  </div>
                ))}

                <div className="atl-j atl-j-page" data-k="p2">
                  <div className="atl-j-script">
                    <div className="atl-j-page-top">
                      <span>ROTEIRO EM CENAS</span>
                      <PenLine size={12} />
                    </div>
                    <div className="atl-j-field">
                      <span>OBJETIVO</span>
                      <span>Apresentar a equipe</span>
                    </div>
                    <div className="atl-j-field">
                      <span>TOM</span>
                      <span>Claro, próximo e informativo</span>
                    </div>
                    <div className="atl-j-scenes">
                      <span className="atl-j-field-label">CENAS</span>
                      {scenes.map(([n, title, dur], i) => (
                        <div key={n} className={i === 1 ? "atl-j-scene is-active" : "atl-j-scene"}>
                          <span>{n}</span>
                          <span>{title}</span>
                          <span>{dur}</span>
                        </div>
                      ))}
                    </div>
                    <span className="atl-j-script-cta">
                      Revisar roteiro <ArrowUpRight size={10} />
                    </span>
                  </div>
                  <div className="atl-j-plabel" data-plabel>
                    <strong>Roteiro em cenas</strong>
                    <br />
                    Prévia textual, cena por cena
                  </div>
                </div>

                <div className="atl-j atl-j-page" data-k="p1">
                  <div className="atl-j-video">
                    <video
                      src="/landing/clinica-horizonte.mp4"
                      muted
                      loop
                      playsInline
                      preload="metadata"
                    />
                    <div className="atl-j-video-overlay">
                      <div className="atl-j-page-top">
                        <span>CLÍNICA HORIZONTE</span>
                        <span className="atl-j-badge">
                          <Play size={8} />
                          0:10
                        </span>
                      </div>
                      <div className="atl-j-video-copy">
                        <strong>
                          Um dia na
                          <br />
                          Clínica Horizonte.
                        </strong>
                        <div className="atl-j-page-bottom">
                          <span>Vídeo · Exemplo fictício</span>
                          <span>Reels</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="atl-j-plabel" data-plabel>
                    <strong>Vídeo</strong>
                    <br />
                    Mostre o espaço e a equipe
                  </div>
                </div>

                <div className="atl-j atl-j-page" data-k="p0">
                  <div className="atl-j-carousel">
                    <div className="atl-j-carousel-track" data-car>
                      {slides.map((s, i) => (
                        <div key={s.eyebrow} className={`atl-j-slide is-${s.tone}`}>
                          <div className="atl-j-page-top">
                            <span>CLÍNICA HORIZONTE</span>
                            <ArrowUpRight size={14} />
                          </div>
                          {i === 0 && (
                            <div className="atl-j-arch">
                              <span />
                              <span />
                            </div>
                          )}
                          {i === 1 && <div className="atl-j-ring" />}
                          <div className="atl-j-slide-copy">
                            <span>{s.eyebrow}</span>
                            <strong>
                              {s.title.map((line, j) => (
                                <span key={j}>{line}</span>
                              ))}
                            </strong>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="atl-j-carousel-bar" data-carbar data-on-dark="false">
                      <span>Carrossel · Exemplo fictício</span>
                      <span className="atl-j-dots">
                        {slides.map((s, i) => (
                          <span
                            key={s.eyebrow}
                            data-cardot
                            data-active={i === 0 ? "true" : "false"}
                          />
                        ))}
                      </span>
                    </div>
                  </div>
                  <div className="atl-j-plabel" data-plabel>
                    <strong>Carrossel</strong>
                    <br />
                    Organize a informação em páginas.
                  </div>
                </div>

                <div className="atl-j atl-j-plan" data-k="plan">
                  <span className="atl-date">
                    <small>OUT</small>20
                  </span>
                  <div>
                    <strong>Conheça nossa equipe</strong>
                    <span>Instagram · Versão 2</span>
                  </div>
                  <CalendarDays size={17} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
