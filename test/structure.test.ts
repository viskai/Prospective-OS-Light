import { test } from "node:test";
import assert from "node:assert/strict";
import { calculerStructure, groupesDedoubles, repartir } from "../src/lib/structure.ts";
import { calculerCouverture } from "../src/lib/emplois.ts";
import { NIVEAUX_DEF } from "../src/lib/referentiel.ts";

test("6e : 104 élèves → 4 divisions de 26, heures par discipline", () => {
  const r = calculerStructure([{ id: "6e", eff: 104 }]);
  const n = r.niveaux[0];
  assert.equal(n.div, 4);
  assert.deepEqual(repartir(104, 4), [26, 26, 26, 26]);
  assert.equal(n.parDisc.LET, 18);            // 4,5 h × 4
  assert.equal(n.parDisc.MAT, 18);
  assert.equal(n.parDisc.ANG, 16);            // 4 h × 4, classe entière en 6e
  assert.equal(n.parDisc.HG, 12);
  assert.equal(n.parDisc.SPC, 6);             // 3 h × 4 × 0,5
  assert.equal(n.parDisc.EPS, 16);
  assert.equal(n.total, 100);
  assert.ok(Math.abs(r.etp.EPS - 16 / 20) < 1e-9); // ORS EPS = 20
});

test("dédoublements : regroupement de classes minimise les groupes", () => {
  assert.equal(groupesDedoubles([26, 26, 26, 26], 24, 4), 5);   // 104/24 → 5 groupes (au lieu de 8)
  assert.equal(groupesDedoubles([26, 26, 26, 26], 24, 1), 8);   // sans regroupement possible
  assert.equal(groupesDedoubles([], 24, 4), 0);
});

test("5e : sciences en groupes (1,5 h × groupes)", () => {
  const n = calculerStructure([{ id: "5e", eff: 100 }]).niveaux[0];   // 4 divisions de 25
  const svt = n.cours.find((c) => c.id === "svt")!;
  assert.equal(svt.groupes, 5);                // 100/22 → 5 groupes
  assert.equal(svt.prof, 7.5);
});

test("choix : LV2 et spécialités, avec contrôle de cohérence", () => {
  const r = calculerStructure([{ id: "1g", eff: 70 }]);
  const n = r.niveaux[0];
  assert.equal(n.div, 2);
  assert.equal(n.cours.find((c) => c.id === "s-ma")!.groupes, 2);      // 0,65 × 70 = 45,5 → 2 groupes de 32
  assert.equal(n.alertes.length, 0);                                    // parts par défaut cohérentes
  const bad = calculerStructure([{ id: "1g", eff: 70, parts: { "s-ma": 0.1 } }]).niveaux[0];
  assert.ok(bad.alertes.some((a) => /Spécialités/.test(a.texte)));
});

test("pondération 1,1 h en cycle terminal, hors EPS", () => {
  const n = calculerStructure([{ id: "tg", eff: 60 }]).niveaux[0];
  assert.ok(Math.abs(n.parDiscPond.PHI - n.parDisc.PHI * 1.1) < 1e-9);
  assert.equal(n.parDiscPond.EPS, n.parDisc.EPS);
});

test("primaire : classes, PE et ASEM", () => {
  const r = calculerStructure([{ id: "ps", eff: 52 }, { id: "cp", eff: 78 }]);
  assert.equal(r.primaire.classes, 2 + 3);
  assert.equal(r.primaire.postesPE, 5);
  assert.equal(r.primaire.asem, 2);
  assert.equal(r.besoins.PE, undefined);
});

test("division insuffisante : alerte critique", () => {
  const r = calculerStructure([{ id: "3e", eff: 90, div: 2 }]);
  assert.ok(r.alertes.some((a) => a.niveau === "critique"));
});

test("couverture : HSA, création de postes, excédent", () => {
  const c = calculerCouverture({ MAT: 80, LET: 36, SVT: 10 }, { MAT: { postes: 3 }, LET: { postes: 2 }, SVT: { postes: 1 } });
  assert.equal(c.MAT.hsa, 26);                 // 80 − 54
  assert.equal(c.MAT.creations, 1);            // 26/3 > 2 HSA/poste → 1 TP à 22 h → 4/4 = 1 HSA/poste
  assert.equal(c.MAT.etat, "recruter");
  assert.equal(c.LET.etat, "equilibre");
  assert.equal(c.SVT.etat, "excedent");
});

test("référentiel : ids de cours uniques par niveau", () => {
  for (const n of NIVEAUX_DEF) {
    const ids = n.cours.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length, n.id);
  }
});
