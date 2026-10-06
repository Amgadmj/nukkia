/** Pick placeholders for the destination, never simulated content or progress. */
export function workspaceLoadingLayout(pathname: string, tab?: unknown) {
  if (pathname === "/conteudo") {
    if (tab === "planejamento" || tab === "calendario") return "calendar";
    if (tab === "biblioteca") return "dashboard";
    return "editor";
  }
  if (pathname === "/marca" || pathname === "/diagnostico" || pathname === "/conta")
    return "editor";
  if (pathname === "/trilha" || pathname === "/redes") return "list";
  return "dashboard";
}
