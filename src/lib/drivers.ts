// P1 — Registre des drivers : catalogue des hypothèses (nom, unité, module source).
// Les libellés vivent ici, source unique réutilisée par les écrans et le moteur.
// Unités monétaires : jeton {M} remplacé par la monnaie de pilotage (uniteAvecMonnaie) ; `monetaire` pilote le re-basage.
import { NIVEAUX } from "./eduka.ts";
import type { Monnaies } from "./monnaie.ts";
import { uniteAvecMonnaie } from "./monnaie.ts";

export type ModuleSource = "A1" | "A2" | "A3" | "B1" | "B2" | "B3" | "C1" | "D1" | "D2" | "D3" | "P3" | "P4" | "global";

export interface DriverDef {
  code: string;
  libelle: string;
  unite: string;
  module: ModuleSource;
  pas?: number;
  calcule?: boolean;   // publié par un module (non saisi)
  monetaire?: boolean; // montant en monnaie de pilotage : converti si la monnaie de base change
}

export const SCENARIOS = ["central", "favorable", "stress"] as const;
export const HORIZON_ANNEES = 15;

const d = (code: string, libelle: string, unite: string, module: ModuleSource, pas = 1): DriverDef =>
  ({ code, libelle, unite, module, pas, monetaire: unite.includes("{M}") });

