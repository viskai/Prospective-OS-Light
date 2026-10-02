// C1 — Services généraux & contrats : registre des contrats, charges récurrentes indexées, charges variables, enveloppes
// pédagogiques par cycle, alertes d'échéance. Montants dans la monnaie de pilotage ; un contrat libellé en devise est converti.
import { versBase, tauxManquants, type Monnaies } from "./monnaie.ts";
import type { EffectifsSegment, Segment } from "./recettes.ts";

export type CategorieCharge = "energie" | "maintenance" | "nettoyage" | "securite" | "it" | "assurances" | "loyer" | "autre";

export interface Contrat {
  ref: string;
  fournisseur: string;                 // personne morale (jamais un nom de personne)
  objet: string;
  categorie: CategorieCharge;
  montantAnnuel: number;               // en `devise`, valeur de l'année de départ
  devise: string;
  dateDebut: string;                   // ISO AAAA-MM-JJ
  dateFin?: string;                    // absente = durée indéterminée
  preavisJours: number;                // délai de préavis avant la fin ou le renouvellement
  indexation: number;                  // % par an
  centreCout: string;
  reconduit?: boolean;                 // true (défaut) : la charge continue après la fin, indexée
}

export interface ChargesVariables {
  parEleve?: Partial<Record<Segment, number>>;      // coût annuel par élève, par segment (ex. frais d'examens IB)
  parM2?: number;                                   // énergie et entretien, par m² et par an
  enveloppesPeda?: Partial<Record<Segment, { montant: number; mode: "forfait" | "par_eleve" }>>;  // remplacent les demandes de moyens
  indexation: number;                               // % par an
  refacturation?: { categories: string[]; part: number };   // part (%) des charges communes prise en charge par un établissement partenaire du campus
}

export interface ContexteCharges {
  monnaies: Monnaies;
  debutAnnee: number;                               // première année scolaire : 2026 pour 2026-27
  moisRentree?: number;                             // 1-12, défaut 9 (septembre)
  effectifs: EffectifsSegment[];                    // par année
  surfaces: number[];                               // m² par année (existant + projets de D2)
  horizon?: number;
}

export interface ChargesProjetees {
  annees: string[];
  parCategorie: Record<string, number[]>;           // milliers de monnaie de base
  total: number[];
  alertes: AlerteContrat[];
}

export interface AlerteContrat { ref: string; niveau: "information" | "vigilance" | "critique"; texte: string }

const facteur = (pct: number, t: number) => Math.pow(1 + pct / 100, t);
const jour = (iso: string) => { const d = Date.parse(`${iso}T00:00:00Z`); if (Number.isNaN(d)) throw new Error(`Date invalide : ${iso}`); return d; };
const JOUR_MS = 86_400_000;

/** Un contrat pèse sur l'année t s'il a commencé et, sauf reconduction, n'est pas échu avant la rentrée. */
export function contratActif(c: Contrat, t: number, ctx: Pick<ContexteCharges, "debutAnnee" | "moisRentree">): boolean {
  const mois = String(ctx.moisRentree ?? 9).padStart(2, "0");
  const debutAnnee = jour(`${ctx.debutAnnee + t}-${mois}-01`), finAnnee = jour(`${ctx.debutAnnee + t + 1}-${mois}-01`);
  if (jour(c.dateDebut) >= finAnnee) return false;
  if (c.dateFin && c.reconduit === false && jour(c.dateFin) < debutAnnee) return false;
  return true;
}

