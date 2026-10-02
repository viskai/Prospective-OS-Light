import { test } from "node:test";
import assert from "node:assert/strict";
import { creationsCumulees, executerScenario, type ParamsScenario } from "../src/lib/moteur.ts";
import type { Niveau } from "../src/lib/cohort.ts";
import type { Espace } from "../src/lib/espaces.ts";
import type { PosteRH } from "../src/lib/rh.ts";
import type { CouvertureDiscipline } from "../src/lib/emplois.ts";

// Jeu d'essai synthétique : effectifs agrégés par niveau (2025-26), tous les autres paramètres sont fictifs.
const E0: [string, Niveau["cycle"], number, number | undefined][] = [
  ["PS", "Mat", 17, undefined], ["MS", "Mat", 41, 100], ["GS", "Mat", 57, 100], ["CP", "Elem", 59, 100], ["CE1", "Elem", 68, 100], ["CE2", "Elem", 71, 100], ["CM1", "Elem", 80, 100], ["CM2", "Elem", 66, 100],
  ["6e", "Col", 81, 100], ["5e", "Col", 56, 100], ["4e", "Col", 48, 100], ["3e", "Col", 55, 100], ["2nde", "Lyc", 40, 100], ["1ere", "Lyc", 38, 100], ["Tle", "Lyc", 44, 100],
];
const niveaux: Niveau[] = E0.map(([code, cycle, e0, retention]) => ({ code, cycle, e0, retention, secondaire: ["Col", "Lyc"].includes(cycle) }));
const salles = (cycle: Espace["cycle"], n: number): Espace[] => Array.from({ length: n }, (_, i) => ({ ref: `${cycle}${i}`, nom: `Salle ${cycle} ${i}`, type: "salle_classe", cycle, surfaceM2: 60 }));
const poste = (ref: string, centre: string, x: Partial<PosteRH> = {}): PosteRH => ({ ref, service: "secondaire", centre, categorie: "enseignant", statut: "contractuel", quotite: 1, ors: 18, devise: "EUR", salaireBase: 60000, chargesPct: 12, ...x });
const postes: PosteRH[] = [
  ...["LET", "MAT", "ANG", "HG", "EPS", "SPC", "SVT"].flatMap((d) => [1, 2, 3, 4].map((i) => poste(`${d}${i}`, d, d === "EPS" ? { ors: 20 } : {}))),
  ...Array.from({ length: 12 }, (_, i) => poste(`PE${i}`, "PE", { statut: "pe", service: "primaire", ors: 24 })),
  ...Array.from({ length: 6 }, (_, i) => poste(`AD${i}`, "Administration", { categorie: "non_enseignant", statut: "local", service: "administration", salaireBase: 40000 })),
];

const base = (): ParamsScenario => ({
  monnaies: { base: "EUR", taux: { EUR: 1, MYR: 5 } }, debutAnnee: 2026, horizon: 15,
  niveaux, scenario: { entree: 30, croissance: 0, dRet: 0, dSec: 0 }, jauge: "plafond",
  espaces: [...salles("maternelle", 4), ...salles("elementaire", 12), ...salles("college", 8), ...salles("lycee", 6)],
  paramsEspaces: { tauxOccupation: { maternelle: 1, elementaire: 1, college: 0.85, lycee: 0.85 }, m2ParSalle: { maternelle: 80, elementaire: 70, college: 65, lycee: 65 }, plafondClasse: { maternelle: 26, elementaire: 26, college: 28, lycee: 35 } },
  projetsSaisis: [], capex: { indexationConstruction: 3, renouvellementAnnuel: 400, indexationRenouvellement: 3, dureeAmortRenouvellement: 8, vncExistante: 18000, dotationExistante: 900 },
  recettes: { tarifParSegment: { Mat: 9000, Elem: 10000, Col: 12000, Lyc: 13000 }, hausseAnnuelle: 3, remises: 5, fraisInscription: 1500, autresParEleve: 400, indexationAutres: 3, subventions: 100 },
  pfc: { taux: 6, abattement: 0, assiette: "tarif_moyen_pondere" },
  postes, politique: { revalorisation: 3, gvt: 1, tauxHSA: 2500, monnaies: { base: "EUR", taux: { EUR: 1, MYR: 5 } }, minGroupe: 3 },
  forfaits: [{ id: "imp", nom: "IMP", type: "imp", unites: 20, montantUnitaire: 1200 }, { id: "dec", nom: "Décharges", type: "decharge", unites: 5, montantUnitaire: 6000 }], coutCreation: 70000,
  contrats: [{ ref: "C1", fournisseur: "Société X", objet: "Maintenance", categorie: "maintenance", montantAnnuel: 150000, devise: "EUR", dateDebut: "2025-01-01", preavisJours: 90, indexation: 3, centreCout: "SG" }],
  chargesVariables: { indexation: 3, parM2: 40, enveloppesPeda: { Col: { montant: 150, mode: "par_eleve" } } },
  dette: { taux: 5, duree: 20 }, promesses: [], financement: { tresorerieInitiale: 3000, tauxPlacement: 2, tauxDecouvert: 8 }, bfr: { joursCreances: 20, joursDettes: 40 },
});

test("scénario complet sur 15 ans : les états financiers bouclent", () => {
  const r = executerScenario(base());
  assert.equal(r.annees.length, 15);
  assert.equal(r.etats.boucle, true, JSON.stringify(r.etats.controles.filter((c) => !c.ok)));
  assert.ok(r.effectifs.total[0] > 0);
  assert.ok(r.masse.total[0] > 0 && r.charges.total[0] > 0 && r.recettes[0].total > 0);
});

