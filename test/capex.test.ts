import { test } from "node:test";
import assert from "node:assert/strict";
import { anneesDecaissement, calculerCapex, controlerProjets, coutProjet, type HypothesesCapex, type ProjetCapex } from "../src/lib/capex.ts";

const h: HypothesesCapex = { indexationConstruction: 0, renouvellementAnnuel: 0, indexationRenouvellement: 0, dureeAmortRenouvellement: 8, vncExistante: 0, dotationExistante: 0 };
const p: ProjetCapex = { nom: "Extension", cycle: "elementaire", salles: 4, m2: 480, coutM2: 9000, anneeService: 3, dureeTravaux: 2, dureeAmort: 30, partEmprunt: 50, partFonds: 10 };
const near = (a: number, b: number, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} ≠ ${b}`);

test("coût et calendrier de décaissement", () => {
  near(coutProjet(p), 4320);
  assert.deepEqual(anneesDecaissement(p), [1, 2]);
  assert.deepEqual(anneesDecaissement({ ...p, anneeService: 0 }), [0]);
  assert.deepEqual(anneesDecaissement({ ...p, anneeService: 1 }), [0, 0]);     // jamais avant l'année 0
});

test("décaissements, amortissement à partir de la mise en service, valeur nette", () => {
  const r = calculerCapex([p], h);
  near(r.decaissements[1], 2160); near(r.decaissements[2], 2160); near(r.decaissements[0], 0);
  assert.equal(r.dotations[2], 0);
  near(r.dotations[3], 4320 / 30); near(r.dotations[14], 4320 / 30);
  near(r.vnc[2], 4320); near(r.vnc[3], 4320 - 144);
  near(r.surfacesAjoutees[2], 0); near(r.surfacesAjoutees[3], 480);
  assert.equal(r.sallesAjoutees[3].elementaire, 4); assert.equal(r.sallesAjoutees[2].elementaire, 0);
});

test("financement : emprunt, fonds affectés, autofinancement", () => {
  const r = calculerCapex([p], h);
  near(r.emprunts[1], 1080); near(r.fonds[1], 216); near(r.autofinancement[1], 864);
  near(r.tauxAutofinancement[1]!, 0.4); assert.equal(r.tauxAutofinancement[0], null);
});

test("indexation de la construction : coût nominal décaissé et amorti", () => {
  const r = calculerCapex([p], { ...h, indexationConstruction: 5 });
  near(r.decaissements[1], 2160 * 1.05); near(r.decaissements[2], 2160 * 1.05 ** 2);
  near(r.dotations[3], (2160 * 1.05 + 2160 * 1.05 ** 2) / 30);
});

test("renouvellement du parc et immobilisations existantes", () => {
  const r = calculerCapex([], { ...h, renouvellementAnnuel: 800, dureeAmortRenouvellement: 4, vncExistante: 2500, dotationExistante: 1000 });
  near(r.renouvellement[0], 800);
  near(r.dotationsRenouvellement[0], 200); near(r.dotationsRenouvellement[3], 800); near(r.dotationsRenouvellement[4], 800);   // 4 générations en cours
  assert.deepEqual(r.dotationsExistant.slice(0, 4), [1000, 1000, 500, 0]);                                                  // plafonné à la valeur nette
  near(r.vnc[0], 2500 + 800 - 1200);
});

test("contrôles des projets", () => {
  assert.deepEqual(controlerProjets([p]), []);
  assert.ok(controlerProjets([{ ...p, partEmprunt: 80, partFonds: 30 }]).some((x) => />/.test(x)));
  assert.ok(controlerProjets([{ ...p, m2: 0 }]).length > 0);
});
