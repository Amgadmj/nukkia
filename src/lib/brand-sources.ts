import type { BrandResearch, BrandPreview } from "./brand-preview.ts";

export function brandReferencesFingerprint(brand: BrandPreview) {
  return [
    ...new Set(
      groupBrandSources(brand.research, brand.extraLinks)
        .filter((x) => !brand.excludedReferences.includes(x.key))
        .map((x) => x.key),
    ),
  ]
    .sort()
    .join("|");
}

export type SourceIdentity = { key: string; url: string; label: string; kind: string };

export type ChannelReference = {
  key: string;
  provider: string;
  label: string;
  value: string;
  state: "informed" | "identified" | "confirmed";
};

// A read-only projection of the editor's references, never account authorization.
export function projectChannelReferences(data: {
  answers: { website: string; instagram: string; linkedin: string };
  brand: BrandPreview;
}): ChannelReference[] {
  const { brand, answers } = data;
  const excluded = new Set(brand.excludedReferences);
  const providerOf = (source: SourceIdentity) =>
    source.kind === "Site" ? "website" : source.kind.toLowerCase();
  const manual = brand.extraLinks.flatMap((url) => {
    const source = sourceIdentity(url);
    return source ? [source] : [];
  });
  // Edited manual profiles supersede the old answer for that channel. Include
  // excluded manual entries here so removing one cannot revive the old answer.
  const manualProviders = new Set(
    manual.filter((source) => source.kind !== "Site").map(providerOf),
  );
  const manualKeys = new Set(manual.map((source) => source.key));
  const rows = new Map<string, ChannelReference>();
  const legacy = [
    { provider: "website", label: "Site", value: answers.website || brand.referenceUrl },
    { provider: "instagram", label: "Instagram", value: answers.instagram },
    { provider: "linkedin", label: "LinkedIn", value: answers.linkedin },
  ];
  for (const row of legacy) {
    const value = row.value.trim();
    if (!value || manualProviders.has(row.provider)) continue;
    const url =
      row.provider === "instagram" && /^@?[\w.]{1,30}$/.test(value)
        ? `https://instagram.com/${value.replace(/^@/, "")}`
        : /^[a-z][a-z\d+.-]*:/i.test(value)
          ? value
          : `https://${value}`;
    const source = sourceIdentity(url.replace(/^http:/i, "https:"));
    const key = source?.key ?? `answer:${row.provider}`;
    if (!excluded.has(key)) rows.set(key, { ...row, key, value, state: "informed" });
  }
  const fingerprint = brandReferencesFingerprint(brand);
  const confirmed = Boolean(fingerprint && fingerprint === brand.referencesConfirmed);
  for (const source of groupBrandSources(brand.research, brand.extraLinks)) {
    if (!source.url || excluded.has(source.key)) continue;
    const previous = rows.get(source.key);
    rows.set(source.key, {
      key: source.key,
      provider: providerOf(source),
      label: source.kind,
      value: source.url,
      state: confirmed
        ? "confirmed"
        : previous || manualKeys.has(source.key)
          ? "informed"
          : "identified",
    });
  }
  return [...rows.values()];
}

