import { test } from "node:test";
import assert from "node:assert/strict";
import { calculerFonds, controlerPromesses, type Promesse } from "../src/lib/fonds.ts";

const near = (a: number, b: number, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} ≠ ${b}`);
const pr = (ref: string, x: Partial<Promesse> = {}): Promesse => ({
  ref, campagne: "Campagne A", montant: 1000, probabilite: 0.5, calendrier: [{ annee: 1, part: 0.6 }, { annee: 2, part: 0.4 }], affectation: { projet: "Extension" }, ...x,
});

test("collecte pondérée par la probabilité et calendrier d'encaissement", () => {
  const r = calculerFonds([pr("A"), pr("B", { affectation: "libre", montant: 400, probabilite: 1, calendrier: [{ annee: 0, part: 1 }] })], [], 5);
  near(r.collecteAttendue[1], 300); near(r.collecteAttendue[2], 200); near(r.collecteAttendue[0], 400);
  near(r.donsLibres[0], 400); near(r.fondsAffectesRecus[1], 300);
  near(r.parAffectation.Extension[2], 200);
  assert.equal(r.objectif, 1400); near(r.collecteCumulee, 900);
});

test("emploi des fonds affectés : plafonné aux fonds reçus, solde et manque", () => {
  const r = calculerFonds([pr("A")], [0, 500, 100, 0, 0], 5);
  near(r.utilisation[1], 300); near(r.manque[1], 200); near(r.soldeAEmployer[1], 0);
  near(r.utilisation[2], 100); near(r.manque[2], 0); near(r.soldeAEmployer[2], 100);   // 200 reçus − 100 employés
  assert.ok(r.alertes[0].includes("année 1"));
  const ok = calculerFonds([pr("A")], [0, 100, 100, 0, 0], 5);
  assert.deepEqual(ok.alertes, []); near(ok.soldeAEmployer[4], 300 + 200 - 200);
});

test("solde initial de fonds déjà reçus", () => {
  const r = calculerFonds([], [50, 0], 2, 80);
  near(r.utilisation[0], 50); near(r.soldeAEmployer[0], 30); near(r.manque[0], 0);
});

test("contrôles des promesses", () => {
  assert.deepEqual(controlerPromesses([pr("A")]), []);
  const e = controlerPromesses([pr("A"), pr("A"), pr("B", { probabilite: 1.5 }), pr("C", { calendrier: [{ annee: 1, part: 0.5 }] })]);
  for (const m of [/double/, /probabilité/, /calendrier/]) assert.ok(e.some((x) => m.test(x)));
});
