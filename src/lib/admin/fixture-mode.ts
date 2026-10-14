/**
 * Development-only sample data for the admin panel. `?fixtures=1` switches it
 * on and the choice sticks for the browser session, so navigation does not
 * lose it. `import.meta.env.DEV` is replaced by `false` in production builds,
 * which removes every branch that reads this flag.
 */
const KEY = "nukkia-admin-fixtures";

export function isFixtureMode(): boolean {
  if (!import.meta.env.DEV || typeof window === "undefined") return false;
  try {
    const param = new URLSearchParams(window.location.search).get("fixtures");
    if (param === "1") window.sessionStorage.setItem(KEY, "1");
    if (param === "0") window.sessionStorage.removeItem(KEY);
    return window.sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}
