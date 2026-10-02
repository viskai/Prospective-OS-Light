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

test("mix de payeurs : tarif moyen entre « particulier » et « entreprise »", async () => {
  const { tarifMoyenPayeurs } = await import("../src/lib/recettes.ts");
  const m = tarifMoyenPayeurs({ Mat: 30200, Lyc: 48600 }, { Mat: 41900, Lyc: 63900 }, { Mat: 0.85, Lyc: 0.8 });
  near(m.Mat!, 0.85 * 30200 + 0.15 * 41900); near(m.Lyc!, 0.8 * 48600 + 0.2 * 63900);
  near(tarifMoyenPayeurs({ Col: 100 }, { Col: 200 }, 0.5).Col!, 150);
  assert.throws(() => tarifMoyenPayeurs({ Col: 1 }, {}, 0.5));
});

test("remises détaillées par nature et supplément de section internationale", () => {
  const d: HypothesesRecettes = { ...h, remises: { fratrie: 0.65, personnel: 4.45, paiement_annuel: 0.86 }, supplements: [{ nom: "SI", montantParEleve: 9600, eleves: { Col: 20, Lyc: 10 } }] };
  const r = recettesAnnee(0, eff, 0, d);
  near(r.supplements, 288);                                               // 30 élèves × 9 600
  near(r.brut, 100 * 22 + 200 * 23.5 + 100 * 26.5 + 50 * 29 + 288);
  near(r.remisesParNature.personnel, r.brut * 0.0445);
  near(r.remises, r.brut * 0.0596);
  near(recettesAnnee(2, eff, 0, d).supplements, 288 * 1.035 ** 2);
});

test("PFC LFKL : assiette sur le tarif particulier, abattement 6 %, taux 6 %", () => {
  const tarifs = { Mat: 29800, Elem: 35900, Col: 43400, Lyc: 47900 };
  const rec: HypothesesRecettes = { ...h, tarifParSegment: { Mat: 33000, Elem: 40000, Col: 48000, Lyc: 53000 } };   // tarif moyen supérieur au tarif particulier
  const e = { Mat: 103, Elem: 328, Col: 233, Lyc: 117 };
  const assiette = 103 * 29800 + 328 * 35900 + 233 * 43400 + 117 * 47900;
  near(pfc(0, e, rec, { taux: 6, abattement: 6, assiette: "tarif_moyen_pondere", tarifsAssiette: tarifs }), (assiette * 0.94 * 0.06) / 1000);
  near(pfc(2, e, rec, { taux: 6, abattement: 6, assiette: "tarif_moyen_pondere", tarifsAssiette: tarifs }), (assiette * 1.035 ** 2 * 0.94 * 0.06) / 1000);
  assert.ok(pfc(0, e, rec, { taux: 6, abattement: 6, assiette: "tarif_moyen_pondere" }) > pfc(0, e, rec, { taux: 6, abattement: 6, assiette: "tarif_moyen_pondere", tarifsAssiette: tarifs }));
});
