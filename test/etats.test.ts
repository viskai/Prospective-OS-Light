import { test } from "node:test";
import assert from "node:assert/strict";
import { consolider, type EntreesEtats } from "../src/lib/etats.ts";
import { calculerCapex } from "../src/lib/capex.ts";
import { echeancier } from "../src/lib/tresorerie.ts";
import { calculerFonds } from "../src/lib/fonds.ts";

const H = 8;
const near = (a: number, b: number, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} ≠ ${b}`);
const serie = (v: number) => Array<number>(H).fill(v);

function entrees(x: Partial<EntreesEtats> = {}): EntreesEtats {
  const capex = calculerCapex(
    [{ nom: "Extension", cycle: "elementaire", salles: 4, m2: 480, coutM2: 9000, anneeService: 3, dureeTravaux: 2, dureeAmort: 30, partEmprunt: 50, partFonds: 10 }],
    { indexationConstruction: 3, renouvellementAnnuel: 500, indexationRenouvellement: 3, dureeAmortRenouvellement: 8, vncExistante: 20000, dotationExistante: 1200 }, H);
  const fonds = calculerFonds([{ ref: "A", campagne: "C", montant: 1000, probabilite: 0.8, calendrier: [{ annee: 1, part: 1 }], affectation: { projet: "Extension" } }, { ref: "B", campagne: "C", montant: 100, probabilite: 1, calendrier: [{ annee: 0, part: 1 }], affectation: "libre" }], capex.fonds, H);
  const dette = echeancier(capex.emprunts, { taux: 6, duree: 20 }, [{ ref: "X", nom: "Prêt", encours: 3000, taux: 4, dureeRestante: 6 }], H);
  return {
    annees: Array.from({ length: H }, (_, i) => `${2026 + i}-${27 + i}`),
    produits: { scolarite: serie(9000), inscription: serie(300), autres: serie(500), subventions: serie(150), donsLibres: fonds.donsLibres },
    charges: { personnel: serie(7000), fonctionnement: serie(1800), pfc: serie(500) },
    capex: { decaissements: capex.decaissements, dotations: capex.dotations, vnc: capex.vnc },
    dette, fondsAffectes: { recus: fonds.fondsAffectesRecus, utilisation: fonds.utilisation, soldeInitial: 0 },
    financement: { tresorerieInitiale: 2500, tauxPlacement: 3, tauxDecouvert: 9 }, bfr: { joursCreances: 30, joursDettes: 45 },
    ouverture: { vncExistante: 20000, empruntsExistants: 3000 }, ...x,
  };
}

test("les trois états bouclent : bilan équilibré, flux = variation de trésorerie", () => {
  const r = consolider(entrees());
  assert.deepEqual(r.controles.filter((c) => !c.ok), [], JSON.stringify(r.controles));
  assert.equal(r.boucle, true);
  for (let t = 0; t < H; t++) near(r.bilan.actif.total[t], r.bilan.passif.total[t]);
});

test("compte de résultat : produits, charges, amortissements, intérêts", () => {
  const e = entrees(), r = consolider(e);
  near(r.compteResultat.produits.total[1], 9000 + 300 + 500 + 150 + e.produits.donsLibres[1] + r.compteResultat.produits.financiers[1]);
  near(r.compteResultat.charges.amortissements[0], 1200 + 500 / 8);
  near(r.compteResultat.charges.interetsEmprunts[0], 3000 * 0.04);
  near(r.compteResultat.resultat[0], r.compteResultat.produits.total[0] - r.compteResultat.charges.total[0]);
  near(r.compteResultat.produits.financiers[0], 2500 * 0.03);
});

test("flux : exploitation, investissement, financement ; fonds affectés et emprunts", () => {
  const e = entrees(), r = consolider(e);
  near(r.flux.investissement[2], -e.capex.decaissements[2]);
  near(r.flux.financement[1], e.dette.tirages[1] - e.dette.capital[1] + e.fondsAffectes.recus[1]);
  near(r.flux.tresorerieCloture[0], r.flux.tresorerieOuverture[0] + r.flux.variation[0]);
  near(r.flux.tresorerieOuverture[3], r.flux.tresorerieCloture[2]);
  assert.ok(r.bilan.passif.fondsAffectes[1] > 0);
  near(r.bilan.passif.emprunts[H - 1], e.dette.encours[H - 1]);
});

test("découvert : trésorerie négative au passif, frais financiers, états toujours bouclés", () => {
  const r = consolider(entrees({ financement: { tresorerieInitiale: -1500, tauxPlacement: 3, tauxDecouvert: 9 }, charges: { personnel: serie(11000), fonctionnement: serie(1800), pfc: serie(500) } }));
  assert.ok(r.bilan.passif.concoursBancaires.some((v) => v > 0));
  near(r.compteResultat.charges.fraisDecouvert[0], 1500 * 0.09);
  assert.equal(r.boucle, true);
  assert.ok(r.kpis.pointBasTresorerie < 0);
});

test("contrôle bloquant : une valeur nette incohérente (D2) casse le bilan", () => {
  const e = entrees();
  e.capex.vnc = e.capex.vnc.map((v, t) => (t === 4 ? v + 100 : v));
  const r = consolider(e);
  assert.equal(r.boucle, false);
  assert.equal(r.controles.find((c) => c.code === "bilan")!.ok, false);
});

test("fonds propres : variation = résultat + emploi des fonds affectés", () => {
  const e = entrees(), r = consolider(e);
  const fp = r.bilan.passif.fondsPropres;
  near(fp[1] - fp[0], r.compteResultat.resultat[1] + e.fondsAffectes.utilisation[1]);
  assert.ok(e.fondsAffectes.utilisation.some((v) => v > 0));
});

test("KPI : marge nette, masse salariale sur recettes, jours de charges couverts, endettement", () => {
  const r = consolider(entrees());
  near(r.kpis.margeNette[0]!, r.compteResultat.resultat[0] / r.compteResultat.produits.total[0]);
  near(r.kpis.masseSalarialeSurRecettes[0]!, 7000 / r.compteResultat.produits.total[0]);
  assert.ok(r.kpis.joursChargesCouverts[0]! > 0);
  assert.ok(r.kpis.endettementSurFondsPropres.every((v) => v != null));
});
