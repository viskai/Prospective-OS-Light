// B3 — RH & masse salariale (module isolé : accès DAF, direction RH et Payroll).
// Seul module qui manipule des postes individuels. Aucun nom, aucune donnée d'état civil : un poste a une référence opaque.
// Il ne publie que des agrégats (par catégorie et centre de coût, jamais sous 3 postes) et des postes en place par discipline.
// Montants en monnaie de pilotage (src/lib/monnaie.ts). Un salaire ou une contribution libellé en devise locale est converti
// avec le taux de change du driver ; les sorties sont en milliers de la monnaie de base.
import { versBase, tauxManquants, type Monnaies, MONNAIES_DEFAUT } from "./monnaie.ts";

export type Devise = string;                  // code ISO ; la monnaie de base est celle de `PolitiqueSalariale.monnaies`
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
  devise: Devise;                     // devise des montants ci-dessous (en général la monnaie de base)
  salaireBase: number;                // annuel, temps plein, en `devise`
  primes?: number;                    // annuel, en `devise`
  chargesPct?: number;                // charges employeur, % du salaire
  avantages?: number;                 // annuel, en `devise`
  contributionResident?: number;      // résident AEFE : coût annuel pour l'établissement (remplace le salaire), en `devise`
  regimeLocal?: RegimeLocal;          // contrat local malaisien : charges sociales calculées par règles (remplace chargesPct)
  pensionCivile?: number;             // résident : contribution annuelle à la pension civile, à pleine charge, en `devise`
  anneeDebut?: number;                // index d'année de projection (0 = année de départ)
  anneeFin?: number;                  // dernière année incluse
}

/** Contrat local malaisien : les charges dépendent de la nationalité et du droit au bonus. */
export interface RegimeLocal {
  malaisien: boolean;                 // EIS et HRDF ne s'appliquent qu'aux malaisiens (et résidents permanents pour l'EIS)
  bonusEligible?: boolean;
  indemnitesAnnuelles?: number;       // allocations et indemnités, annuel en `devise`
  epfPct?: number;                    // surcharge du taux EPF (défaut : celui de la politique)
}

/** Règles de charges sociales locales (à tenir à jour avec la réglementation). */
export interface ChargesSociales {
  epfPct: number;                     // cotisation employeur, % du brut
  socsoPct: number;                   // % du brut, plafonné
  socsoPlafondAnnuel: number;         // montant annuel maximal de la cotisation, en monnaie de base
  eisPct: number;
  hrdfPct: number;
  bonusMois: number;                  // provision de bonus, en mois de salaire
}

export interface PolitiqueSalariale {
  revalorisation: number;             // % par an (indexation des grilles)
  gvt: number;                        // % par an (glissement des carrières) ; hors résidents
  tauxHSA: number;                    // monnaie de base, par an et par heure hebdomadaire d'HSA (0 = non renseigné)
  monnaies: Monnaies;                 // monnaie de base et taux de change
  minGroupe: number;                  // seuil de confidentialité (3)
  chargesSociales?: ChargesSociales;  // requis pour les postes à régime local
  pensionCivileMontee?: number[];     // part de la pension civile due, par année (ex. [0.37, 1, 1…]) ; absent = pleine charge
}

/** Aucun montant par défaut : taux d'HSA et taux de change sont des paramètres à renseigner. */
export const POLITIQUE_DEFAUT: PolitiqueSalariale = { revalorisation: 3, gvt: 1, tauxHSA: 0, monnaies: MONNAIES_DEFAUT, minGroupe: 3 };

/** IMP et décharges en montant forfaitaire : pas de conversion en heures. */
export interface Forfait {
  id: string;
  nom: string;
  type: "imp" | "decharge" | "prime" | "autre";
  centre?: string;
  unites: number;                     // nombre d'IMP, de décharges…
  montantUnitaire: number;            // monnaie de base, par unité et par an
  indexe?: boolean;                   // suit la revalorisation (défaut : oui)
}

