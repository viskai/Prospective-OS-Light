// D3 — Financement & trésorerie : comptes bancaires, emprunts (échéancier, simulation), plan de trésorerie mensuel.
// Montants en milliers de la monnaie de pilotage ; comptes en devise convertis avec les taux du driver (src/lib/monnaie.ts).
import { versBase, type Monnaies } from "./monnaie.ts";

export interface CompteBancaire { ref: string; nom: string; devise: string; solde: number /* en unités de la devise */ }

/** Solde d'ouverture consolidé (milliers de monnaie de base) : placements et comptes multidevises. */
export const soldeOuverture = (comptes: CompteBancaire[], m: Monnaies): number =>
  comptes.reduce((s, c) => s + versBase(m, c.solde, c.devise) / 1000, 0);

/** Emprunt en cours à l'année de départ : encours (milliers), remboursé en annuités constantes dès l'année 0. */
export interface EmpruntExistant { ref: string; nom: string; encours: number; taux: number; dureeRestante: number }
export interface ParamsDette { taux: number; duree: number }   // nouveaux emprunts : taux annuel en %, durée en années

export interface Echeancier {
  tirages: number[]; interets: number[]; capital: number[]; service: number[]; encours: number[]; // encours en fin d'année
}

const annuite = (A: number, r: number, n: number) => (r > 0 ? (A * r) / (1 - Math.pow(1 + r, -n)) : A / n);

/**
 * Échéancier annuel. Un tirage de l'année y est remboursé en annuités constantes à partir de l'année y+1 ;
 * les intérêts de l'année portent sur le capital restant dû à l'ouverture (les tirages de l'année n'en génèrent pas).
 */
export function echeancier(tirages: number[], p: ParamsDette, existants: EmpruntExistant[] = [], horizon = tirages.length): Echeancier {
  const n = Math.max(1, Math.round(p.duree)), r = p.taux / 100;
  type Tranche = { depuis: number; reste: number; ann: number; r: number };
  const tranches: Tranche[] = existants.map((e) => ({ depuis: -1, reste: e.encours, ann: annuite(e.encours, e.taux / 100, Math.max(1, Math.round(e.dureeRestante))), r: e.taux / 100 }));
  const z = () => Array<number>(horizon).fill(0);
  const interets = z(), capital = z(), encours = z(), tir = z();
  for (let t = 0; t < horizon; t++) {
    for (const x of tranches) {
      if (x.depuis < t && x.reste > 1e-9) {
        const i = x.reste * x.r, c = Math.min(x.reste, x.ann - i);
        interets[t] += i; capital[t] += c; x.reste -= c;
      }
    }
    tir[t] = tirages[t] ?? 0;
    if (tir[t] > 0) tranches.push({ depuis: t, reste: tir[t], ann: annuite(tir[t], r, n), r });
    encours[t] = tranches.reduce((s, x) => s + x.reste, 0);
  }
  return { tirages: tir, interets, capital, service: interets.map((v, t) => v + capital[t]), encours };
}

export interface SimulationEmprunt { annuite: number; totalInterets: number; echeancier: { annee: number; interets: number; capital: number; encours: number }[] }

/** Simulation d'un emprunt : annuité, coût total et tableau d'amortissement (remboursement dès l'année suivante, différé optionnel). */
export function simulerEmprunt(montant: number, tauxPct: number, duree: number, differe = 0): SimulationEmprunt {
  const r = tauxPct / 100, n = Math.max(1, Math.round(duree));
  const a = annuite(montant, r, n);
  let reste = montant, total = 0;
  const tab: SimulationEmprunt["echeancier"] = [];
  for (let k = 1; k <= n + differe; k++) {
    const i = reste * r;
    const c = k <= differe ? 0 : Math.min(reste, a - i);
    reste -= c; total += i;
    tab.push({ annee: k, interets: i, capital: c, encours: reste });
  }
  return { annuite: a, totalInterets: total, echeancier: tab };
}

/* ------------------------------ Plan de trésorerie mensuel ------------------------------ */

export const CALENDRIER_UNIFORME: number[] = Array(12).fill(100 / 12);

export interface FluxAnnuels {                 // par année scolaire, milliers
  encaissements: number[]; paie: number[]; fournisseurs: number[]; capex: number[]; serviceDette: number[];
  ressources?: number[];                       // emprunts tirés, fonds affectés reçus
}

export interface ParamsPlanMensuel {
  moisDepart: string;                          // AAAA-MM, premier mois du plan
  nbMois: number;                              // 12 à 18
  moisRentree: number;                         // 1-12, défaut 9
  debutAnnee: number;                          // première année scolaire de la projection
  soldeOuverture: number;
  annuel: FluxAnnuels;
  calendrierFacturation: number[];             // 12 valeurs en %, par mois depuis la rentrée, somme 100
  calendrierPaie?: number[]; calendrierFournisseurs?: number[]; calendrierCapex?: number[]; calendrierDette?: number[]; calendrierRessources?: number[];
  seuilMois: number;                           // couverture minimale en mois de charges d'exploitation
  /** Acompte de réinscription : encaissé un mois donné (juin), déduit de la facture de la 1re période de l'année suivante. */
  acompte?: { mois: number; montantParEleve: number; eleves: number[]; initial?: number /* élèves ayant payé l'acompte avant le début du plan */ };
}

