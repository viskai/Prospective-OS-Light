import { test } from "node:test";
import assert from "node:assert/strict";
import { projeter, anneesScolaires, niveauPasse, type Niveau } from "../src/lib/cohort.ts";
import { registreInitial, HORIZON_ANNEES } from "../src/lib/drivers.ts";

const niv: Niveau[] = [
  { code: "PS", cycle: "Mat", e0: 50 },
  { code: "MS", cycle: "Mat", e0: 60, retention: 120 },
  { code: "GS", cycle: "Mat", e0: 60, retention: 100 },
];
const base = { niveaux: niv, scenario: { entree: 50, croissance: 0, dRet: 0, dSec: 0 }, horizon: HORIZON_ANNEES };

test("horizon 15 ans et montée de cohorte", () => {
  const r = projeter({ ...base, jauge: "demande", capacite: () => 1e9 });
  assert.equal(r.effectifs.length, 15);
  assert.equal(r.effectifs[1][2], 60);        // GS(1) = MS(0) × 100 %
  assert.equal(r.effectifs[1][1], 60);        // MS(1) = PS(0) × 120 %
  assert.equal(r.effectifs[1][0], 50);        // entrée
});

test("la jauge plafonne les nouveaux inscrits", () => {
  const libre = projeter({ ...base, jauge: "demande", capacite: () => 1e9 });
  const plaf = projeter({ ...base, jauge: "plafond", capacite: () => 165 });
  assert.ok(plaf.total[1] <= 165 + 1e-9);
  assert.ok(plaf.total[1] < libre.total[1]);
});

test("scénario stress réduit les effectifs", () => {
  const c = projeter({ ...base, jauge: "demande", capacite: () => 1e9 });
  const s = projeter({ ...base, scenario: { entree: 40, croissance: 0, dRet: -3, dSec: 0 }, jauge: "demande", capacite: () => 1e9 });
  assert.ok(s.total[5] < c.total[5]);
});

test("utilitaires", () => {
  assert.equal(anneesScolaires(2026, 3).join(), "2026-27,2027-28,2028-29");
  assert.equal(niveauPasse(["CP", "CE1", "CE2"], "CE2", 1), "CE1");
  assert.equal(niveauPasse(["CP", "CE1"], "CP", 2), null);
});

test("registre : codes uniques", () => {
  const codes = registreInitial().map((d) => d.code);
  assert.equal(new Set(codes).size, codes.length);
});
