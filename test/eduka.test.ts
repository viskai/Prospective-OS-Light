import { test } from "node:test";
import assert from "node:assert/strict";
import { parseListeEleves, normaliseNiveau } from "../src/lib/eduka.ts";

const ENTETE = ["Code identifiant", "Payeur des frais de scolarité", "Nationalité 1", "Niveau"];

test("agrège par niveau et normalise payeur", () => {
  const r = parseListeEleves([ENTETE, ["A1", "Famille", "Française", "CM2"], ["A2", "Entreprise (facturation à la famille)", "Chinoise", "1ère"], ["A3", "Famille", "Française", null]]);
  assert.deepEqual(r.effectifParNiveau, { CM2: 1, "1ere": 1, NR: 1 });
  assert.equal(r.lignes[1].payeur, "entreprise_facture_famille");
  assert.deepEqual(r.erreurs, []);
});

test("bloque doublons et en-tête inattendu", () => {
  const r = parseListeEleves([["Nom", "x", "y", "z"], ["A1", "Famille", "FR", "CP"], ["A1", "Famille", "FR", "CP"]]);
  assert.ok(r.erreurs.length >= 5);
});

test("niveaux", () => {
  assert.equal(normaliseNiveau("Toute Petite Section"), "TPS");
  assert.equal(normaliseNiveau("Terminale"), "Tle");
  assert.equal(normaliseNiveau(undefined), "NR");
});
