import { test } from "node:test";
import assert from "node:assert/strict";
import { controlerPostes, coutPoste, enPlaceDepuisPostes, POLITIQUE_DEFAUT, projeterMasseSalariale, type PosteRH } from "../src/lib/rh.ts";

const pol = POLITIQUE_DEFAUT;
const base = (ref: string, centre: string, x: Partial<PosteRH> = {}): PosteRH => ({
  ref, service: "secondaire", centre, categorie: "enseignant", statut: "contractuel", quotite: 1, ors: 18, devise: "AUD", salaireBase: 100000, chargesPct: 10, ...x,
});
const near = (a: number, b: number, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} ≠ ${b}`);

test("coût d'un poste : charges, quotité, HSA, devise, revalorisation et GVT", () => {
  near(coutPoste(base("A", "MAT"), 0, pol), 110);                                   // 100 k × 1,10
  near(coutPoste(base("A", "MAT", { quotite: 0.5 }), 0, pol), 55);
  near(coutPoste(base("A", "MAT", { hsa: 2 }), 0, pol), 110 + 6);                   // 2 h × 3 000 AUD
  near(coutPoste(base("A", "MAT", { devise: "MYR", salaireBase: 300000 }), 0, pol), 110);   // 3 MYR pour 1 AUD
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
  ]);
  for (const motif of [/double/, /centre/, /quotité/, /ORS/, /contribution/, /salaire/]) assert.ok(e.some((x) => motif.test(x)), String(motif));
  assert.deepEqual(controlerPostes([base("A", "MAT")]), []);
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
