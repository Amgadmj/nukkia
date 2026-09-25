import type { ReactElement } from "react";
import { ArrowUpRight, Globe2, Instagram, Linkedin, Unplug } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ChannelReference } from "@/lib/brand-sources";

type QueryState = "loading" | "error" | "ready";
type ChannelOverviewProps = {
  company: { website: string | null; instagram_handle: string | null; linkedin_url: string | null };
  accounts: { provider: string; username: string | null; status: string }[];
  accountsState: QueryState;
  latestData: { provider: string; captured_for: string }[];
  dataState: QueryState;
  onRetry: () => void;
  action: ReactElement;
  priority?: ReactElement;
  references?: ChannelReference[];
};

// Supplied text is not an authenticated account or a trusted URL.
function publicUrl(value: string | null, provider: string): string | null {
  const text = value?.trim();
  if (!text) return null;
  if (provider === "instagram" && /^@?[a-z\d._]{1,30}$/i.test(text)) {
    return `https://www.instagram.com/${text.replace(/^@/, "")}/`;
  }
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
    if (!url.hostname.includes(".") || /\s/.test(text)) return null;
    const domain =
      provider === "instagram" ? "instagram.com" : provider === "linkedin" ? "linkedin.com" : null;
    if (domain && url.hostname !== domain && !url.hostname.endsWith(`.${domain}`)) return null;
    return url.href;
  } catch {
    return null;
  }
}

const connectionLabels: Record<string, string> = {
  connected: "Conexão registrada",
  disconnected: "Não conectado",
  pending: "Autorização pendente",
  error: "Conexão com erro",
};

export function ChannelOverview({
  company,
  accounts,
  accountsState,
  latestData,
  dataState,
  onRetry,
  action,
  priority,
  references,
}: ChannelOverviewProps) {
  const channels = [
    { provider: "website", label: "Site", value: company.website, icon: Globe2 },
    { provider: "instagram", label: "Instagram", value: company.instagram_handle, icon: Instagram },
    { provider: "linkedin", label: "LinkedIn", value: company.linkedin_url, icon: Linkedin },
  ];
  const publicChannels = references
    ? [
        ...references.map((reference) => ({
          ...reference,
          icon: channels.find((channel) => channel.provider === reference.provider)?.icon ?? Globe2,
        })),
        ...channels
          .filter(
            (channel) => !references.some((reference) => reference.provider === channel.provider),
          )
          .map((channel) => ({ ...channel, key: channel.provider, value: "", state: "informed" })),
      ]
    : channels.map((channel) => ({ ...channel, key: channel.provider, state: "informed" }));
  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="max-w-2xl">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Sua presença digital
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Canais</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Os endereços da sua marca e as permissões de acesso, cada um com seu próprio status.
          </p>
        </div>
        <Button asChild>{action}</Button>
      </header>
      {priority}
      <section aria-labelledby="public-channels">
        <h2 id="public-channels" className="text-lg font-semibold">
          Links da marca
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Referências identificadas, informadas ou confirmadas pela marca. Um link não autoriza
          publicação nem acesso às métricas.
        </p>
        <div className="mt-5 divide-y divide-border rounded-2xl border border-border bg-card/40 px-5 sm:px-6">
          {publicChannels.map(({ key, provider, label, value, state, icon: Icon }) => {
            const href = publicUrl(value, provider);
            return (
              <div key={key} className="flex flex-wrap items-center gap-4 py-6">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border">
                  <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1 basis-40">
                  <h3 className="text-sm font-medium">{label}</h3>
                  <p className="mt-1 break-all text-sm text-muted-foreground">
                    {value?.trim() || "Ainda não informado"}
                  </p>
                  {value?.trim() && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {state === "confirmed"
                        ? "Link confirmado pela marca"
                        : state === "identified"
                          ? "Link identificado · confirmar no contexto"
                          : "Link informado"}
                    </p>
                  )}
                </div>
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Abrir ${label} em nova aba`}
                    className="inline-flex min-h-10 items-center gap-2 rounded-md px-2 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Abrir link <ArrowUpRight className="size-3.5" aria-hidden="true" />
                  </a>
                ) : (
                  <Badge variant="outline">
                    {value?.trim() ? "Revisar endereço" : "Não informado"}
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      </section>
      <section aria-labelledby="account-connections" className="space-y-5">
        <div>
          <h2 id="account-connections" className="text-lg font-semibold">
            Conexões das contas
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Status salvo na Nukkia. A autorização e a validade do acesso não são verificadas nesta
            tela.
          </p>
        </div>
        {(accountsState === "error" || dataState === "error") && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4 text-sm"
          >
            <p>
              Não foi possível consultar{" "}
              {accountsState === "error" ? "as conexões" : "as datas dos dados"}.
            </p>
            <Button variant="outline" size="sm" onClick={onRetry}>
              Tentar novamente
            </Button>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {channels
            .filter((channel) => channel.provider !== "website")
            .map(({ provider, label, icon: Icon }) => {
              const account = accounts.find((entry) => entry.provider === provider);
              const period = latestData.find((entry) => entry.provider === provider)?.captured_for;
              const date = period ? new Date(`${period}T00:00:00Z`) : null;
              const validDate = date && !Number.isNaN(date.getTime()) ? date : null;
              const status =
                accountsState === "loading"
                  ? "Consultando…"
                  : accountsState === "error"
                    ? "Status indisponível"
                    : (connectionLabels[account?.status ?? "disconnected"] ??
                      "Status desconhecido");
              return (
                <article key={provider} className="rounded-2xl border border-border bg-card/40 p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="flex items-center gap-2 text-sm font-medium">
                      <Icon className="size-4" aria-hidden="true" />
                      {label}
                    </h3>
                    <Badge variant="outline">{status}</Badge>
                  </div>
                  <p className="mt-5 break-words text-sm text-muted-foreground">
                    {accountsState !== "ready"
                      ? "Aguardando confirmação dos dados da conta."
                      : account?.username
                        ? `Conta registrada: ${account.username}`
                        : "Nenhuma conta identificada neste registro."}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {dataState === "loading"
                      ? "Consultando a data dos dados…"
                      : dataState === "error"
                        ? "Data dos dados indisponível."
                        : validDate
                          ? `Último período com dados: ${validDate.toLocaleDateString("pt-BR", { timeZone: "UTC" })}.`
                          : "Nenhum período com dados registrado."}
                  </p>
                </article>
              );
            })}
        </div>
        <div className="flex gap-3 rounded-xl bg-muted/30 p-5">
          <Unplug className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="space-y-2 text-sm leading-6">
            <p className="font-medium">Conexão automática ainda indisponível</p>
            <p className="text-muted-foreground">
              A autorização de Instagram e LinkedIn ainda não está habilitada. Você pode revisar
              seus links e preparar conteúdo; por enquanto, publique diretamente em cada rede. Não
              envie senhas ou tokens.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
