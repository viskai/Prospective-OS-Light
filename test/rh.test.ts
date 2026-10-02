import { test } from "node:test";
import assert from "node:assert/strict";
import { controlerPostes, coutPoste, enPlaceDepuisPostes, POLITIQUE_DEFAUT, projeterMasseSalariale, type PolitiqueSalariale, type PosteRH } from "../src/lib/rh.ts";

const pol: PolitiqueSalariale = { ...POLITIQUE_DEFAUT, tauxHSA: 3000, monnaies: { base: "EUR", taux: { EUR: 1, MYR: 3, USD: 1.1 } } };
const base = (ref: string, centre: string, x: Partial<PosteRH> = {}): PosteRH => ({
  ref, service: "secondaire", centre, categorie: "enseignant", statut: "contractuel", quotite: 1, ors: 18, devise: "EUR", salaireBase: 100000, chargesPct: 10, ...x,
});
const near = (a: number, b: number, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} ≠ ${b}`);

test("coût d'un poste : charges, quotité, HSA, devise, revalorisation et GVT", () => {
  near(coutPoste(base("A", "MAT"), 0, pol), 110);                                   // 100 k × 1,10
  near(coutPoste(base("A", "MAT", { quotite: 0.5 }), 0, pol), 55);
  near(coutPoste(base("A", "MAT", { hsa: 2 }), 0, pol), 110 + 6);                   // 2 h × 3 000 (monnaie de base)
  near(coutPoste(base("A", "MAT", { devise: "MYR", salaireBase: 300000 }), 0, pol), 110);   // 3 MYR pour 1 unité de base
  near(coutPoste(base("A", "MAT"), 1, pol), 110 * 1.03 * 1.01);                     // revalorisation + GVT
});

test("résident AEFE : contribution seule, sans GVT", () => {
  const r = base("R", "ANG", { statut: "resident", salaireBase: 0, contributionResident: 95000, chargesPct: 0 });
  near(coutPoste(r, 0, pol), 95);
  near(coutPoste(r, 2, pol), 95 * 1.03 ** 2);
});

test("période d'emploi : départ et arrivée", () => {
  const p = base("A", "MAT", { anneeDebut: 2, anneeFin: 4 });
  assert.equal(coutPoste(p, 1, pol), 0);
  assert.ok(coutPoste(p, 3, pol) > 0);
  assert.equal(coutPoste(p, 5, pol), 0);
});

test("masse salariale : horizon 15 ans, totaux cohérents", () => {
  const postes = ["a", "b", "c"].map((r) => base(r, "MAT"));
  const m = projeterMasseSalariale(postes, pol);
  assert.equal(m.annees.length, 15);
  assert.equal(m.annees[0], "2026-27");
  near(m.total[0], 330);
  near(m.etp[0], 3);
  assert.ok(m.total[14] > m.total[0]);
});

test("confidentialité : aucune ligne publiée sous 3 postes, total conservé", () => {
  const postes = [
    ...["m1", "m2", "m3", "m4", "m5"].map((r) => base(r, "MAT")),
    base("g1", "ANG"), base("g2", "ESP"),                                 // 2 isolés → regroupés avec la plus petite ligne
    ...["x1", "x2", "x3", "x4"].map((r) => base(r, "Administration", { categorie: "non_enseignant", statut: "local" })),
  ];
  const m = projeterMasseSalariale(postes, pol);
  const attendu = postes.reduce((s, p) => s + coutPoste(p, 0, pol), 0);
  near(m.total[0], attendu);
  for (const l of m.lignes) assert.ok(l.effectif >= 3, `${l.categorie}/${l.centre} : ${l.effectif}`);
  assert.equal(m.lignes.some((l) => l.centre === "ANG" || l.centre === "ESP"), false);
});

test("confidentialité : trois isolés d'une même catégorie forment une ligne « Autres »", () => {
  const postes = [...["m1", "m2", "m3"].map((r) => base(r, "MAT")), base("g1", "ANG"), base("g2", "ESP"), base("g3", "ALL")];
  const m = projeterMasseSalariale(postes, pol);
  const autres = m.lignes.find((l) => l.centre === "Autres (regroupé)")!;
  assert.equal(autres.effectif, 3);
  assert.equal(autres.regroupe, true);
});

test("moins de 3 postes au total : détail masqué", () => {
  const m = projeterMasseSalariale([base("a", "MAT"), base("b", "ANG")], pol);
  assert.equal(m.lignes.length, 1);
  assert.match(m.lignes[0].centre, /masqué/);
});

test("IMP et décharges en montants forfaitaires, créations de B2", () => {
  const m = projeterMasseSalariale(["a", "b", "c"].map((r) => base(r, "MAT")), pol, {
    forfaits: [{ id: "imp", nom: "IMP", type: "imp", unites: 10, montantUnitaire: 1200 }, { id: "dec", nom: "Décharges", type: "decharge", unites: 4, montantUnitaire: 5000, indexe: false }],
    creations: [{ centre: "MAT", etp: 1, annee: 2, coutUnitaire: 110000 }],
  });
  const imp = m.lignes.find((l) => l.centre === "imp")!, dec = m.lignes.find((l) => l.centre === "decharge")!, cr = m.lignes.find((l) => l.categorie === "creations")!;
  near(imp.parAnnee[0], 12); near(imp.parAnnee[1], 12 * 1.03);
  near(dec.parAnnee[0], 20); near(dec.parAnnee[5], 20);                  // non indexé
  assert.equal(cr.parAnnee[1], 0); near(cr.parAnnee[2], 110 * 1.03 ** 2);
  near(m.total[0], 330 + 12 + 20);
});

test("contrôles du fichier RH", () => {
  const e = controlerPostes([
    base("A", "MAT"), base("A", "MAT"), base("B", "", { quotite: 0 }), base("C", "ANG", { ors: undefined }),
    base("D", "ESP", { statut: "resident", contributionResident: undefined }), base("E", "LET", { salaireBase: 0 }),
  ], pol);
  for (const motif of [/double/, /centre/, /quotité/, /ORS/, /contribution/, /salaire/]) assert.ok(e.some((x) => motif.test(x)), String(motif));
  assert.deepEqual(controlerPostes([base("A", "MAT")], pol), []);
  assert.ok(controlerPostes([base("A", "MAT", { devise: "XYZ" })], pol).some((x) => /Taux de change manquant/.test(x)));
  assert.ok(controlerPostes([base("A", "MAT", { hsa: 1 })], { ...pol, tauxHSA: 0 }).some((x) => /taux d'HSA/.test(x)));
});

test("postes en place pour B2 : agrégat par discipline, PE à part", () => {
  const r = enPlaceDepuisPostes([
    base("a", "MAT"), base("b", "MAT", { quotite: 0.5, ors: 22 }), base("c", "MAT", { statut: "resident", hsa: 1 }),
    base("d", "PE", { statut: "pe", ors: 24 }), base("e", "Administration", { categorie: "non_enseignant", statut: "local" }),
  ]);
  assert.equal(r.parDiscipline.MAT.postes, 2.5);
  assert.equal(r.parDiscipline.MAT.apport, 18 + 11 + 18);
  assert.equal(r.parDiscipline.MAT.postesDetaches, 1);
  assert.equal(r.postesPE, 1);
  assert.equal(r.hsa, 1);
  assert.equal(r.parDiscipline.PE, undefined);
});

test("changer de monnaie de base : même masse salariale une fois reconvertie", async () => {
  const { rebaser, facteurRebasage } = await import("../src/lib/monnaie.ts");
  const postes = [base("a", "MAT", { devise: "MYR", salaireBase: 300000 }), base("b", "MAT"), base("c", "MAT", { hsa: 2 })];
  const avant = projeterMasseSalariale(postes, pol);
  const pol2: PolitiqueSalariale = { ...pol, monnaies: rebaser(pol.monnaies, "MYR"), tauxHSA: pol.tauxHSA * facteurRebasage(pol.monnaies, "MYR") };
  const apres = projeterMasseSalariale(postes.map((p) => (p.devise === "EUR" ? { ...p, devise: "MYR", salaireBase: p.salaireBase * 3, primes: (p.primes ?? 0) * 3 } : p)), pol2);
  for (let t = 0; t < 15; t += 7) near(apres.total[t], avant.total[t] * 3, 1e-6);
});

// Cas chiffrés du classeur budget LFKL (montants seuls, sans donnée nominative), en ringgit.
const CS = { epfPct: 13, socsoPct: 1.75, socsoPlafondAnnuel: 1249.8, eisPct: 0.2, hrdfPct: 1, bonusMois: 1.3 };

test("régime local malaisien : bonus, EPF, SOCSO plafonnée, EIS, HRDF (cas du classeur)", async () => {
  const { coutEmployeurLocal } = await import("../src/lib/rh.ts");
  // technicien malaisien, bonus : salaire 50 285,88 → coût employeur 64 623,01
  const a = coutEmployeurLocal(50285.88, 0, { malaisien: true, bonusEligible: true }, CS);
  near(a.brut, 55733.517, 1e-3); near(a.total, 64623.0129615, 1e-3);
  // enseignant malaisien sans bonus : salaire 153 222 + indemnités 11 889 → 189 806,56 (SOCSO plafonnée à 1 249,8)
  const b = coutEmployeurLocal(153222, 11889, { malaisien: true }, CS);
  near(b.total, 189806.562, 1e-3); near(b.charges, 21464.43 + 1249.8 + 330.222 + 1651.11, 1e-2);
  // non malaisien : ni EIS ni HRDF
  const c = coutEmployeurLocal(278189.28, 40329, { malaisien: false }, CS);
  near(c.total, 318518.28 + 41407.3764 + 1249.8, 1e-2);
});

test("poste à régime local dans la masse salariale, avec revalorisation et GVT", () => {
  const p0: PolitiqueSalariale = { ...POLITIQUE_DEFAUT, monnaies: { base: "MYR", taux: { MYR: 1 } }, chargesSociales: CS };
  const poste = base("L", "ANG", { devise: "MYR", salaireBase: 153222, chargesPct: undefined, regimeLocal: { malaisien: true, indemnitesAnnuelles: 11889 } });
  near(coutPoste(poste, 0, p0), 189.806562, 1e-6);
  const f = 1.03 * 1.01;
  assert.ok(Math.abs(coutPoste(poste, 1, p0) - 189.806562 * f) < 1.5);          // plafond SOCSO non indexé : écart de l'ordre du millier
  assert.throws(() => coutPoste(poste, 0, POLITIQUE_DEFAUT), /charges sociales/);
});

test("pension civile des résidents : montée en charge sur les années", () => {
  const r = base("R", "MAT", { statut: "resident", salaireBase: 0, contributionResident: 300000, chargesPct: 0, pensionCivile: 100000 });
  const p1: PolitiqueSalariale = { ...pol, revalorisation: 0, gvt: 0, pensionCivileMontee: [0.4, 1] };
  near(coutPoste(r, 0, p1), 340); near(coutPoste(r, 1, p1), 400); near(coutPoste(r, 5, p1), 400);       // au-delà de la série : pleine charge
  near(coutPoste(r, 0, { ...p1, pensionCivileMontee: undefined }), 400);
});
