import { useBrandKit, useCompany, useDiagnostic } from "./company";
import { diagnosticMatchesAnswers, foundationProgress, normalizeAnswers } from "./onboarding";
import { useDraft } from "./onboarding-draft";

export function useFoundation() {
  const companyQuery = useCompany();
  const company = companyQuery.data;
  const diagnosticQuery = useDiagnostic(company?.id);
  const brandQuery = useBrandKit(company?.id);
  const draft = useDraft(company?.owner_id, company?.id);
  const diagnostic = diagnosticQuery.data;
  const brand = brandQuery.data;
  const answers = draft?.answers ?? normalizeAnswers(diagnostic?.answers);
  const ready = diagnostic?.status === "ready" && Boolean(diagnostic.report);
  const reportCurrent = ready && diagnosticMatchesAnswers(diagnostic?.answers, answers);
  const logo = Boolean(brand?.logo_url);
  const identity = brand?.selected_index != null && Boolean(brand.palette && brand.tone);
  const progress = foundationProgress({
    company: Boolean(company),
    answers,
    diagnostic: ready,
    logo,
    identity,
    pendingReportUpdate: ready && !reportCurrent,
  });
  const next = !company
    ? { to: "/painel", label: "Cadastrar minha empresa" }
    : progress.answered < progress.total || !reportCurrent
      ? { to: "/diagnostico", label: "Continuar meu diagnóstico" }
      : !logo || !identity
        ? { to: "/marca", label: "Construir minha identidade" }
        : { to: "/conteudo", label: "Criar meu plano de conteúdo" };
  return {
    company,
    diagnostic,
    brand,
    answers,
    draft,
    ready,
    reportCurrent,
    logo,
    identity,
    progress,
    next,
    loading: companyQuery.isLoading || diagnosticQuery.isLoading || brandQuery.isLoading,
    error: companyQuery.error || diagnosticQuery.error || brandQuery.error,
  };
}
