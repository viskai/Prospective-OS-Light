import { test } from "node:test";
import assert from "node:assert/strict";
import { alertesContrats, contratActif, contratsEchusSous6Mois, controlerContrats, projeterCharges, type Contrat } from "../src/lib/contrats.ts";

const m = { base: "EUR", taux: { EUR: 1, MYR: 5 } };
const c = (ref: string, x: Partial<Contrat> = {}): Contrat => ({
  ref, fournisseur: "Société X", objet: `Contrat ${ref}`, categorie: "maintenance", montantAnnuel: 100000, devise: "EUR",
  dateDebut: "2024-01-01", preavisJours: 90, indexation: 3, centreCout: "SG", ...x,
});
const near = (a: number, b: number, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} ≠ ${b}`);
const ctx = { monnaies: m, debutAnnee: 2026, effectifs: Array(5).fill({ Col: 100, Lyc: 50, IB: 10 }), surfaces: Array(5).fill(10000) };

test("charges récurrentes indexées, devise convertie", () => {
  const r = projeterCharges([c("A"), c("B", { devise: "MYR", montantAnnuel: 500000, categorie: "energie" })], { indexation: 0 }, ctx);
  near(r.parCategorie.maintenance[0], 100); near(r.parCategorie.energie[0], 100);
  near(r.parCategorie.maintenance[2], 100 * 1.03 ** 2);
  near(r.total[0], 200);
});

test("contrat échu non reconduit : la charge disparaît ; reconduit : elle continue", () => {
  const fini = c("F", { dateFin: "2027-08-31", reconduit: false }), cont = c("G", { dateFin: "2027-08-31" });
  assert.equal(contratActif(fini, 0, ctx), true);
  assert.equal(contratActif(fini, 1, ctx), false);       // 2027-28 débute le 1er sept 2027, après la fin du contrat
  assert.equal(contratActif(fini, 2, ctx), false);
  assert.equal(contratActif(cont, 4, ctx), true);
  assert.equal(contratActif(c("H", { dateDebut: "2028-01-01" }), 0, ctx), false);   // pas encore commencé
  assert.equal(contratActif(c("H", { dateDebut: "2028-01-01" }), 1, ctx), true);    // commence en cours d'année 2027-28
});

test("charges variables par segment (IB différencié), surfaces et enveloppes pédagogiques", () => {
  const r = projeterCharges([], {
    indexation: 2, parEleve: { Lyc: 100, IB: 1500 }, parM2: 50,
    enveloppesPeda: { Col: { montant: 200, mode: "par_eleve" }, Lyc: { montant: 40000, mode: "forfait" } },
  }, ctx);
  near(r.parCategorie.variables_eleves[0], (50 * 100 + 10 * 1500) / 1000);       // 20
  near(r.parCategorie.surfaces[0], 10000 * 50 / 1000);                              // 500
  near(r.parCategorie.fonctionnement_pedagogique[0], (100 * 200 + 40000) / 1000);  // 60
  near(r.parCategorie.surfaces[1], 500 * 1.02);
});

test("alertes d'échéance et de préavis", () => {
  const a = alertesContrats([
    c("T1", { dateFin: "2026-12-31", preavisJours: 90 }),        // préavis 2 oct → il reste 1 jour
    c("T2", { dateFin: "2026-10-15", preavisJours: 60 }),        // préavis dépassé
    c("T3", { dateFin: "2027-03-01", preavisJours: 30 }),        // fin sous 6 mois
    c("T4", { dateFin: "2030-01-01" }), c("T5"), c("T6", { dateFin: "2026-06-30", reconduit: false }),
  ], "2026-10-01");
  const niv = (r: string) => a.find((x) => x.ref === r)?.niveau;
  assert.equal(niv("T1"), "vigilance"); assert.equal(niv("T2"), "critique"); assert.equal(niv("T3"), "information");
  assert.equal(niv("T4"), undefined); assert.equal(niv("T5"), undefined); assert.equal(niv("T6"), "critique");
  assert.equal(contratsEchusSous6Mois([c("T1", { dateFin: "2026-12-31" }), c("T4", { dateFin: "2030-01-01" })], "2026-10-01"), 1);
});

test("contrôles du registre", () => {
  const e = controlerContrats([c("A"), c("A"), c("B", { dateFin: "2020-01-01" }), c("C", { devise: "XYZ" }), c("D", { centreCout: "" })], m);
  for (const r of [/double/, /antérieure/, /Taux de change/, /centre/]) assert.ok(e.some((x) => r.test(x)), String(r));
  assert.deepEqual(controlerContrats([c("A")], m), []);
});

test("charges communes du campus : part prise en charge par l'établissement partenaire", () => {
  const r = projeterCharges([c("M", { montantAnnuel: 1000000, categorie: "maintenance" }), c("S", { montantAnnuel: 400000, categorie: "securite" })],
    { indexation: 0, parM2: 100, refacturation: { categories: ["maintenance", "securite", "surfaces"], part: 22.5 } }, ctx);
  const communes = 1000 + 400 + 10000 * 100 / 1000;
  near(r.parCategorie.refacturation_partenaire[0], -communes * 0.225);
  near(r.total[0], communes * 0.775);
});
