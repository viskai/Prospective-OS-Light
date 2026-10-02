// A2 — Tarifs & recettes, A3 — PFC AEFE.
// Tous les montants sont dans la monnaie de pilotage (src/lib/monnaie.ts) : tarifs unitaires dans l'unité, résultats en milliers.
import type { Cycle } from "./cohort.ts";

/** Segment tarifaire : un cycle, ou l'IB qui peut être tarifé et coûté différemment du lycée général. */
export type Segment = Cycle | "IB";
export type EffectifsSegment = Partial<Record<Segment, number>>;

export interface HypothesesRecettes {
  tarifParSegment: Partial<Record<Segment, number>>;      // droits de scolarité annuels, année 0 ; IB absent = tarif du lycée
  hausseAnnuelle: number;                                  // % par an, tous segments
  hausseParSegment?: Partial<Record<Segment, number>>;     // % par an propre à un segment (ex. rattrapage tarifaire de l'IB)
  tarifsParAnnee?: Partial<Record<Segment, number[]>>;     // série explicite par année : remplace le calcul pour ce segment
  remises: number | Record<string, number>;                // % du brut : total, ou détail par nature (fratrie, personnel, paiement annuel…)
  supplements?: SupplementTarifaire[];                     // frais d'écolage supplémentaires (ex. section internationale)
  fraisInscription: number;                                // par nouvel inscrit
  autresParEleve: number;                                  // services annexes, par élève
  indexationAutres: number;                                // % par an
  subventions: number;                                     // milliers / an
}

/** Supplément annuel facturé aux élèves d'un dispositif (compté dans le brut, indexé comme les tarifs). */
export interface SupplementTarifaire {
  nom: string;
  montantParEleve: number;                                 // année de départ
  eleves: Partial<Record<Segment, number>>;                // élèves concernés par segment
}

export type AssiettePFC = "tarif_reference" | "tarif_moyen" | "tarif_moyen_pondere";

export interface HypothesesPFC {
  taux: number;                                            // % de l'assiette
  abattement: number;                                      // %
  assiette: AssiettePFC;
  tarifReference?: number;                                 // requis si assiette = tarif_reference
  tarifsAssiette?: Partial<Record<Segment, number>>;       // tarifs servant à l'assiette (ex. tarif « particulier » : sous-estimation volontaire), année de départ ; remplace les tarifs de recettes
  segmentsExclus?: Segment[];                              // segments hors assiette (ex. IB si non pris en charge)
}

export interface RecettesAnnee {
  brut: number; remises: number; net: number; inscription: number; autres: number; subventions: number; total: number;
  parSegment: Partial<Record<Segment, number>>;            // brut par segment
  remisesParNature: Record<string, number>;                // milliers, par nature de remise
  supplements: number;                                     // milliers, inclus dans le brut
}

const k = (montant: number) => montant / 1000;
const SEGMENTS: Segment[] = ["Mat", "Elem", "Col", "Lyc", "IB"];

/** Tarif moyen d'un segment selon la part de familles au tarif « particulier » (le reste paie le tarif « entreprise »). */
export function tarifMoyenPayeurs(
  particulier: Partial<Record<Segment, number>>, entreprise: Partial<Record<Segment, number>>, partParticulier: number | Partial<Record<Segment, number>>,
): Partial<Record<Segment, number>> {
  const out: Partial<Record<Segment, number>> = {};
  for (const seg of Object.keys(particulier) as Segment[]) {
    const part = typeof partParticulier === "number" ? partParticulier : partParticulier[seg];
    if (part == null || entreprise[seg] == null) throw new Error(`Part de familles ou tarif entreprise manquant pour ${seg}`);
    out[seg] = part * (particulier[seg] as number) + (1 - part) * (entreprise[seg] as number);
  }
  return out;
}

/** Tarif unitaire d'un segment à l'année t. */
export function tarifSegment(seg: Segment, t: number, h: HypothesesRecettes): number {
  const serie = h.tarifsParAnnee?.[seg];
  if (serie && serie[t] != null) return serie[t];
  const depart = h.tarifParSegment[seg] ?? (seg === "IB" ? h.tarifParSegment.Lyc : undefined);
  if (depart == null) throw new Error(`Tarif manquant pour le segment ${seg}`);
  return depart * Math.pow(1 + (h.hausseParSegment?.[seg] ?? h.hausseAnnuelle) / 100, t);
}

/** Recettes de l'année t (0 = année de départ) à partir des effectifs par segment et des nouveaux inscrits. */
export function recettesAnnee(t: number, eff: EffectifsSegment, nouveaux: number, h: HypothesesRecettes): RecettesAnnee {
  const fAutres = Math.pow(1 + h.indexationAutres / 100, t);
  const parSegment: Partial<Record<Segment, number>> = {};
  let brut = 0, eleves = 0;
  for (const s of SEGMENTS) {
    const n = eff[s] ?? 0;
    if (!n) continue;
    parSegment[s] = k(n * tarifSegment(s, t, h));
    brut += parSegment[s] as number;
    eleves += n;
  }
  let supplements = 0;
  for (const sup of h.supplements ?? []) {
    const n = Object.values(sup.eleves).reduce((a, b) => a + (b ?? 0), 0);
    supplements += k(n * sup.montantParEleve * Math.pow(1 + h.hausseAnnuelle / 100, t));
  }
  brut += supplements;
  const taux = typeof h.remises === "number" ? { total: h.remises } : h.remises;
  const remisesParNature = Object.fromEntries(Object.entries(taux).map(([nom, pct]) => [nom, (brut * pct) / 100]));
  const remises = Object.values(remisesParNature).reduce((a, b) => a + b, 0);
  const net = brut - remises;
  const inscription = k(nouveaux * h.fraisInscription * Math.pow(1 + h.hausseAnnuelle / 100, t));
  const autres = k(eleves * h.autresParEleve * fAutres);
  const subventions = h.subventions * fAutres;
  return { brut, remises, net, inscription, autres, subventions, total: net + inscription + autres + subventions, parSegment, remisesParNature, supplements };
}

/** PFC AEFE : assiette théorique × effectif constaté × taux, avec abattement. `t` indexe les tarifs. */
export function pfc(t: number, eff: EffectifsSegment, hRec: HypothesesRecettes, h: HypothesesPFC): number {
  const exclus = new Set(h.segmentsExclus ?? []);
  const segs = SEGMENTS.filter((s) => (eff[s] ?? 0) > 0 && !exclus.has(s));
  const total = segs.reduce((s, x) => s + (eff[x] as number), 0);
  if (total === 0) return 0;
  const tarif = (x: Segment) => (h.tarifsAssiette?.[x] != null ? (h.tarifsAssiette[x] as number) * Math.pow(1 + hRec.hausseAnnuelle / 100, t) : tarifSegment(x, t, hRec));
  let assietteParEleve: number;
  if (h.assiette === "tarif_reference") {
    if (h.tarifReference == null) throw new Error("tarifReference requis pour l'assiette « tarif_reference »");
    assietteParEleve = h.tarifReference * Math.pow(1 + hRec.hausseAnnuelle / 100, t);
  } else if (h.assiette === "tarif_moyen") {
    assietteParEleve = segs.reduce((s, x) => s + tarif(x), 0) / segs.length;
  } else {
    assietteParEleve = segs.reduce((s, x) => s + (eff[x] as number) * tarif(x), 0) / total;
  }
  return k(assietteParEleve * total * (h.taux / 100) * (1 - h.abattement / 100));
}