export function projeterCharges(contrats: Contrat[], v: ChargesVariables, ctx: ContexteCharges): ChargesProjetees {
  const horizon = ctx.horizon ?? ctx.effectifs.length;
  const annees = Array.from({ length: horizon }, (_, i) => `${ctx.debutAnnee + i}-${String((ctx.debutAnnee + i + 1) % 100).padStart(2, "0")}`);
  const parCategorie: Record<string, number[]> = {};
  const ajouter = (cat: string, t: number, valeur: number) => { (parCategorie[cat] ??= Array(horizon).fill(0))[t] += valeur; };
  for (let t = 0; t < horizon; t++) {
    for (const c of contrats) {
      if (!contratActif(c, t, ctx)) continue;
      ajouter(c.categorie, t, versBase(ctx.monnaies, c.montantAnnuel * facteur(c.indexation, t), c.devise, t) / 1000);
    }
    const f = facteur(v.indexation, t), eff = ctx.effectifs[t] ?? {};
    for (const [seg, montant] of Object.entries(v.parEleve ?? {}) as [Segment, number][]) ajouter("variables_eleves", t, ((eff[seg] ?? 0) * montant * f) / 1000);
    if (v.parM2) ajouter("surfaces", t, ((ctx.surfaces[t] ?? 0) * v.parM2 * f) / 1000);
    for (const [seg, e] of Object.entries(v.enveloppesPeda ?? {}) as [Segment, { montant: number; mode: "forfait" | "par_eleve" }][])
      ajouter("fonctionnement_pedagogique", t, ((e.mode === "par_eleve" ? (eff[seg] ?? 0) * e.montant : e.montant) * f) / 1000);
  }
  if (v.refacturation) {
    for (let t = 0; t < horizon; t++) {
      const communes = v.refacturation.categories.reduce((s, c) => s + (parCategorie[c]?.[t] ?? 0), 0);
      ajouter("refacturation_partenaire", t, (-communes * v.refacturation.part) / 100);
    }
  }
  const total = Array.from({ length: horizon }, (_, t) => Object.values(parCategorie).reduce((s, a) => s + a[t], 0));
  return { annees, parCategorie, total, alertes: [] };
}

/** Alertes d'échéance : fin sous 6 mois (information), préavis sous 90 jours (vigilance), préavis dépassé (critique). */
export function alertesContrats(contrats: Contrat[], dateRef: string): AlerteContrat[] {
  const ref = jour(dateRef), out: AlerteContrat[] = [];
  for (const c of contrats) {
    if (!c.dateFin) continue;
    const fin = jour(c.dateFin), limite = fin - c.preavisJours * JOUR_MS;
    if (fin < ref) { if (c.reconduit === false) out.push({ ref: c.ref, niveau: "critique", texte: `${c.objet} : contrat échu le ${c.dateFin} et non reconduit` }); continue; }
    if (limite < ref) out.push({ ref: c.ref, niveau: "critique", texte: `${c.objet} : préavis dépassé (date limite ${new Date(limite).toISOString().slice(0, 10)}), fin le ${c.dateFin}` });
    else if ((limite - ref) / JOUR_MS <= 90) out.push({ ref: c.ref, niveau: "vigilance", texte: `${c.objet} : préavis à donner avant le ${new Date(limite).toISOString().slice(0, 10)}` });
    else if ((fin - ref) / JOUR_MS <= 183) out.push({ ref: c.ref, niveau: "information", texte: `${c.objet} : fin du contrat le ${c.dateFin}` });
  }
  return out;
}

export const contratsEchusSous6Mois = (contrats: Contrat[], dateRef: string): number =>
  contrats.filter((c) => c.dateFin && jour(c.dateFin) >= jour(dateRef) && (jour(c.dateFin) - jour(dateRef)) / JOUR_MS <= 183).length;

/** Contrôles du registre : doublons, dates, devises sans taux. */
export function controlerContrats(contrats: Contrat[], m: Monnaies): string[] {
  const e: string[] = [], vus = new Set<string>();
  for (const c of contrats) {
    if (vus.has(c.ref)) e.push(`Référence en double : ${c.ref}`);
    vus.add(c.ref);
    if (!(c.montantAnnuel >= 0)) e.push(`${c.ref} : montant invalide`);
    if (c.dateFin && jour(c.dateFin) < jour(c.dateDebut)) e.push(`${c.ref} : date de fin antérieure au début`);
    if (!c.centreCout) e.push(`${c.ref} : centre de coût manquant`);
  }
  for (const d of tauxManquants(m, contrats.map((c) => c.devise))) e.push(`Taux de change manquant pour ${d} (monnaie de base : ${m.base})`);
  return e;
}
