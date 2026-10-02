// D2 — CAPEX pluriannuel : projets d'investissement, renouvellement du parc, décaissements, amortissements, valeur nette,
// et répartition du financement (emprunt, fonds affectés, autofinancement). Logique reprise du prototype.
// Prix unitaires dans la monnaie de pilotage (par m²) ; stocks et flux en milliers de monnaie de base.

export type CycleEspace = "maternelle" | "elementaire" | "college" | "lycee";

export interface ProjetCapex {
  nom: string;
  cycle?: CycleEspace;                 // cycle auquel les salles créées s'ajoutent (D1)
  salles: number;                      // salles de classe créées
  m2: number;
  coutM2: number;                      // monnaie de base par m², aux prix de l'année de départ
  anneeService: number;                // index d'année de mise en service (début de l'amortissement)
  dureeTravaux: number;                // années de décaissement précédant la mise en service
  dureeAmort: number;
  partEmprunt: number;                 // % du coût financé par emprunt
  partFonds: number;                   // % financé par fonds affectés (P4)
  montantForfaitaire?: number;         // investissement ponctuel (monnaie de base) : remplace m² × coût au m²
  quotePart?: number;                  // % du coût supporté par l'établissement (investissements partagés d'un campus) ; défaut 100
}

export interface HypothesesCapex {
  indexationConstruction: number;      // % par an, appliqué au coût l'année du décaissement
  renouvellementAnnuel: number;        // milliers, aux prix de l'année de départ
  indexationRenouvellement: number;    // % par an
  dureeAmortRenouvellement: number;
  vncExistante: number;                // milliers : immobilisations nettes importées de la comptabilité
  dotationExistante: number;           // milliers par an
}

export interface ResultatCapex {
  decaissementsProjets: number[]; renouvellement: number[]; decaissements: number[];
  dotationsProjets: number[]; dotationsRenouvellement: number[]; dotationsExistant: number[]; dotations: number[];
  vnc: number[];                       // valeur nette en fin d'année
  emprunts: number[]; fonds: number[]; autofinancement: number[]; tauxAutofinancement: (number | null)[];
  surfacesAjoutees: number[];          // m² cumulés mis en service
  sallesAjoutees: Record<CycleEspace, number>[];
}

export const coutProjet = (p: ProjetCapex) => (((p.montantForfaitaire ?? p.m2 * p.coutM2) / 1000) * (p.quotePart ?? 100)) / 100;

/** Années de décaissement : dureeTravaux années précédant la mise en service (année 0 incluse, jamais avant). */
export function anneesDecaissement(p: ProjetCapex): number[] {
  if (p.anneeService <= 0) return [0];
  const dur = Math.max(1, Math.round(p.dureeTravaux));
  const ys: number[] = [];
  for (let k = dur; k >= 1; k--) ys.push(Math.max(0, p.anneeService - k));
  return ys;
}

const f = (pct: number, t: number) => Math.pow(1 + pct / 100, t);

export function calculerCapex(projets: ProjetCapex[], h: HypothesesCapex, horizon = 15): ResultatCapex {
  const z = () => Array<number>(horizon).fill(0);
  const dP = z(), ren = z(), amP = z(), amR = z(), amE = z(), emprunts = z(), fonds = z(), surf = z();
  const salles = Array.from({ length: horizon }, () => ({ maternelle: 0, elementaire: 0, college: 0, lycee: 0 } as Record<CycleEspace, number>));
  for (const p of projets) {
    const cout = coutProjet(p), ys = anneesDecaissement(p), part = cout / ys.length;
    for (const y of ys) {
      if (y >= horizon) continue;
      const montant = part * f(h.indexationConstruction, y);       // valeur nominale l'année du décaissement
      dP[y] += montant; emprunts[y] += (montant * p.partEmprunt) / 100; fonds[y] += (montant * p.partFonds) / 100;
    }
  }
  // l'amortissement porte sur le coût réellement décaissé (nominal)
  for (const p of projets) {
    const ys = anneesDecaissement(p), cout = coutProjet(p), part = cout / ys.length;
    const nominal = ys.reduce((s, y) => s + part * f(h.indexationConstruction, y), 0);
    const duree = Math.max(1, Math.round(p.dureeAmort));
    for (let t = p.anneeService; t < Math.min(horizon, p.anneeService + duree); t++) amP[t] += nominal / duree;
    for (let t = Math.max(0, p.anneeService); t < horizon; t++) {
      surf[t] += p.m2;
      if (p.cycle) salles[t][p.cycle] += p.salles;
    }
  }
  const vie = Math.max(1, Math.round(h.dureeAmortRenouvellement));
  for (let t = 0; t < horizon; t++) ren[t] = h.renouvellementAnnuel * f(h.indexationRenouvellement, t);
  for (let t = 0; t < horizon; t++) for (let v = 0; v <= t; v++) if (t - v < vie) amR[t] += ren[v] / vie;
  let reste = h.vncExistante;
  for (let t = 0; t < horizon; t++) { amE[t] = Math.min(h.dotationExistante, reste); reste -= amE[t]; }
  const decaissements = dP.map((v, t) => v + ren[t]);
  const dotations = amP.map((v, t) => v + amR[t] + amE[t]);
  let vnc = h.vncExistante;
  const vncAnnee = decaissements.map((d, t) => (vnc = vnc + d - dotations[t]));
  const autofinancement = decaissements.map((d, t) => d - emprunts[t] - fonds[t]);
  return {
    decaissementsProjets: dP, renouvellement: ren, decaissements, dotationsProjets: amP, dotationsRenouvellement: amR, dotationsExistant: amE, dotations,
    vnc: vncAnnee, emprunts, fonds, autofinancement,
    tauxAutofinancement: decaissements.map((d, t) => (d > 0 ? autofinancement[t] / d : null)),
    surfacesAjoutees: surf, sallesAjoutees: salles,
  };
}

/** Contrôle : parts de financement cohérentes et projets exploitables. */
export function controlerProjets(projets: ProjetCapex[]): string[] {
  const e: string[] = [];
  for (const p of projets) {
    if (p.partEmprunt + p.partFonds > 100 + 1e-9) e.push(`${p.nom} : emprunt + fonds affectés > 100 %`);
    if (p.montantForfaitaire == null && (!(p.m2 > 0) || !(p.coutM2 > 0))) e.push(`${p.nom} : surface ou coût au m² manquant`);
    if (p.quotePart != null && !(p.quotePart > 0 && p.quotePart <= 100)) e.push(`${p.nom} : quote-part hors de 0 à 100 %`);
    if (!(p.dureeAmort >= 1)) e.push(`${p.nom} : durée d'amortissement manquante`);
  }
  return e;
}
