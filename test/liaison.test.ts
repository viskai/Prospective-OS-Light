import { test } from "node:test";
import assert from "node:assert/strict";
import { projeter, separerIB, type Niveau } from "../src/lib/cohort.ts";
import { effectifsParSegment, niveauxStructureAnnee, structureParAnnee, nouveauxInscrits } from "../src/lib/liaison.ts";

const niv: Niveau[] = [
  { code: "2nde", cycle: "Lyc", e0: 100 }, { code: "1ere", cycle: "Lyc", e0: 100, retention: 100 }, { code: "Tle", cycle: "Lyc", e0: 100, retention: 100 },
];
const res = projeter({ niveaux: niv, scenario: { entree: 100, croissance: 0, dRet: 0, dSec: 0 }, jauge: "demande", horizon: 10, capacite: () => 1e9 });
const ibp = { anneeOuverture: 3, partPremiere: 20, retention: 90, codePremiere: "1ere", codeTerminale: "Tle" };

test("IB inexistant avant son ouverture, puis retranché de la 1ère et de la terminale", () => {
  const s = separerIB(res, niv, ibp);
  assert.equal(s.ib1[2], 0); assert.equal(s.ib1[3], 20);              // 20 % de 100
  assert.equal(s.ib2[3], 0); assert.equal(s.ib2[4], 18);              // 20 × 90 %
  assert.equal(s.premiereGenerale[4], 80);
  assert.equal(s.terminaleGenerale[4], 100 - 18);
  assert.equal(s.ib[4], 38);
  // le total du lycée est inchangé
  for (let t = 0; t < 10; t++) assert.equal(s.premiereGenerale[t] + s.terminaleGenerale[t] + s.ib[t], res.effectifs[t][1] + res.effectifs[t][2]);
});

test("part d'IB croissante par année, IB2 plafonné à la terminale", () => {
  const s = separerIB(res, niv, { ...ibp, anneeOuverture: 1, partPremiere: [10, 20, 30, 40] });
  assert.equal(s.ib1[1], 10); assert.equal(s.ib1[3], 30); assert.equal(s.ib1[9], 40);   // série depuis l'ouverture, dernière valeur prolongée
  const gros = separerIB(res, niv, { ...ibp, anneeOuverture: 1, partPremiere: 100, retention: 150 });
  assert.ok(gros.alertes.length > 0);
  assert.ok(gros.ib2.every((v, t) => v <= res.effectifs[t][2] + 1e-9));
});

test("entrées de structure : IB à part, voie générale nette", () => {
  const n = niveauxStructureAnnee(niv, [100, 100, 100], { ib1: 20, ib2: 18 });
  assert.deepEqual(n, [{ id: "2nde", eff: 100 }, { id: "1g", eff: 80 }, { id: "tg", eff: 82 }, { id: "ib1", eff: 20 }, { id: "ib2", eff: 18 }]);
  assert.deepEqual(niveauxStructureAnnee(niv, [100, 100, 100]).map((x) => x.id), ["2nde", "1g", "tg"]);
});

test("structure par année : l'IB apporte ses propres heures et divisions", () => {
  const s = separerIB(res, niv, ibp);
  const st = structureParAnnee(niv, res, s);
  assert.equal(st.length, 10);
  assert.equal(st[2].niveaux.some((n) => n.id === "ib1"), false);
  assert.equal(st[5].niveaux.some((n) => n.id === "ib1"), true);
  assert.ok((st[5].besoins.PHI ?? 0) > (st[2].besoins.PHI ?? 0));       // TOK et matières IB ajoutés
});

test("effectifs par segment tarifaire", () => {
  const s = separerIB(res, niv, ibp);
  const seg = effectifsParSegment(res, s);
  assert.equal(seg[2].IB, undefined);
  assert.equal(seg[4].IB, 38);
  assert.equal(seg[4].Lyc! + seg[4].IB!, res.parCycle[4].Lyc);
  assert.equal(nouveauxInscrits(res).length, 10);
});
