// Moteur de scénario : enchaîne A1 → D1 → B1 → A2/A3 → B2/B3 → C1 → D2 → D3 → P4 → P3 (états bouclés) → plan mensuel.
// Les modules ne s'appellent pas entre eux : le moteur transmet leurs sorties (drivers publiés) au module suivant.
import { projeter, separerIB, type Entree, type Niveau, type ParamsIB, type Scenario, type Jauge, type SplitIB } from "./cohort.ts";
import { effectifsParSegment, nouveauxInscrits, structureParAnnee } from "./liaison.ts";
import { REGLAGES_DEFAUT, type Reglages } from "./referentiel.ts";
import type { ResStructure } from "./structure.ts";
import { capaciteAccueil, confronter, divisionsParCycle, projetsDepuisBesoins, surfaceTotale, type ConfrontationAnnee, type Espace, type ParamsEspaces, type ParamsProjets } from "./espaces.ts";
import { calculerCapex, type HypothesesCapex, type ProjetCapex, type ResultatCapex } from "./capex.ts";
import { pfc as calculerPfc, recettesAnnee, type HypothesesPFC, type HypothesesRecettes, type RecettesAnnee } from "./recettes.ts";
import { calculerCouverture, EMPLOIS_DEFAUT, type CouvertureDiscipline, type ReglagesEmplois } from "./emplois.ts";
import { enPlaceDepuisPostes, projeterMasseSalariale, type Forfait, type MasseSalariale, type PolitiqueSalariale, type PosteCree, type PosteRH } from "./rh.ts";
import { projeterCharges, type ChargesProjetees, type ChargesVariables, type Contrat } from "./contrats.ts";
import { echeancier, planMensuel, type Echeancier, type EmpruntExistant, type ParamsDette, type ParamsPlanMensuel, type PlanMensuel } from "./tresorerie.ts";
import { calculerFonds, type Promesse, type ResultatFonds } from "./fonds.ts";
import { consolider, type EtatsFinanciers } from "./etats.ts";
import type { Monnaies } from "./monnaie.ts";

export interface ParamsScenario {
  monnaies: Monnaies;
  debutAnnee: number;
  horizon?: number;                                  // défaut 15
  // A1
  niveaux: Niveau[]; scenario: Scenario; jauge: Jauge; ib?: ParamsIB;
  // B1 / B2
  reglagesStructure?: Reglages; reglagesEmplois?: ReglagesEmplois;
  // D1 / D2
  espaces: Espace[]; paramsEspaces: ParamsEspaces; projetsSaisis: ProjetCapex[]; propositionProjets?: ParamsProjets; capex: HypothesesCapex;
  // A2 / A3
  recettes: HypothesesRecettes; pfc: HypothesesPFC;
  // B3
  postes: PosteRH[]; politique: PolitiqueSalariale; forfaits: Forfait[]; coutCreation: number;
  // C1
  contrats: Contrat[]; chargesVariables: ChargesVariables;
  // D3 / P4 / P3
  dette: ParamsDette; empruntsExistants?: EmpruntExistant[]; promesses: Promesse[]; fondsSoldeInitial?: number;
  financement: { tresorerieInitiale: number; tauxPlacement: number; tauxDecouvert: number };
  bfr: { joursCreances: number; joursDettes: number };
  planMensuel?: Pick<ParamsPlanMensuel, "moisDepart" | "nbMois" | "moisRentree" | "calendrierFacturation" | "seuilMois"> & Partial<ParamsPlanMensuel>;
}

export interface ResultatScenario {
  annees: string[];
  effectifs: { total: number[]; split?: SplitIB };
  structure: ResStructure[];
  confrontation: ConfrontationAnnee[];
  projets: ProjetCapex[];
  recettes: RecettesAnnee[]; pfc: number[];
  couvertures: Record<string, CouvertureDiscipline>[];
  creations: PosteCree[];
  masse: MasseSalariale;
  charges: ChargesProjetees;
  capex: ResultatCapex;
  dette: Echeancier;
  fonds: ResultatFonds;
  etats: EtatsFinanciers;
  plan?: PlanMensuel;
  alertes: string[];
}

/** Créations de postes cumulées : un temps plein créé reste en place ; on ne compte que l'augmentation d'une année sur l'autre. */
export function creationsCumulees(couvertures: Record<string, CouvertureDiscipline>[], coutUnitaire: number): PosteCree[] {
  const out: PosteCree[] = [];
  const cumul: Record<string, number> = {};
  couvertures.forEach((c, t) => {
    for (const [d, x] of Object.entries(c)) {
      const cible = Math.max(cumul[d] ?? 0, x.creations);
      if (cible > (cumul[d] ?? 0)) out.push({ centre: d, etp: cible - (cumul[d] ?? 0), annee: t, coutUnitaire });
      cumul[d] = cible;
    }
  });
  return out;
}

