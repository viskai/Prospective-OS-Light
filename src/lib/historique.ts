// A1 — Taux de rétention et entrées calculés sur l'historique des effectifs par niveau (3 ou 5 ans), avec surcharge manuelle.
// Un taux de rétention est le rapport entre l'effectif d'un niveau et celui du niveau inférieur l'année précédente
// (> 100 % : apport de nouveaux inscrits ; < 100 % : départs).

export interface Historique {
  annees: string[];          // ordre chronologique
  niveaux: string[];         // du plus bas au plus haut
  effectifs: number[][];     // [année][niveau]
}

/** CSV annee_scolaire,niveau,effectif → historique. Les niveaux gardent l'ordre `ordre` (défaut : ordre d'apparition). */
export function parserHistoriqueCsv(csv: string, ordre?: string[]): Historique {
  const lignes = csv.trim().split(/\r?\n/).slice(1).map((l) => l.split(","));
  const annees = [...new Set(lignes.map((l) => l[0]))].sort();
  const niveaux = ordre ?? [...new Set(lignes.map((l) => l[1]))];
  const effectifs = annees.map((a) => niveaux.map((n) => Number(lignes.find((l) => l[0] === a && l[1] === n)?.[2] ?? NaN)));
  return { annees, niveaux, effectifs };
}

export interface OptionsRetention {
  fenetre?: 3 | 5;                     // nombre de transitions annuelles retenues, les plus récentes (défaut 3)
  exclure?: string[];                  // années d'arrivée à ignorer (ex. année atypique)
  surcharge?: Record<string, number>;  // taux manuels en %, par niveau
}

/** Rétention (%) de chaque niveau sauf le premier : somme des effectifs d'arrivée ÷ somme des effectifs d'origine sur la fenêtre. */
export function retentionsDepuisHistorique(h: Historique, o: OptionsRetention = {}): Record<string, number> {
  const fenetre = o.fenetre ?? 3;
  const transitions = h.annees.map((a, t) => t).filter((t) => t > 0 && !(o.exclure ?? []).includes(h.annees[t])).slice(-fenetre);
  const out: Record<string, number> = {};
  h.niveaux.forEach((n, i) => {
    if (i === 0) return;
    let num = 0, den = 0;
    for (const t of transitions) {
      const a = h.effectifs[t][i], b = h.effectifs[t - 1][i - 1];
      if (Number.isFinite(a) && Number.isFinite(b) && b > 0) { num += a; den += b; }
    }
    out[n] = o.surcharge?.[n] ?? (den > 0 ? (num / den) * 100 : NaN);
  });
  return out;
}

export interface StatsEntree { moyenne: number; min: number; max: number; derniere: number }

/** Entrées au premier niveau sur la fenêtre (les plus récentes années). */
export function entreesDepuisHistorique(h: Historique, fenetre = 3): StatsEntree {
  const v = h.effectifs.map((l) => l[0]).filter(Number.isFinite).slice(-fenetre);
  return { moyenne: v.reduce((s, x) => s + x, 0) / v.length, min: Math.min(...v), max: Math.max(...v), derniere: v[v.length - 1] };
}
