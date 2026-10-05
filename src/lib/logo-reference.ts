export function ownedLogoPath(
  value: string | null | undefined,
  projectUrl: string,
  companyId: string,
): string | null {
  try {
    if (!value) return null;
    const url = new URL(value);
    const prefix = "/storage/v1/object/sign/brand-assets/";
    if (url.origin !== new URL(projectUrl).origin || !url.pathname.startsWith(prefix)) return null;
    const path = decodeURIComponent(url.pathname.slice(prefix.length));
    if (
      !path.startsWith(`${companyId}/`) ||
      path.split("/").some((part) => !part || part === "." || part === "..")
    )
      return null;
    return path;
  } catch {
    return null;
  }
}
