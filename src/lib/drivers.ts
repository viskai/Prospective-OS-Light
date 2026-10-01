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
  out.push(d("rev.hausse", "Hausse annuelle des tarifs", "%", "A2", 0.5));
  out.push(d("rev.remise", "Remises et fratries", "% brut", "A2", 0.5));
  out.push(d("aefe.pfc", "Taux de PFC AEFE", "% brut", "A3", 0.5));
  out.push(d("aefe.abattement", "Abattement sur la PFC", "%", "A3"));
  out.push(d("pay.gvt", "Revalorisation et GVT", "%/an", "B3", 0.25));
  out.push(d("sg.indexation", "Indexation des charges", "%/an", "C1", 0.25));
  out.push(d("fin.change.MYR", "Taux de change MYR", "MYR/AUD", "global", 0.01));
  out.push(d("fin.change.EUR", "Taux de change EUR", "EUR/AUD", "global", 0.01));
  return out;
}
