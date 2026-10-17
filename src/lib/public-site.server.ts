import { Resolver, lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { load } from "cheerio";
import { suggestionSchema, type BrandResearch } from "./brand-preview.ts";
import { mergeDiscoveredLinks, sourceIdentity } from "./brand-sources.ts";
import { organizationName, visualEvidence, evidenceMarkdown } from "./clinic-evidence.ts";
import { parseWithScrapling, logoPalette, renderWithScrapling } from "./scrapling.server.ts";
import { isTrackingParameter } from "./onboarding.ts";
import { extractClinicContacts } from "./clinic-contacts.ts";

export function publicWebsiteUrl(raw: string): URL {
  const url = new URL(raw);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    isIP(url.hostname.replace(/^\[|\]$/g, "")) ||
    !url.hostname.includes(".") ||
    /\.(localhost|local|internal|test|invalid)$/i.test(url.hostname)
  ) {
    throw new Error("Use o endereço HTTPS público do site da marca.");
  }
  url.hash = "";
  return url;
}
export function isPublicIpv4(address: string): boolean {
  if (isIP(address) !== 4) return false;
  const [a = 0, b = 0, c = 0] = address.split(".").map(Number);
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113)
  );
}
const sameSite = (a: string, b: string) => a.replace(/^www\./, "") === b.replace(/^www\./, "");

// c-ares (Resolver) talks to the configured DNS servers directly and ignores the
// OS resolver. Some machines (e.g. Windows with IPv6-only or local DNS proxies)
// expose servers c-ares cannot reach, so it fails with a transport error even
// though the host resolves fine through getaddrinfo. Only these resolver
// infrastructure failures fall back; a negative answer (ENOTFOUND/ENODATA) is
// authoritative and never retried through another path.
const RESOLVER_INFRASTRUCTURE_ERRORS = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEOUT",
  "ETIMEDOUT",
  "ESERVFAIL",
  "EREFUSED",
  "EBADRESP",
  "EOF",
  "EFILE",
  "ENOTIMP",
  "ENOTINITIALIZED",
  "ELOADIPHLPAPI",
  "EADDRGETNETWORKPARAMS",
]);
export function isResolverInfrastructureError(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && RESOLVER_INFRASTRUCTURE_ERRORS.has(code);
}

// Settles with the task's result, or rejects with the abort reason as soon as the
// signal fires. `onAbort` lets cancellable work (c-ares) stop early; getaddrinfo
// cannot be cancelled, so its late result is simply ignored.
function abortable<T>(signal: AbortSignal, task: () => Promise<T>, onAbort?: () => void) {
  return new Promise<T>((resolve, reject) => {
    const abort = () => {
      onAbort?.();
      reject(signal.reason);
    };
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener("abort", abort, { once: true });
    task()
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", abort));
  });
}

// Returns every IPv4 answer for the host. The caller validates all of them and
// connects to one of these exact addresses, so no later lookup can rebind.
async function resolvePublicHost(hostname: string, signal: AbortSignal): Promise<string[]> {
  const resolver = new Resolver({ timeout: 1500, tries: 1 });
  try {
    return await abortable(
      signal,
      () => resolver.resolve4(hostname),
      () => resolver.cancel(),
    );
  } catch (error) {
    if (signal.aborted || !isResolverInfrastructureError(error)) throw error;
  }
  const answers = await abortable(signal, () => lookup(hostname, { all: true, family: 4 }));
  return answers.filter((answer) => answer.family === 4).map((answer) => answer.address);
}

