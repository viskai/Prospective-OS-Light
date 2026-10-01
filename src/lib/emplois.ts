// B2 — Carte des emplois (version Light) : besoin en heures vs apport des postes en place, par discipline.
// Règle reprise de « TRM en direct » : apport = Σ ORS des postes à temps plein ; écart → HSA ou création de temps pleins.
// Retirés : transferts d'excédents entre disciplines, recrutement en sous-service, détail nominatif (B3).

export interface PosteDiscipline {
  postes: number;      // postes à temps plein en place (équivalents temps plein, partagés au prorata)
  apport?: number;     // heures apportées ; par défaut postes × ORS de la discipline
}

export interface ReglagesEmplois {
  ors: Record<string, number>;      // ORS par discipline (clé "defaut" en repli)
  orsRecrutement: number;           // ORS d'un temps plein créé (contractuel local : 22 par défaut)
  hsaMax: Record<string, number>;   // HSA maximales par poste (clé "defaut" en repli)
}

export const EMPLOIS_DEFAUT: ReglagesEmplois = { ors: { defaut: 18, EPS: 20 }, orsRecrutement: 22, hsaMax: { defaut: 2 } };

export type EtatDiscipline = "equilibre" | "soutenable" | "recruter" | "creer" | "excedent" | "sansPoste";

export interface CouvertureDiscipline {
  besoin: number; besoinETP: number; postes: number; apport: number; ecart: number;
  hsa: number; excedent: number; hsaParPoste: number | null; seuil: number;
  creations: number; hsaApres: number; hsaParPosteApres: number | null; etat: EtatDiscipline;
}

export function calculerCouverture(
  besoins: Record<string, number>,
  enPlace: Record<string, PosteDiscipline>,
  R: ReglagesEmplois = EMPLOIS_DEFAUT,
): Record<string, CouvertureDiscipline> {
  const ors = (d: string) => R.ors[d] ?? R.ors.defaut ?? 18;
  const seuilDe = (d: string) => R.hsaMax[d] ?? R.hsaMax.defaut ?? 2;
  const out: Record<string, CouvertureDiscipline> = {};
  for (const d of new Set([...Object.keys(besoins), ...Object.keys(enPlace)])) {
    if (d === "PE") continue;
    const besoin = besoins[d] ?? 0;
    const P = enPlace[d]?.postes ?? 0;
    const apport = enPlace[d]?.apport ?? P * ors(d);
    if (!besoin && !apport) continue;
    const ecart = besoin - apport;
    const hsa = Math.max(0, ecart), excedent = Math.max(0, -ecart);
    const seuil = seuilDe(d);
    const hsaParPoste = P > 0 ? hsa / P : null;
    const tpPossibles = Math.floor((hsa + 1e-6) / R.orsRecrutement);
    let creations = 0;
    if (hsa > 0.05) {
      if (P <= 0) creations = tpPossibles;
      else if ((hsaParPoste as number) > seuil + 1e-9) {
        creations = tpPossibles;
        for (let k = 1; k <= tpPossibles; k++) if ((hsa - k * R.orsRecrutement) / (P + k) <= seuil + 1e-9) { creations = k; break; }
      }
    }
    const hsaApres = Math.max(0, hsa - creations * R.orsRecrutement);
    const postesApres = P + creations;
    let etat: EtatDiscipline;
    if (excedent > 0.05) etat = "excedent";
    else if (hsa <= 0.05) etat = "equilibre";
    else if (P <= 0) etat = creations ? "creer" : "sansPoste";
    else if ((hsaParPoste as number) <= seuil + 1e-9) etat = "soutenable";
    else etat = creations ? "recruter" : "soutenable";
    out[d] = { besoin, besoinETP: besoin / ors(d), postes: P, apport, ecart, hsa, excedent, hsaParPoste, seuil, creations,
      hsaApres, hsaParPosteApres: postesApres > 0 ? hsaApres / postesApres : null, etat };
  }
  return out;
}
