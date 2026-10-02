// D1 — Besoins d'espaces : inventaire, capacité d'accueil, confrontation aux divisions projetées (B1),
// salles manquantes ou excédentaires par année, projets d'extension transmis au CAPEX (D2).
import type { Cycle } from "./cohort.ts";
import type { CycleEspace, ProjetCapex } from "./capex.ts";

export type TypeEspace = "salle_classe" | "salle_specialisee" | "gymnase" | "cdi" | "administration" | "autre";

export interface Espace {
  ref: string;
  nom: string;
  type: TypeEspace;
  cycle?: CycleEspace | "commun";
  surfaceM2: number;
  affectation?: string;
  sousType?: string;                    // ex. laboratoire, salle d'arts, gymnase (pour les besoins spécialisés)
}

export const CYCLES: CycleEspace[] = ["maternelle", "elementaire", "college", "lycee"];
/** Cycle de A1 (Mat/Elem/Col/Lyc) → cycle de la structure et des espaces. */
export const CYCLE_ESPACE: Record<Cycle, CycleEspace> = { Mat: "maternelle", Elem: "elementaire", Col: "college", Lyc: "lycee" };

export interface BesoinSpecialise {
  sousType: string;                     // à rapprocher de Espace.sousType
  cycles: CycleEspace[];
  pourDivisions: number;                // 1 espace pour N divisions
}

export interface ParamsEspaces {
  tauxOccupation: Record<CycleEspace, number>;   // part du temps où une salle banalisée sert (1 = une salle par classe)
  m2ParSalle: Record<CycleEspace, number>;       // surface brute d'une salle construite
  plafondClasse: Record<CycleEspace, number>;    // élèves par division (pour la capacité d'accueil)
  besoinsSpecialises?: BesoinSpecialise[];
}

export type PlanSalles = Record<CycleEspace, number>;

const salles = (espaces: Espace[]): PlanSalles => {
  const o: PlanSalles = { maternelle: 0, elementaire: 0, college: 0, lycee: 0 };
  for (const e of espaces) if (e.type === "salle_classe" && e.cycle && e.cycle !== "commun") o[e.cycle] += 1;
  return o;
};

export const sallesExistantes = salles;
export const surfaceTotale = (espaces: Espace[]) => espaces.reduce((s, e) => s + e.surfaceM2, 0);

/** Salles de classe disponibles à l'année t : existantes + salles créées par les projets mis en service. */
export function sallesDisponibles(espaces: Espace[], projets: ProjetCapex[], t: number): PlanSalles {
  const o = salles(espaces);
  for (const p of projets) if (p.cycle && p.anneeService <= t) o[p.cycle] += p.salles;
  return o;
}

/** Places d'accueil par cycle : salles × taux d'occupation × élèves par division. Alimente la jauge plafonnée de A1. */
export function capaciteAccueil(espaces: Espace[], projets: ProjetCapex[], P: ParamsEspaces) {
  return (t: number, cycleA1: Cycle): number => {
    const c = CYCLE_ESPACE[cycleA1];
    return sallesDisponibles(espaces, projets, t)[c] * P.tauxOccupation[c] * P.plafondClasse[c];
  };
}

export interface EcartSalles {
  besoin: number; disponible: number;
  ecart: number;                        // disponible − besoin : négatif = salles manquantes, positif = excédent
}

export interface ConfrontationAnnee {
  parCycle: Record<CycleEspace, EcartSalles>;
  specialises: { sousType: string; besoin: number; disponible: number; ecart: number }[];
  sallesManquantes: number;             // total des manques sur les cycles (KPI « salles manquantes »)
  m2Manquants: number;
}

export function confronter(divisions: Record<CycleEspace, number>[], espaces: Espace[], projets: ProjetCapex[], P: ParamsEspaces): ConfrontationAnnee[] {
  return divisions.map((div, t) => {
    const dispo = sallesDisponibles(espaces, projets, t);
    const parCycle = {} as Record<CycleEspace, EcartSalles>;
    let manque = 0, m2 = 0;
    for (const c of CYCLES) {
      const besoin = Math.ceil((div[c] ?? 0) / P.tauxOccupation[c] - 1e-9);
      parCycle[c] = { besoin, disponible: dispo[c], ecart: dispo[c] - besoin };
      if (parCycle[c].ecart < 0) { manque += -parCycle[c].ecart; m2 += -parCycle[c].ecart * P.m2ParSalle[c]; }
    }
    const specialises = (P.besoinsSpecialises ?? []).map((b) => {
      const d = b.cycles.reduce((s, c) => s + (div[c] ?? 0), 0);
      const besoin = Math.ceil(d / b.pourDivisions - 1e-9);
      const disponible = espaces.filter((e) => e.sousType === b.sousType).length;
      return { sousType: b.sousType, besoin, disponible, ecart: disponible - besoin };
    });
    return { parCycle, specialises, sallesManquantes: manque, m2Manquants: m2 };
  });
}

export interface ParamsProjets {
  coutM2: number;                       // monnaie de base par m² (aux prix de l'année de départ)
  dureeTravaux: number;
  dureeAmort: number;
  partEmprunt: number;
  partFonds: number;
  fenetre?: number;                     // années couvertes par un même projet (défaut 5)
}

/**
 * Propose des projets d'extension : au premier déficit d'un cycle, un projet couvre le déficit maximal de la fenêtre,
 * mis en service l'année du premier manque ; on recommence tant qu'un déficit subsiste. Les projets déjà saisis comptent.
 */
export function projetsDepuisBesoins(divisions: Record<CycleEspace, number>[], espaces: Espace[], existants: ProjetCapex[], P: ParamsEspaces, pr: ParamsProjets): ProjetCapex[] {
  const proposes: ProjetCapex[] = [];
  const fenetre = pr.fenetre ?? 5;
  for (const c of CYCLES) {
    for (let garde = 0; garde < 10; garde++) {
      const tous = [...existants, ...proposes];
      const ecarts = confronter(divisions, espaces, tous, P).map((x) => x.parCycle[c].ecart);
      const t0 = ecarts.findIndex((e) => e < 0);
      if (t0 < 0) break;
      const manque = Math.max(...ecarts.slice(t0, t0 + fenetre).map((e) => -e), 0);
      proposes.push({
        nom: `Extension ${c} (besoin ${manque} salle${manque > 1 ? "s" : ""})`, cycle: c, salles: manque, m2: manque * P.m2ParSalle[c], coutM2: pr.coutM2,
        anneeService: t0, dureeTravaux: pr.dureeTravaux, dureeAmort: pr.dureeAmort, partEmprunt: pr.partEmprunt, partFonds: pr.partFonds,
      });
    }
  }
  return proposes;
}

/** Divisions par cycle d'espace (IB et voie générale confondus) à partir de la structure de B1. */
export function divisionsParCycle(niveaux: { cycle: CycleEspace; div: number }[]): Record<CycleEspace, number> {
  const o: Record<CycleEspace, number> = { maternelle: 0, elementaire: 0, college: 0, lycee: 0 };
  for (const n of niveaux) o[n.cycle] += n.div;
  return o;
}

export function controlerEspaces(espaces: Espace[]): string[] {
  const e: string[] = [], vus = new Set<string>();
  for (const x of espaces) {
    if (vus.has(x.ref)) e.push(`Référence en double : ${x.ref}`);
    vus.add(x.ref);
    if (!(x.surfaceM2 > 0)) e.push(`${x.ref} : surface manquante`);
    if (x.type === "salle_classe" && (!x.cycle || x.cycle === "commun")) e.push(`${x.ref} : une salle de classe doit être rattachée à un cycle`);
  }
  return e;
}