// Resolve once, reject mixed private/public answers, then connect directly to that
// address with the original TLS servername/Host. No second DNS lookup/rebinding.
export async function fetchPublicResource(
  raw: string,
  options: {
    image?: boolean;
    originHost?: string;
    robots?: boolean;
    sitemap?: boolean;
    stylesheet?: boolean;
    script?: boolean;
    allowedPath?: (path: string) => boolean;
    signal: AbortSignal;
  },
) {
  let url = publicWebsiteUrl(raw);
  for (let redirect = 0; redirect <= 3; redirect++) {
    options.signal.throwIfAborted();
    if (options.originHost && !sameSite(url.hostname, options.originHost))
      throw new Error("O site redirecionou para outro domínio.");
    if (options.allowedPath && !options.allowedPath(url.pathname + url.search))
      throw new Error("O site limita a leitura automática deste conteúdo.");
    const addresses = await resolvePublicHost(url.hostname, options.signal);
    options.signal.throwIfAborted();
    if (!addresses.length || addresses.some((address) => !isPublicIpv4(address)))
      throw new Error("Este endereço não é um site público permitido.");
    const result = await new Promise<{
      status: number;
      location: string;
      mime: string;
      bytes: Buffer;
    }>((resolve, reject) => {
      const req = httpsRequest(
        {
          hostname: addresses[0]!,
          servername: url.hostname,
          port: 443,
          path: url.pathname + url.search,
          method: "GET",
          agent: false,
          signal: options.signal,
          headers: {
            Host: url.hostname,
            "User-Agent": "NukkiaBrandPreview/1.0",
            Accept: options.image
              ? "image/png,image/jpeg,image/webp"
              : options.sitemap
                ? "application/xml,text/xml,text/plain"
                : "text/html,text/plain",
            "Accept-Encoding": "identity",
          },
        },
        (res) => {
          const status = res.statusCode ?? 500;
          const mime = String(res.headers["content-type"] ?? "")
            .split(";")[0]!
            .toLowerCase();
          // RFC 9309: a robots.txt the crawler cannot get (any 4xx, including a
          // firewall's 401/403) means no rules, and a 200 that is not text is
          // a site fallback page, not rules. Neither may abort the whole reading.
          if (
            options.robots &&
            ((status >= 400 && status < 500) || (status === 200 && !/^text\//.test(mime)))
          ) {
            res.destroy();
            resolve({ status, location: "", mime, bytes: Buffer.alloc(0) });
            return;
          }
          if (status >= 300 && status < 400) {
            res.destroy();
            resolve({
              status,
              location: String(res.headers.location ?? ""),
              mime,
              bytes: Buffer.alloc(0),
            });
            return;
          }
          const expected = options.script
            ? /^(?:text|application)\/(?:javascript|x-javascript|ecmascript)$/
            : options.stylesheet
              ? /^text\/css$/
              : options.image
                ? /^image\/(png|jpeg|webp)$/
                : options.robots
                  ? /^text\//
                  : options.sitemap
                    ? /^(application\/(xml|[\w.-]+\+xml)|text\/(xml|plain))$/
                    : /^(text\/html|application\/xhtml\+xml)$/;
          if (
            status !== 200 ||
            !expected.test(mime) ||
            (res.headers["content-encoding"] && res.headers["content-encoding"] !== "identity")
          ) {
            res.destroy();
            reject(new Error("Não foi possível ler este conteúdo público."));
            return;
          }
          const maxBytes = options.robots ? 100_000 : options.image ? 600_000 : 1_000_000;
          const chunks: Buffer[] = [];
          let size = 0;
          res.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > maxBytes) {
              res.destroy(new Error("Conteúdo acima do limite de leitura."));
              return;
            }
            chunks.push(chunk);
          });
          res.on("error", reject);
          res.on("end", () =>
            resolve({ status, location: "", mime, bytes: Buffer.concat(chunks) }),
          );
        },
      );
      req.setTimeout(6000, () => req.destroy(new Error("O site demorou para responder.")));
      req.on("error", reject);
      req.end();
    });
    if (result.status >= 300 && result.status < 400) {
      url = publicWebsiteUrl(new URL(result.location, url).href);
      continue;
    }
    return { ...result, url: url.href };
  }
  throw new Error("O site redirecionou muitas vezes.");
}

export function robotsAllows(robots: string, pathname: string): boolean {
  let agents: string[] = [];
  let sawRule = false;
  const matches: { length: number; allowed: boolean }[] = [];
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.split("#")[0]!.trim();
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim().toLowerCase(),
      value = line.slice(colon + 1).trim();
    if (key === "user-agent") {
      if (sawRule) {
        agents = [];
        sawRule = false;
      }
      agents.push(value.toLowerCase());
      continue;
    }
    if (key !== "allow" && key !== "disallow") continue;
    sawRule = true;
    if (!value || !agents.some((agent) => agent === "*" || agent.includes("nukkia"))) continue;
    // Conservative wildcard handling, without evaluating arbitrary regexes:
    // block a wildcard disallow's prefix; don't broaden wildcard allows.
    const wildcard = value.indexOf("*");
    if (wildcard >= 0 && key === "allow") continue;
    const matchesPath =
      wildcard >= 0
        ? pathname.startsWith(value.slice(0, wildcard))
        : value.endsWith("$")
          ? pathname === value.slice(0, -1)
          : pathname.startsWith(value);
    if (matchesPath)
      matches.push({ length: wildcard >= 0 ? wildcard : value.length, allowed: key === "allow" });
  }
  matches.sort((a, b) => b.length - a.length || Number(b.allowed) - Number(a.allowed));
  return matches[0]?.allowed ?? true;
}

const MAX_CANDIDATES = 100;
const MAX_SITEMAPS = 4;
const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