export interface MoisTreso {
  mois: string; t: number;
  encaissements: number; paie: number; fournisseurs: number; capex: number; dette: number; ressources: number;
  flux: number; solde: number; couvertureMois: number | null;
  acompte: number;                             // acompte encaissé ce mois (inclus dans les encaissements)
  deductionAcompte: number;                    // acompte déduit de la facture de ce mois (déjà retranché des encaissements)
}

export interface PlanMensuel {
  mois: MoisTreso[];
  pointBas: { mois: string; solde: number };
  couvertureMin: number | null;
  alertes: string[];
}

const sommeCalendrier = (c: number[]) => c.reduce((s, x) => s + x, 0);

export function controlerCalendrier(c: number[] | undefined, nom: string): string[] {
  if (!c) return [];
  const e: string[] = [];
  if (c.length !== 12) e.push(`Calendrier ${nom} : 12 mois attendus`);
  else if (Math.abs(sommeCalendrier(c) - 100) > 0.01) e.push(`Calendrier ${nom} : somme = ${sommeCalendrier(c).toFixed(2)} % (attendu 100)`);
  return e;
}

export function planMensuel(p: ParamsPlanMensuel): PlanMensuel {
  if (p.nbMois < 12 || p.nbMois > 18) throw new Error("Le plan mensuel couvre 12 à 18 mois");
  const erreurs = [
    ...controlerCalendrier(p.calendrierFacturation, "facturation"), ...controlerCalendrier(p.calendrierPaie, "paie"),
    ...controlerCalendrier(p.calendrierFournisseurs, "fournisseurs"), ...controlerCalendrier(p.calendrierCapex, "CAPEX"),
    ...controlerCalendrier(p.calendrierDette, "dette"), ...controlerCalendrier(p.calendrierRessources, "ressources"),
  ];
  if (erreurs.length) throw new Error(erreurs.join(" ; "));
  const [a0, m0] = p.moisDepart.split("-").map(Number);
  const rentree = p.moisRentree || 9;
  const cal = (c: number[] | undefined, pos: number) => (c ?? CALENDRIER_UNIFORME)[pos] / 100;
  const mois: MoisTreso[] = [];
  const alertes: string[] = [];
  let solde = p.soldeOuverture;
  for (let k = 0; k < p.nbMois; k++) {
    const idx = a0 * 12 + (m0 - 1) + k, an = Math.floor(idx / 12), m = (idx % 12) + 1;
    const t = an - p.debutAnnee - (m < rentree ? 1 : 0), pos = (m - rentree + 12) % 12;
    if (t < 0 || t >= p.annuel.encaissements.length) throw new Error(`Mois ${an}-${String(m).padStart(2, "0")} hors de la projection`);
    const A = p.annuel;
    const ac = p.acompte;
    const acompteRecu = ac && m === ac.mois ? ((ac.eleves[t] ?? 0) * ac.montantParEleve) / 1000 : 0;
    // la déduction porte sur la 1re facture de l'année scolaire : acompte payé en juin de l'année scolaire précédente
    const deduction = ac && pos === 0 ? (((t > 0 ? ac.eleves[t - 1] : ac.initial) ?? 0) * ac.montantParEleve) / 1000 : 0;
    const enc = A.encaissements[t] * cal(p.calendrierFacturation, pos) - deduction + acompteRecu, paie = A.paie[t] * cal(p.calendrierPaie, pos);
    const four = A.fournisseurs[t] * cal(p.calendrierFournisseurs, pos), capex = A.capex[t] * cal(p.calendrierCapex, pos);
    const dette = A.serviceDette[t] * cal(p.calendrierDette, pos), res = (A.ressources?.[t] ?? 0) * cal(p.calendrierRessources, pos);
    const flux = enc + res - paie - four - capex - dette;
    solde += flux;
    const chargesMensuelles = (A.paie[t] + A.fournisseurs[t]) / 12;
    mois.push({ mois: `${an}-${String(m).padStart(2, "0")}`, t, encaissements: enc, paie, fournisseurs: four, capex, dette, ressources: res, flux, solde,
      couvertureMois: chargesMensuelles > 0 ? solde / chargesMensuelles : null, acompte: acompteRecu, deductionAcompte: deduction });
  }
  const bas = mois.reduce((b, x) => (x.solde < b.solde ? x : b), mois[0]);
  const couv = mois.map((x) => x.couvertureMois).filter((x): x is number => x != null);
  const couvertureMin = couv.length ? Math.min(...couv) : null;
  if (bas.solde < 0) alertes.push(`Trésorerie négative en ${bas.mois} (${bas.solde.toFixed(0)})`);
  else if (couvertureMin != null && couvertureMin < p.seuilMois) alertes.push(`Couverture minimale de ${couvertureMin.toFixed(1)} mois de charges, sous le seuil de ${p.seuilMois}`);
  return { mois, pointBas: { mois: bas.mois, solde: bas.solde }, couvertureMin, alertes };
}