export function registreInitial(): DriverDef[] {
  const out: DriverDef[] = [];
  out.push(d("global.monnaie", "Monnaie de pilotage", "code", "global"));
  for (const s of SCENARIOS) {
    out.push(d(`scen.${s}.entree`, `Entrées au 1er niveau — ${s}`, "élèves/an", "A1"));
    out.push(d(`scen.${s}.croissance`, `Croissance de l'entrée — ${s}`, "%/an", "A1", 0.5));
    out.push(d(`scen.${s}.dRet`, `Δ rétention tous niveaux — ${s}`, "pts", "A1", 0.5));
    out.push(d(`scen.${s}.dSec`, `Δ rétention secondaire — ${s}`, "pts", "A1", 0.5));
  }
  for (const n of NIVEAUX) {
    out.push(d(`niv.${n}.e0`, `Effectif de départ — ${n}`, "élèves", "A1"));
    if (n !== NIVEAUX[0]) out.push(d(`niv.${n}.retention`, `Taux de rétention — ${n}`, "%", "A1", 0.1));
  }
  for (const c of ["Mat", "Elem", "Col", "Lyc"]) out.push(d(`cycle.${c}.capacite`, `Capacité par classe — ${c}`, "élèves", "A1"));

  // IB : n'existe pas encore ; effectifs retranchés de la 1ère et de la terminale générales
  out.push(d("ib.anneeOuverture", "Année d'ouverture de l'IB (index, 0 = année de départ)", "année", "A1"));
  out.push(d("ib.partPremiere", "Part des élèves de 1ère qui entrent en IB", "%", "A1", 0.5));
  out.push(d("ib.retention", "Passage IB1 → IB2", "%", "A1", 0.5));
  out.push(d("rev.tarif.IB", "Droits de scolarité IB (vide = tarif du lycée)", "{M}/an", "A2", 100));
  out.push(d("rev.hausse.IB", "Hausse annuelle propre à l'IB (vide = hausse générale)", "%/an", "A2", 0.5));
  out.push(d("sg.parEleve.IB", "Coût annuel par élève IB (licence, examens)", "{M}/an", "C1", 50));

  for (const c of ["Mat", "Elem", "Col", "Lyc"]) out.push(d(`rev.tarif.${c}`, `Droits de scolarité — ${c}`, "{M}/an", "A2", 100));
  out.push(d("rev.hausse", "Hausse annuelle des tarifs", "%", "A2", 0.5));
  out.push(d("rev.remise", "Remises et fratries", "% brut", "A2", 0.5));
  out.push(d("rev.fraisInscription", "Frais de première inscription", "{M}", "A2", 100));
  out.push(d("rev.autresParEleve", "Services annexes par élève", "{M}/an", "A2", 50));
  out.push(d("aefe.pfc", "Taux de PFC AEFE", "% brut", "A3", 0.5));
  out.push(d("aefe.abattement", "Abattement sur la PFC", "%", "A3"));
  out.push(d("aefe.subventions", "Subventions d'exploitation", "k{M}/an", "A3", 10));

  for (const c of ["maternelle", "elementaire", "college", "lycee"]) out.push(d(`struct.plafondClasse.${c}`, `Plafond de classe — ${c}`, "élèves", "B1"));
  for (const c of ["LV", "SCI", "DED", "SPE", "OPT", "IB"]) out.push(d(`struct.plafondGroupe.${c}`, `Plafond de groupe — ${c}`, "élèves", "B1"));
  out.push(d("struct.maxBloc", "Classes regroupables pour les dédoublements", "classes", "B1"));
  out.push(d("struct.ponderation", "Pondération cycle terminal (1,1 h)", "0/1", "B1"));
  out.push(d("struct.lvh.h", "Heures de langue du pays hôte (malais)", "h/division", "B1", 0.5));
  out.push(d("emp.ors.defaut", "ORS par défaut", "h/semaine", "B2"));
  out.push(d("emp.ors.EPS", "ORS EPS", "h/semaine", "B2"));
  out.push(d("emp.orsRecrutement", "ORS d'un temps plein créé", "h/semaine", "B2"));
  out.push(d("emp.hsaMax", "HSA maximales par poste", "h/semaine", "B2", 0.5));

  out.push(d("pay.revalorisation", "Revalorisation des grilles", "%/an", "B3", 0.25));
  out.push(d("pay.gvt", "GVT (glissement des carrières, hors résidents)", "%/an", "B3", 0.25));
  out.push(d("pay.tauxHSA", "Coût annuel d'une heure d'HSA hebdomadaire", "{M}/an", "B3", 100));
  out.push(d("pay.chargesPct", "Charges employeur", "% du salaire", "B3", 0.5));
  out.push(d("pay.contributionResident", "Coût d'un résident pour l'établissement", "{M}/an", "B3", 1000));
  out.push(d("pay.coutCreation", "Coût moyen d'un temps plein créé", "{M}/an", "B3", 1000));
  out.push(d("pay.minGroupe", "Seuil de confidentialité des agrégats", "postes", "B3"));
  out.push(d("forfait.imp.unites", "Nombre d'IMP", "unités", "B3"));
  out.push(d("forfait.imp.montant", "Montant forfaitaire d'une IMP", "{M}/an", "B3", 50));
  out.push(d("forfait.decharge.unites", "Nombre de décharges", "unités", "B3"));
  out.push(d("forfait.decharge.montant", "Montant forfaitaire d'une décharge", "{M}/an", "B3", 500));

  out.push(d("sg.indexation", "Indexation des charges", "%/an", "C1", 0.25));
  out.push(d("sg.parM2", "Énergie et entretien par m²", "{M}/m²/an", "C1", 5));
  for (const c of ["Mat", "Elem", "Col", "Lyc"]) out.push(d(`sg.peda.${c}`, `Enveloppe de fonctionnement pédagogique — ${c}`, "{M}", "C1", 50));
  out.push(d("sg.preavisAlerteJours", "Seuil d'alerte de préavis", "jours", "C1"));

  out.push(d("esp.tauxOccupation", "Taux d'occupation des salles banalisées", "%", "D1", 1));
  out.push(d("esp.m2ParSalle", "Surface brute d'une salle construite", "m²", "D1", 5));
  out.push(d("capex.coutM2", "Coût de construction", "{M}/m²", "D2", 100));
  out.push(d("capex.indexationConstruction", "Indexation du coût de construction", "%/an", "D2", 0.25));
  out.push(d("capex.renouvellement", "CAPEX de renouvellement", "k{M}/an", "D2", 50));
  out.push(d("capex.dureeAmortRenouvellement", "Durée d'amortissement du renouvellement", "ans", "D2"));
  out.push(d("capex.vncExistante", "Immobilisations nettes existantes", "k{M}", "D2", 100));
  out.push(d("capex.dotationExistante", "Dotation annuelle sur l'existant", "k{M}/an", "D2", 50));

  out.push(d("fin.tauxEmprunt", "Taux des nouveaux emprunts", "%/an", "D3", 0.25));
  out.push(d("fin.dureeEmprunt", "Durée des nouveaux emprunts", "ans", "D3"));
  out.push(d("fin.tauxPlacement", "Taux de rémunération de la trésorerie", "%/an", "D3", 0.25));
  out.push(d("fin.tauxDecouvert", "Taux des concours bancaires", "%/an", "D3", 0.25));
  out.push(d("fin.tresorerieInitiale", "Trésorerie d'ouverture (comptes consolidés)", "k{M}", "D3", 100));
  out.push(d("fin.seuilMois", "Couverture minimale de trésorerie", "mois de charges", "D3", 0.5));
  out.push(d("fin.joursCreances", "Délai moyen de règlement des familles", "jours", "P3"));
  out.push(d("fin.joursDettes", "Délai moyen de règlement des fournisseurs", "jours", "P3"));
  out.push(d("fonds.objectif", "Objectif de collecte", "k{M}", "P4", 50));
  out.push(d("fonds.soldeInitial", "Fonds affectés reçus et non employés au départ", "k{M}", "P4", 50));

  // taux de change : unités de la devise pour 1 unité de monnaie de pilotage, créés par devise utilisée
  return out;
}

/** Driver de taux de change pour une devise donnée (unités de `devise` pour 1 unité de la monnaie de base). */
export const driverChange = (devise: string, base: string): DriverDef =>
  ({ code: `fin.change.${devise}`, libelle: `Taux de change ${devise}`, unite: `${devise}/${base}`, module: "global", pas: 0.01 });

export const uniteDriver = (def: DriverDef, m: Monnaies) => uniteAvecMonnaie(def.unite, m);

/**
 * Re-basage des valeurs de drivers lors d'un changement de monnaie de pilotage : seuls les drivers monétaires sont multipliés
 * par `facteur` (voir facteurRebasage). Les valeurs absentes du registre sont laissées telles quelles.
 */
export function rebaserDrivers(valeurs: Record<string, number | number[]>, defs: DriverDef[], facteur: number): Record<string, number | number[]> {
  const monetaires = new Set(defs.filter((x) => x.monetaire).map((x) => x.code));
  const out: Record<string, number | number[]> = {};
  for (const [code, v] of Object.entries(valeurs)) {
    out[code] = monetaires.has(code) ? (Array.isArray(v) ? v.map((x) => x * facteur) : v * facteur) : v;
  }
  return out;
}
