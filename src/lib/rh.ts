// B3 — RH & masse salariale (module isolé : accès DAF, direction RH et Payroll).
// Seul module qui manipule des postes individuels. Aucun nom, aucune donnée d'état civil : un poste a une référence opaque.
// Il ne publie que des agrégats (par catégorie et centre de coût, jamais sous 3 postes) et des postes en place par discipline.
// Montants saisis en devise (unités), sorties en k AUD.

export type Devise = "AUD" | "MYR" | "EUR";
export type Statut = "resident" | "tnr" | "contractuel" | "vacataire" | "pe" | "local";
export type Service = "primaire" | "secondaire" | "administration" | "periscolaire";
export type Categorie = "enseignant" | "non_enseignant";

export interface PosteRH {
  ref: string;                        // identifiant opaque, jamais un nom
  service: Service;
  centre: string;                     // centre de coût : code discipline (LET, MAT…) ou département
  categorie: Categorie;
  statut: Statut;
  contrat?: "permanent" | "cdi" | "cdd" | "casual" | "detache";
  quotite: number;                    // 1 = temps plein
  ors?: number;                       // obligation de service hebdomadaire à temps plein (enseignants)
  hsa?: number;                       // heures supplémentaires hebdomadaires
  devise: Devise;
  salaireBase: number;                // annuel, temps plein, en devise
  primes?: number;                    // annuel, en devise
  chargesPct?: number;                // charges employeur, % du salaire
  avantages?: number;                 // annuel, en devise
  contributionResident?: number;      // résident AEFE : coût annuel pour l'établissement (remplace le salaire)
  anneeDebut?: number;                // index d'année de projection (0 = année de départ)
  anneeFin?: number;                  // dernière année incluse
}

export interface PolitiqueSalariale {
  revalorisation: number;             // % par an (indexation des grilles)
  gvt: number;                        // % par an (glissement des carrières) ; hors résidents
  tauxHSA: number;                    // AUD par an et par heure hebdomadaire d'HSA
  change: Record<Devise, number>;     // unités de devise pour 1 AUD
  deriveChange?: Partial<Record<Devise, number>>; // % par an de hausse du nombre d'unités par AUD
  minGroupe: number;                  // seuil de confidentialité (3)
}

export const POLITIQUE_DEFAUT: PolitiqueSalariale = {
  revalorisation: 3, gvt: 1, tauxHSA: 3000, change: { AUD: 1, MYR: 3.0, EUR: 0.6 }, minGroupe: 3,
};

/** IMP et décharges en montant forfaitaire : pas de conversion en heures. */
export interface Forfait {
  id: string;
  nom: string;
  type: "imp" | "decharge" | "prime" | "autre";
  centre?: string;
  unites: number;                     // nombre d'IMP, de décharges…
  montantUnitaire: number;            // AUD par unité et par an
  indexe?: boolean;                   // suit la revalorisation (défaut : oui)
}

export interface PosteCree {          // créations issues de B2 (temps pleins locaux à recruter)
  centre: string;
  etp: number;
  annee: number;                      // première année de coût
  coutUnitaire: number;               // AUD par ETP et par an, charges comprises, valeur de l'année de départ
}

const facteur = (pct: number, t: number) => Math.pow(1 + pct / 100, t);

/** Coût annuel d'un poste pour l'établissement, en k AUD, à l'année t de projection ; 0 hors de sa période. */
export function coutPoste(p: PosteRH, t: number, pol: PolitiqueSalariale): number {
  if (t < (p.anneeDebut ?? 0) || (p.anneeFin != null && t > p.anneeFin)) return 0;
  const charges = 1 + (p.chargesPct ?? 0) / 100;
  let base: number;
  if (p.statut === "resident") base = (p.contributionResident ?? 0) * p.quotite;
  else base = ((p.salaireBase * p.quotite + (p.primes ?? 0)) * charges + (p.avantages ?? 0));
  const hsa = (p.hsa ?? 0) * pol.tauxHSA / pol.change.AUD;       // taux HSA exprimé en AUD
  const revalo = facteur(pol.revalorisation, t) * (p.statut === "resident" ? 1 : facteur(pol.gvt, t));
  const local = (base * revalo) / (pol.change[p.devise] * facteur(pol.deriveChange?.[p.devise] ?? 0, t));
  return (local + hsa * facteur(pol.revalorisation, t)) / 1000;
}

