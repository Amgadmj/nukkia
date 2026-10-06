import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { BrandOnboarding } from "./brand-onboarding";
import { BrandLoading } from "./brand-loading";
import { useMarketingWorkspace } from "./marketing-provider";
import { supabase } from "@/integrations/supabase/client";
import { useBrandResearch } from "@/lib/use-brand-research";
import { recordWorkspaceEvent, workspaceKey } from "@/lib/marketing-workspace";
import { demoSchema, type DemoData } from "@/lib/quick-start";
import { apiFetch } from "@/lib/api";

const acknowledgementSchema = z.object({
  data: demoSchema,
  revision: z.string().uuid(),
  updatedAt: z.string().datetime({ offset: true }),
});

export function AccountOnboarding({
  replay = false,
  initialStep = 0,
}: {
  replay?: boolean;
  initialStep?: number;
}) {
  const { data, setData, company, ownerId, sync, resolveConflict } = useMarketingWorkspace();
  const [step, setStep] = useState(initialStep);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const created = useRef<{ ownerId: string; id: string } | null>(null);
  const lifetime = useRef<{ ownerId: string; active: boolean } | null>(null);
  const inFlight = useRef(false);
  const navigate = useNavigate();
  const queries = useQueryClient();
  const { research } = useBrandResearch(data, setData);
  useEffect(() => {
    const life = { ownerId, active: true };
    lifetime.current = life;
    inFlight.current = false;
    if (created.current?.ownerId !== ownerId) created.current = null;
    setSaving(false);
    setError("");
    // Revoke continuations immediately on auth change, before layout unmount.
    const { data: auth } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        event === "SIGNED_OUT" ||
        (event === "INITIAL_SESSION" && !session) ||
        (session && session.user.id !== ownerId)
      )
        life.active = false;
    });
    return () => {
      life.active = false;
      auth.subscription.unsubscribe();
    };
  }, [ownerId]);
  useEffect(() => {
    if (
      !lifetime.current?.active ||
      inFlight.current ||
      error ||
      sync === "loading" ||
      sync === "conflict"
    )
      return;
    if (company && data.onboarded && !replay) {
      const life = lifetime.current;
      const timer = window.setTimeout(
        () => {
          if (life?.active && lifetime.current === life)
            void navigate({ to: "/painel", replace: true });
        },
        window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 650,
      );
      return () => window.clearTimeout(timer);
    }
    // The core helper is idempotent; never dirty the seed before cloud recovery.
    setData((current) => recordWorkspaceEvent(current, "started"));
    return undefined;
  }, [company, data.onboarded, error, navigate, ownerId, replay, setData, sync]);
  async function finish(completed: DemoData) {
    const life = lifetime.current;
    if (
      !life?.active ||
      life.ownerId !== ownerId ||
      inFlight.current ||
      sync === "loading" ||
      sync === "conflict"
    )
      return;
    inFlight.current = true;
    const active = () => life.active && lifetime.current === life;
    setSaving(true);
    setError("");
    const document = { ...completed, onboarded: true };
    try {
      const values = {
        name: document.name,
        segment: document.segment,
        website: document.answers.website || null,
      };
      const target =
        company?.id || (created.current?.ownerId === ownerId ? created.current.id : null);
      const result = target
        ? await supabase
            .from("companies")
            .update(values)
            .eq("id", target)
            .eq("owner_id", ownerId)
            .select("id")
            .single()
        : await supabase
            .from("companies")
            .insert({ ...values, owner_id: ownerId, onboarding_step: "content" })
            .select("id")
            .single();
      if (!active()) return;
      if (result.error || !result.data)
        throw new Error(
          "Não foi possível salvar sua empresa. Suas respostas continuam aqui; tente novamente.",
        );
      created.current = { ownerId, id: result.data.id };
      setData(document);
      if (!company) {
        const key = workspaceKey(ownerId, result.data.id);
        const writeHandoff = (revision: string | null) => {
          try {
            window.sessionStorage.setItem(
              key,
              JSON.stringify({ data: document, revision, dirty: !revision }),
            );
            return true;
          } catch {
            return false;
          }
        };
        // Persist before the network await: a reload now finds the new company,
        // so its draft must already exist under that company's key.
        const localSaved = writeHandoff(null);
        let revision: string | null = null;
        try {
          const response = await apiFetch("/api/marketing-workspace", {
            companyId: result.data.id,
            data: document,
            expectedRevision: null,
          });
          if (!active()) return;
          if (response.ok) {
            const body: unknown = await response.json();
            if (!active()) return;
            const ack = acknowledgementSchema.safeParse(body);
            if (
              ack.success &&
              JSON.stringify(ack.data.data) === JSON.stringify(demoSchema.parse(document))
            )
              revision = ack.data.revision;
          }
        } catch {
          /* Company creation remains valid when workspace sync is unavailable. */
        }
        if (!active()) return;
        const retained = writeHandoff(revision) || localSaved;
        // Either a durable tab draft or a validated cloud acknowledgement is
        // sufficient for the provider handoff. Otherwise retain this editor.
        if (!revision && !retained) {
          throw new Error(
            "Sua empresa foi criada, mas este navegador não conseguiu guardar a peça. Mantenha esta página aberta e tente novamente.",
          );
        }
      }
      if (!active()) return;
      await queries.invalidateQueries({ queryKey: ["company"] });
      if (!active()) return;
      void navigate({ to: "/painel" });
    } catch (failure) {
      if (active())
        setError(
          failure instanceof Error
            ? failure.message
            : "Não foi possível continuar. Tente novamente.",
        );
    } finally {
      if (active()) {
        inFlight.current = false;
        setSaving(false);
      }
    }
  }
  if (sync === "loading") return <BrandLoading />;
  if (sync === "conflict")
    return (
      <div className="nukkia-workspace quick-demo">
        <section className="quick-storage-notice" aria-labelledby="workspace-version-title">
          <h1 id="workspace-version-title">Escolha qual versão continuar.</h1>
          <p>As duas versões foram preservadas.</p>
          <div className="workspace-save-actions">
            <button type="button" onClick={() => resolveConflict("cloud")}>
              Usar versão da conta
            </button>
            <button type="button" onClick={() => resolveConflict("local")}>
              Manter minha versão desta aba
            </button>
          </div>
        </section>
      </div>
    );
  if (company && data.onboarded && !replay && !saving && !error) return <BrandLoading />;
  return (
    <div className="nukkia-workspace quick-demo">
      {error && (
        <p className="quick-storage-notice" role="alert">
          {error}
        </p>
      )}
      <BrandOnboarding
        step={step}
        data={data}
        onData={setData}
        onStep={(next) =>
          next < 0
            ? company
              ? void navigate({ to: "/painel" })
              : setStep(0)
            : setStep(Math.min(next, 3))
        }
        onResearch={research}
        onComplete={(completed) => void finish(completed)}
        busy={saving}
      />
    </div>
  );
}
