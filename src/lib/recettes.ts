// A2 — Tarifs & recettes, A3 — PFC AEFE. Montants en k AUD, tarifs en AUD.
import type { Cycle } from "./cohort.ts";

export interface HypothesesRecettes {
  tarifParCycle: Record<Cycle, number>;   // droits de scolarité annuels, AUD
  hausseAnnuelle: number;                 // % par an
  remises: number;                        // % du brut (remises et fratries)
  fraisInscription: number;               // AUD, par nouvel inscrit
  autresParEleve: number;                 // AUD, services annexes
  indexationAutres: number;               // % par an
  subventions: number;                    // k AUD / an
}

export type AssiettePFC = "tarif_reference" | "tarif_moyen" | "tarif_moyen_pondere";

export interface HypothesesPFC {
  taux: number;                           // % de l'assiette
  abattement: number;                     // %
  assiette: AssiettePFC;
  tarifReference?: number;                // AUD, requis si assiette = tarif_reference
}

export interface RecettesAnnee {
  brut: number; remises: number; net: number; inscription: number; autres: number; subventions: number; total: number;
}

const k = (aud: number) => aud / 1000;

/** Recettes de l'année t (0 = année de départ) à partir des effectifs par cycle et des nouveaux inscrits. */
export function recettesAnnee(t: number, effParCycle: Record<Cycle, number>, nouveaux: number, h: HypothesesRecettes): RecettesAnnee {
  const fTarif = Math.pow(1 + h.hausseAnnuelle / 100, t);
  const fAutres = Math.pow(1 + h.indexationAutres / 100, t);
  const total_eleves = Object.values(effParCycle).reduce((a, b) => a + b, 0);
  const brut = k((Object.keys(effParCycle) as Cycle[]).reduce((s, c) => s + effParCycle[c] * h.tarifParCycle[c], 0) * fTarif);
  const remises = (brut * h.remises) / 100;
  const net = brut - remises;
  const inscription = k(nouveaux * h.fraisInscription * fTarif);
  const autres = k(total_eleves * h.autresParEleve * fAutres);
  const subventions = h.subventions * fAutres;
  return { brut, remises, net, inscription, autres, subventions, total: net + inscription + autres + subventions };
}

/** PFC AEFE : assiette théorique × effectif constaté × taux, avec abattement. */
export function pfc(effParCycle: Record<Cycle, number>, tarifParCycle: Record<Cycle, number>, hausseCumulee: number, h: HypothesesPFC): number {
  const cycles = Object.keys(effParCycle) as Cycle[];
  const eff = cycles.reduce((s, c) => s + effParCycle[c], 0);
  if (eff === 0) return 0;
  const f = 1 + hausseCumulee / 100;
  let assietteParEleve: number;
  if (h.assiette === "tarif_reference") {
    if (h.tarifReference == null) throw new Error("tarifReference requis pour l'assiette « tarif_reference »");
    assietteParEleve = h.tarifReference * f;
  } else if (h.assiette === "tarif_moyen") {
    assietteParEleve = (cycles.reduce((s, c) => s + tarifParCycle[c], 0) / cycles.length) * f;
  } else {
    assietteParEleve = (cycles.reduce((s, c) => s + effParCycle[c] * tarifParCycle[c], 0) / eff) * f;
  }
  return k(assietteParEleve * eff * (h.taux / 100) * (1 - h.abattement / 100));
}
