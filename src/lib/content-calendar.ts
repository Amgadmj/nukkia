import type { LibraryItem } from "./content-library.ts";

export function localCalendarDate(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
export function shiftCalendarDay(day: string, amount: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}
export function shiftCalendarMonth(month: string, amount: number) {
  const date = new Date(`${month}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + amount);
  return date.toISOString().slice(0, 7);
}
export function calendarDays(month: string) {
  const first = `${month}-01`;
  const offset = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, index) => shiftCalendarDay(first, index - offset));
}
export function plannedTitle(item: LibraryItem) {
  const snapshot = item.versions.find((entry) => entry.version === item.plan?.version)?.snapshot;
  if (snapshot?.kind === "generic") return snapshot.brand.creative?.copy.title || item.title;
  if (snapshot?.kind === "health")
    return (
      snapshot.draft.options.find((option) => option.id === snapshot.draft.selectedOption)?.title ||
      item.title
    );
  return item.title;
}
export function plannedForDay(items: LibraryItem[], day: string) {
  return items
    .filter((item) => !item.archived && item.plan?.date === day)
    .sort(
      (a, b) =>
        (a.plan!.time || "99:99").localeCompare(b.plan!.time || "99:99") ||
        plannedTitle(a).localeCompare(plannedTitle(b), "pt-BR"),
    );
}
