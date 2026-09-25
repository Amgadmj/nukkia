import test from "node:test";
import assert from "node:assert/strict";
import { unzipSync, strFromU8 } from "fflate";
import { postSvg, publicationZip, wrapCopy } from "../src/lib/post-art.ts";
import { handleBrandPreview, localPreviewAllowed } from "../src/lib/brand-preview.server.ts";
const brief = {
  name: 'Marca <script>&"',
  segment: "Pilates",
  offer: "Aulas em pequenos grupos",
  audience: "Pessoas que procuram movimento",
  goal: "Atrair novos clientes",
  detail: "Turmas de até quatro pessoas.",
  action: "direct" as const,
  destination: "",
};
const copy = {
  title: "Movimento com atenção de perto",
  body: "Conheça nossas turmas de até quatro pessoas.",
  caption: "Uma aula em pequenos grupos. Envie uma mensagem para saber mais.",
};
test("visual escapes user markup and does not embed remote images", () => {
  const svg = postSvg(brief, copy, {
    accent: "#395D51",
    logo: "https://other.com/logo.svg",
    photo: "",
  });
  assert.ok(svg.includes('width="1080" height="1350"'));
  assert.ok(svg.includes("&lt;script&gt;"));
  assert.ok(!svg.includes("https://other.com"));
  assert.ok(svg.includes(copy.body));
  for (const line of wrapCopy("X".repeat(180), 48)) assert.ok(line.length <= 48);
});
test("download package contains the image bytes and reviewed caption, not a text-only promise", () => {
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const files = unzipSync(publicationZip(png, copy.caption, ["https://brand.com/"]));
  assert.deepEqual(files["publicacao.png"], png);
  assert.equal(strFromU8(files["legenda.txt"]!), copy.caption);
  assert.match(strFromU8(files["referencias.txt"]!), /https:\/\/brand.com/);
});
const request = (body: unknown, origin = "http://localhost:8081") =>
  new Request("http://localhost:8081/api/brand-preview", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
test("research endpoint is disabled outside local same-origin development", async () => {
  assert.equal(localPreviewAllowed(request({}), false), false);
  assert.equal(localPreviewAllowed(request({}, "https://attacker.com"), true), false);
  assert.equal(
    (await handleBrandPreview(request({ action: "research", url: "", material: "Olá" }), false))
      .status,
    403,
  );
});
test("manual source can be collected locally without any AI transfer or implied verification", async () => {
  const response = await handleBrandPreview(
    request({ action: "research", url: "", material: brief.detail }),
    true,
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.research.status, "ready");
  assert.equal(body.research.sources[0].text, brief.detail);
  assert.equal(body.research.sources[0].url, "material:fornecido");
  assert.deepEqual(body.research.suggestions, []);
});
test("oversized input and unsupported actions cannot start collection", async () => {
  assert.equal(
    (
      await handleBrandPreview(
        request({ action: "research", url: "", material: "A".repeat(50000) }),
        true,
      )
    ).status,
    400,
  );
  assert.equal(
    (await handleBrandPreview(request({ action: "generate", brief }), true)).status,
    400,
  );
});
