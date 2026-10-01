// P1 — Registre des drivers : catalogue des hypothèses (nom, unité, module source).
// Les libellés vivent ici, source unique réutilisée par les écrans et le moteur.
import { NIVEAUX } from "./eduka.ts";

export type ModuleSource = "A1" | "A2" | "A3" | "B1" | "B2" | "B3" | "C1" | "D1" | "D2" | "D3" | "P3" | "P4" | "global";

export interface DriverDef {
  code: string;
  libelle: string;
  unite: string;
  module: ModuleSource;
  pas?: number;
  calcule?: boolean;   // publié par un module (non saisi)
}

export const SCENARIOS = ["central", "favorable", "stress"] as const;
export const HORIZON_ANNEES = 15;

const d = (code: string, libelle: string, unite: string, module: ModuleSource, pas = 1): DriverDef => ({ code, libelle, unite, module, pas });

export function registreInitial(): DriverDef[] {
  const out: DriverDef[] = [];
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
  for (const c of ["maternelle", "elementaire", "college", "lycee"]) out.push(d(`struct.plafondClasse.${c}`, `Plafond de classe — ${c}`, "élèves", "B1"));
  for (const c of ["LV", "SCI", "DED", "SPE", "OPT"]) out.push(d(`struct.plafondGroupe.${c}`, `Plafond de groupe — ${c}`, "élèves", "B1"));
  out.push(d("struct.maxBloc", "Classes regroupables pour les dédoublements", "classes", "B1"));
  out.push(d("struct.ponderation", "Pondération cycle terminal (1,1 h)", "0/1", "B1"));
  out.push(d("emp.ors.defaut", "ORS par défaut", "h/semaine", "B2"));
  out.push(d("emp.ors.EPS", "ORS EPS", "h/semaine", "B2"));
  out.push(d("emp.orsRecrutement", "ORS d'un temps plein créé", "h/semaine", "B2"));
  out.push(d("emp.hsaMax", "HSA maximales par poste", "h/semaine", "B2", 0.5));
  out.push(d("rev.hausse", "Hausse annuelle des tarifs", "%", "A2", 0.5));
  out.push(d("rev.remise", "Remises et fratries", "% brut", "A2", 0.5));
  out.push(d("aefe.pfc", "Taux de PFC AEFE", "% brut", "A3", 0.5));
  out.push(d("aefe.abattement", "Abattement sur la PFC", "%", "A3"));
  out.push(d("pay.revalorisation", "Revalorisation des grilles", "%/an", "B3", 0.25));
  out.push(d("pay.gvt", "GVT (glissement des carrières, hors résidents)", "%/an", "B3", 0.25));
  out.push(d("pay.tauxHSA", "Taux annuel d'une HSA hebdomadaire", "AUD", "B3", 100));
  out.push(d("pay.chargesPct", "Charges employeur", "% du salaire", "B3", 0.5));
  out.push(d("pay.contributionResident", "Coût d'un résident pour l'établissement", "AUD/an", "B3", 1000));
  out.push(d("pay.minGroupe", "Seuil de confidentialité des agrégats", "postes", "B3"));
  out.push(d("forfait.imp.unites", "Nombre d'IMP", "unités", "B3"));
  out.push(d("forfait.imp.montant", "Montant d'une IMP", "AUD/an", "B3", 50));
  out.push(d("forfait.decharge.unites", "Nombre de décharges", "unités", "B3"));
  out.push(d("forfait.decharge.montant", "Montant forfaitaire d'une décharge", "AUD/an", "B3", 500));
  out.push(d("struct.lvh.h", "Heures de langue du pays hôte (malais)", "h/division", "B1", 0.5));
  out.push(d("sg.indexation", "Indexation des charges", "%/an", "C1", 0.25));
  out.push(d("fin.change.MYR", "Taux de change MYR", "MYR/AUD", "global", 0.01));
  out.push(d("fin.change.EUR", "Taux de change EUR", "EUR/AUD", "global", 0.01));
  return out;
}
