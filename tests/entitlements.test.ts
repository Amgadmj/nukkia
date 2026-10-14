import test from "node:test";
import assert from "node:assert/strict";
import { buildEntitlements, formatBrl } from "../src/lib/pricing/entitlements.ts";

test("a Pro client with unused videos sees how many remain and the render cap left", () => {
  const view = buildEntitlements({
    plan: "pro",
    usage: { video_render: 3, arte: 70 },
    videoBalance: 2,
  });
  assert.equal(view.video.headline, "2 vídeos restantes");
  assert.equal(view.video.state, "ok");
  assert.equal(view.video.rendersLeft, 2);
  assert.equal(view.video.renderCap, 5);
  const images = view.meters.find((m) => m.kind === "arte")!;
  assert.deepEqual(
    [images.used, images.limit, images.remaining, images.state],
    [70, 80, 10, "low"],
  );
});

test("the last video is flagged low on Pro, and zero is empty with a way to buy", () => {
  assert.equal(
    buildEntitlements({ plan: "pro", usage: {}, videoBalance: 1 }).video.headline,
    "1 vídeo restante",
  );
  assert.equal(buildEntitlements({ plan: "pro", usage: {}, videoBalance: 1 }).video.state, "low");
  const empty = buildEntitlements({ plan: "pro", usage: {}, videoBalance: 0 }).video;
  assert.equal(empty.state, "empty");
  assert.match(empty.detail, /extra/);
});

test("Essencial and Free show video as part of Pro, unless the client bought extra videos", () => {
  for (const plan of ["free", "essencial"] as const) {
    const video = buildEntitlements({ plan, usage: {}, videoBalance: 0 }).video;
    assert.equal(video.state, "not_included");
    assert.match(video.headline, /plano Pro/);
  }
  const bought = buildEntitlements({ plan: "essencial", usage: {}, videoBalance: 1 }).video;
  assert.equal(bought.state, "ok");
  assert.equal(bought.headline, "1 vídeo restante");
  assert.match(bought.detail, /12 meses/);
});

test("meters mark exhausted and excluded allowances", () => {
  const view = buildEntitlements({
    plan: "essencial",
    usage: { carrossel: 4, video_render: 0 },
    videoBalance: 0,
  });
  assert.equal(view.meters.find((m) => m.kind === "carrossel")!.state, "empty");
  assert.equal(view.meters.find((m) => m.kind === "video_render")!.state, "not_included");
  assert.equal(view.meters.find((m) => m.kind === "video_render")!.fraction, 0);
});

test("reais are formatted the Brazilian way", () => {
  assert.equal(formatBrl(19_700).replace(/\s/g, " "), "R$ 197");
  assert.equal(formatBrl(17_950).replace(/\s/g, " "), "R$ 179,50");
});
