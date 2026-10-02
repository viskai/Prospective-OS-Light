import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { recettesAnnee, tarifMoyenPayeurs, pfc, type Segment, type HypothesesRecettes } from "../src/lib/recettes.ts";
import { anneeCivileDepuisScolaire, PART_FACTURATION } from "../src/lib/exercice.ts";

// Calibrage sur le classeur Budget 2026 de LFKL (agrégats par niveau, aucune donnée nominative).
const d = JSON.parse(readFileSync("data/lfkl/revenus_2026_hypotheses.json", "utf8")) as {
  resultats_budget_2026: { frais_scolarite_particulier_brut: number; frais_scolarite_entreprise_brut: number };
  niveaux: { niveau: string; effectif_2025_26: number; famille: number; corporate: number; tarif_famille_2025_26: number; tarif_corporate_2025_26: number; effectif_2026_27: number; tarif_famille_2026_27: number; tarif_corporate_2026_27: number }[];
};
const CYCLE: Record<string, Segment> = { PS: "Mat", MS: "Mat", GS: "Mat", CP: "Elem", CE1: "Elem", CE2: "Elem", CM1: "Elem", CM2: "Elem", "6e": "Col", "5e": "Col", "4e": "Col", "3e": "Col", "2nde": "Lyc", "1ere": "Lyc", Tle: "Lyc" };
const SEGS: Segment[] = ["Mat", "Elem", "Col", "Lyc"];
const somme = (f: (n: (typeof d.niveaux)[number]) => number) => Object.fromEntries(SEGS.map((s) => [s, d.niveaux.filter((n) => CYCLE[n.niveau] === s).reduce((a, n) => a + f(n), 0)])) as Record<Segment, number>;
const tarif = (cle: "tarif_famille_2025_26" | "tarif_corporate_2025_26" | "tarif_famille_2026_27" | "tarif_corporate_2026_27") =>
  Object.fromEntries(SEGS.map((s) => [s, d.niveaux.find((n) => CYCLE[n.niveau] === s)![cle]])) as Record<Segment, number>;

test("recettes de scolarité 2026 du budget retrouvées à ± 1 % (effectifs × tarifs × mix de payeurs, pondération civile 60/40)", () => {
  const e25 = somme((n) => n.effectif_2025_26), e26 = somme((n) => n.effectif_2026_27);
  const fam = somme((n) => n.famille), tot = somme((n) => n.famille + n.corporate);
  const part = Object.fromEntries(SEGS.map((s) => [s, fam[s] / tot[s]]));
  const m25 = tarifMoyenPayeurs(tarif("tarif_famille_2025_26"), tarif("tarif_corporate_2025_26"), part), m26 = tarifMoyenPayeurs(tarif("tarif_famille_2026_27"), tarif("tarif_corporate_2026_27"), part);
  const h: HypothesesRecettes = {
    tarifParSegment: m25, tarifsParAnnee: Object.fromEntries(SEGS.map((s) => [s, [m25[s]!, m26[s]!]])), hausseAnnuelle: 0, remises: 0, fraisInscription: 0, autresParEleve: 0, indexationAutres: 0, subventions: 0,
  };
  const sy = [recettesAnnee(0, e25, 0, h).brut, recettesAnnee(1, e26, 0, h).brut];
  const civil2026 = anneeCivileDepuisScolaire(sy, PART_FACTURATION)[1];
  const budget = (d.resultats_budget_2026.frais_scolarite_particulier_brut + d.resultats_budget_2026.frais_scolarite_entreprise_brut) / 1000;
  assert.ok(Math.abs(civil2026 / budget - 1) < 0.01, `${civil2026.toFixed(0)} k vs ${budget.toFixed(0)} k`);
});

test("PFC LFKL : la formule du classeur surestime l'assiette (colonne T1 pondérée à 0,6 au lieu de 0,4 hors maternelle)", () => {
  const eff = { Mat: 103, Elem: 328, Col: 233, Lyc: 117 };                                      // effectifs prévisibles de la feuille PFC
  const jan = { Mat: 29800, Elem: 35900, Col: 43400, Lyc: 47900 };                              // tarif « particulier » appliqué de janvier à août
  const rec: HypothesesRecettes = { tarifParSegment: jan, hausseAnnuelle: 1.5, remises: 0, fraisInscription: 0, autresParEleve: 0, indexationAutres: 0, subventions: 0 };
  // assiette annuelle correcte : 60 % de l'année au tarif de janvier, 40 % au tarif de septembre (+1,5 %)
  const blended = Object.fromEntries(SEGS.map((s) => [s, jan[s] * (0.6 + 0.4 * 1.015)])) as Record<Segment, number>;
  const correcte = pfc(0, eff, rec, { taux: 6, abattement: 6, assiette: "tarif_moyen_pondere", tarifsAssiette: blended });
  assert.ok(Math.abs(correcte * 1000 - 1733988) < 2, `${correcte * 1000}`);
  // formule du classeur : 0,6 sur la 1re colonne partout, 0,4 sur la 2e en maternelle seulement, 0,6 ailleurs
  const budget = SEGS.reduce((s, x) => s + eff[x] * jan[x] * 0.6 + eff[x] * jan[x] * 1.015 * (x === "Mat" ? 0.4 : 0.6), 0) * 0.94 * 0.06;
  assert.ok(Math.abs(budget - 2048746) < 2);
  const ecartLigne521130 = (budget - correcte * 1000) * (2 / 3 + (1 / 3) * (800 / 781));          // pondération civile 2/3 + 1/3 avec 800 élèves
  assert.ok(Math.abs(ecartLigne521130 - 317310) < 5, `${ecartLigne521130}`);                    // ≈ 317 000 RM de charge PFC en trop dans le budget
});
