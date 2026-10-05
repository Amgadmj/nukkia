import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { authRecoveryUrl, passwordIssue } from "@/lib/auth-recovery";
export function AuthRecovery({ mode }: { mode: "recuperar" | "redefinir" | "reenviar" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<"loading" | "ready" | "invalid">("loading");
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    let active = true;
    if (mode !== "redefinir") return;
    const invalid = new URLSearchParams(window.location.hash.slice(1)).has("error");
    supabase.auth
      .getUser()
      .then(({ data, error }) => {
        if (active) setSession(!invalid && data.user && !error ? "ready" : "invalid");
      })
      .catch(() => {
        if (active) setSession("invalid");
      });
    const { data } = supabase.auth.onAuthStateChange((event, current) => {
      if (active && event === "PASSWORD_RECOVERY" && current) setSession("ready");
      if (active && event === "SIGNED_OUT") setSession("invalid");
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [mode]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (mode === "redefinir") {
      const issue = passwordIssue(password, confirmation);
      if (issue) {
        setMessage(issue);
        return;
      }
      if (session !== "ready") return;
    }
    setBusy(true);
    setMessage("");
    try {
      if (mode === "redefinir") {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setPassword("");
        setConfirmation("");
        setDone(true);
        setMessage("Senha atualizada. Você pode voltar ao seu espaço de trabalho.");
      } else {
        const result =
          mode === "recuperar"
            ? await supabase.auth.resetPasswordForEmail(email.trim(), {
                redirectTo: authRecoveryUrl(window.location.origin),
              })
            : await supabase.auth.resend({
                type: "signup",
                email: email.trim(),
                options: { emailRedirectTo: new URL("/auth", window.location.origin).href },
              });
        if (result.error) throw result.error;
        setMessage(
          "Se este e-mail puder receber o link, você receberá as instruções. Confira também o spam.",
        );
      }
    } catch {
      setMessage(
        "Não foi possível concluir. Confira sua conexão ou solicite um novo link e tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      <h2>
        {mode === "recuperar"
          ? "Recuperar acesso"
          : mode === "reenviar"
            ? "Reenviar confirmação"
            : "Definir nova senha"}
      </h2>
      {mode === "redefinir" && session !== "ready" ? (
        <p role="status">
          {session === "loading"
            ? "Verificando o link…"
            : "O link expirou, é inválido ou a sessão terminou. Solicite um novo link."}
        </p>
      ) : (
        !done && (
          <form className="space-y-4" onSubmit={submit}>
            {mode === "redefinir" ? (
              <>
                <label className="block">
                  Nova senha
                  <input
                    className="quick-input"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={72}
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </label>
                <label className="block">
                  Confirmar nova senha
                  <input
                    className="quick-input"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={72}
                    required
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                  />
                </label>
              </>
            ) : (
              <label className="block">
                E-mail
                <input
                  className="quick-input"
                  type="email"
                  autoComplete="email"
                  maxLength={255}
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
            )}
            <button className="quick-primary" disabled={busy}>
              {busy ? "Aguarde…" : mode === "redefinir" ? "Salvar nova senha" : "Enviar link"}
            </button>
          </form>
        )
      )}
      {message && <p role="status">{message}</p>}
      {mode === "redefinir" && session === "invalid" && (
        <Link to="/auth" search={{ modo: "recuperar" }} className="block underline">
          Solicitar novo link
        </Link>
      )}
      <Link to="/auth" search={{ modo: "entrar" }} className="block underline">
        Voltar para entrar
      </Link>
    </div>
  );
}
