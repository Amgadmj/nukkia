import test from "node:test";
import assert from "node:assert/strict";
import { identityPaletteOptions } from "../src/lib/identity-palette.ts";

test("saved palette wins over unrelated saved options and research; variants stay close", () => {
  const options = identityPaletteOptions({
    saved: { nome: "Atual", cores: ["#204060", "#FAFAFA"] },
    accent: "#FF0000",
    colors: ["#00FF00"],
  });
  assert.equal(options.length, 3);
  assert.deepEqual(options[0]?.cores, ["#204060", "#FAFAFA"]);
  assert.match(options[1]!.nome, /Proposta/);
  assert.deepEqual(options[1]!.cores, ["#324F6D", "#FAFAFA"]);
  assert.deepEqual(options[2]!.cores, ["#1D3B58", "#E6E6E6"]);
});

test("observed colors seed unconfirmed identity, confirmed accent takes priority", () => {
  assert.equal(
    identityPaletteOptions({ accent: "#112233", colors: ["#335577", "bad"] })[0]?.cores[0],
    "#335577",
  );
  assert.equal(
    identityPaletteOptions({ accent: "#112233", confirmed: true, colors: ["#335577"] })[0]
      ?.cores[0],
    "#112233",
  );
  assert.deepEqual(identityPaletteOptions({ accent: "bad", colors: ["red"] }), []);
});
test("the site's chromatic accent leads the proposals instead of logo whitespace", () => {
  const options = identityPaletteOptions({
    accent: "#C64A27",
    colors: ["#ffffff", "#c64a27", "#dd5934"],
  });
  assert.equal(options[0]!.cores[0], "#C64A27");
});