export interface PosteCree {          // créations issues de B2 (temps pleins locaux à recruter)
  centre: string;
  etp: number;
  annee: number;                      // première année de coût
  coutUnitaire: number;               // monnaie de base, par ETP et par an, charges comprises, valeur de l'année de départ
}

const facteur = (pct: number, t: number) => Math.pow(1 + pct / 100, t);

/**
 * Coût employeur local : brut = salaire + indemnités + provision de bonus ; + EPF + SOCSO (plafonnée) + EIS + HRDF.
 * Montants dans une même unité (celle du salaire).
 */
export function coutEmployeurLocal(salaire: number, indemnites: number, r: RegimeLocal, c: ChargesSociales): { brut: number; charges: number; total: number } {
  const bonus = r.bonusEligible ? (salaire / 12) * c.bonusMois : 0;
  const brut = salaire + indemnites + bonus;
  const epf = (brut * (r.epfPct ?? c.epfPct)) / 100;
  const socso = Math.min((brut * c.socsoPct) / 100, c.socsoPlafondAnnuel);
  const eis = r.malaisien ? (brut * c.eisPct) / 100 : 0;
  const hrdf = r.malaisien ? (brut * c.hrdfPct) / 100 : 0;
  const charges = epf + socso + eis + hrdf;
  return { brut, charges, total: brut + charges };
}

/** Coût annuel d'un poste pour l'établissement, en milliers de monnaie de base, à l'année t de projection ; 0 hors de sa période. */
export function coutPoste(p: PosteRH, t: number, pol: PolitiqueSalariale): number {
  if (t < (p.anneeDebut ?? 0) || (p.anneeFin != null && t > p.anneeFin)) return 0;
  const charges = 1 + (p.chargesPct ?? 0) / 100;
  const revalo = facteur(pol.revalorisation, t) * (p.statut === "resident" ? 1 : facteur(pol.gvt, t));
  let base: number;
  if (p.statut === "resident") {
    const pension = (p.pensionCivile ?? 0) * (pol.pensionCivileMontee?.[t] ?? 1);
    base = ((p.contributionResident ?? 0) + pension) * p.quotite;
  } else if (p.regimeLocal) {
    if (!pol.chargesSociales) throw new Error(`${p.ref} : régime local sans règles de charges sociales dans la politique salariale`);
    // les plafonds ne sont pas indexés : on calcule sur les montants revalorisés, en monnaie de base
    const aBase = (v: number) => versBase(pol.monnaies, v * revalo, p.devise, t);
    const c = coutEmployeurLocal(aBase(p.salaireBase * p.quotite), aBase((p.regimeLocal.indemnitesAnnuelles ?? 0) + (p.primes ?? 0)), p.regimeLocal, pol.chargesSociales);
    return (c.total + aBase(p.avantages ?? 0) + (p.hsa ?? 0) * pol.tauxHSA * facteur(pol.revalorisation, t)) / 1000;
  } else base = ((p.salaireBase * p.quotite + (p.primes ?? 0)) * charges + (p.avantages ?? 0));
  const enBase = versBase(pol.monnaies, base * revalo, p.devise, t);
  const hsa = (p.hsa ?? 0) * pol.tauxHSA * facteur(pol.revalorisation, t);     // heures × taux, déjà en monnaie de base
  return (enBase + hsa) / 1000;
}

export interface LigneMasse {
  categorie: string;                  // enseignant, non_enseignant, forfaits, creations ou « tous » (regroupement)
  centre: string;
  effectif: number;                   // nombre de postes de la ligne (≥ seuil de confidentialité, hors forfaits et créations)
  regroupe: boolean;
  parAnnee: number[];                 // milliers de monnaie de base
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
    if (p.hsa && !(pol.tauxHSA > 0)) erreurs.push(`${p.ref} : HSA saisies mais taux d'HSA non renseigné`);
    if (p.statut === "pe" && p.categorie !== "enseignant") erreurs.push(`${p.ref} : statut PE réservé aux enseignants`);
  }
  for (const d of tauxManquants(pol.monnaies, postes.map((p) => p.devise))) erreurs.push(`Taux de change manquant pour ${d} (monnaie de base : ${pol.monnaies.base})`);
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
