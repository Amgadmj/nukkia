export function authRecoveryUrl(origin: string) {
  return new URL("/auth?modo=redefinir", new URL(origin).origin).href;
}
export function passwordIssue(password: string, confirmation: string): string | null {
  if (password.length < 8 || password.length > 72) return "Use uma senha de 8 a 72 caracteres.";
  return password === confirmation ? null : "As senhas não coincidem.";
}