export function executerScenario(P: ParamsScenario): ResultatScenario {
  const H = P.horizon ?? 15;
  const R = P.reglagesStructure ?? REGLAGES_DEFAUT;
  const alertes: string[] = [];
  const entree = (jauge: Jauge, capacite: Entree["capacite"]): Entree => ({ niveaux: P.niveaux, scenario: P.scenario, jauge, horizon: H, capacite });

  // 1. besoin en salles sur la demande non plafonnée → projets d'extension éventuels (D1)
  const demande = projeter(entree("demande", () => Infinity));
  const struct0 = structureParAnnee(P.niveaux, demande, P.ib ? separerIB(demande, P.niveaux, P.ib) : undefined, R);
  const div0 = struct0.map((s) => divisionsParCycle(s.niveaux.map((n) => ({ cycle: n.cycle, div: n.div }))));
  const projets = [...P.projetsSaisis, ...(P.propositionProjets ? projetsDepuisBesoins(div0, P.espaces, P.projetsSaisis, P.paramsEspaces, P.propositionProjets) : [])];

  // 2. effectifs définitifs avec la capacité des salles disponibles (jauge) et structure pédagogique (B1)
  const res = projeter(entree(P.jauge, capaciteAccueil(P.espaces, projets, P.paramsEspaces)));
  const split = P.ib ? separerIB(res, P.niveaux, P.ib) : undefined;
  alertes.push(...(split?.alertes ?? []));
  const structure = structureParAnnee(P.niveaux, res, split, R);
  const divisions = structure.map((s) => divisionsParCycle(s.niveaux.map((n) => ({ cycle: n.cycle, div: n.div }))));
  const confrontation = confronter(divisions, P.espaces, projets, P.paramsEspaces);
  structure.forEach((s, t) => s.alertes.filter((a) => a.niveau === "critique").forEach((a) => alertes.push(`Année ${t} : ${a.texte}`)));

  // 3. recettes et PFC (A2/A3)
  const segments = effectifsParSegment(res, split), nouveaux = nouveauxInscrits(res);
  const recettes = segments.map((e, t) => recettesAnnee(t, e, nouveaux[t], P.recettes));
  const pfcs = segments.map((e, t) => calculerPfc(t, e, P.recettes, P.pfc));

  // 4. emplois (B2) puis masse salariale (B3)
  const enPlace = enPlaceDepuisPostes(P.postes, (P.reglagesEmplois ?? EMPLOIS_DEFAUT).ors.defaut);
  const couvertures = structure.map((s) => calculerCouverture(s.besoins, enPlace.parDiscipline, P.reglagesEmplois ?? EMPLOIS_DEFAUT));
  const creations = creationsCumulees(couvertures, P.coutCreation);
  const masse = projeterMasseSalariale(P.postes, P.politique, { horizon: H, debut: P.debutAnnee, forfaits: P.forfaits, creations });

  // 5. CAPEX (D2), charges de fonctionnement (C1)
  const capex = calculerCapex(projets, P.capex, H);
  const surfaces = capex.surfacesAjoutees.map((m2) => m2 + surfaceTotale(P.espaces));
  const charges = projeterCharges(P.contrats, P.chargesVariables, { monnaies: P.monnaies, debutAnnee: P.debutAnnee, effectifs: segments, surfaces, horizon: H });

  // 6. dette (D3), fonds affectés (P4)
  const dette = echeancier(capex.emprunts, P.dette, P.empruntsExistants ?? [], H);
  const fonds = calculerFonds(P.promesses, capex.fonds, H, P.fondsSoldeInitial ?? 0);
  alertes.push(...fonds.alertes);

  // 7. états financiers bouclés (P3)
  const etats = consolider({
    annees: masse.annees,
    produits: { scolarite: recettes.map((r) => r.net), inscription: recettes.map((r) => r.inscription), autres: recettes.map((r) => r.autres), subventions: recettes.map((r) => r.subventions), donsLibres: fonds.donsLibres },
    charges: { personnel: masse.total, fonctionnement: charges.total, pfc: pfcs },
    capex: { decaissements: capex.decaissements, dotations: capex.dotations, vnc: capex.vnc },
    dette, fondsAffectes: { recus: fonds.fondsAffectesRecus, utilisation: fonds.utilisation, soldeInitial: P.fondsSoldeInitial ?? 0 },
    financement: P.financement, bfr: P.bfr, ouverture: { vncExistante: P.capex.vncExistante, empruntsExistants: (P.empruntsExistants ?? []).reduce((s, e) => s + e.encours, 0) },
    analytique: { personnel: masse.lignes, fonctionnement: charges.parCategorie },
  });
  if (!etats.boucle) alertes.push("États financiers non bouclés : " + etats.controles.filter((c) => !c.ok).map((c) => c.libelle).join(" ; "));

  // 8. plan de trésorerie mensuel (D3)
  let plan: PlanMensuel | undefined;
  if (P.planMensuel) {
    const encaissements = recettes.map((r, t) => r.net + r.inscription + r.autres + r.subventions + fonds.donsLibres[t]);
    plan = planMensuel({
      debutAnnee: P.debutAnnee, soldeOuverture: P.financement.tresorerieInitiale, ...P.planMensuel,
      annuel: { encaissements, paie: masse.total, fournisseurs: charges.total.map((v, t) => v + pfcs[t]), capex: capex.decaissements, serviceDette: dette.service, ressources: dette.tirages.map((v, t) => v + fonds.fondsAffectesRecus[t]) },
    });
    alertes.push(...plan.alertes);
  }
  return { annees: masse.annees, effectifs: { total: res.total, split }, structure, confrontation, projets, recettes, pfc: pfcs, couvertures, creations, masse, charges, capex, dette, fonds, etats, plan, alertes };
}
