import { test } from "node:test";
import assert from "node:assert/strict";
import { recettesAnnee, pfc, tarifSegment, type HypothesesRecettes } from "../src/lib/recettes.ts";

const h: HypothesesRecettes = {
  tarifParSegment: { Mat: 22000, Elem: 23500, Col: 26500, Lyc: 29000 }, hausseAnnuelle: 3.5, remises: 6,
  fraisInscription: 3500, autresParEleve: 800, indexationAutres: 3, subventions: 150,
};
const eff = { Mat: 100, Elem: 200, Col: 100, Lyc: 50 };
const near = (a: number, b: number, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} ≠ ${b}`);

test("recettes année 0", () => {
  const r = recettesAnnee(0, eff, 40, h);
  assert.equal(r.brut, 100 * 22 + 200 * 23.5 + 100 * 26.5 + 50 * 29);
  near(r.remises, r.brut * 0.06);
  assert.equal(r.inscription, 140);
  assert.equal(r.autres, 360);
  near(r.total, r.net + 140 + 360 + 150);
});

test("hausse tarifaire appliquée", () => {
  const a = recettesAnnee(0, eff, 0, h), b = recettesAnnee(2, eff, 0, h);
  near(b.brut / a.brut, 1.035 ** 2);
});

test("IB : tarif du lycée par défaut, puis différenciation (tarif, hausse, série explicite)", () => {
  assert.equal(tarifSegment("IB", 0, h), 29000);
  const diff: HypothesesRecettes = { ...h, tarifParSegment: { ...h.tarifParSegment, IB: 33000 }, hausseParSegment: { IB: 5 } };
  near(tarifSegment("IB", 2, diff), 33000 * 1.05 ** 2);
  near(tarifSegment("Lyc", 2, diff), 29000 * 1.035 ** 2);
  const serie: HypothesesRecettes = { ...h, tarifsParAnnee: { IB: [29000, 29000, 34000, 35000] } };
  assert.equal(tarifSegment("IB", 2, serie), 34000);
  const r = recettesAnnee(0, { Lyc: 40, IB: 10 }, 0, diff);
  near(r.parSegment.IB!, 330); near(r.parSegment.Lyc!, 40 * 29);
});

test("PFC : abattement, assiettes et segments exclus", () => {
  const base = { taux: 6, abattement: 0, assiette: "tarif_moyen_pondere" as const };
  const brut = recettesAnnee(0, eff, 0, h).brut;
  near(pfc(0, eff, h, base), brut * 0.06);
  near(pfc(0, eff, h, { ...base, abattement: 50 }), brut * 0.03);
  assert.throws(() => pfc(0, eff, h, { ...base, assiette: "tarif_reference" }));
  assert.equal(pfc(0, {}, h, base), 0);
  const avecIB = { Lyc: 40, IB: 10 };
  const diff: HypothesesRecettes = { ...h, tarifParSegment: { ...h.tarifParSegment, IB: 33000 } };
  near(pfc(0, avecIB, diff, { ...base, segmentsExclus: ["IB"] }), 40 * 29 * 0.06);
});
