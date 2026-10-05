import type { DemoData } from "@/lib/quick-start";
export function HealthReadiness({ data }: { data: DemoData }) {
  const draft = data.healthStudio;
  const option = draft.options.find((option) => option.id === draft.selectedOption);
  return (
    <div className="workspace-page">
      <header>
        <h1>Prontidão e revisão de saúde</h1>
        <p>
          O estúdio atual prepara roteiros fictícios. Estas são as dependências para produzir e
          revisar material real no Brasil, em medicina.
        </p>
      </header>
      <section className="workspace-card">
        <h2>Rascunho atual · revisão {draft.revision}</h2>
        <p>
          {option
            ? `${option.title} · ${option.scenes.length} cenas · ${draft.duration}s`
            : "Nenhuma opção selecionada."}
        </p>
        <p>
          Sem pacote de mídia completo, sem envio para revisão e sem aprovação profissional. A
          aprovação criativa de uma imagem não libera conteúdo de saúde.
        </p>
        {option && (
          <details>
            <summary>Inspecionar o roteiro atual</summary>
            {option.scenes.map((scene) => (
              <p key={scene.id}>
                {scene.seconds}s · {scene.heading}: {scene.script}
              </p>
            ))}
          </details>
        )}
      </section>
      <div className="library-grid">
        {[
          [
            "Clínica e profissional",
            "Identidade e credenciais não verificadas. Responsável e revisor ainda não atribuídos.",
          ],
          [
            "Fontes e direitos",
            "Fontes, afirmações e licenças precisam de revisão. Links e declarações do proprietário não equivalem a liberação.",
          ],
          [
            "Imagem e voz",
            "Avatar próprio indisponível. Consentimentos separados de imagem e voz, revogação e provedor não configurados.",
          ],
          [
            "Produção e custo",
            "Nenhum trabalho de produção enviado. Renderização, reserva de orçamento, tentativas e cancelamento dependem do serviço de produção.",
          ],
          [
            "Revisão profissional",
            "Pendente de configuração do revisor e de um pacote imutável com mídia completa, texto, fontes e destino. Nenhuma decisão registrada.",
          ],
          [
            "Entrega controlada",
            "Download e publicação de saúde indisponíveis. Alterações de conteúdo ou fontes exigem nova revisão; revogação deve bloquear a entrega.",
          ],
        ].map(([title, detail]) => (
          <section className="workspace-card" key={title}>
            <h2>{title}</h2>
            <p>{detail}</p>
            <strong>Não habilitado</strong>
          </section>
        ))}
      </div>
      <p role="status">
        Solicitar ajustes, rejeitar e aprovar esta versão estarão disponíveis somente com autoridade
        de revisão no servidor. Nenhum indicador desta tela concede essa autoridade.
      </p>
    </div>
  );
}
