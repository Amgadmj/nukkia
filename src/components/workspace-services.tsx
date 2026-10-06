import { MaterialInput } from "./material-input";
import { serviceBriefPatch } from "@/lib/service-brief";
import { useBlocker } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Plus, ArrowLeft, Check, Pencil, Archive } from "lucide-react";
import { activeWorkspaces } from "./marketing-context";
import {
  emptyService,
  putService,
  selectService,
  setServiceStatus,
  type Service,
  type ServiceCatalog,
} from "@/lib/service-catalog";
import {
  catalogLogoutKey,
  catalogScopeKey,
  readCatalog,
  resetCatalog,
  saveCatalog,
  type CatalogScope,
  type CatalogStorage,
  type CatalogSave,
} from "@/lib/service-catalog-storage";

const statusLabels = { draft: "Rascunho", confirmed: "Confirmado", archived: "Arquivado" };
const storage: CatalogStorage = {
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
  removeItem: (key) => window.localStorage.removeItem(key),
};
const issueLabels = {
  corrupt:
    "Os dados salvos neste dispositivo não puderam ser abertos. Eles foram preservados. Copie seu rascunho antes de redefinir o catálogo.",
  unavailable:
    "Não foi possível salvar neste dispositivo. Seu rascunho continua aberto; copie-o antes de sair e tente reabrir os dados.",
  conflict:
    "O catálogo mudou em outra aba. Seu rascunho foi preservado aqui. Copie-o antes de abrir a versão mais recente.",
  locked:
    "Este navegador não oferece o bloqueio necessário para salvar com segurança em várias abas. Copie seu rascunho e abra em um navegador atualizado.",
};
type ServiceBriefAction = (service: Service, revision: string) => void;
export function WorkspaceServices({
  scope,
  onApplyBrief,
}: {
  scope?: CatalogScope | undefined;
  onApplyBrief?: ServiceBriefAction | undefined;
}) {
  if (!scope)
    return (
      <div className="services-empty">
        <h2>Serviços e ofertas</h2>
        <p>
          Selecione sua empresa para organizar os serviços. Este catálogo pertence à sua conta e à
          empresa selecionada.
        </p>
      </div>
    );
  return (
    <ServiceCatalogView key={catalogScopeKey(scope)} scope={scope} onApplyBrief={onApplyBrief} />
  );
}
function ServiceCatalogView({
  scope,
  onApplyBrief,
}: {
  scope: CatalogScope;
  onApplyBrief?: ServiceBriefAction | undefined;
}) {
  const key = catalogScopeKey(scope),
    logoutKey = catalogLogoutKey(scope);
  const [snapshot, setSnapshot] = useState(() => readCatalog(storage, scope));
  const [catalog, setCatalog] = useState(snapshot.catalog);
  const [focusedId, setFocusedId] = useState<string | null>(
    snapshot.catalog.selectedId || snapshot.catalog.items[0]?.id || null,
  );
  const [edit, setEdit] = useState<Service | null>(null);
  const original = useRef("");
  const [issue, setIssue] = useState<keyof typeof issueLabels | null>(
    snapshot.issue === "revoked" ? null : snapshot.issue,
  );
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [revoked, setRevoked] = useState(snapshot.issue === "revoked");
  const revokedRef = useRef(snapshot.issue === "revoked"),
    mounted = useRef(true),
    busyRef = useRef(false);
  const baseline = useRef(snapshot);
  baseline.current = snapshot;
  const dirty = edit !== null && JSON.stringify(edit) !== original.current;
  const focused = catalog.items.find((item) => item.id === focusedId);
  useEffect(() => {
    mounted.current = true;
    const revoke = () => {
      revokedRef.current = true;
      setRevoked(true);
      setEdit(null);
    };
    const registration =
      scope.kind === "account" ? { ownerId: scope.ownerId, clear: revoke } : null;
    if (registration) activeWorkspaces.add(registration);
    function changed(event: StorageEvent) {
      if (event.key !== null && event.key !== key && event.key !== logoutKey) return;
      try {
        if (logoutKey && storage.getItem(logoutKey) !== baseline.current.logout) return revoke();
        if (storage.getItem(key) !== baseline.current.raw) {
          setIssue("conflict");
          setSaved(false);
        }
      } catch {
        setIssue("unavailable");
        setSaved(false);
      }
    }
    window.addEventListener("storage", changed);
    return () => {
      mounted.current = false;
      if (registration) activeWorkspaces.delete(registration);
      window.removeEventListener("storage", changed);
    };
  }, [key, logoutKey, scope.kind, scope.kind === "account" ? scope.ownerId : ""]);
  useBlocker({
    disabled: revoked,
    enableBeforeUnload: dirty || busy,
    shouldBlockFn: () =>
      busyRef.current || (dirty && !window.confirm("Descartar as alterações ainda não salvas?")),
  });
  function leaveEdit() {
    return !dirty || window.confirm("Descartar as alterações ainda não salvas?");
  }
  function startEdit(item?: Service) {
    if (!leaveEdit()) return;
    const next = item ? { ...item } : emptyService();
    original.current = JSON.stringify(next);
    setEdit(next);
    setError("");
    setSaved(false);
  }
  async function persist(next: ServiceCatalog, reset = false): Promise<boolean> {
    if (busyRef.current || revokedRef.current || !mounted.current) return false;
    if (!navigator.locks?.request) {
      setIssue("locked");
      return false;
    }
    busyRef.current = true;
    const expected = baseline.current;
    setBusy(true);
    setSaved(false);
    setError("");
    try {
      const result: CatalogSave | null = await navigator.locks.request(
        "nukkia-services:" + key,
        () => {
          if (revokedRef.current || !mounted.current) return null;
          return reset
            ? resetCatalog(storage, scope, expected)
            : saveCatalog(storage, scope, expected, next);
        },
      );
      if (!result || revokedRef.current || !mounted.current) return false;
      if (result.kind === "revoked") {
        revokedRef.current = true;
        setRevoked(true);
        setEdit(null);
        return false;
      }
      if (result.kind !== "saved") {
        setIssue(result.kind);
        return false;
      }
      baseline.current = result.snapshot;
      setSnapshot(result.snapshot);
      setCatalog(result.snapshot.catalog);
      setIssue(null);
      setSaved(true);
      return true;
    } catch {
      if (mounted.current) setIssue("unavailable");
      return false;
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!edit) return;
    try {
      if (await persist(putService(catalog, edit))) {
        setFocusedId(edit.id);
        setEdit(null);
      }
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Revise os campos do serviço.");
    }
  }
  function reload() {
    if (!leaveEdit()) return;
    if (logoutKey) {
      try {
        if (storage.getItem(logoutKey) !== baseline.current.logout) {
          revokedRef.current = true;
          setRevoked(true);
          setEdit(null);
          return;
        }
      } catch {
        setIssue("unavailable");
        return;
      }
    }
    const next = readCatalog(storage, scope);
    baseline.current = next;
    setSnapshot(next);
    setCatalog(next.catalog);
    setIssue(next.issue === "revoked" ? null : next.issue);
    if (next.issue === "revoked") {
      revokedRef.current = true;
      setRevoked(true);
    }
    setEdit(null);
    setFocusedId(next.catalog.selectedId || next.catalog.items[0]?.id || null);
    setSaved(false);
  }
  async function reset() {
    if (
      !window.confirm(
        "Redefinir apenas o catálogo de serviços deste dispositivo? Os dados preservados serão substituídos por um catálogo vazio.",
      )
    )
      return;
    if (await persist(catalog, true)) {
      setEdit(null);
      setFocusedId(null);
    }
  }
  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(edit || catalog, null, 2));
      setError("Rascunho copiado. Guarde-o antes de reabrir os dados.");
    } catch {
      setError("Não foi possível copiar. Selecione e copie os campos antes de sair.");
    }
  }
  if (revoked)
    return (
      <div role="alert" className="services-empty">
        <h2>Catálogo fechado</h2>
        <p>Sua sessão mudou. Entre novamente para abrir os serviços da sua empresa.</p>
      </div>
    );
  return (
    <div className="services-catalog" aria-busy={busy}>
      <div className="services-heading">
        <div>
          <h2>Serviços e ofertas</h2>
          <p>O que sua marca oferece, com informações e fontes que você pode revisar.</p>
        </div>
        <button
          className="quick-primary"
          onClick={() => startEdit()}
          disabled={busy || issue === "corrupt"}
        >
          <Plus size={16} /> Novo serviço
        </button>
      </div>
      <p className="services-local-note">
        {scope.kind === "demo"
          ? "Demonstração: catálogo fictício separado das contas."
          : "Catálogo desta empresa."}{" "}
        Salvo apenas neste navegador. A conexão com a base de dados será feita após a revisão da
        proposta.
      </p>
      {issue && (
        <div className="services-notice" role="alert">
          <p>{issueLabels[issue]}</p>
          <div className="services-actions">
            <button className="quick-secondary" onClick={copyDraft}>
              Copiar rascunho
            </button>
            <button className="quick-secondary" onClick={reload} disabled={busy}>
              Reabrir dados deste dispositivo
            </button>
            {issue === "corrupt" && (
              <button className="quick-text-button" onClick={reset} disabled={busy}>
                Redefinir catálogo
              </button>
            )}
          </div>
        </div>
      )}
      {saved && (
        <p className="services-saved" role="status">
          <Check size={16} /> Salvo neste dispositivo.
        </p>
      )}
      {error && (
        <p role="status" className="services-feedback">
          {error}
        </p>
      )}
      <div className="services-layout">
        <nav className="services-list" aria-label="Catálogo de serviços">
          {catalog.items.length === 0 ? (
            <p>Nenhum serviço salvo ainda.</p>
          ) : (
            catalog.items.map((item) => (
              <button
                key={item.id}
                aria-current={focusedId === item.id && !edit ? "true" : undefined}
                onClick={() => {
                  if (!leaveEdit()) return;
                  setFocusedId(item.id);
                  setEdit(null);
                  setError("");
                }}
              >
                <strong>{item.title}</strong>
                <span>
                  {statusLabels[item.status]}
                  {catalog.selectedId === item.id ? " · Selecionado" : ""}
                </span>
              </button>
            ))
          )}
        </nav>
        <div className="services-detail">
          {edit ? (
            <form onSubmit={submit}>
              <fieldset disabled={busy}>
                <button
                  type="button"
                  className="quick-text-button"
                  onClick={() => {
                    if (leaveEdit()) setEdit(null);
                  }}
                >
                  <ArrowLeft size={16} /> Voltar ao catálogo
                </button>
                <h3>
                  {catalog.items.some((i) => i.id === edit.id) ? "Editar serviço" : "Novo serviço"}
                </h3>
                <label>
                  Nome do serviço
                  <input
                    autoFocus
                    required
                    maxLength={120}
                    value={edit.title}
                    onChange={(e) => setEdit({ ...edit, title: e.target.value })}
                  />
                </label>
                <label>
                  Resumo
                  <textarea
                    maxLength={2000}
                    value={edit.summary}
                    onChange={(e) => setEdit({ ...edit, summary: e.target.value })}
                  />
                </label>
                <label>
                  Público
                  <input
                    maxLength={500}
                    value={edit.audience}
                    onChange={(e) => setEdit({ ...edit, audience: e.target.value })}
                  />
                </label>
                <div className="services-form-row">
                  <label>
                    Chamada administrativa
                    <input
                      placeholder="Ex.: Falar com a equipe"
                      maxLength={200}
                      value={edit.cta}
                      onChange={(e) => setEdit({ ...edit, cta: e.target.value })}
                    />
                  </label>
                  <label>
                    Válido até
                    <input
                      type="date"
                      value={edit.validUntil}
                      onChange={(e) => setEdit({ ...edit, validUntil: e.target.value })}
                    />
                  </label>
                </div>
                <label>
                  Condições
                  <textarea
                    maxLength={1000}
                    value={edit.conditions}
                    onChange={(e) => setEdit({ ...edit, conditions: e.target.value })}
                  />
                </label>
                <label className="services-checkbox">
                  <input
                    type="checkbox"
                    checked={edit.conditionsConfirmed}
                    onChange={(e) => setEdit({ ...edit, conditionsConfirmed: e.target.checked })}
                  />{" "}
                  Revisei e confirmei as condições
                </label>
                <label>
                  Fonte das informações
                  <input
                    maxLength={1000}
                    value={edit.source}
                    onChange={(e) => setEdit({ ...edit, source: e.target.value })}
                  />
                </label>
                <MaterialInput
                  key={edit.id}
                  value={edit.visualMaterial ?? null}
                  onChange={(material) => setEdit({ ...edit, visualMaterial: material })}
                />
                <label>
                  Material autorizado
                  <textarea
                    placeholder="Condições de uso ou referência complementar."
                    maxLength={1000}
                    value={edit.material}
                    onChange={(e) => setEdit({ ...edit, material: e.target.value })}
                  />
                </label>
                <label>
                  Estado
                  <select
                    aria-label="Estado"
                    value={edit.status}
                    onChange={(e) =>
                      setEdit({ ...edit, status: e.target.value as Service["status"] })
                    }
                  >
                    <option value="draft">Rascunho</option>
                    <option value="confirmed">Confirmado</option>
                    {edit.status === "archived" && <option value="archived">Arquivado</option>}
                  </select>
                </label>
                <p className="services-local-note">
                  As alterações só são guardadas ao salvar. Condições pendentes continuam
                  sinalizadas, mesmo em um serviço confirmado.
                </p>
                <button className="quick-primary" type="submit" disabled={busy || !!issue}>
                  Salvar serviço
                </button>
              </fieldset>
            </form>
          ) : focused ? (
            <>
              <div className="services-detail-heading">
                <h3>{focused.title}</h3>
                <span className={`services-state services-state-${focused.status}`}>
                  {statusLabels[focused.status]}
                </span>
              </div>
              {focused.visualMaterial && (
                <figure className="material-current">
                  <img src={focused.visualMaterial.image} alt={focused.visualMaterial.title} />
                  <figcaption>
                    Fonte: {focused.visualMaterial.source} · permissão declarada, não verificada
                  </figcaption>
                </figure>
              )}
              <dl>
                {[
                  ["Resumo", focused.summary],
                  ["Público", focused.audience],
                  ["Chamada administrativa", focused.cta],
                  ["Validade", focused.validUntil],
                  ["Condições", focused.conditions],
                  ["Fonte", focused.source],
                  ["Material autorizado", focused.material],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value || "Não informado"}</dd>
                  </div>
                ))}
              </dl>
              <p className={focused.conditionsConfirmed ? "services-saved" : "services-pending"}>
                {focused.conditionsConfirmed
                  ? "Condições confirmadas pela equipe."
                  : "Condições ainda não confirmadas."}
              </p>
              {onApplyBrief && (
                <button
                  className="quick-primary"
                  disabled={busy || !!issue || revoked}
                  onClick={() => {
                    try {
                      const current = readCatalog(storage, scope);
                      if (current.issue || current.raw !== baseline.current.raw) {
                        setIssue("conflict");
                        return;
                      }
                      const now = new Date();
                      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
                      if (!serviceBriefPatch(focused, today)) {
                        setError(
                          "Confirme o serviço, as condições e a vigência. Resumo e condições juntos precisam caber em 600 caracteres.",
                        );
                        return;
                      }
                      if (
                        !window.confirm(
                          "Usar este serviço no briefing da peça? A oferta prioritária da marca e o texto já editado serão preservados. A aprovação criativa precisará ser refeita.",
                        )
                      )
                        return;
                      const latest = readCatalog(storage, scope);
                      if (
                        latest.issue ||
                        latest.raw !== baseline.current.raw ||
                        revokedRef.current
                      ) {
                        setIssue("conflict");
                        return;
                      }
                      onApplyBrief(focused, catalog.revision);
                    } catch {
                      setError(
                        "Não foi possível usar o serviço. Confira o catálogo e tente novamente.",
                      );
                    }
                  }}
                >
                  Usar este serviço no briefing
                </button>
              )}
              <div className="services-actions">
                <button
                  className="quick-secondary"
                  onClick={() => startEdit(focused)}
                  disabled={busy}
                >
                  <Pencil size={15} /> Editar serviço
                </button>
                <button
                  className="quick-text-button"
                  disabled={busy || !!issue}
                  onClick={async () => {
                    if (
                      focused.status !== "archived" &&
                      !window.confirm("Arquivar este serviço? Ele ficará fora da seleção ativa.")
                    )
                      return;
                    await persist(
                      setServiceStatus(
                        catalog,
                        focused.id,
                        focused.status === "archived" ? "draft" : "archived",
                      ),
                    );
                  }}
                >
                  <Archive size={15} />{" "}
                  {focused.status === "archived" ? "Restaurar como rascunho" : "Arquivar serviço"}
                </button>
              </div>
              {focused.status !== "archived" && (
                <div className="services-selection">
                  <button
                    className="quick-secondary"
                    disabled={busy || !!issue}
                    onClick={() =>
                      void persist(
                        selectService(
                          catalog,
                          catalog.selectedId === focused.id ? null : focused.id,
                        ),
                      )
                    }
                  >
                    {catalog.selectedId === focused.id ? "Remover seleção" : "Selecionar serviço"}
                  </button>
                  <p>
                    {catalog.selectedId === focused.id ? "Selecionado neste catálogo. " : ""}A
                    seleção permanece local. Usar no briefing cria uma cópia explícita no seu
                    espaço, sem importar o catálogo inteiro.
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="services-empty">
              <h3>Comece pelo que sua marca oferece</h3>
              <p>
                Cadastre um serviço ou uma oferta para reunir descrição, público, condições e
                referências em um só lugar.
              </p>
              <button
                className="quick-secondary"
                onClick={() => startEdit()}
                disabled={busy || !!issue}
              >
                Criar primeiro serviço
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