// Display/discovery normalization only. Network requests still use the server's
// DNS-pinned public-resource collector; finding a link never authorizes a fetch.
export function sourceIdentity(raw: string): SourceIdentity | null {
  if (raw.length > 2048) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    !url.hostname.includes(".") ||
    /^[\d.]+$/.test(url.hostname) ||
    url.hostname.includes(":") ||
    /\.(local|localhost|internal|test|invalid)$/.test(url.hostname)
  )
    return null;
  let host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (/^(?:[a-z]{2}|m)\.linkedin\.com$/.test(host)) host = "linkedin.com";
  if (["m.facebook.com", "web.facebook.com"].includes(host)) host = "facebook.com";
  if (host === "twitter.com") host = "x.com";
  if (host === "threads.net") host = "threads.com";
  const path = url.pathname.replace(/\/+$/, "");
  const profiles: Record<string, { kind: string; pattern: RegExp }> = {
    "instagram.com": {
      kind: "Instagram",
      pattern:
        /^\/(?!accounts$|explore$|direct$|p$|reel$|reels$|stories$|share$|about$|legal$)[\w.]+$/i,
    },
    "linkedin.com": { kind: "LinkedIn", pattern: /^\/(company|school|in)\/[\w%-]+$/i },
    "facebook.com": {
      kind: "Facebook",
      pattern:
        /^\/(?!sharer(?:\.php)?$|share\.php$|login(?:\.php)?$|dialog$|watch$|reel$|reels$|groups$|events$|privacy$|help$|pages$|people$)[\w.-]+$/i,
    },
    "tiktok.com": { kind: "TikTok", pattern: /^\/@[\w.]+$/i },
    "youtube.com": { kind: "YouTube", pattern: /^\/(?:@[\w.-]+|(?:channel|c|user)\/[\w-]+)$/i },
    "x.com": {
      kind: "X",
      pattern: /^\/(?!intent$|share$|home$|i$|search$|login$|explore$)[\w]+$/i,
    },
    "pinterest.com": { kind: "Pinterest", pattern: /^\/(?!pin$|search$|login$)[\w]+$/i },
    "threads.com": { kind: "Threads", pattern: /^\/@[\w.]+$/i },
  };
  const profile = profiles[host];
  url.hash = "";
  if (profile) {
    url.hostname = host;
    const facebookPage =
      host === "facebook.com" ? path.match(/^\/(?:pages|people)\/([\w%.-]+)\/(\d+)$/i) : null;
    if (!facebookPage && !profile.pattern.test(path)) return null;
    const facebookNumericProfile = host === "facebook.com" && path.toLowerCase() === "/profile.php";
    const facebookId =
      facebookPage?.[2] ?? (facebookNumericProfile ? url.searchParams.get("id") : null);
    if (facebookNumericProfile && !/^\d+$/.test(facebookId ?? "")) return null;
    url.pathname = facebookNumericProfile ? "/profile.php" : path;
    url.search = facebookNumericProfile ? `?id=${facebookId}` : "";
    return {
      key: facebookId
        ? `https://facebook.com/profile.php?id=${facebookId}`
        : host === "youtube.com" && path.startsWith("/channel/")
          ? url.href
          : url.href.toLowerCase(),
      url: url.href,
      kind: profile.kind,
      label: "@" + (facebookPage?.[1] ?? facebookId ?? path.split("/").pop()!.replace(/^@/, "")),
    };
  }
  // A dedicated website has one reference. Keep its supplied hostname (including
  // www), but link to the root; original evidence URLs remain in group.pages.
  url.pathname = "/";
  url.search = "";
  return { key: host, url: url.href, label: host, kind: "Site" };
}

// A bare handle edits the existing network; an explicit URL may change it.
export function editedSourceIdentity(originalUrl: string, input: string) {
  const value = input.trim();
  if (!value || value.length > 2048) return null;
  if (/^[a-z][a-z\d+.-]*:/i.test(value)) return sourceIdentity(value);
  const original = sourceIdentity(originalUrl);
  if (!original) return null;
  if (original.kind !== "Site" && /^@?[\w.-]+$/.test(value)) {
    const url = new URL(original.url);
    const handle = value.replace(/^@/, "");
    url.search = "";
    if (original.kind === "LinkedIn") url.pathname = `/${url.pathname.split("/")[1]}/${handle}`;
    else
      url.pathname = `/${["TikTok", "YouTube", "Threads"].includes(original.kind) ? "@" : ""}${handle}`;
    return sourceIdentity(url.href);
  }
  return sourceIdentity(`https://${value}`);
}

export function mergeDiscoveredLinks(links: BrandResearch["discoveredLinks"]) {
  const seen = new Set<string>();
  return links
    .flatMap((link) => {
      const identity = sourceIdentity(link.url);
      if (!identity || !sourceIdentity(link.foundOn) || seen.has(identity.key)) return [];
      seen.add(identity.key);
      return [{ url: identity.url, foundOn: link.foundOn }];
    })
    .slice(0, 12);
}

export type SourceGroup = SourceIdentity & {
  pages: BrandResearch["sources"];
  foundOn: string[];
};

export function groupBrandSources(
  research: BrandResearch,
  extraLinks: string[] = [],
): SourceGroup[] {
  const groups = new Map<string, SourceGroup>();
  for (const source of research.sources) {
    const identity =
      source.url === "material:fornecido"
        ? { key: source.url, url: "", label: "Material fornecido", kind: "Texto" }
        : sourceIdentity(source.url);
    if (!identity) continue;
    const group = groups.get(identity.key) ?? { ...identity, pages: [], foundOn: [] };
    if (!group.pages.some((page) => page.url === source.url)) group.pages.push(source);
    groups.set(identity.key, group);
  }
  for (const link of research.discoveredLinks) {
    const identity = sourceIdentity(link.url);
    if (!identity || !sourceIdentity(link.foundOn)) continue;
    const group = groups.get(identity.key) ?? { ...identity, pages: [], foundOn: [] };
    if (!group.foundOn.includes(link.foundOn)) group.foundOn.push(link.foundOn);
    groups.set(identity.key, group);
  }
  // Manual references identify an address only; they do not supply read material
  // or a discovery origin and must never be promoted into research.sources.
  for (const link of extraLinks) {
    const identity = sourceIdentity(link);
    if (identity && !groups.has(identity.key))
      groups.set(identity.key, { ...identity, pages: [], foundOn: [] });
  }
  return [...groups.values()];
}
