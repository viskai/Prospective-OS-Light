// Liaison A1 → B1 / A2 : traduit les effectifs projetés (par niveau et par année) en entrées de structure
// et en effectifs par segment tarifaire, en isolant l'IB (retranché de la 1ère et de la terminale générales).
import type { Niveau, Resultat, SplitIB } from "./cohort.ts";
import type { NiveauIn, ResStructure } from "./structure.ts";
import { calculerStructure } from "./structure.ts";
import { REGLAGES_DEFAUT, type Reglages } from "./referentiel.ts";
import type { EffectifsSegment } from "./recettes.ts";

/** Code de niveau de A1 (src/lib/eduka.ts) → identifiant du référentiel de structure. TPS n'a pas de structure. */
export const CODE_STRUCTURE: Record<string, string> = {
  PS: "ps", MS: "ms", GS: "gs", CP: "cp", CE1: "ce1", CE2: "ce2", CM1: "cm1", CM2: "cm2",
  "6e": "6e", "5e": "5e", "4e": "4e", "3e": "3e", "2nde": "2nde", "1ere": "1g", Tle: "tg",
};

export interface IbAnnee { ib1: number; ib2: number }

/** Entrées de structure d'une année : effectifs entiers, IB retranché de la 1ère et de la terminale. */
export function niveauxStructureAnnee(niveaux: Niveau[], ligne: number[], ib: IbAnnee = { ib1: 0, ib2: 0 }, codes = { premiere: "1ere", terminale: "Tle" }): NiveauIn[] {
  const out: NiveauIn[] = [];
  const ib1 = Math.round(ib.ib1), ib2 = Math.round(ib.ib2);
  niveaux.forEach((n, i) => {
    const id = CODE_STRUCTURE[n.code];
    if (!id) return;
    let eff = Math.round(ligne[i]);
    if (n.code === codes.premiere) eff = Math.max(0, eff - ib1);
    if (n.code === codes.terminale) eff = Math.max(0, eff - ib2);
    out.push({ id, eff });
  });
  if (ib1 > 0) out.push({ id: "ib1", eff: ib1 });
  if (ib2 > 0) out.push({ id: "ib2", eff: ib2 });
  return out;
}

/** Structure pédagogique de chaque année de l'horizon (divisions, heures, ETP, postes PE, ASEM). */
export function structureParAnnee(niveaux: Niveau[], res: Resultat, split?: SplitIB, R: Reglages = REGLAGES_DEFAUT): ResStructure[] {
  return res.effectifs.map((ligne, t) => calculerStructure(niveauxStructureAnnee(niveaux, ligne, split ? { ib1: split.ib1[t], ib2: split.ib2[t] } : undefined), R));
}

/** Effectifs par segment tarifaire et par année : le lycée est net de l'IB, l'IB est un segment à part. */
export function effectifsParSegment(res: Resultat, split?: SplitIB): EffectifsSegment[] {
  return res.parCycle.map((c, t) => {
    const ib = split?.ib[t] ?? 0;
    return { Mat: c.Mat, Elem: c.Elem, Col: c.Col, Lyc: c.Lyc - ib, ...(ib > 0 ? { IB: ib } : {}) };
  });
}

/** Nouveaux inscrits de l'année (apports de la montée de cohorte), pour les frais de première inscription. */
export const nouveauxInscrits = (res: Resultat): number[] => res.apports.map((a) => a.reduce((s, x) => s + x, 0));