test("la capacité des salles plafonne les effectifs ; un projet d'extension proposé les libère", () => {
  const p = base();
  p.scenario = { entree: 45, croissance: 3, dRet: 0, dSec: 0 };          // croissance : besoin de salles
  const plafonne = executerScenario(p);
  const avec = executerScenario({ ...p, propositionProjets: { coutM2: 3000, dureeTravaux: 2, dureeAmort: 30, partEmprunt: 60, partFonds: 0 } });
  assert.ok(avec.projets.length > 0);
  assert.ok(avec.effectifs.total[14] > plafonne.effectifs.total[14]);
  assert.ok(avec.capex.decaissements.some((v) => v > 0) && avec.dette.tirages.some((v) => v > 0));
  assert.equal(avec.etats.boucle, true);
});

test("IB : à partir de son ouverture, retranché de la voie générale, tarifé et coûté à part", () => {
  const p = base();
  p.jauge = "demande";
  p.ib = { anneeOuverture: 2, partPremiere: 25, retention: 95, codePremiere: "1ere", codeTerminale: "Tle" };
  p.recettes = { ...p.recettes, tarifParSegment: { ...p.recettes.tarifParSegment, IB: 16000 } };
  p.chargesVariables = { ...p.chargesVariables, parEleve: { IB: 2000 } };
  const sans = executerScenario({ ...base(), jauge: "demande" }), avec = executerScenario(p);
  assert.equal(avec.effectifs.split!.ib[1], 0);
  assert.ok(avec.effectifs.split!.ib[5] > 0);
  assert.equal(avec.effectifs.total[5], sans.effectifs.total[5]);                       // même nombre d'élèves
  assert.ok(avec.recettes[5].parSegment.IB! > 0);
  assert.ok(avec.recettes[5].brut > sans.recettes[5].brut);                             // tarif IB supérieur
  assert.ok(avec.charges.parCategorie.variables_eleves[5] > (sans.charges.parCategorie.variables_eleves?.[5] ?? 0));
  assert.ok(avec.structure[5].niveaux.some((n) => n.id === "ib1"));
  assert.equal(avec.etats.boucle, true);
});

test("changer de monnaie de pilotage : mêmes états, exprimés dans l'autre monnaie", async () => {
  const { rebaser, facteurRebasage } = await import("../src/lib/monnaie.ts");
  const a = executerScenario(base());
  const f = facteurRebasage(base().monnaies, "MYR");                                    // 1 EUR = 5 MYR
  const p = base();
  const monnaies = rebaser(p.monnaies, "MYR");
  const x = (v: number) => v * f;
  const m: ParamsScenario = {
    ...p, monnaies,
    recettes: { ...p.recettes, tarifParSegment: Object.fromEntries(Object.entries(p.recettes.tarifParSegment).map(([k, v]) => [k, x(v!)])), fraisInscription: x(p.recettes.fraisInscription), autresParEleve: x(p.recettes.autresParEleve), subventions: x(p.recettes.subventions) },
    postes: postes.map((q) => ({ ...q, devise: "MYR", salaireBase: x(q.salaireBase) })), politique: { ...p.politique, monnaies, tauxHSA: x(p.politique.tauxHSA) },
    forfaits: p.forfaits.map((g) => ({ ...g, montantUnitaire: x(g.montantUnitaire) })), coutCreation: x(p.coutCreation),
    contrats: p.contrats.map((c) => ({ ...c, devise: "MYR", montantAnnuel: x(c.montantAnnuel) })),
    chargesVariables: { ...p.chargesVariables, parM2: x(40), enveloppesPeda: { Col: { montant: x(150), mode: "par_eleve" } } },
    capex: { ...p.capex, renouvellementAnnuel: x(400), vncExistante: x(18000), dotationExistante: x(900) },
    financement: { ...p.financement, tresorerieInitiale: x(3000) },
  };
  const b = executerScenario(m);
  for (const t of [0, 7, 14]) {
    assert.ok(Math.abs(b.etats.compteResultat.resultat[t] - a.etats.compteResultat.resultat[t] * f) < 1e-3 * Math.max(1, Math.abs(a.etats.compteResultat.resultat[t] * f)));
    assert.ok(Math.abs(b.etats.flux.tresorerieCloture[t] - a.etats.flux.tresorerieCloture[t] * f) < 1e-3 * Math.max(1, Math.abs(a.etats.flux.tresorerieCloture[t] * f)));
  }
  assert.equal(b.etats.boucle, true);
});

test("plan de trésorerie mensuel branché sur le scénario", () => {
  const r = executerScenario({ ...base(), planMensuel: { moisDepart: "2026-09", nbMois: 15, moisRentree: 9, calendrierFacturation: [40, 0, 0, 30, 0, 0, 30, 0, 0, 0, 0, 0], seuilMois: 3 } });
  assert.equal(r.plan!.mois.length, 15);
  assert.ok(Number.isFinite(r.plan!.pointBas.solde));
});

test("créations de postes cumulées : un poste créé reste en place", () => {
  const c = (n: number) => ({ MAT: { creations: n } as CouvertureDiscipline });
  const r = creationsCumulees([c(0), c(1), c(1), c(3), c(2)], 70000);
  assert.deepEqual(r.map((x) => [x.centre, x.etp, x.annee]), [["MAT", 1, 1], ["MAT", 2, 3]]);
});