// Query-bearing pages can be search, cart or mutation endpoints. Only known
// tracking parameters are disposable; never convert arbitrary queries to pages.
export function canonicalCrawlUrl(raw: string, base: string): string | null {
  try {
    if (raw.length > 2048) return null;
    const origin = publicWebsiteUrl(base);
    const url = publicWebsiteUrl(new URL(raw, origin).href);
    if (!sameSite(url.hostname, origin.hostname)) return null;
    for (const key of [...url.searchParams.keys()]) {
      if (isTrackingParameter(key)) url.searchParams.delete(key);
    }
    if (url.search) return null;
    url.hostname = origin.hostname;
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.href.length <= 2048 ? url.href : null;
  } catch {
    return null;
  }
}

function pagePriority(url: string): number {
  let path: string;
  try {
    path = fold(decodeURIComponent(new URL(url).pathname));
  } catch {
    return 0;
  }
  if (
    /(?:^|\/)(?:wp-admin|wp-json|admin|login|logout|sign-?in|sign-?out|account|cart|checkout|search|agenda|booking|privacy|privacidade|terms|termos)(?:[/._-]|$)/.test(
      path,
    ) ||
    /\.(?!html?$|php$)[a-z\d]{1,8}$/.test(path)
  )
    return 0;
  const priorities = [
    /servi|treatment|tratamento|especialidade|fisioterapia|condicionamento|simulador|solu[cç]|solution|capabilit|capacidade/,
    /product|produto|producto|catalog|portfolio|ecossistema|ecosystem|plataforma|platform|tecnologia|technology|metodo|method|como-funciona|how-it-works/,
    /offer|oferta|promo|deal/,
    /sobre|about|quem-somos|nosotros|clinica|empresa|company|historia|missao|mission/,
    /price|pricing|preco|precio|valor|plano|plan(?:s|es)?(?:\/|$)|pacote/,
    /faq|pergunta|duvida|question/,
    /contact|contato|fale-conosco/,
  ];
  const index = priorities.findIndex((pattern) => pattern.test(path));
  if (index >= 0) return priorities.length - index;
  // /index.html is the home page under another name, which is already read.
  if (/(?:^|\/)(?:index|home|inicio)(?:\.html?|\.php)?$/.test(path)) return 0;
  // Brands name their pages in their own words (e.g. /ecossistema, /nossa-visao).
  // A shallow page we have no keyword for is still worth reading, after the
  // known ones; deep paths are usually articles or listings.
  return path.split("/").filter(Boolean).length <= 2 ? 0.5 : 0;
}

export function prioritizePageLinks(
  links: string[],
  base: string,
  limit = MAX_CANDIDATES,
): string[] {
  const unique = new Set<string>();
  for (const link of links) {
    const canonical = canonicalCrawlUrl(link, base);
    if (canonical && pagePriority(canonical)) unique.add(canonical);
  }
  return [...unique]
    .sort((a, b) => pagePriority(b) - pagePriority(a))
    .slice(0, Math.max(0, Math.min(MAX_CANDIDATES, limit)));
}

export function parseSitemap(xml: string, base: string): { urls: string[]; sitemaps: string[] } {
  const result: { urls: string[]; sitemaps: string[] } = { urls: [], sitemaps: [] };
  // Do not interpret DTDs/entities or accept oversized documents in this pure
  // parser either. The network layer enforces its own byte and MIME limits.
  if (xml.length > 1_000_000 || /<!DOCTYPE|<!ENTITY/i.test(xml)) return result;
  const $ = load(xml, { xmlMode: true });
  const root = $.root().children().first();
  const kind = root.get(0)?.tagName?.split(":").pop();
  if (kind !== "urlset" && kind !== "sitemapindex") return result;
  const entries = root.children().toArray().slice(0, MAX_CANDIDATES);
  const seen = new Set<string>();
  for (const entry of entries) {
    if (entry.tagName.split(":").pop() !== (kind === "urlset" ? "url" : "sitemap")) continue;
    const location = $(entry)
      .children()
      .toArray()
      .find((el) => el.tagName.split(":").pop() === "loc");
    if (!location) continue;
    const url = canonicalCrawlUrl($(location).text().trim(), base);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    (kind === "urlset" ? result.urls : result.sitemaps).push(url);
  }
  return result;
}

