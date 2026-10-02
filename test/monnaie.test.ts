import { test } from "node:test";
import assert from "node:assert/strict";
import { facteurRebasage, formaterMontant, rebaser, tauxManquants, uniteAvecMonnaie, verifierMonnaies, versBase, type Monnaies } from "../src/lib/monnaie.ts";

const m: Monnaies = { base: "EUR", taux: { EUR: 1, MYR: 5, AUD: 1.6 }, derive: { MYR: 2 } };
const near = (a: number, b: number, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} ≠ ${b}`);

test("conversion vers la base, avec dérive", () => {
  assert.equal(versBase(m, 100, "EUR"), 100);
  near(versBase(m, 500, "MYR"), 100);
  near(versBase(m, 500, "MYR", 2), 100 / 1.02 ** 2);      // la devise se déprécie : moins d'euros
  assert.throws(() => versBase(m, 1, "USD"), /USD/);
});

test("changement de monnaie de base : les montants et les taux restent cohérents", () => {
  const n = rebaser(m, "MYR");
  assert.equal(n.base, "MYR");
  assert.equal(n.taux.MYR, 1);
  near(n.taux.EUR, 0.2);
  near(n.taux.AUD, 0.32);
  // 100 EUR = 500 MYR : facteur de rebasage 5
  assert.equal(facteurRebasage(m, "MYR"), 5);
  // même valeur économique avant / après
  near(versBase(n, 100 * facteurRebasage(m, "MYR"), "MYR"), 500);
  near(versBase(m, 80, "AUD") * facteurRebasage(m, "MYR"), versBase(n, 80, "AUD"));
  // aller-retour
  const r = rebaser(n, "EUR");
  near(r.taux.MYR, 5); near(r.taux.AUD, 1.6); near(r.derive!.MYR, 2, 1e-9);
});

test("rebasage impossible sans taux", () => {
  assert.throws(() => rebaser(m, "USD"), /USD/);
});

test("contrôles et utilitaires", () => {
  assert.deepEqual(verifierMonnaies(m), []);
  assert.ok(verifierMonnaies({ base: "EUR", taux: { MYR: 5 } }).length > 0);
  assert.deepEqual(tauxManquants(m, ["EUR", "USD", "MYR", "USD"]), ["USD"]);
  assert.equal(uniteAvecMonnaie("k{M}/an", m), "kEUR/an");
  assert.match(formaterMontant(m, 1234.4, { milliers: true }), /^1[\s  ]234 k EUR$/);
});
