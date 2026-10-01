// B1 — Structure pédagogique (version Light) : effectifs projetés → divisions → heures-professeur → ETP.
// Reprend le moteur de « TRM en direct » ; sans IB/DNL/dispositifs, barrettes de spécialités, missions ni transferts.
import { NIVEAUX_DEF, REGLAGES_DEFAUT, type Cours, type NiveauDef, type Reglages } from "./referentiel.ts";

export interface NiveauIn {
  id: string;                          // ps … cm2, 6e … 3e, 2nde, 1g, tg
  eff: number;                         // effectif projeté (sortie de A1)
  div?: number;                        // divisions imposées ; sinon plafond de classe
  parts?: Record<string, number>;      // surcharge des parts de choix, par id de cours
  gr?: Record<string, number>;         // surcharge des heures en groupes, par id de cours
  inactifs?: string[];                 // cours désactivés
}

export interface Alerte { niveau: "critique" | "alerte" | "info"; texte: string }

export interface ResCours {
  id: string; label: string; h: number;
  groupes: number; prof: number;                  // heures-professeur hebdomadaires
  parDisc: Record<string, number>;
}

export interface ResNiveau {
  id: string; nom: string; cycle: NiveauDef["cycle"];
  eff: number; div: number; divMin: number; moyenne: number;
  cours: ResCours[]; parDisc: Record<string, number>; parDiscPond: Record<string, number>;
  total: number; alertes: Alerte[];
}

export interface ResStructure {
  niveaux: ResNiveau[];
  /** Heures-prof hebdomadaires par discipline, pondérées (second degré + spécialistes du primaire). */
  besoins: Record<string, number>;
  etp: Record<string, number>;                    // besoins ÷ ORS
  primaire: { classes: number; postesPE: number; asem: number };
  alertes: Alerte[];
}

export const repartir = (total: number, n: number): number[] => {
  if (n <= 0) return [];
  const base = Math.floor(total / n), reste = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < reste ? 1 : 0));
};

/** Découpe n classes consécutives en blocs d'environ b classes (jamais plus de maxBloc). */
function tailleBlocs(n: number, b: number, maxBloc: number): number[] {
  if (n <= 0) return [];
  b = Math.max(1, Math.min(b, n, maxBloc));
  let nb = Math.max(1, Math.floor(n / b));
  if (Math.ceil(n / nb) > maxBloc) nb = Math.ceil(n / b);
  nb = Math.min(nb, n);
  const base = Math.floor(n / nb), reste = n % nb;
  return Array.from({ length: nb }, (_, i) => base + (i >= nb - reste ? 1 : 0));
}

/** Nombre minimal de groupes quand on regroupe les classes par blocs de 1 à maxBloc (à égalité, le plus petit bloc). */
export function groupesDedoubles(effClasses: number[], plafond: number, maxBloc: number): number {
  let meilleur = Infinity;
  for (let b = 1; b <= Math.min(maxBloc, effClasses.length); b++) {
    let i = 0, g = 0;
    for (const t of tailleBlocs(effClasses.length, b, maxBloc)) {
      const eff = effClasses.slice(i, i + t).reduce((s, x) => s + x, 0);
      g += eff > 0 ? Math.ceil(eff / plafond) : 0;
      i += t;
    }
    meilleur = Math.min(meilleur, g);
  }
  return Number.isFinite(meilleur) ? meilleur : 0;
}

const ventiler = (parts: Record<string, number>, h: number, acc: Record<string, number>) => {
  for (const [d, p] of Object.entries(parts)) acc[d] = (acc[d] ?? 0) + h * p;
};
const orsDe = (R: Reglages, d: string) => R.ors[d] ?? R.ors.defaut ?? 18;

