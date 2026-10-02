// P4 — Fundraising & fonds affectés : promesses de dons pondérées, fonds affectés à un projet ou à des bourses internes,
// ressources reçues / utilisées / restant à employer, lien avec le financement par fonds du CAPEX (D2).
// Montants en milliers de la monnaie de pilotage.

export interface Promesse {
  ref: string;
  campagne: string;
  montant: number;                       // montant promis
  probabilite: number;                   // 0 à 1
  calendrier: { annee: number; part: number }[];   // part (0-1) encaissée par année de projection, somme = 1
  affectation: "libre" | { projet: string } | "bourses";
}

export type Affectation = "libre" | "bourses" | string;   // string = nom du projet

export interface ResultatFonds {
  collecteAttendue: number[];            // pondérée par la probabilité, tous dons
  donsLibres: number[];                  // dons non affectés : produits de l'exercice
  fondsAffectesRecus: number[];          // dons affectés (projets, bourses) reçus dans l'année
  utilisation: number[];                 // fonds affectés réellement employés
  utilisationDemandee: number[];
  manque: number[];                      // demandé − employé : à financer autrement (autofinancement)
  soldeAEmployer: number[];              // fonds affectés reçus cumulés − employés cumulés, fin d'année
  parAffectation: Record<string, number[]>;
  objectif: number;                      // somme des montants promis (non pondérés)
  collecteCumulee: number;               // somme pondérée sur l'horizon
  alertes: string[];
}

export const affectationDe = (p: Promesse): Affectation => (typeof p.affectation === "string" ? p.affectation : p.affectation.projet);

export function controlerPromesses(promesses: Promesse[]): string[] {
  const e: string[] = [], vus = new Set<string>();
  for (const p of promesses) {
    if (vus.has(p.ref)) e.push(`Référence en double : ${p.ref}`);
    vus.add(p.ref);
    if (!(p.montant >= 0)) e.push(`${p.ref} : montant invalide`);
    if (!(p.probabilite >= 0 && p.probabilite <= 1)) e.push(`${p.ref} : probabilité hors de 0 à 1`);
    const s = p.calendrier.reduce((x, c) => x + c.part, 0);
    if (Math.abs(s - 1) > 1e-6) e.push(`${p.ref} : calendrier d'encaissement = ${(s * 100).toFixed(0)} % (attendu 100 %)`);
  }
  return e;
}

/**
 * @param utilisationDemandee fonds affectés que le plan voudrait employer chaque année (ex. part de CAPEX financée par fonds, D2,
 *        plus bourses internes). L'emploi est plafonné aux fonds disponibles ; l'écart est un manque à financer autrement.
 * @param soldeInitial fonds affectés déjà reçus et non employés au départ
 */
export function calculerFonds(promesses: Promesse[], utilisationDemandee: number[], horizon: number, soldeInitial = 0): ResultatFonds {
  const z = () => Array<number>(horizon).fill(0);
  const collecte = z(), libres = z(), affectes = z();
  const parAffectation: Record<string, number[]> = {};
  for (const p of promesses) {
    const a = affectationDe(p);
    for (const c of p.calendrier) {
      if (c.annee < 0 || c.annee >= horizon) continue;
      const v = p.montant * p.probabilite * c.part;
      collecte[c.annee] += v;
      if (a === "libre") libres[c.annee] += v; else affectes[c.annee] += v;
      (parAffectation[a] ??= z())[c.annee] += v;
    }
  }
  const demande = z().map((_, t) => utilisationDemandee[t] ?? 0);
  const utilise = z(), manque = z(), solde = z();
  let dispo = soldeInitial;
  for (let t = 0; t < horizon; t++) {
    dispo += affectes[t];
    utilise[t] = Math.min(demande[t], dispo);
    manque[t] = demande[t] - utilise[t];
    dispo -= utilise[t];
    solde[t] = dispo;
  }
  const alertes: string[] = [];
  const t0 = manque.findIndex((m) => m > 1e-9);
  if (t0 >= 0) alertes.push(`Fonds affectés insuffisants dès l'année ${t0} : ${manque[t0].toFixed(0)} à financer autrement`);
  return {
    collecteAttendue: collecte, donsLibres: libres, fondsAffectesRecus: affectes, utilisation: utilise, utilisationDemandee: demande, manque, soldeAEmployer: solde,
    parAffectation, objectif: promesses.reduce((s, p) => s + p.montant, 0), collecteCumulee: collecte.reduce((s, x) => s + x, 0), alertes,
  };
}
