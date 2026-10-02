// P3 — États financiers bouclés : compte de résultat par nature, bilan, tableau des flux de trésorerie, par scénario.
// Consolide les sorties des modules (A2/A3, B3, C1, D2, D3, P4). Montants en milliers de la monnaie de pilotage.
// Aucun module n'écrit ici : les états ne font que consolider, puis des contrôles bloquants vérifient la fermeture.
import type { Echeancier } from "./tresorerie.ts";
import type { LigneMasse } from "./rh.ts";

export interface EntreesEtats {
  annees: string[];
  produits: { scolarite: number[]; inscription: number[]; autres: number[]; subventions: number[]; donsLibres: number[] };
  charges: { personnel: number[]; fonctionnement: number[]; pfc: number[] };
  capex: { decaissements: number[]; dotations: number[]; vnc: number[] };       // D2 : vnc = valeur nette en fin d'année
  dette: Echeancier;                                                            // D3 : tirages, intérêts, capital, encours
  fondsAffectes: { recus: number[]; utilisation: number[]; soldeInitial: number };   // P4
  financement: { tresorerieInitiale: number; tauxPlacement: number; tauxDecouvert: number };   // % annuels
  bfr: { joursCreances: number; joursDettes: number; creancesInitiales?: number; dettesInitiales?: number };
  ouverture: { vncExistante: number; empruntsExistants: number };              // bilan d'ouverture ; les fonds propres en sont l'ajustement
  analytique?: { personnel: LigneMasse[]; fonctionnement: Record<string, number[]> };
  tolerance?: number;
}

export interface Controle { code: string; libelle: string; ok: boolean; ecartMax: number }

export interface EtatsFinanciers {
  annees: string[];
  compteResultat: {
    produits: { scolarite: number[]; inscription: number[]; autres: number[]; subventions: number[]; donsLibres: number[]; financiers: number[]; total: number[] };
    charges: { personnel: number[]; fonctionnement: number[]; pfc: number[]; amortissements: number[]; interetsEmprunts: number[]; fraisDecouvert: number[]; total: number[] };
    resultat: number[];
  };
  bilan: {
    actif: { immobilisations: number[]; creancesFamilles: number[]; tresorerie: number[]; total: number[] };
    passif: { fondsPropres: number[]; fondsAffectes: number[]; emprunts: number[]; dettesFournisseurs: number[]; concoursBancaires: number[]; total: number[] };
  };
  flux: {
    exploitation: number[]; investissement: number[]; financement: number[]; variation: number[];
    tresorerieOuverture: number[]; tresorerieCloture: number[];
    detail: { resultat: number[]; dotations: number[]; variationBFR: number[]; decaissementsCapex: number[]; tirages: number[]; capitalRembourse: number[]; fondsAffectesRecus: number[] };
  };
  controles: Controle[];
  boucle: boolean;
  kpis: { margeNette: (number | null)[]; masseSalarialeSurRecettes: (number | null)[]; joursChargesCouverts: (number | null)[]; endettementSurFondsPropres: (number | null)[]; pointBasTresorerie: number };
  analytique?: EntreesEtats["analytique"];
}

const sum = (...a: number[][]) => a[0].map((_, t) => a.reduce((s, x) => s + x[t], 0));

