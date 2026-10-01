import { test } from "node:test";
import assert from "node:assert/strict";
import { recettesAnnee, pfc } from "../src/lib/recettes.ts";

const tarif = { Mat: 22000, Elem: 23500, Col: 26500, Lyc: 29000 };
const eff = { Mat: 100, Elem: 200, Col: 100, Lyc: 50 };
const h = { tarifParCycle: tarif, hausseAnnuelle: 3.5, remises: 6, fraisInscription: 3500, autresParEleve: 800, indexationAutres: 3, subventions: 150 };

test("recettes année 0", () => {
  const r = recettesAnnee(0, eff, 40, h);
  assert.equal(r.brut, 100 * 22 + 200 * 23.5 + 100 * 26.5 + 50 * 29);
  assert.ok(Math.abs(r.remises - r.brut * 0.06) < 1e-9);
  assert.equal(r.inscription, 140);
  assert.equal(r.autres, 360);
  assert.ok(Math.abs(r.total - (r.net + 140 + 360 + 150)) < 1e-9);
});

test("hausse tarifaire appliquée", () => {
  const a = recettesAnnee(0, eff, 0, h), b = recettesAnnee(2, eff, 0, h);
  assert.ok(Math.abs(b.brut / a.brut - 1.035 ** 2) < 1e-9);
});

test("PFC : abattement et assiettes", () => {
  const base = { taux: 6, abattement: 0, assiette: "tarif_moyen_pondere" as const };
  const brut = recettesAnnee(0, eff, 0, h).brut;
  assert.ok(Math.abs(pfc(eff, tarif, 0, base) - brut * 0.06) < 1e-9);
  assert.ok(Math.abs(pfc(eff, tarif, 0, { ...base, abattement: 50 }) - brut * 0.03) < 1e-9);
  assert.throws(() => pfc(eff, tarif, 0, { ...base, assiette: "tarif_reference" }));
  assert.equal(pfc({ Mat: 0, Elem: 0, Col: 0, Lyc: 0 }, tarif, 0, base), 0);
});
