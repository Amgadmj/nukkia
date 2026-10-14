import { NukkiaLogo } from "@/components/nukkia-logo";

// Every figure below is a published survey result. Keep value, wording and source in
// sync with the linked report; never add a number here that has no source.
const TIC_URL =
  "https://cetic.br/media/docs/publicacoes/2/pt-br/20260831091252/TIC_EMPRESAS_2025_PT_RE.pdf";
const SEBRAE_URL =
  "https://agenciasebrae.com.br/dados/pequenos-negocios-ampliam-presenca-digital-para-conquistar-clientes";

const stats = [
  {
    value: "79%",
    label: "das empresas brasileiras usam WhatsApp ou Telegram.",
    source: "TIC Empresas 2025",
    href: TIC_URL,
  },
  {
    value: "53%",
    label: "têm site. Muitas concentram a presença nas redes sociais.",
    source: "TIC Empresas 2025",
    href: TIC_URL,
  },
  {
    value: "68%",
    label: "venderam pela internet em 2025. Dessas, 79% usaram WhatsApp ou Telegram.",
    source: "TIC Empresas 2025",
    href: TIC_URL,
  },
  {
    value: "74%",
    label: "dos pequenos negócios citam o WhatsApp como principal ferramenta de vendas digitais.",
    source: "Sebrae, 2022 · 6.345 donos ouvidos",
    href: SEBRAE_URL,
  },
];

// Illustrative activity (reviewed pieces per week), not a business result.
const weeks = ["Semana 1", "Semana 2", "Semana 3", "Semana 4"];
const points: [number, number][] = [
  [60, 186],
  [200, 150],
  [340, 108],
  [500, 62],
];

export function AtlanticProof() {
  const line = points.map(([x, y]) => `${x},${y}`).join(" ");
  const area = `${points[0]![0]},220 ${line} ${points[3]![0]},220`;
  const [px, py] = points[0]!;
  return (
    <>
      <section className="atl-section atl-container atl-proof" aria-labelledby="atl-proof-title">
        <div className="atl-section-heading">
          <p className="atl-eyebrow">O MERCADO BRASILEIRO, EM DADOS</p>
          <h2 id="atl-proof-title">
            O WhatsApp é onde
            <br />
            <em>o negócio brasileiro acontece.</em>
          </h2>
          <p>
            Números de pesquisas públicas sobre empresas brasileiras. São dados do mercado, não
            resultados da Nukkia.
          </p>
        </div>
        <dl className="atl-proof-grid" data-proof>
          {stats.map((s) => (
            <div key={s.label} className="atl-proof-stat">
              <dt>
                <span>{s.value}</span>
              </dt>
              <dd>
                {s.label}
                <a href={s.href} target="_blank" rel="noreferrer">
                  Fonte: {s.source}
                </a>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="atl-section atl-container atl-pulse" aria-labelledby="atl-pulse-title">
        <div className="atl-section-heading">
          <p className="atl-eyebrow">UM MÊS COM A NUKKIA</p>
          <h2 id="atl-pulse-title">
            Menos recomeço.
            <br />
            <em>Mais constância.</em>
          </h2>
          <p>Contexto salvo, peças revisadas por você e um ritmo que a equipe consegue manter.</p>
        </div>
        <div className="atl-pulse-card" role="group" aria-labelledby="atl-pulse-caption">
          <div className="atl-pulse-top">
            <strong>Peças revisadas e aprovadas por semana</strong>
            <span>Exemplo ilustrativo · dados fictícios</span>
          </div>
          <div className="atl-pulse-chart">
            <svg viewBox="0 0 560 240" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="atl-pulse-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="currentColor" stopOpacity="0.22" />
                  <stop offset="1" stopColor="currentColor" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[40, 100, 160, 220].map((y) => (
                <line key={y} x1="0" x2="560" y1={y} y2={y} className="atl-pulse-grid" />
              ))}
              <polygon points={area} fill="url(#atl-pulse-fill)" />
              <polyline points={line} className="atl-pulse-line" />
              {points.map(([x, y]) => (
                <circle key={x} cx={x} cy={y} r="4.5" className="atl-pulse-dot" />
              ))}
            </svg>
            <div
              className="atl-pulse-pin"
              style={{ left: `${(px / 560) * 100}%`, top: `${(py / 240) * 100}%` }}
            >
              <span className="atl-pulse-bubble">Começou a usar a Nukkia</span>
              <span className="atl-pulse-face">
                <NukkiaLogo compact markOnly symbolWidth={16} />
              </span>
            </div>
          </div>
          <ol className="atl-pulse-weeks">
            {weeks.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ol>
          <p id="atl-pulse-caption" className="atl-pulse-note">
            Exemplo ilustrativo para mostrar o fluxo. Não representa resultado de nenhuma clínica.
          </p>
        </div>
      </section>
    </>
  );
}