function calculerNiveau(def: NiveauDef, nv: NiveauIn, R: Reglages): ResNiveau {
  const plafondClasse = R.plafondClasse[def.cycle];
  const divMin = nv.eff > 0 ? Math.ceil(nv.eff / plafondClasse) : 0;
  const div = nv.div ?? divMin;
  const effClasses = repartir(nv.eff, div);
  const alertes: Alerte[] = [];
  if (nv.eff > 0 && div < divMin) alertes.push({ niveau: "critique", texte: `${nv.eff} élèves pour ${div} divisions : plafond ${plafondClasse} dépassé, il faut ${divMin} divisions` });

  const parDisc: Record<string, number> = {};
  const cours: ResCours[] = [];
  for (const c of def.cours as Cours[]) {
    if (nv.inactifs?.includes(c.id)) continue;
    const somme = Object.values(c.parts).reduce((s, x) => s + x, 0);
    const k = somme > 1 + 1e-9 ? somme : 1;                       // co-intervention : plusieurs professeurs en même temps
    const plafond = R.plafondGroupe[c.cat];
    const r: ResCours = { id: c.id, label: c.label, h: c.h, groupes: 0, prof: 0, parDisc: {} };
    if (c.kind === "classe") {
      const gr = Math.min(c.h, Math.max(0, nv.gr?.[c.id] ?? c.gr ?? 0));
      const G = gr > 0 && div > 0 ? groupesDedoubles(effClasses, plafond, R.maxBloc) : 0;
      r.groupes = G;
      r.prof = ((c.h - gr) * div + gr * G) * k;
    } else {
      const part = Math.max(0, nv.parts?.[c.id] ?? c.part ?? 0);
      const eff = part * nv.eff;
      const G = eff > 0 ? Math.ceil(eff / plafond - 1e-9) : 0;
      r.groupes = G;
      r.prof = c.h * G * k;
    }
    ventiler(c.parts, r.prof / k, r.parDisc);
    ventiler(c.parts, r.prof / k, parDisc);
    cours.push(r);
  }

  const pond = R.ponderation && def.cycleTerminal;
  const parDiscPond: Record<string, number> = {};
  for (const [d, h] of Object.entries(parDisc)) parDiscPond[d] = pond && d !== "EPS" ? h * R.ponderationFacteur : h;
  // contrôles de cohérence des choix (LV2 : 1 par élève ; spécialités : 3 en 1ère, 2 en terminale)
  const attendu: Record<string, number> = { lv2: def.id === "6e" ? 0 : 1, spe: def.id === "1g" ? 3 : def.id === "tg" ? 2 : 0 };
  for (const [g, cible] of Object.entries(attendu)) {
    if (!cible) continue;
    const somme = (def.cours as Cours[]).filter((c) => c.groupe === g && !nv.inactifs?.includes(c.id))
      .reduce((s, c) => s + Math.max(0, nv.parts?.[c.id] ?? c.part ?? 0), 0);
    if (Math.abs(somme - cible) > 0.005) alertes.push({ niveau: "info", texte: `${g === "lv2" ? "LV2" : "Spécialités"} : ${somme.toFixed(2)} choix par élève (attendu : ${cible})` });
  }
  return { id: def.id, nom: def.nom, cycle: def.cycle, eff: nv.eff, div, divMin, moyenne: div ? nv.eff / div : 0,
    cours, parDisc, parDiscPond, total: Object.values(parDisc).reduce((s, x) => s + x, 0), alertes };
}

export function calculerStructure(entrees: NiveauIn[], R: Reglages = REGLAGES_DEFAUT): ResStructure {
  const niveaux: ResNiveau[] = [];
  const alertes: Alerte[] = [];
  const besoins: Record<string, number> = {};
  let classesPrim = 0, asem = 0;
  for (const nv of entrees) {
    const def = NIVEAUX_DEF.find((d) => d.id === nv.id);
    if (!def) { alertes.push({ niveau: "alerte", texte: `Niveau inconnu : ${nv.id}` }); continue; }
    const res = calculerNiveau(def, nv, R);
    niveaux.push(res);
    if (def.cycle === "maternelle" || def.cycle === "elementaire") {
      classesPrim += res.div;
      if (def.cycle === "maternelle") asem += res.div * R.asemParClasseMaternelle;
      // le PE assure les cours ; les langues peuvent être confiées à un spécialiste d'anglais (heures retirées au PE)
      for (const [d, h] of Object.entries(res.parDiscPond)) {
        if (d === "PE") continue;
        besoins[d] = (besoins[d] ?? 0) + h;
      }
      if (R.lvSpecialistePrimaire && def.cycle === "elementaire") {
        const hLv = res.cours.find((c) => c.id === "lv")?.prof ?? 0;
        besoins.ANG = (besoins.ANG ?? 0) + hLv;
      }
    } else {
      for (const [d, h] of Object.entries(res.parDiscPond)) besoins[d] = (besoins[d] ?? 0) + h;
    }
    alertes.push(...res.alertes.map((a) => ({ ...a, texte: `${def.court} : ${a.texte}` })));
  }
  const etp: Record<string, number> = {};
  for (const [d, h] of Object.entries(besoins)) etp[d] = h / orsDe(R, d);
  return { niveaux, besoins, etp, primaire: { classes: classesPrim, postesPE: classesPrim, asem }, alertes };
}