export interface LigneMasse {
  categorie: string;                  // enseignant, non_enseignant, forfaits, creations ou « tous » (regroupement)
  centre: string;
  effectif: number;                   // nombre de postes de la ligne (≥ seuil de confidentialité, hors forfaits et créations)
  regroupe: boolean;
  parAnnee: number[];                 // k AUD
}

export interface MasseSalariale {
  annees: string[];
  lignes: LigneMasse[];
  total: number[];
  etp: number[];                      // ETP des postes en place
  alertes: string[];
}

const libelleAnnee = (debut: number, i: number) => `${debut + i}-${String((debut + i + 1) % 100).padStart(2, "0")}`;

/**
 * Masse salariale projetée, agrégée par catégorie × centre de coût.
 * Règle de confidentialité : une ligne de moins de `minGroupe` postes est regroupée dans « Autres » de sa catégorie,
 * puis, si le regroupement reste en dessous du seuil, dans une ligne unique « tous / Autres ».
 */
export function projeterMasseSalariale(
  postes: PosteRH[], pol: PolitiqueSalariale = POLITIQUE_DEFAUT, opts: { horizon?: number; debut?: number; forfaits?: Forfait[]; creations?: PosteCree[] } = {},
): MasseSalariale {
  const horizon = opts.horizon ?? 15, debut = opts.debut ?? 2026;
  const annees = Array.from({ length: horizon }, (_, i) => libelleAnnee(debut, i));
  const serie = (f: (t: number) => number) => Array.from({ length: horizon }, (_, t) => f(t));
  const alertes: string[] = [];

  type Groupe = { categorie: string; centre: string; postes: PosteRH[] };
  const groupes = new Map<string, Groupe>();
  for (const p of postes) {
    const k = `${p.categorie}|${p.centre}`;
    if (!groupes.has(k)) groupes.set(k, { categorie: p.categorie, centre: p.centre, postes: [] });
    groupes.get(k)!.postes.push(p);
  }
  const ligneDe = (categorie: string, centre: string, ps: PosteRH[], regroupe: boolean): LigneMasse =>
    ({ categorie, centre, effectif: ps.length, regroupe, parAnnee: serie((t) => ps.reduce((s, p) => s + coutPoste(p, t, pol), 0)) });

  const lignes: LigneMasse[] = [];
  const petits = new Map<string, PosteRH[]>();
  for (const g of groupes.values()) {
    if (g.postes.length >= pol.minGroupe) lignes.push(ligneDe(g.categorie, g.centre, g.postes, false));
    else petits.set(g.categorie, [...(petits.get(g.categorie) ?? []), ...g.postes]);
  }
  const reste: PosteRH[] = [];
  for (const [cat, ps] of petits) {
    if (ps.length >= pol.minGroupe) lignes.push(ligneDe(cat, "Autres (regroupé)", ps, true));
    else reste.push(...ps);
  }
  if (reste.length) {
    if (reste.length >= pol.minGroupe) lignes.push(ligneDe("tous", "Autres (regroupé)", reste, true));
    else {
      // moins de 3 postes au total hors des lignes publiées : fusion avec la plus petite ligne publiée, ou masquage du détail
      const cible = [...lignes].sort((a, b) => a.effectif - b.effectif)[0];
      if (cible) {
        const extra = reste.map((p) => serie((t) => coutPoste(p, t, pol)));
        cible.parAnnee = cible.parAnnee.map((v, t) => v + extra.reduce((s, e) => s + e[t], 0));
        cible.effectif += reste.length; cible.regroupe = true;
      } else lignes.push(ligneDe("tous", "Ensemble (détail masqué : moins de " + pol.minGroupe + " postes)", reste, true));
    }
  }

  const fo = opts.forfaits ?? [];
  for (const type of new Set(fo.map((f) => f.type))) {
    const fs = fo.filter((f) => f.type === type);
    lignes.push({ categorie: "forfaits", centre: type, effectif: 0, regroupe: false,
      parAnnee: serie((t) => fs.reduce((s, f) => s + (f.unites * f.montantUnitaire * (f.indexe === false ? 1 : facteur(pol.revalorisation, t))) / 1000, 0)) });
  }
  for (const c of opts.creations ?? []) {
    lignes.push({ categorie: "creations", centre: c.centre, effectif: 0, regroupe: false,
      parAnnee: serie((t) => (t >= c.annee ? (c.etp * c.coutUnitaire * facteur(pol.revalorisation, t)) / 1000 : 0)) });
  }

  const etp = serie((t) => postes.reduce((s, p) => s + (t < (p.anneeDebut ?? 0) || (p.anneeFin != null && t > p.anneeFin) ? 0 : p.quotite), 0));
  const total = serie((t) => lignes.reduce((s, l) => s + l.parAnnee[t], 0));
  return { annees, lignes, total, etp, alertes };
}

