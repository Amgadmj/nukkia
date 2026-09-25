export function welcomeDestination(hasCompany: boolean, hasReport: boolean, replay: boolean) {
  if (!hasCompany) return "company";
  if (hasReport && !replay) return "dashboard";
  return "questions";
}