export function extractPage(html: string, url: string) {
  const contacts = extractClinicContacts(html, url, new Date().toISOString());
  const $ = load(html);
  const noiseHeading =
    /^(?:testimonials?|depoimentos?(?: de clientes)?|reviews?|avaliacoes|comentarios?|comments?|(?:our |meet (?:our |the ))?team|nossa equipe|equipe|staff|cookies?|preferencias de cookies)$/;
  const serviceHeading =
    /servi|product|produto|oferta|promo|preco|price|faq|contato|contact|fisioterapia|tratamento/;
  $("section, aside, article, div, ul, ol").each((_, el) => {
    const node = $(el);
    const marker = fold([node.attr("id"), node.attr("class"), node.attr("aria-label")].join(" "));
    if (
      !/(?:^|[\s_-])(?:testimonials?|depoimentos?|reviews?|comments?|comentarios?|team|equipe|staff|cookies?)(?:$|[\s_-])/.test(
        marker,
      )
    )
      return;
    if (
      node
        .find("h1, h2, h3")
        .toArray()
        .some((heading) => serviceHeading.test(fold($(heading).text())))
    )
      return;
    node.remove();
  });
  $("h1, h2, h3").each((_, el) => {
    const heading = $(el);
    if (!noiseHeading.test(fold(heading.text().replace(/\s+/g, " ").trim()))) return;
    const parent = heading.parent();
    if (
      parent.is("section, aside, article, div") &&
      parent.find("h1, h2, h3").first().get(0) === el &&
      !parent
        .find("h1, h2, h3")
        .toArray()
        .some((node) => serviceHeading.test(fold($(node).text())))
    ) {
      parent.remove();
      return;
    }
    const level = Number(el.tagName.slice(1));
    let next = heading.next();
    while (next.length) {
      const tag = next.get(0)?.tagName ?? "";
      if (/^h[1-6]$/.test(tag) && Number(tag.slice(1)) <= level) break;
      if (next.is("section, article") || next.find("h1, h2, h3").length) break;
      const following = next.next();
      next.remove();
      next = following;
    }
    heading.remove();
  });
  const discovered: BrandResearch["discoveredLinks"] = [];
  const discover = (href: string, explicitlyAssociated = false) => {
    try {
      const target = publicWebsiteUrl(new URL(href, url).href);
      const identity = sourceIdentity(target.href);
      if (!identity || sameSite(target.hostname, new URL(url).hostname)) return;
      if (identity.kind !== "Site" || explicitlyAssociated)
        discovered.push({ url: identity.url, foundOn: url });
    } catch {
      /* Ignore malformed or non-public links. */
    }
  };
  // Capture social links before nav/footer/script removal. An ordinary outbound
  // website link may be a vendor or partner, so only rel=me / business sameAs
  // qualifies it as an associated website. These links are never crawl targets.
  $("a[href]").each((_, el) => {
    const anchor = $(el);
    discover(anchor.attr("href") ?? "", /(?:^|\s)me(?:\s|$)/i.test(anchor.attr("rel") ?? ""));
  });
  $("script[type='application/ld+json']").each((_, el) => {
    try {
      const parsed: unknown = JSON.parse($(el).text());
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of [...nodes]) {
        if (node && typeof node === "object" && Array.isArray(node["@graph"]))
          nodes.push(...node["@graph"]);
      }
      for (const node of nodes) {
        if (!node || typeof node !== "object") continue;
        const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
        if (
          !types.some(
            (type: unknown) =>
              typeof type === "string" &&
              /(?:^|\/)(Organization|Corporation|LocalBusiness|MedicalBusiness|MedicalOrganization|MedicalClinic|Dentist|Hospital|HealthClub|Store|Restaurant|ProfessionalService|EducationalOrganization)$/.test(
                type,
              ),
          )
        )
          continue;
        const links = Array.isArray(node.sameAs) ? node.sameAs : [node.sameAs];
        for (const link of links) if (typeof link === "string") discover(link, true);
      }
    } catch {
      /* Invalid metadata must not block regular page extraction. */
    }
  });
  const clean = (s: string) => s.replace(/\s+/g, " ").trim();
  const title = clean($("title").first().text()).slice(0, 200);
  let metadataName = "";
  $("script[type='application/ld+json']").each((_, el) => {
    try {
      const data = JSON.parse($(el).text());
      const nodes = Array.isArray(data) ? data : [data, ...(data?.["@graph"] ?? [])];
      const org = nodes.find(
        (node) =>
          /Organization|Hospital|MedicalClinic|LocalBusiness|DiagnosticLab/.test(
            String(node?.["@type"]),
          ) && typeof node?.name === "string",
      );
      if (org) metadataName = organizationName(org.name);
    } catch {
      /* Optional structured data. */
    }
  });
  const name =
    metadataName ||
    organizationName(clean($("meta[property='og:site_name']").attr("content") ?? "")) ||
    organizationName(title);
  const stylesheets = $("link[rel='stylesheet'][href]")
    .toArray()
    .map((el) => $(el).attr("href") ?? "")
    .slice(0, 3);
  const visual = visualEvidence(
    $("style").text() +
      "\n" +
      $("[style]")
        .toArray()
        .map((el) => $(el).attr("style"))
        .join("\n"),
    url,
  );
  const description = clean(
    $("meta[name='description']").attr("content") ??
      $("meta[property='og:description']").attr("content") ??
      "",
  );
  const logoHref =
    $("img[src][alt*='logo' i], img[src][class*='logo' i]").first().attr("src") ??
    $("img[src]")
      .toArray()
      .map((el) => $(el).attr("src") ?? "")
      .find((src) => /(?:^|\/)logo(?:[-_.\d]|$)/i.test(src)) ??
    "";
  const links = prioritizePageLinks(
    $("a[href]")
      .toArray()
      .map((el) => $(el).attr("href") ?? ""),
    url,
  );
  $("script, style, nav, footer, form, noscript, iframe, [hidden], [aria-hidden='true']").remove();
  // Template biographies are not evidence of real staff. Drop the whole
  // placeholder card when it is an inert link, otherwise only the text block.
  let placeholderRemoved = false;
  $("h1, h2, h3, p, li").each((_, el) => {
    if (!/lorem\s+ipsum/i.test($(el).text())) return;
    placeholderRemoved = true;
    const card = $(el).closest('a[href="#"]');
    if (card.length) card.remove();
    else $(el).remove();
  });
  const blocks = $(
    "h1, h2, h3, h4, h5, p, li, dt, dd, a[href*='especial'], a[href*='servi'], a[href*='tratamento'], a[href*='exame']",
  )
    .toArray()
    .map((el) => clean($(el).text()))
    .filter(Boolean);
  const text = [...new Set([name, title, description, ...blocks])]
    .filter(Boolean)
    .join("\n")
    .slice(0, 10000);
  let logo = "";
  try {
    if (logoHref) logo = publicWebsiteUrl(new URL(logoHref, url).href).href;
  } catch {
    /* optional */
  }
  return {
    title,
    name,
    text,
    contacts,
    links,
    logo,
    placeholderRemoved,
    discoveredLinks: mergeDiscoveredLinks(discovered),
    visual,
    stylesheets,
    // Same noise filtering applies to both parsers, including personal sections.
    cleanHtml: $.html(),
  };
}

