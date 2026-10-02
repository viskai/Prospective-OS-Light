import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { anneeCivileDepuisScolaire, anneeScolaireDepuisCivile, PART_FACTURATION } from "../src/lib/exercice.ts";
import { entreesDepuisHistorique, parserHistoriqueCsv, retentionsDepuisHistorique } from "../src/lib/historique.ts";

const near = (a: number, b: number, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} ≠ ${b}`);
const ORDRE = ["PS", "MS", "GS", "CP", "CE1", "CE2", "CM1", "CM2", "6e", "5e", "4e", "3e", "2nde", "1ere", "Tle"];
const h = parserHistoriqueCsv(readFileSync("data/lfkl/effectifs_historiques.csv", "utf8"), ORDRE);

test("historique LFKL : 12 années, 15 niveaux, totaux de la feuille de budget", () => {
  assert.equal(h.annees.length, 12); assert.equal(h.annees[0], "2014-15"); assert.equal(h.annees.at(-1), "2025-26");
  const total = (a: string) => h.effectifs[h.annees.indexOf(a)].reduce((s, x) => s + x, 0);
  near(total("2014-15"), 852); near(total("2022-23"), 634); near(total("2025-26"), 775);
  assert.ok(h.effectifs.every((l) => l.every(Number.isFinite)));
});

test("rétention sur 3 ou 5 ans à partir de l'historique réel", () => {
  const r3 = retentionsDepuisHistorique(h, { fenetre: 3 }), r5 = retentionsDepuisHistorique(h, { fenetre: 5 });
  assert.deepEqual(Object.keys(r3), ORDRE.slice(1));
  // vérification de la formule sur un cas recalculé à la main
  const i = h.annees.length - 1;
  const a = h.effectifs[i][1] + h.effectifs[i - 1][1] + h.effectifs[i - 2][1], b = h.effectifs[i - 1][0] + h.effectifs[i - 2][0] + h.effectifs[i - 3][0];
  near(r3.MS, (a / b) * 100);
  assert.ok(r3.MS > 150, "forte entrée entre PS et MS (recrutement en cours de maternelle)");
  assert.ok(r3["6e"] > 100 && r5["6e"] > 90);
  assert.ok(r3["3e"] < 100, "érosion en fin de collège");
  assert.notEqual(r3.MS, r5.MS);
  assert.equal(retentionsDepuisHistorique(h, { surcharge: { CP: 99 } }).CP, 99);
  assert.ok(retentionsDepuisHistorique(h, { fenetre: 3, exclure: ["2025-26"] }).MS !== r3.MS);
});

test("entrées en petite section", () => {
  const e = entreesDepuisHistorique(h, 3);
  assert.equal(e.derniere, 13); near(e.moyenne, (19 + 17 + 13) / 3);
  assert.equal(e.max, 19);
});

test("année civile ↔ année scolaire", () => {
  // flux mensuels : 4/12 de l'année scolaire Y tombent dans Y, 8/12 de Y-1 dans Y
  const sy = [120, 150, 180];
  const cy = anneeCivileDepuisScolaire(sy, 4 / 12, 120);
  near(cy[0], 120); near(cy[1], (150 * 4 + 120 * 8) / 12); near(cy[2], (180 * 4 + 150 * 8) / 12);
  // aller-retour (à la borne près)
  const retour = anneeScolaireDepuisCivile([100, 130, 170, 200], 4 / 12);
  near(retour[0], (100 * 4 + 130 * 8) / 12);
  // facturation : 60 % de l'année civile viennent de l'année scolaire précédente (T2 et T3), 40 % de la courante (T1)
  near(anneeCivileDepuisScolaire([1000, 2000], PART_FACTURATION)[1], 0.4 * 2000 + 0.6 * 1000);
});
