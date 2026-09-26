import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import https from "node:https";
import dnsPromises, { Resolver } from "node:dns/promises";
import { syncBuiltinESMExports } from "node:module";
import { PassThrough } from "node:stream";
import test, { type TestContext } from "node:test";
import * as crawler from "../src/lib/public-site.server.ts";
import { researchSchema, type BrandResearch } from "../src/lib/brand-preview.ts";

const origin = "https://brand.com";
const html = (title: string, extra = "") =>
  `<title>${title}</title><h1>${title}</h1><p>Oferecemos sessões de fisioterapia e aulas de movimento com acompanhamento individual. Consulte os serviços, horários e valores da marca.</p>${extra}`;
const links = (paths: string[]) => paths.map((path) => `<a href="${path}">${path}</a>`).join("");
const xml = (paths: string[], index = false) =>
  `<${index ? "sitemapindex" : "urlset"}>${paths.map((path) => `<${index ? "sitemap" : "url"}><loc>${origin}${path}</loc></${index ? "sitemap" : "url"}>`).join("")}</${index ? "sitemapindex" : "urlset"}>`;
type Fixture = { body?: string; mime?: string; status?: number; location?: string; delay?: number };

// Stub only DNS and the socket boundary; exercise the real transport validation,
// redirect handling, extraction, scheduler, cancellation and progress callbacks.
function network(t: TestContext, fixtures: Record<string, Fixture>) {
  const requested: string[] = [];
  let active = 0;
  let peak = 0;
  t.mock.method(Resolver.prototype, "resolve4", async () => ["93.184.216.34"]);
  t.mock.method(https, "request", (options, callback) => {
    assert.equal(options.hostname, "93.184.216.34", "connections must stay DNS-pinned");
    assert.equal(options.servername, "brand.com");
    assert.equal(options.headers.Host, "brand.com");
    const path = String(options.path);
    requested.push(path);
    const fixture = fixtures[path] ?? { status: 404, mime: "text/plain" };
    const req = new EventEmitter() as EventEmitter & {
      setTimeout: () => typeof req;
      end: () => void;
      destroy: (error?: Error) => void;
    };
    let timer: ReturnType<typeof setTimeout>;
    let started = false;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (started) active--;
      clearTimeout(timer);
      options.signal.removeEventListener("abort", abort);
    };
    const abort = () => req.destroy(new Error("aborted"));
    req.destroy = (error) => {
      finish();
      if (error) req.emit("error", error);
    };
    req.setTimeout = () => req;
    req.end = () => {
      started = true;
      active++;
      peak = Math.max(peak, active);
      options.signal.addEventListener("abort", abort, { once: true });
      timer = setTimeout(() => {
        if (finished) return;
        const response = new PassThrough();
        Object.assign(response, {
          statusCode: fixture.status ?? 200,
          headers: {
            "content-type": fixture.mime ?? "text/html",
            ...(fixture.location ? { location: fixture.location } : {}),
          },
        });
        response.once("end", finish);
        response.once("close", finish);
        callback(response);
        response.end(fixture.body ?? "");
      }, fixture.delay ?? 1);
    };
    return req;
  });
  syncBuiltinESMExports();
  t.after(() => {
    t.mock.restoreAll();
    syncBuiltinESMExports();
  });
  return { requested, active: () => active, peak: () => peak };
}

