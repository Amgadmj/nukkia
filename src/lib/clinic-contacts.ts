import { load } from "cheerio";

export type ClinicContact = {
  kind: "phone" | "email" | "address";
  value: string;
  normalizedValue: string;
  sourceUrl: string;
  observedAt: string;
};

function safeSource(value: string): boolean {
  if (value.length > 2048 || /[\s\p{Cc}]/u.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

function text(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function normalize(kind: ClinicContact["kind"], value: string): string {
  if (kind === "email") {
    return /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/u.test(value) ? value.toLowerCase() : "";
  }
  if (kind === "phone") {
    // Keep explicit extensions distinct; never infer a country or area code.
    const match = value.match(/^([+\d\s().-]+?)(?:\s*(?:ext\.?|x|ramal|;ext=)\s*(\d+))?$/iu);
    if (!match) return "";
    const digits = (match[1] || "").replace(/\D/gu, "");
    return digits.length >= 7 && digits.length <= 15
      ? digits + (match[2] ? `x${match[2]}` : "")
      : "";
  }
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function types(value: unknown): string[] {
  return (Array.isArray(value) ? value : [value])
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.replace(/^https?:\/\/schema\.org\//u, ""));
}

const businessTypes = new Set([
  "Organization",
  "MedicalClinic",
  "Hospital",
  "LocalBusiness",
  "DiagnosticLab",
]);
const sensitiveContext =
  /patient|paciente|testimonial|depoimento|review|avaliac|person\b|prontu|health[\s_-]*(?:record|form|data)|medical[\s_-]*record|diagnos(?:is|es)|diagnostico|symptom|sintoma|\bcpf\b|\bssn\b|identity|identidade/iu;

/** Read public business contact markup without fetching or scanning arbitrary body text. */
export function extractClinicContacts(
  html: string,
  sourceUrl: string,
  observedAt: string,
): ClinicContact[] {
  if (!safeSource(sourceUrl)) return [];
  const $ = load(html);
  const contacts: ClinicContact[] = [];
  const seen = new Set<string>();
  function add(kind: ClinicContact["kind"], raw: unknown) {
    if (typeof raw !== "string" || contacts.length >= 30) return;
    const value = text(raw);
    if (!value || value.length > 500) return;
    const normalizedValue = normalize(kind, value);
    const key = `${kind}:${normalizedValue}`;
    if (!normalizedValue || seen.has(key)) return;
    seen.add(key);
    contacts.push({ kind, value, normalizedValue, sourceUrl, observedAt });
  }

  // Inspect local structural context, not the entire document's text (which
  // could otherwise suppress a legitimate footer after a patient section).
  function blocked(element: Parameters<typeof $>[0]): boolean {
    const node = $(element);
    return node
      .parents()
      .addBack()
      .toArray()
      .some((ancestor) => {
        const current = $(ancestor);
        if (
          current.is(
            "form, [role='form'], input, textarea, select, blockquote, [hidden], [aria-hidden='true'], template",
          )
        )
          return true;
        const markers = ["id", "class", "itemtype", "itemprop", "aria-label", "data-section"]
          .map((name) => current.attr(name) || "")
          .join(" ");
        const headings = current.is("body, html")
          ? ""
          : current.children("h1,h2,h3,h4,h5,h6,legend").text();
        return sensitiveContext.test(
          `${markers} ${headings}`.normalize("NFD").replace(/\p{M}/gu, ""),
        );
      });
  }

  const structuredAddress = "[itemprop~='address'], [itemprop~='streetAddress']";
  function addressText(element: Parameters<typeof $>[0]): string {
    const node = $(element);
    if (
      node
        .find("*")
        .toArray()
        .some((child) => blocked(child))
    )
      return "";
    const address = node.clone();
    address.find("script, style, form, a[href^='tel:'], a[href^='mailto:']").remove();
    address.find("br").replaceWith(" ");
    return text(node.attr("content") ?? address.text());
  }

  function publicAddressScope(element: Parameters<typeof $>[0]): boolean {
    return $(element)
      .parents()
      .addBack()
      .toArray()
      .some((ancestor) => {
        const current = $(ancestor);
        if (current.is("footer, [role='contentinfo']")) return true;
        const markers = ["id", "class", "aria-label", "data-section"]
          .map((name) => current.attr(name) || "")
          .join(" ");
        const headings = current.is("body, html")
          ? ""
          : current.children("h1,h2,h3,h4,h5,h6").text();
        return /(?:^|[\s_-])(?:contact|contacts|contato|contatos|unit|units|unidade|unidades|branch|branches|location|locations|footer|rodape)(?:$|[\s_-])/iu.test(
          `${markers} ${headings}`.normalize("NFD").replace(/\p{M}/gu, ""),
        );
      });
  }

  function readMarkupAddress(element: Parameters<typeof $>[0]) {
    const node = $(element);
    if (node.parents(`address, ${structuredAddress}`).length) return;
    if (
      node
        .find("*")
        .toArray()
        .some((child) => blocked(child))
    )
      return;
    if (node.is("address")) {
      add("address", addressText(element));
    } else if (node.is(structuredAddress)) {
      const parts = [
        "streetAddress",
        "addressLocality",
        "addressRegion",
        "postalCode",
        "addressCountry",
      ]
        .flatMap((property) =>
          node
            .find(`[itemprop~='${property}']`)
            .toArray()
            .map((part) => addressText(part)),
        )
        .filter(Boolean);
      add("address", parts.length ? parts.join(", ") : addressText(element));
    } else if (publicAddressScope(element)) {
      // Read only small address-shaped blocks, never an entire contact section.
      if (node.find(`p, div, li, address, ${structuredAddress}`).length) return;
      const value = addressText(element).replace(/^(?:endere[cç]o|address)\s*:\s*/iu, "");
      if (sensitiveContext.test(value.normalize("NFD").replace(/\p{M}/gu, ""))) return;
      if (
        /^(?:(?:rua|r\.|avenida|av\.|travessa|alameda|rodovia|pra[cç]a)\s+[^\d]{1,100}\d|\d+[a-z]?\s+[\p{L}\d .'-]{1,100}\b(?:street|st\.?|road|rd\.?|avenue|ave\.?|lane|ln\.?|drive|dr\.?)\b)/iu.test(
          value,
        )
      ) {
        add("address", value);
      }
    }
  }

  function readBusiness(data: unknown, depth = 0) {
    if (depth > 20 || contacts.length >= 30) return;
    if (Array.isArray(data)) {
      for (const item of data) readBusiness(item, depth + 1);
      return;
    }
    if (!data || typeof data !== "object") return;
    const node = data as Record<string, unknown>;
    const nodeTypes = types(node["@type"]);
    if (nodeTypes.some((type) => /Person|Patient|Review|Comment/iu.test(type))) return;
    if (nodeTypes.some((type) => businessTypes.has(type))) {
      for (const [property, kind] of [
        ["email", "email"],
        ["telephone", "phone"],
      ] as const) {
        const values = Array.isArray(node[property]) ? node[property] : [node[property]];
        for (const value of values) add(kind, value);
      }
      for (const address of Array.isArray(node["address"]) ? node["address"] : [node["address"]]) {
        if (!address || typeof address !== "object") continue;
        const postal = address as Record<string, unknown>;
        const postalTypes = types(postal["@type"]);
        if (
          !postalTypes.includes("PostalAddress") ||
          postalTypes.some((type) => /Person|Patient/iu.test(type))
        )
          continue;
        const country = postal["addressCountry"];
        const countryName =
          country && typeof country === "object"
            ? (country as Record<string, unknown>)["name"]
            : country;
        const parts = [
          postal["streetAddress"],
          postal["addressLocality"],
          postal["addressRegion"],
          postal["postalCode"],
          countryName,
        ];
        add("address", parts.filter((part): part is string => typeof part === "string").join(", "));
      }
    }
    // Only graph containers are traversed, never author/review/patient objects.
    if (node["@graph"]) readBusiness(node["@graph"], depth + 1);
  }

  $(`a[href], address, ${structuredAddress}, p, div, li, script[type='application/ld+json']`).each(
    (_, element) => {
      if (contacts.length >= 30) return;
      if (blocked(element)) return;
      const node = $(element);
      if (node.is("script")) {
        try {
          readBusiness(JSON.parse(node.text()));
        } catch {
          /* Ignore malformed publisher JSON. */
        }
      } else if (node.is(`address, ${structuredAddress}`) || !node.is("a[href]")) {
        readMarkupAddress(element);
      } else {
        const href = (node.attr("href") || "").trim();
        try {
          if (/^(mailto|tel):/iu.test(href)) {
            const scheme = href.slice(0, href.indexOf(":")).toLowerCase();
            const value = decodeURIComponent(href.slice(href.indexOf(":") + 1).split("?")[0] || "");
            if (scheme === "mailto") {
              for (const email of value.split(/[,;]/u)) add("email", email);
            } else add("phone", value);
          } else {
            const url = new URL(href, sourceUrl);
            if (
              url.protocol === "whatsapp:" &&
              url.hostname === "send" &&
              !url.username &&
              !url.password
            ) {
              add("phone", url.searchParams.get("phone"));
              return;
            }
            if (url.protocol !== "https:" || url.username || url.password) return;
            if (url.hostname === "wa.me" && /^\/\d+\/?$/u.test(url.pathname)) {
              add("phone", url.pathname.replaceAll("/", ""));
            } else if (
              ["api.whatsapp.com", "web.whatsapp.com", "www.whatsapp.com", "whatsapp.com"].includes(
                url.hostname,
              ) &&
              /^\/send\/?$/u.test(url.pathname)
            ) {
              add("phone", url.searchParams.get("phone"));
            }
          }
        } catch {
          /* Malformed URLs or percent encoding are not candidates. */
        }
      }
    },
  );
  return contacts;
}

export function reconcileClinicContacts(contacts: ClinicContact[]): {
  kind: ClinicContact["kind"];
  values: {
    value: string;
    normalizedValue: string;
    sources: { url: string; observedAt: string }[];
  }[];
  requiresReview: boolean;
}[] {
  const groups: ReturnType<typeof reconcileClinicContacts> = [];
  for (const contact of contacts) {
    if (!safeSource(contact.sourceUrl)) continue;
    const value = text(contact.value);
    if (!value || value.length > 500) continue;
    const normalizedValue = normalize(contact.kind, value);
    if (!normalizedValue) continue;
    let group = groups.find((item) => item.kind === contact.kind);
    if (!group) {
      group = { kind: contact.kind, values: [], requiresReview: false };
      groups.push(group);
    }
    let candidate = group.values.find((item) => item.normalizedValue === normalizedValue);
    if (!candidate) {
      candidate = { value, normalizedValue, sources: [] };
      group.values.push(candidate);
    }
    if (
      !candidate.sources.some(
        (source) => source.url === contact.sourceUrl && source.observedAt === contact.observedAt,
      )
    ) {
      candidate.sources.push({ url: contact.sourceUrl, observedAt: contact.observedAt });
    }
    // Multiple branches/purposes need confirmation, not a correctness verdict.
    group.requiresReview = group.values.length > 1;
  }
  return groups;
}
