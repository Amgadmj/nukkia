import type { Dispatch, SetStateAction } from "react";
import { essentialDiagnostic, recommendChannels } from "@/lib/marketing-workspace";
import type { DemoData } from "@/lib/quick-start";

export function ChannelRecommendations({
  data,
  onData,
  onDiagnose,
}: {
  data: DemoData;
  onData: Dispatch<SetStateAction<DemoData>>;
  onDiagnose: () => void;
}) {
  const diagnostic = essentialDiagnostic(data);
  if (!diagnostic.complete)
    return (
      <section className="workspace-card workspace-channel-recommendations">
        <p className="workspace-eyebrow">RECOMENDAÇÃO DE CANAIS</p>
        <h2>Primeiro, conclua o diagnóstico da marca.</h2>
        <p>
          Público, objetivo e obstáculo ajudam a Nukkia a propor onde sua presença pode começar.
        </p>
        <button type="button" className="quick-text-button" onClick={onDiagnose}>
          Continuar diagnóstico
        </button>
      </section>
    );
  const recommendations = recommendChannels(data);
  return (
    <section className="workspace-card workspace-channel-recommendations">
      <p className="workspace-eyebrow">RECOMENDAÇÃO INICIAL</p>
      <h2>Onde vale começar</h2>
      <p>
        Sugestões baseadas no seu público, objetivo e tipo de negócio. São hipóteses para você
        confirmar, não previsões de desempenho.
      </p>
      <div className="workspace-channel-grid">
        {recommendations.map((recommendation) => (
          <button
            type="button"
            key={recommendation.value}
            aria-pressed={data.strategy.channel === recommendation.value}
            onClick={() =>
              onData((current) => ({
                ...current,
                strategy: { ...current.strategy, channel: recommendation.value },
              }))
            }
          >
            <strong>{recommendation.label}</strong>
            <span>{recommendation.reason}</span>
          </button>
        ))}
      </div>
      {data.strategy.channel && (
        <p className="workspace-channel-confirmation" role="status">
          Ponto de partida confirmado. Você poderá mudar esta prioridade depois.
        </p>
      )}
    </section>
  );
}
