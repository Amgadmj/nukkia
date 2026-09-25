import test from "node:test";
import assert from "node:assert/strict";
import * as art from "../src/lib/post-art.ts";
import { demoSchema } from "../src/lib/quick-start.ts";
import { composeContent, creativeFingerprint } from "../src/lib/brand-preview.ts";

function fixture() {
  const data = demoSchema.parse({
    name: "Movitta",
    segment: "Fisioterapia",
    answers: {
      offers: "Exercícios personalizados",
      audience: "Adultos que buscam orientação",
      goals: "Receber mais agendamentos",
    },
    brand: {
      confirmed: true,
      detail: "Acompanhamento individual pela equipe da marca.",
      visualStyle: "essential",
      identityConfirmed: true,
    },
  });
  data.brand.creative = composeContent(data, "invite");
  data.brand.creative.approved = creativeFingerprint(data);
  return data;
}
test("video export requires an approved current piece before rendering or sending frames", async () => {
  assert.equal(typeof art.preparePromoVideo, "function");
  const data = fixture();
  data.brand.creative!.approved = null;
  await assert.rejects(
    art.preparePromoVideo(data, ["svg"], {
      current: () => data,
      render: async () => {
        throw new Error("must not render");
      },
      request: async () => {
        throw new Error("must not send");
      },
    }),
    /Aprove/,
  );
});
test("video export sends the approved frame bytes and returns a playable-type result", async () => {
  assert.equal(typeof art.preparePromoVideo, "function");
  const data = fixture();
  const result = await art.preparePromoVideo(data, ["approved-svg"], {
    current: () => data,
    render: async (svg) => {
      assert.equal(svg, "approved-svg");
      return new Uint8Array([137, 80, 78, 71]);
    },
    request: async (frames) => {
      assert.deepEqual(frames, ["data:image/png;base64,iVBORw=="]);
      return new Blob(["video"], { type: "video/mp4" });
    },
  });
  assert.equal(result.type, "video/mp4");
  assert.equal(await result.text(), "video");
});
test("an edit during video composition discards the old result instead of offering its download", async () => {
  assert.equal(typeof art.preparePromoVideo, "function");
  const data = fixture();
  await assert.rejects(
    art.preparePromoVideo(data, ["svg"], {
      current: () => data,
      render: async () => new Uint8Array([1]),
      request: async () => {
        data.brand.creative!.copy.title = "Outro título";
        return new Blob(["video"], { type: "video/mp4" });
      },
    }),
    /mudou/,
  );
});
test("an HTML response cannot be exposed as a successful MP4", async () => {
  assert.equal(typeof art.preparePromoVideo, "function");
  const data = fixture();
  await assert.rejects(
    art.preparePromoVideo(data, ["svg"], {
      current: () => data,
      render: async () => new Uint8Array([1]),
      request: async () => new Blob(["error"], { type: "text/html" }),
    }),
    /MP4/,
  );
});