test("sitemap parsing is same-site, bounded, entity-aware and separates nested indexes", () => {
  assert.equal(typeof crawler.parseSitemap, "function");
  assert.deepEqual(
    crawler.parseSitemap(
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url><loc>https://brand.com/services?utm_source=a&amp;utm_medium=b#top</loc></url>
    <url><loc><![CDATA[https://brand.com/products/]]></loc></url>
    <url><loc>https://elsewhere.com/services</loc></url>
    <url><loc>https://brand.com/checkout?buy=1</loc></url>
  </urlset>`,
      origin,
    ),
    { urls: [origin + "/services", origin + "/products"], sitemaps: [] },
  );
  assert.deepEqual(crawler.parseSitemap(xml(["/catalog.xml", "/company.xml"], true), origin), {
    urls: [],
    sitemaps: [origin + "/catalog.xml", origin + "/company.xml"],
  });
  assert.equal(
    crawler.parseSitemap(xml(Array.from({ length: 140 }, (_, i) => `/services/${i}`)), origin).urls
      .length,
    100,
  );
});

test("priority links deduplicate tracking and skip query actions, assets and utility paths", () => {
  assert.equal(typeof crawler.prioritizePageLinks, "function");
  assert.deepEqual(
    crawler.prioritizePageLinks(
      [
        "/contact",
        "/faq",
        "/prices",
        "/about",
        "/promotions",
        "/products",
        "/services/?utm_source=nav#top",
        "https://www.brand.com/services",
        "/services?add-to-cart=3",
        "/services?sort=price",
        "/services.pdf",
        "/logout/services",
        "/privacy",
        "https://facebook.com/brand",
        "http://brand.com/services",
      ],
      origin,
    ),
    ["services", "products", "promotions", "about", "prices", "faq", "contact"].map(
      (path) => `${origin}/${path}`,
    ),
  );
});

test("extraction strips bounded testimonial, comment, team and cookie sections but keeps service facts", () => {
  const page = crawler.extractPage(
    `<title>Marca</title><main>
    <section id="services"><h2>Serviços</h2><p>Nossa equipe oferece fisioterapia, aulas e planos mensais.</p></section>
    <section class="testimonials"><h2>Depoimentos</h2><div><p>Garantiu minha cura.</p></div></section>
    <div id="comments"><p>Comentário de visitante enganoso.</p></div>
    <section id="our-team"><h2>Equipe</h2><article><h3>Nome de funcionário</h3></article></section>
    <div class="cookie-consent"><p>Aceite todos os cookies.</p></div>
    <section><h2>Depoimentos de clientes</h2><p>Milagre em um dia.</p></section>
    <section><h2>Preços</h2><p>Plano de aulas custa R$ 200 por mês.</p></section>
    <h2>Equipe</h2><p>Biografia genérica</p><h2>Produtos</h2><p>Produtos de mobilidade disponíveis.</p>
  </main>`,
    origin,
  );
  assert.doesNotMatch(page.text, /cura|enganoso|funcionário|cookies|Milagre|Biografia/);
  assert.match(page.text, /Nossa equipe oferece fisioterapia/);
  assert.match(page.text, /R\$ 200/);
  assert.match(page.text, /Produtos de mobilidade/);
});

test("initial crawl reads eight prioritized pages with concurrency <=3 and immutable evidence snapshots", async (t) => {
  const paths = [
    "/contact",
    "/faq",
    "/prices",
    "/about",
    "/promotions",
    "/products",
    "/services",
    "/services/extra",
  ];
  const net = network(t, {
    "/": {
      body: html(
        "Marca",
        `<meta property="og:site_name" content="Marca">${links(paths)}<img alt="logo" src="/logo.png"><a href="https://instagram.com/marca">Instagram</a>`,
      ),
    },
    ...Object.fromEntries(paths.map((path) => [path, { body: html(path), delay: 15 }])),
  });
  const snapshots: BrandResearch[] = [];
  const result = await crawler.collectBrandSite(origin, {
    onProgress: (research) => snapshots.push(research),
  });
  assert.equal(result.sources.length, 8);
  assert.ok(result.sources.some((source) => source.url === origin + "/services/extra"));
  assert.ok(!result.sources.some((source) => source.url === origin + "/contact"));
  assert.ok(net.peak() <= 3);
  assert.ok(net.peak() >= 2, "pages should overlap instead of consuming the budget sequentially");
  assert.ok(!net.requested.includes("/logo.png"));
  assert.equal(snapshots[0]?.sources.length, 1);
  assert.deepEqual(snapshots[0]?.discoveredLinks, [
    { url: "https://instagram.com/marca", foundOn: origin + "/" },
  ]);
  assert.equal(snapshots.at(-1)?.sources.length, 8);
  assert.ok(
    snapshots.every((snapshot) => snapshot.sources.every((source) => source.text.length > 0)),
  );
  for (const snapshot of [...snapshots, result])
    assert.equal(researchSchema.safeParse(snapshot).success, true);
  assert.equal(result.suggestions[0]?.origin, "extracted");
  assert.equal(result.suggestions[0]?.foundAt, result.sources[0]?.fetchedAt);
});

test("robots-declared sitemap discovery stays one nested level and obeys path restrictions", async (t) => {
  const net = network(t, {
    "/robots.txt": {
      mime: "text/plain",
      body: "User-agent: *\nDisallow: /services/private\nSitemap: https://brand.com/index.xml\nSitemap: https://outside.com/map.xml",
    },
    "/": { body: html("Marca") },
    "/index.xml": { mime: "application/xml", body: xml(["/child.xml", "/nested.xml"], true) },
    "/child.xml": {
      mime: "text/xml",
      body: xml(["/services/public", "/services/private", "/products"]),
    },
    "/nested.xml": { mime: "application/xml", body: xml(["/too-deep.xml"], true) },
    "/services/public": { body: html("Serviço") },
    "/products": { body: html("Produtos") },
  });
  const result = await crawler.collectBrandSite(origin);
  assert.equal(result.sources.length, 3);
  assert.ok(net.requested.includes("/child.xml"));
  assert.ok(!net.requested.includes("/too-deep.xml"));
  assert.ok(!net.requested.includes("/services/private"));
});

test("the shared sitemap URL budget prevents reading past 100 candidates across children", async (t) => {
  const net = network(t, {
    "/": { body: html("Marca") },
    "/sitemap.xml": { mime: "application/xml", body: xml(["/a.xml", "/b.xml"], true) },
    "/a.xml": {
      mime: "application/xml",
      body: xml(["/products", ...Array.from({ length: 99 }, (_, i) => `/unranked-${i}`)]),
    },
    "/b.xml": { mime: "application/xml", body: xml(["/services/beyond-budget"]) },
    "/products": { body: html("Produtos") },
    "/services/beyond-budget": { body: html("Should not be collected") },
  });
  const result = await crawler.collectBrandSite(origin);
  assert.equal(result.sources.length, 2);
  assert.ok(!net.requested.includes("/services/beyond-budget"));
});

test("deadline cancels pending pages and returns evidence collected so far", async (t) => {
  // The slow pages never answer on their own (1h delay), so only the global
  // deadline can end the crawl. The budget leaves ample room for robots.txt and
  // the homepage even when the suite runs files in parallel on a loaded machine;
  // the former 60ms budget raced those two requests and sometimes lost.
  const net = network(t, {
    "/": { body: html("Marca", links(["/services", "/products"])) },
    "/services": { body: html("Lento"), delay: 3_600_000 },
    "/products": { body: html("Lento"), delay: 3_600_000 },
  });
  const started = Date.now();
  const result = await crawler.collectBrandSite(origin, { budgetMs: 1500 });
  assert.ok(Date.now() - started < 5000, "pending pages must be canceled by the deadline");
  assert.ok(net.requested.includes("/services") && net.requested.includes("/products"));
  assert.equal(result.sources.length, 1);
  assert.equal(net.active(), 0);
  assert.ok(result.message, "partial research should explain the interrupted collection");
});

test("caller abort returns already collected sources and stops issuing requests", async (t) => {
  const controller = new AbortController();
  const net = network(t, { "/": { body: html("Marca", links(["/services"])) } });
  const result = await crawler.collectBrandSite(origin, {
    signal: controller.signal,
    onProgress: (research) => {
      if (research.sources.length) controller.abort();
    },
  });
  assert.equal(result.sources.length, 1);
  assert.ok(!net.requested.includes("/services"));
});

test("a deeper pass preserves old sources, suggestions and logo while discovering new links", async (t) => {
  const previous: BrandResearch = researchSchema.parse({
    status: "ready",
    sources: [
      {
        url: origin + "/",
        title: "Original",
        text: "Texto original preservado.",
        fetchedAt: "2026-01-01",
      },
    ],
    suggestions: [{ field: "name", value: "Original", quote: "Original", sourceUrl: origin + "/" }],
    discoveredLinks: [{ url: "https://instagram.com/marca", foundOn: origin + "/" }],
    logo: "data:image/png;base64,AAAA",
    logoSource: origin + "/logo.png",
    message: "",
  });
  const saved = structuredClone(previous);
  network(t, {
    "/": { body: html("New homepage", links(["/services"])) },
    "/services": { body: html("Serviços", links(["/products"])) },
    "/products": { body: html("Produtos") },
  });
  const result = await crawler.collectBrandSite(origin, { previous, maxPages: 16 });
  assert.equal(result.sources.length, 3);
  assert.deepEqual(result.sources[0], saved.sources[0]);
  assert.deepEqual(result.suggestions, saved.suggestions);
  assert.equal(result.logo, saved.logo);
  assert.deepEqual(previous, saved);
});

test("page caps cannot exceed sixteen even when more priority links are available", async (t) => {
  const paths = Array.from({ length: 30 }, (_, i) => `/services/${i}`);
  network(t, {
    "/": { body: html("Marca", links(paths)) },
    ...Object.fromEntries(paths.map((path) => [path, { body: html(path) }])),
  });
  const result = await crawler.collectBrandSite(origin, { maxPages: 99 });
  assert.equal(result.sources.length, 16);
});

test("redirect aliases yield only one source and cannot cross hosts or bypass robots", async (t) => {
  const net = network(t, {
    "/robots.txt": { mime: "text/plain", body: "User-agent: *\nDisallow: /private" },
    "/": { body: html("Marca", links(["/services/a", "/services/b", "/products", "/about"])) },
    "/services/a": { status: 302, location: "/services/shared?utm_source=a" },
    "/services/b": { status: 302, location: "/services/shared?utm_source=b" },
    "/services/shared?utm_source=a": { body: html("Shared") },
    "/services/shared?utm_source=b": { body: html("Shared") },
    "/products": { status: 302, location: "https://other.com/services" },
    "/about": { status: 302, location: "/private" },
  });
  const result = await crawler.collectBrandSite(origin);
  assert.deepEqual(
    result.sources.map((source) => source.url),
    [origin + "/", origin + "/services/shared"],
  );
  assert.ok(!net.requested.includes("/private"));
});

test("a sparse landing page still discovers readable service pages", async (t) => {
  network(t, {
    "/": { body: links(["/services"]) },
    "/services": { body: html("Services") },
  });
  const result = await crawler.collectBrandSite(origin);
  assert.ok(result.sources.some((source) => source.url === origin + "/services"));
});

test("relative links resolve against the fetched directory, not its deduplication key", async (t) => {
  network(t, {
    "/services": { status: 301, location: "/services/" },
    "/services/": { body: html("Serviços", '<a href="prices">Preços</a>') },
    "/services/prices": { body: html("Preços") },
  });
  const result = await crawler.collectBrandSite(origin + "/services/");
  assert.deepEqual(
    result.sources.map((source) => source.url),
    [origin + "/services", origin + "/services/prices"],
  );
});

test("reaching the page cap does not wait for slow optional sitemap discovery", async (t) => {
  const net = network(t, {
    "/": { body: html("Marca") },
    "/sitemap.xml": { mime: "application/xml", body: xml(["/products"]), delay: 500 },
  });
  const started = Date.now();
  const result = await crawler.collectBrandSite(origin, { maxPages: 1, budgetMs: 1000 });
  assert.ok(Date.now() - started < 350);
  assert.equal(result.sources.length, 1);
  assert.equal(result.message, "");
  assert.equal(net.active(), 0);
});

test("DNS resolution is included in the global deadline and canceled before any connection", async (t) => {
  const net = network(t, {});
  let canceled = false;
  t.mock.method(Resolver.prototype, "resolve4", () => new Promise(() => {}));
  t.mock.method(Resolver.prototype, "cancel", () => {
    canceled = true;
  });
  const result = await crawler.collectBrandSite(origin, { budgetMs: 20 });
  assert.equal(canceled, true);
  assert.deepEqual(net.requested, []);
  assert.equal(result.status, "unavailable");
  assert.equal(result.sources.length, 0);
});

test("robots denial, mixed DNS answers, content caps and unsafe redirects still fail closed", async (t) => {
  const net = network(t, {
    "/robots.txt": { body: "User-agent: *\nDisallow: /", mime: "text/plain" },
    "/oversized": { body: "a".repeat(1_000_001) },
    "/unsafe": { status: 302, location: "http://brand.com/about" },
    "/loop": { status: 302, location: "/loop" },
  });
  await assert.rejects(crawler.collectBrandSite(origin), /limita/);
  assert.deepEqual(net.requested, ["/robots.txt"]);
  const signal = AbortSignal.timeout(1000);
  await assert.rejects(crawler.fetchPublicResource(origin + "/oversized", { signal }), /limite/);
  await assert.rejects(crawler.fetchPublicResource(origin + "/unsafe", { signal }), /HTTPS/);
  await assert.rejects(
    crawler.fetchPublicResource(origin + "/loop", { signal }),
    /redirecionou muitas/,
  );
  assert.equal(net.requested.filter((path) => path === "/loop").length, 4);
  t.mock.method(Resolver.prototype, "resolve4", async () => ["93.184.216.34", "127.0.0.1"]);
  await assert.rejects(
    crawler.fetchPublicResource(origin + "/private-dns", { signal }),
    /público permitido/,
  );
  assert.ok(!net.requested.includes("/private-dns"));
});

const dnsError = (code: string) => Object.assign(new Error(`queryA ${code} brand.com`), { code });

test("resolver infrastructure failures fall back to the OS lookup and stay DNS-pinned", async (t) => {
  for (const code of ["ECONNREFUSED", "ETIMEOUT", "ESERVFAIL", "ECONNRESET", "EREFUSED"]) {
    const net = network(t, { "/": { body: html("Marca") } });
    const lookups: unknown[] = [];
    t.mock.method(Resolver.prototype, "resolve4", async () => {
      throw dnsError(code);
    });
    t.mock.method(dnsPromises, "lookup", async (host: string, options: unknown) => {
      lookups.push([host, options]);
      return [{ address: "93.184.216.34", family: 4 }];
    });
    syncBuiltinESMExports();
    // The network helper asserts every connection targets the resolved address.
    const result = await crawler.collectBrandSite(origin);
    assert.equal(result.sources.length, 1, code);
    assert.ok(net.requested.includes("/"), code);
    assert.deepEqual(lookups[0], ["brand.com", { all: true, family: 4 }], code);
    t.mock.restoreAll();
    syncBuiltinESMExports();
  }
});

test("authoritative negative DNS answers never fall back to another resolver", async (t) => {
  for (const code of ["ENOTFOUND", "ENODATA"]) {
    const net = network(t, {});
    let lookups = 0;
    t.mock.method(Resolver.prototype, "resolve4", async () => {
      throw dnsError(code);
    });
    t.mock.method(dnsPromises, "lookup", async () => {
      lookups++;
      return [{ address: "93.184.216.34", family: 4 }];
    });
    syncBuiltinESMExports();
    await assert.rejects(
      crawler.fetchPublicResource(origin + "/", { signal: AbortSignal.timeout(1000) }),
      (error: { code?: string }) => error.code === code,
    );
    assert.equal(lookups, 0, code);
    assert.deepEqual(net.requested, [], code);
    t.mock.restoreAll();
    syncBuiltinESMExports();
  }
});

test("the lookup fallback still rejects private or mixed answers before connecting", async (t) => {
  const net = network(t, {});
  t.mock.method(Resolver.prototype, "resolve4", async () => {
    throw dnsError("ECONNREFUSED");
  });
  t.mock.method(dnsPromises, "lookup", async () => [
    { address: "93.184.216.34", family: 4 },
    { address: "10.0.0.8", family: 4 },
  ]);
  syncBuiltinESMExports();
  await assert.rejects(
    crawler.fetchPublicResource(origin + "/", { signal: AbortSignal.timeout(1000) }),
    /público permitido/,
  );
  t.mock.method(dnsPromises, "lookup", async () => []);
  syncBuiltinESMExports();
  await assert.rejects(
    crawler.fetchPublicResource(origin + "/", { signal: AbortSignal.timeout(1000) }),
    /público permitido/,
  );
  assert.deepEqual(net.requested, []);
});

test("a hanging lookup fallback is bounded by the global deadline", async (t) => {
  const net = network(t, {});
  t.mock.method(Resolver.prototype, "resolve4", async () => {
    throw dnsError("ETIMEOUT");
  });
  t.mock.method(dnsPromises, "lookup", () => new Promise(() => {}));
  syncBuiltinESMExports();
  const started = Date.now();
  const result = await crawler.collectBrandSite(origin, { budgetMs: 50 });
  assert.ok(Date.now() - started < 3000);
  assert.equal(result.status, "unavailable");
  assert.deepEqual(net.requested, []);
});

test("resolver error classification separates infrastructure failures from answers", () => {
  assert.equal(crawler.isResolverInfrastructureError(dnsError("ECONNREFUSED")), true);
  assert.equal(crawler.isResolverInfrastructureError(dnsError("ETIMEOUT")), true);
  assert.equal(crawler.isResolverInfrastructureError(dnsError("ENOTFOUND")), false);
  assert.equal(crawler.isResolverInfrastructureError(dnsError("ENODATA")), false);
  assert.equal(crawler.isResolverInfrastructureError(new Error("aborted")), false);
  assert.equal(crawler.isResolverInfrastructureError(null), false);
});
