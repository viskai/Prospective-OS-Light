// Monnaie unique de pilotage. Tous les montants de l'application (tarifs, coûts, CAPEX, forfaits, états financiers)
// sont exprimés dans la monnaie de base de l'établissement, modifiable. Une autre monnaie n'intervient qu'à l'entrée
// d'un montant libellé en devise (contrat ou salaire local) : il est converti à la saisie, avec un taux piloté par driver.
// Aucun code de devise n'est écrit en dur dans les calculs.

export interface Monnaies {
  base: string;                              // code ISO de la monnaie de pilotage (EUR, MYR, AUD…)
  taux: Record<string, number>;              // unités de la devise pour 1 unité de base ; taux[base] = 1
  derive?: Record<string, number>;           // % par an de hausse du nombre d'unités de la devise pour 1 unité de base
}

/** Aucun taux par défaut : un taux inventé fausserait les résultats. À renseigner par le DAF. */
export const MONNAIES_DEFAUT: Monnaies = { base: "MYR", taux: { MYR: 1 } };

export function verifierMonnaies(m: Monnaies): string[] {
  const e: string[] = [];
  if (!m.base) e.push("Monnaie de base manquante");
  if (m.taux[m.base] !== 1) e.push(`Le taux de la monnaie de base (${m.base}) doit valoir 1`);
  for (const [c, t] of Object.entries(m.taux)) if (!(t > 0) || !Number.isFinite(t)) e.push(`Taux invalide pour ${c}`);
  return e;
}

/** Convertit un montant libellé en `devise` vers la monnaie de base, à l'année t (dérive du taux comprise). */
export function versBase(m: Monnaies, montant: number, devise: string, t = 0): number {
  if (devise === m.base) return montant;
  const taux = m.taux[devise];
  if (!(taux > 0)) throw new Error(`Taux de change manquant pour ${devise} (monnaie de base : ${m.base})`);
  return montant / (taux * Math.pow(1 + (m.derive?.[devise] ?? 0) / 100, t));
}

export const tauxManquants = (m: Monnaies, devises: Iterable<string>): string[] =>
  [...new Set(devises)].filter((d) => d !== m.base && !(m.taux[d] > 0));

/** Facteur à appliquer à tout montant exprimé dans l'ancienne base pour l'exprimer dans `nouvelle`. */
export function facteurRebasage(m: Monnaies, nouvelle: string): number {
  const t = nouvelle === m.base ? 1 : m.taux[nouvelle];
  if (!(t > 0)) throw new Error(`Taux manquant pour ${nouvelle} : impossible de changer de monnaie de base`);
  return t;
}

/** Table des taux exprimée dans une nouvelle monnaie de base (la dérive relative est recalculée). */
export function rebaser(m: Monnaies, nouvelle: string): Monnaies {
  const f = facteurRebasage(m, nouvelle);
  const dn = 1 + (m.derive?.[nouvelle] ?? 0) / 100;
  const taux: Record<string, number> = {};
  const derive: Record<string, number> = {};
  for (const [c, t] of Object.entries({ ...m.taux, [m.base]: 1 })) {
    taux[c] = t / f;
    const dc = 1 + (m.derive?.[c] ?? 0) / 100;
    if (c !== nouvelle && dc !== dn) derive[c] = (dc / dn - 1) * 100;
  }
  taux[nouvelle] = 1;
  return { base: nouvelle, taux, ...(Object.keys(derive).length ? { derive } : {}) };
}

/** Réexprime une série de montants dans une nouvelle base (ex. au changement de monnaie de pilotage). */
export const rebaserMontants = (valeurs: number[], facteur: number): number[] => valeurs.map((v) => v * facteur);

/** Affichage : « 1 234 k MYR » ou « 1 234 MYR ». */
export function formaterMontant(m: Monnaies, valeur: number, opts: { milliers?: boolean; locale?: string; decimales?: number } = {}): string {
  const n = new Intl.NumberFormat(opts.locale ?? "fr-FR", { maximumFractionDigits: opts.decimales ?? 0 }).format(valeur);
  return `${n} ${opts.milliers ? "k " : ""}${m.base}`;
}

/** Remplace le jeton {M} d'une unité de driver par la monnaie de base (« {M}/an » → « MYR/an »). */
export const uniteAvecMonnaie = (unite: string, m: Monnaies): string => unite.replaceAll("{M}", m.base);