export function consolider(e: EntreesEtats): EtatsFinanciers {
  const H = e.annees.length;
  const tol = e.tolerance ?? 1e-6;
  const z = () => Array<number>(H).fill(0);
  const financiers = z(), fraisDecouvert = z();
  const creances = z(), dettes = z(), resultat = z(), fondsPropres = z(), fondsAff = z(), tresorerie = z();
  const variationBFR = z(), exploitation = z(), investissement = z(), financement = z(), variation = z(), ouvT = z();
  const prodTotal = z(), chargesTotal = z(), ventes = z();

  // bilan d'ouverture : les fonds propres sont l'ajustement
  const recettesFamilles = (t: number) => e.produits.scolarite[t] + e.produits.inscription[t] + e.produits.autres[t];
  const creances0 = e.bfr.creancesInitiales ?? (recettesFamilles(0) * e.bfr.joursCreances) / 365;
  const dettes0 = e.bfr.dettesInitiales ?? (e.charges.fonctionnement[0] * e.bfr.joursDettes) / 365;
  const actif0 = e.ouverture.vncExistante + creances0 + e.financement.tresorerieInitiale;
  let fp = actif0 - e.ouverture.empruntsExistants - dettes0 - e.fondsAffectes.soldeInitial;
  let fa = e.fondsAffectes.soldeInitial, cash = e.financement.tresorerieInitiale, creancesPrec = creances0, dettesPrec = dettes0;

  for (let t = 0; t < H; t++) {
    // produits et charges financiers sur la trésorerie d'ouverture
    financiers[t] = cash > 0 ? (cash * e.financement.tauxPlacement) / 100 : 0;
    fraisDecouvert[t] = cash < 0 ? (-cash * e.financement.tauxDecouvert) / 100 : 0;
    prodTotal[t] = e.produits.scolarite[t] + e.produits.inscription[t] + e.produits.autres[t] + e.produits.subventions[t] + e.produits.donsLibres[t] + financiers[t];
    chargesTotal[t] = e.charges.personnel[t] + e.charges.fonctionnement[t] + e.charges.pfc[t] + e.capex.dotations[t] + e.dette.interets[t] + fraisDecouvert[t];
    resultat[t] = prodTotal[t] - chargesTotal[t];
    ventes[t] = recettesFamilles(t);

    creances[t] = (recettesFamilles(t) * e.bfr.joursCreances) / 365;
    dettes[t] = (e.charges.fonctionnement[t] * e.bfr.joursDettes) / 365;
    variationBFR[t] = creances[t] - creancesPrec - (dettes[t] - dettesPrec);
    creancesPrec = creances[t]; dettesPrec = dettes[t];

    exploitation[t] = resultat[t] + e.capex.dotations[t] - variationBFR[t];
    investissement[t] = -e.capex.decaissements[t];
    financement[t] = e.dette.tirages[t] - e.dette.capital[t] + e.fondsAffectes.recus[t];
    variation[t] = exploitation[t] + investissement[t] + financement[t];
    ouvT[t] = cash; cash += variation[t]; tresorerie[t] = cash;

    fa += e.fondsAffectes.recus[t] - e.fondsAffectes.utilisation[t]; fondsAff[t] = fa;
    fp += resultat[t] + e.fondsAffectes.utilisation[t];            // l'emploi des fonds affectés rejoint les fonds propres (hors résultat)
    fondsPropres[t] = fp;
  }

  const immos = e.capex.vnc;
  const actif = { immobilisations: immos, creancesFamilles: creances, tresorerie: tresorerie.map((v) => Math.max(0, v)) };
  const passifBase = { fondsPropres, fondsAffectes: fondsAff, emprunts: e.dette.encours, dettesFournisseurs: dettes, concoursBancaires: tresorerie.map((v) => Math.max(0, -v)) };
  const actifTotal = sum(actif.immobilisations, actif.creancesFamilles, actif.tresorerie);
  const passifTotal = sum(passifBase.fondsPropres, passifBase.fondsAffectes, passifBase.emprunts, passifBase.dettesFournisseurs, passifBase.concoursBancaires);

  // contrôles bloquants (§6 P3)
  const max = (a: number[]) => a.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
  const ecartBilan = actifTotal.map((v, t) => v - passifTotal[t]);
  const dFP = fondsPropres.map((v, t) => v - (t ? fondsPropres[t - 1] : fondsPropres[0] - resultat[0] - e.fondsAffectes.utilisation[0]));
  const ecartFP = dFP.map((v, t) => v - resultat[t] - e.fondsAffectes.utilisation[t]);
  const ecartFlux = tresorerie.map((v, t) => v - ((t ? tresorerie[t - 1] : e.financement.tresorerieInitiale) + exploitation[t] + investissement[t] + financement[t]));
  const tresoBilan = sum(actif.tresorerie, passifBase.concoursBancaires.map((v) => -v));
  const ecartTreso = tresoBilan.map((v, t) => v - tresorerie[t]);
  const controle = (code: string, libelle: string, ecarts: number[]): Controle => ({ code, libelle, ok: max(ecarts) <= tol * Math.max(1, ...e.capex.vnc.map(Math.abs)), ecartMax: max(ecarts) });
  const controles = [
    controle("bilan", "Bilan équilibré (actif = passif)", ecartBilan),
    controle("fonds_propres", "Variation des fonds propres = résultat, hors apports de fonds affectés", ecartFP),
    controle("flux", "Flux de trésorerie = variation de trésorerie", ecartFlux),
    controle("tresorerie", "Trésorerie de clôture = trésorerie du bilan", ecartTreso),
  ];

  const ratio = (n: number, d: number) => (Math.abs(d) > 1e-9 ? n / d : null);
  const decaissables = (t: number) => e.charges.personnel[t] + e.charges.fonctionnement[t] + e.charges.pfc[t] + e.dette.interets[t];
  return {
    annees: e.annees,
    compteResultat: {
      produits: { ...e.produits, financiers, total: prodTotal },
      charges: { personnel: e.charges.personnel, fonctionnement: e.charges.fonctionnement, pfc: e.charges.pfc, amortissements: e.capex.dotations, interetsEmprunts: e.dette.interets, fraisDecouvert, total: chargesTotal },
      resultat,
    },
    bilan: { actif: { ...actif, total: actifTotal }, passif: { ...passifBase, total: passifTotal } },
    flux: { exploitation, investissement, financement, variation, tresorerieOuverture: ouvT, tresorerieCloture: tresorerie,
      detail: { resultat, dotations: e.capex.dotations, variationBFR, decaissementsCapex: e.capex.decaissements, tirages: e.dette.tirages, capitalRembourse: e.dette.capital, fondsAffectesRecus: e.fondsAffectes.recus } },
    controles, boucle: controles.every((c) => c.ok),
    kpis: {
      margeNette: resultat.map((r, t) => ratio(r, prodTotal[t])),
      masseSalarialeSurRecettes: e.charges.personnel.map((p, t) => ratio(p, prodTotal[t])),
      joursChargesCouverts: tresorerie.map((c, t) => ratio(c * 365, decaissables(t))),
      endettementSurFondsPropres: e.dette.encours.map((d, t) => ratio(d, fondsPropres[t])),
      pointBasTresorerie: Math.min(...tresorerie),
    },
    analytique: e.analytique,
  };
}