export type CollectBrandSiteOptions = {
  /** Total source limit, including previous evidence. Defaults to 8, at most 16. */
  maxPages?: number;
  budgetMs?: number;
  signal?: AbortSignal;
  onProgress?: (research: BrandResearch) => void;
  previous?: BrandResearch;
};

/**
 * Turns a failed site reading into a safe message for the user and a short
 * code for the server log. Raw network errors are English and say nothing
 * useful; the collector's own messages are already Portuguese and user-safe.
 */
export function describeReadFailure(error: unknown): { code: string; message: string } {
  const code = (error as { code?: unknown } | null)?.code;
  const text = error instanceof Error ? error.message : "";
  if (code === "ENOTFOUND" || code === "ENODATA")
    return {
      code: "dns-not-found",
      message: "Não encontramos esse endereço. Confira se o site está escrito corretamente.",
    };
  if (code === "ECONNRESET" || code === "ECONNREFUSED" || code === "EPIPE")
    return {
      code: "connection-refused",
      message:
        "O site recusou a leitura automática. Cole um texto da marca abaixo ou preencha manualmente.",
    };
  if (code === "ETIMEDOUT" || code === "ABORT_ERR" || /demorou|timeout/i.test(text))
    return {
      code: "timeout",
      message: "O site demorou para responder. Tente novamente ou cole um texto da marca.",
    };
  if (/^[A-ZÀ-Ý]/.test(text) && /[áàâãéêíóôõúç]| o | a | de /.test(text) && text.length < 200)
    return { code: "site-message", message: text };
  return {
    code: typeof code === "string" ? code : "unknown",
    message:
      "Não foi possível ler este site agora. Cole um texto da marca ou preencha manualmente.",
  };
}

