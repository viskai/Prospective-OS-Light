import { test } from "node:test";
import assert from "node:assert/strict";
import { CALENDRIER_UNIFORME, echeancier, planMensuel, simulerEmprunt, soldeOuverture, type ParamsPlanMensuel } from "../src/lib/tresorerie.ts";

const near = (a: number, b: number, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} ≠ ${b}`);

test("simulation d'emprunt : annuité constante, capital remboursé en totalité", () => {
  const s = simulerEmprunt(1000, 6, 10);
  near(s.annuite, 1000 * 0.06 / (1 - 1.06 ** -10));
  near(s.echeancier.reduce((x, e) => x + e.capital, 0), 1000);
  near(s.echeancier.at(-1)!.encours, 0);
  near(s.totalInterets, s.annuite * 10 - 1000);
  near(simulerEmprunt(1000, 0, 4).annuite, 250);
  const d = simulerEmprunt(1000, 5, 5, 2);
  assert.equal(d.echeancier[0].capital, 0); assert.equal(d.echeancier.length, 7);
  near(d.echeancier.at(-1)!.encours, 0);
});

test("échéancier : intérêts sur le capital d'ouverture, remboursement dès l'année suivante", () => {
  const e = echeancier([0, 1000, 0, 0, 0, 0], { taux: 6, duree: 4 });
  assert.equal(e.interets[1], 0); assert.equal(e.capital[1], 0);          // tirage de l'année : rien à payer
  near(e.interets[2], 60); near(e.service[2], 1000 * 0.06 / (1 - 1.06 ** -4));
  near(e.encours[1], 1000); near(e.encours[5], 0);
  near(e.capital.reduce((s, x) => s + x, 0), 1000);
});

test("échéancier : emprunts existants et tirages successifs", () => {
  const e = echeancier([500, 0, 500, 0, 0, 0, 0, 0], { taux: 5, duree: 3 }, [{ ref: "X", nom: "Prêt", encours: 900, taux: 4, dureeRestante: 3 }]);
  near(e.interets[0], 36);                                                  // 900 × 4 %, dès l'année 0
  near(e.capital.reduce((s, x) => s + x, 0), 900 + 1000);
  near(e.encours[7], 0);
});

test("comptes multidevises vers la monnaie de base", () => {
  const m = { base: "EUR", taux: { EUR: 1, MYR: 5 } };
  near(soldeOuverture([{ ref: "1", nom: "A", devise: "EUR", solde: 200000 }, { ref: "2", nom: "B", devise: "MYR", solde: 500000 }], m), 300);
});

const annuel = (v: number, n = 3) => Array(n).fill(v);
const plan = (x: Partial<ParamsPlanMensuel> = {}): ParamsPlanMensuel => ({
  moisDepart: "2026-09", nbMois: 12, moisRentree: 9, debutAnnee: 2026, soldeOuverture: 100,
  annuel: { encaissements: annuel(1200), paie: annuel(800), fournisseurs: annuel(240), capex: annuel(120), serviceDette: annuel(60) },
  calendrierFacturation: [40, 0, 0, 30, 0, 0, 30, 0, 0, 0, 0, 0], seuilMois: 3, ...x,
});

test("plan mensuel : saisonnalité des encaissements, soldes et point bas", () => {
  const r = planMensuel(plan());
  assert.equal(r.mois.length, 12);
  near(r.mois[0].encaissements, 480); near(r.mois[1].encaissements, 0); near(r.mois[3].encaissements, 360);
  near(r.mois[0].paie, 800 / 12);
  near(r.mois[11].solde, 100 + 1200 - 800 - 240 - 120 - 60);                // flux annuel
  assert.ok(r.pointBas.solde <= Math.min(...r.mois.map((x) => x.solde)) + 1e-9);
  assert.equal(r.pointBas.mois, "2027-08");                                  // fin du plan : veille de la rentrée suivante, avant la 1re facturation
});

test("plan mensuel sur 18 mois à cheval sur deux années, alertes", () => {
  const r = planMensuel(plan({ moisDepart: "2026-10", nbMois: 18, soldeOuverture: 0 }));
  assert.equal(r.mois.length, 18); assert.equal(r.mois[0].t, 0); assert.equal(r.mois[11].t, 1);   // sept 2027 = année 1
  assert.equal(r.mois[0].mois, "2026-10"); assert.equal(r.mois[17].mois, "2028-03");
  assert.ok(r.alertes.length > 0);                                           // solde négatif avant la facturation
});

test("plan mensuel : calendriers contrôlés, bornes de durée", () => {
  assert.throws(() => planMensuel(plan({ nbMois: 24 })), /12 à 18/);
  assert.throws(() => planMensuel(plan({ calendrierFacturation: [50, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] })), /somme/);
  assert.throws(() => planMensuel(plan({ moisDepart: "2030-01" })), /hors de la projection/);
  const flat = planMensuel(plan({ calendrierFacturation: CALENDRIER_UNIFORME, soldeOuverture: 400 }));
  assert.equal(flat.alertes.length, 0);
});