/** Contrôles de qualité des postes importés (fichier RH). */
export function controlerPostes(postes: PosteRH[], pol: PolitiqueSalariale = POLITIQUE_DEFAUT): string[] {
  const erreurs: string[] = [];
  const vus = new Set<string>();
  for (const p of postes) {
    if (vus.has(p.ref)) erreurs.push(`Référence en double : ${p.ref}`);
    vus.add(p.ref);
    if (!p.centre) erreurs.push(`${p.ref} : centre de coût manquant`);
    if (!(p.quotite > 0) || p.quotite > 1.5) erreurs.push(`${p.ref} : quotité hors limites (${p.quotite})`);
    if (p.categorie === "enseignant" && !p.ors && p.statut !== "pe") erreurs.push(`${p.ref} : ORS manquante`);
    if (p.statut === "resident" && p.contributionResident == null) erreurs.push(`${p.ref} : contribution du résident manquante`);
    if (p.statut !== "resident" && !(p.salaireBase > 0)) erreurs.push(`${p.ref} : salaire de base manquant`);
    if (!(p.devise in pol.change)) erreurs.push(`${p.ref} : devise sans taux de change (${p.devise})`);
    if (p.statut === "pe" && p.categorie !== "enseignant") erreurs.push(`${p.ref} : statut PE réservé aux enseignants`);
  }
  return erreurs;
}

export interface EnPlace { postes: number; apport: number; postesDetaches: number; postesLocaux: number }

/**
 * Postes en place par discipline, à transmettre à B2 : agrégat sans donnée individuelle.
 * Chaque poste compte à temps plein équivalent ; apport = quotité × ORS. Le PE est compté à part.
 */
export function enPlaceDepuisPostes(postes: PosteRH[], orsDefaut = 18): { parDiscipline: Record<string, EnPlace>; postesPE: number; hsa: number } {
  const parDiscipline: Record<string, EnPlace> = {};
  let postesPE = 0, hsa = 0;
  for (const p of postes) {
    if (p.categorie !== "enseignant" || (p.anneeDebut ?? 0) > 0) continue;
    if (p.statut === "pe") { postesPE += p.quotite; continue; }
    const x = (parDiscipline[p.centre] ??= { postes: 0, apport: 0, postesDetaches: 0, postesLocaux: 0 });
    x.postes += p.quotite; x.apport += p.quotite * (p.ors ?? orsDefaut); hsa += p.hsa ?? 0;
    if (p.statut === "resident") x.postesDetaches += p.quotite; else x.postesLocaux += p.quotite;
  }
  return { parDiscipline, postesPE, hsa };
}