/** JS rendering never fetches directly: preload at most four validated same-site scripts. */
export async function renderPublicPage(
  html: string,
  url: string,
  robots: string,
  signal: AbortSignal,
) {
  if (process.env["SCRAPLING_RENDER"] !== "1") return null;
  const $ = load(html);
  if ($("h1,h2,p,li").text().trim().length >= 400 || !$("script[src]").length) return null;
  const resources: Record<string, { mime: string; body: string }> = {
    [url]: { mime: "text/html", body: Buffer.from(html).toString("base64") },
  };
  const candidates = $("script[src],link[rel='modulepreload'][href]")
    .toArray()
    .map((el) => $(el).attr("src") || $(el).attr("href") || "");
  const visited = new Set<string>();
  let bytes = Buffer.byteLength(html);
  while (candidates.length && visited.size < 4 && bytes < 2_500_000 && !signal.aborted) {
    try {
      const target = publicWebsiteUrl(new URL(candidates.shift()!, url).href);
      if (
        !sameSite(target.hostname, new URL(url).hostname) ||
        !/\.m?js$/.test(target.pathname) ||
        target.search ||
        !robotsAllows(robots, target.pathname) ||
        visited.has(target.href)
      )
        continue;
      visited.add(target.href);
      const response = await fetchPublicResource(target.href, {
        script: true,
        originHost: new URL(url).hostname,
        allowedPath: (path) => robotsAllows(robots, path),
        signal,
      });
      bytes += response.bytes.length;
      if (bytes > 2_500_000) break;
      resources[target.href] = { mime: response.mime, body: response.bytes.toString("base64") };
      for (const match of response.bytes
        .toString("utf8")
        .matchAll(/(?:from\s*|import\s*\()?["'](\.\.?\/[^"'\s]+\.m?js)["']/g))
        candidates.push(new URL(match[1]!, response.url).href);
    } catch {
      /* Missing optional script: retain static metadata. */
    }
  }
  if (Object.keys(resources).length < 2) return null;
  return renderWithScrapling(url, resources, signal);
}

export async function collectBrandSite(
  raw: string,
  options: CollectBrandSiteOptions = {},
): Promise<BrandResearch> {
  const url = publicWebsiteUrl(raw);
  if (
    /(^|\.)(instagram\.com|linkedin\.com|facebook\.com|tiktok\.com|x\.com|twitter\.com|youtube\.com|youtu\.be|pinterest\.com|threads\.(net|com))$/.test(
      url.hostname,
    )
  ) {
    throw new Error(
      "Para este perfil, cole um texto da marca abaixo ou informe o site da empresa.",
    );
  }
  const seed = canonicalCrawlUrl(url.href, url.href);
  if (!seed) throw new Error("Informe o endereço público do site sem parâmetros de consulta.");
  const maxPages = Number.isFinite(options.maxPages)
    ? Math.max(1, Math.min(16, Math.floor(options.maxPages!)))
    : 8;
  const budgetMs = Number.isFinite(options.budgetMs)
    ? Math.max(0, Math.min(2_147_483_647, Math.floor(options.budgetMs!)))
    : 10_000;
  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(), budgetMs);
  if (!budgetMs) deadline.abort();
  const signal = options.signal
    ? AbortSignal.any([deadline.signal, options.signal])
    : deadline.signal;
  const finished = new AbortController();
  const networkSignal = AbortSignal.any([signal, finished.signal]);
  const research: BrandResearch = options.previous
    ? structuredClone(options.previous)
    : {
        status: "loading",
        sources: [],
        contacts: [],
        discoveredLinks: [],
        suggestions: [],
        profile: [],
        message: "",
        logo: "",
        logoSource: "",
      };
  research.status = "loading";
  research.contacts ??= [];
  research.entryUrl = seed;
  const sourceUrls = new Set(
    research.sources.map((source) => canonicalCrawlUrl(source.url, seed) ?? source.url),
  );
  const publish = () => {
    // Each callback owns its snapshot; subsequent workers cannot mutate evidence
    // that has already been delivered, and observers cannot mutate the collector.
    try {
      options.onProgress?.(structuredClone(research));
    } catch {
      /* An observer is optional. */
    }
  };
  let placeholderRemoved = false;
  let failedPages = 0;
  try {
    signal.throwIfAborted();
    if (research.sources.length < maxPages) {
      const robots = (
        await fetchPublicResource(url.origin + "/robots.txt", {
          originHost: url.hostname,
          robots: true,
          signal,
        })
      ).bytes.toString("utf8");
      const allowedPath = (path: string) =>
        robotsAllows(robots, path) && canonicalCrawlUrl(path, seed) !== null;
      if (!allowedPath(new URL(seed).pathname))
        throw new Error(
          "O site limita a leitura automática. Cole um texto da marca para continuar.",
        );

      const pages = new Map<string, number>();
      const visited = new Set<string>();
      const enqueue = (href: string, refresh = false, priority?: number) => {
        const target = canonicalCrawlUrl(href, seed);
        if (!target || visited.has(target) || (!refresh && sourceUrls.has(target))) return;
        if (!allowedPath(new URL(target).pathname)) return;
        pages.set(target, priority ?? (refresh ? 0 : pagePriority(target)));
        if (pages.size > MAX_CANDIDATES) {
          const lowest = [...pages].sort((a, b) => a[1] - b[1]).at(0)!;
          pages.delete(lowest[0]);
        }
      };
      enqueue(seed, true, 100);
      // Prior sources hold extracted evidence, not HTML. Revisit their links only
      // after unseen priority pages; the stored source itself is never replaced.
      for (const source of research.sources) if (source.url !== seed) enqueue(source.url, true);

      const sitemapQueue: { url: string; depth: number }[] = [];
      const sitemapSeen = new Set<string>();
      const addSitemap = (rawUrl: string, depth: number) => {
        const target = canonicalCrawlUrl(rawUrl, seed);
        if (!target || sitemapSeen.has(target) || sitemapSeen.size >= MAX_SITEMAPS) return;
        if (!allowedPath(new URL(target).pathname)) return;
        sitemapSeen.add(target);
        sitemapQueue.push({ url: target, depth });
      };
      for (const line of robots.split(/\r?\n/)) {
        const match = /^\s*sitemap\s*:\s*(\S+)/i.exec(line);
        if (match && sitemapQueue.length < 2) addSitemap(match[1]!, 0);
      }
      // The conventional root also covers missing/stale robots declarations.
      addSitemap(url.origin + "/sitemap.xml", 0);
      let sitemapUrls = 0;
      let sitemapActive = false;
      let pageAttempts = 0;
      let activePages = 0;
      const active = new Set<Promise<void>>();
      const start = (work: () => Promise<void>) => {
        const job = work()
          .catch(() => {
            /* Optional page/discovery failure. */
          })
          .finally(() => active.delete(job));
        active.add(job);
      };
      const readPage = async (target: string) => {
        activePages++;
        pageAttempts++;
        visited.add(target);
        pages.delete(target);
        try {
          const response = await fetchPublicResource(target, {
            originHost: url.hostname,
            allowedPath,
            signal: networkSignal,
          });
          signal.throwIfAborted();
          const canonical = canonicalCrawlUrl(response.url, seed);
          if (!canonical) return;
          visited.add(canonical);
          pages.delete(canonical);
          const originalHtml = response.bytes.toString("utf8");
          const rendered = await renderPublicPage(
            originalHtml,
            response.url,
            robots,
            networkSignal,
          );
          const page = extractPage(rendered || originalHtml, response.url);
          research.contacts = [...research.contacts, ...page.contacts]
            .filter(
              (contact, index, all) =>
                all.findIndex(
                  (item) =>
                    item.kind === contact.kind &&
                    item.normalizedValue === contact.normalizedValue &&
                    item.sourceUrl === contact.sourceUrl,
                ) === index,
            )
            .slice(0, 30);
          const scraplingText = await parseWithScrapling(page.cleanHtml, networkSignal);
          if (scraplingText && scraplingText.length >= 100) {
            page.text = [
              ...new Set([
                page.name,
                page.title,
                ...page.text.split("\n").slice(0, 3),
                scraplingText,
              ]),
            ]
              .filter(Boolean)
              .join("\n")
              .slice(0, 10000);
          }
          if (target === seed) {
            research.visualEvidence = { ...page.visual, logoUrl: page.logo };
            for (const href of page.stylesheets) {
              try {
                const cssUrl = new URL(href, response.url);
                if (
                  !sameSite(cssUrl.hostname, url.hostname) ||
                  !robotsAllows(robots, cssUrl.pathname)
                )
                  continue;
                const css = await fetchPublicResource(cssUrl.href, {
                  originHost: url.hostname,
                  stylesheet: true,
                  signal: networkSignal,
                });
                const observed = visualEvidence(css.bytes.toString("utf8"), css.url);
                research.visualEvidence.colors = [
                  ...research.visualEvidence.colors,
                  ...observed.colors,
                ]
                  .filter(
                    (item, index, all) => all.findIndex((x) => x.value === item.value) === index,
                  )
                  .slice(0, 8);
                research.visualEvidence.fonts = [
                  ...research.visualEvidence.fonts,
                  ...observed.fonts,
                ]
                  .filter(
                    (item, index, all) => all.findIndex((x) => x.value === item.value) === index,
                  )
                  .slice(0, 4);
              } catch {
                /* Optional identity evidence cannot block text. */
              }
            }
            if (page.logo) {
              try {
                const logoUrl = new URL(page.logo);
                if (
                  sameSite(logoUrl.hostname, url.hostname) &&
                  robotsAllows(robots, logoUrl.pathname)
                ) {
                  const logo = await fetchPublicResource(page.logo, {
                    image: true,
                    originHost: url.hostname,
                    signal: networkSignal,
                  });
                  research.logo = `data:${logo.mime};base64,${logo.bytes.toString("base64")}`;
                  research.logoSource = logo.url;
                  const colors = await logoPalette(logo.bytes, networkSignal);
                  research.visualEvidence.colors = [
                    ...colors.map((value) => ({ value, sourceUrl: logo.url })),
                    ...research.visualEvidence.colors,
                  ]
                    .filter(
                      (item, index, all) => all.findIndex((x) => x.value === item.value) === index,
                    )
                    .slice(0, 8);
                }
              } catch {
                /* SVG/remote logos remain source references, not inline assets. */
              }
            }
          }
          for (const link of page.links) enqueue(link);
          placeholderRemoved ||= page.placeholderRemoved;
          const discovered = mergeDiscoveredLinks([
            ...research.discoveredLinks,
            ...page.discoveredLinks.map((link) => ({ ...link, foundOn: canonical })),
          ]);
          let changed = JSON.stringify(discovered) !== JSON.stringify(research.discoveredLinks);
          research.discoveredLinks = discovered;
          if (
            page.text.length >= 100 &&
            !sourceUrls.has(canonical) &&
            research.sources.length < maxPages
          ) {
            sourceUrls.add(canonical);
            const fetchedAt = new Date().toISOString();
            research.sources.push({
              url: canonical,
              title: page.title,
              text: page.text,
              fetchedAt,
              organizationName: page.name,
              parser: rendered
                ? "scrapling-rendered"
                : scraplingText && scraplingText.length >= 100
                  ? "scrapling"
                  : "cheerio",
            });
            if (target === seed && page.name && !options.previous) {
              research.suggestions.push(
                suggestionSchema.parse({
                  field: "name",
                  value: page.name,
                  quote: page.name,
                  sourceUrl: canonical,
                  foundAt: fetchedAt,
                }),
              );
            }
            changed = true;
          }
          if (changed) publish();
        } catch {
          if (!finished.signal.aborted) failedPages++;
        } finally {
          activePages--;
        }
      };
      const readSitemap = async (target: { url: string; depth: number }) => {
        sitemapActive = true;
        try {
          const response = await fetchPublicResource(target.url, {
            originHost: url.hostname,
            allowedPath,
            sitemap: true,
            signal: networkSignal,
          });
          signal.throwIfAborted();
          const parsed = parseSitemap(response.bytes.toString("utf8"), seed);
          const candidates = parsed.urls.slice(0, MAX_CANDIDATES - sitemapUrls);
          sitemapUrls += candidates.length;
          for (const link of prioritizePageLinks(candidates, seed)) enqueue(link);
          if (target.depth === 0) for (const child of parsed.sitemaps) addSitemap(child, 1);
        } finally {
          sitemapActive = false;
        }
      };
      while (!signal.aborted && research.sources.length < maxPages) {
        // Sitemap requests share the same three slots as pages. Serial sitemap
        // traversal makes the 100-URL budget deterministic across child files.
        if (
          !sitemapActive &&
          active.size < 3 &&
          sitemapUrls < MAX_CANDIDATES &&
          sitemapQueue.length
        ) {
          const next = sitemapQueue.shift()!;
          start(() => readSitemap(next));
        }
        while (
          active.size < 3 &&
          pageAttempts < maxPages &&
          research.sources.length + activePages < maxPages &&
          pages.size
        ) {
          const next = [...pages].sort((a, b) => b[1] - a[1])[0]![0];
          start(() => readPage(next));
        }
        if (!active.size) break;
        await Promise.race(active);
      }
      if (research.sources.length >= maxPages) finished.abort();
      // Aborted transport/DNS promises settle promptly; drain them before return
      // so callbacks cannot outlive the final snapshot.
      await Promise.all(active);
    }
    if (!research.sources.length && !signal.aborted)
      throw new Error(
        "Não encontramos texto suficiente. Cole uma apresentação da marca para continuar.",
      );
  } catch (error) {
    if (!signal.aborted && !research.sources.length) throw error;
    if (!signal.aborted) failedPages++;
  } finally {
    clearTimeout(timer);
    finished.abort();
  }
  research.status = research.sources.length ? "ready" : "unavailable";
  research.evidenceMarkdown = evidenceMarkdown(research);
  const messages = [research.message];
  if (placeholderRemoved)
    messages.push(
      "Encontramos textos de exemplo no site e os excluímos da leitura. Confirme as informações da marca antes de usar.",
    );
  if (signal.aborted || failedPages)
    messages.push("A leitura ficou parcial; preservamos as fontes disponíveis até a interrupção.");
  research.message = [...new Set(messages.filter(Boolean))].join(" ").slice(0, 500);
  // Logo evidence shares the same bounded gateway and retains provenance.
  publish();
  return research;
}
