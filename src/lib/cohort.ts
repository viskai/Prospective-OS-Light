// A1 — Projection des effectifs par montée de cohorte (logique du prototype, horizon paramétrable).
// Rétention d'un niveau = effectif du niveau ÷ effectif du niveau inférieur l'année précédente.
// Un taux > 100 % signifie un apport extérieur (nouveaux inscrits) ; < 100 % une attrition.

export type Cycle = "Mat" | "Elem" | "Col" | "Lyc";

export interface Niveau {
  code: string;
  cycle: Cycle;
  e0: number;            // effectif de départ
  retention?: number;    // % ; absent pour le niveau d'entrée
  secondaire?: boolean;  // soumis à Δ rétention secondaire
}

export interface Scenario {
  entree: number;        // entrées au 1er niveau, par an
  croissance: number;    // % par an sur l'entrée
  dRet: number;          // points, tous niveaux
  dSec: number;          // points, secondaire
}

export type Jauge = "plafond" | "demande";

export interface Entree {
  niveaux: Niveau[];
  scenario: Scenario;
  jauge: Jauge;
  horizon: number;                                    // nombre d'années projetées (incl. année 0)
  capacite: (t: number, cycle: Cycle) => number;      // places = salles × capacité par classe, à l'année t
}

export interface Resultat {
  effectifs: number[][];   // [t][niveau]
  apports: number[][];     // nouveaux inscrits [t][niveau]
  parCycle: Record<Cycle, number>[];
  total: number[];
}

const somme = (a: number[]) => a.reduce((x, y) => x + y, 0);

export function projeter(e: Entree): Resultat {
  const { niveaux, scenario: sc, horizon } = e;
  const plafonne = e.jauge === "plafond";
  const eff: number[][] = [niveaux.map((n) => n.e0)];
  const app: number[][] = [
    niveaux.map((n, i) => {
      if (i === 0) return n.e0;
      const r = (n.retention ?? 100) / 100;
      return r > 1 ? (n.e0 * (r - 1)) / r : 0;
    }),
  ];
  for (let t = 1; t < horizon; t++) {
    const passants: number[] = [];
    const apports: number[] = [];
    niveaux.forEach((n, i) => {
      if (i === 0) {
        passants[i] = 0;
        apports[i] = sc.entree * Math.pow(1 + sc.croissance / 100, t - 1);
        return;
      }
      const prec = eff[t - 1][i - 1];
      const taux = Math.max(0, (n.retention ?? 0) / 100 + sc.dRet / 100 + (n.secondaire ? sc.dSec / 100 : 0));
      passants[i] = prec * Math.min(taux, 1);
      apports[i] = prec * Math.max(taux - 1, 0);
    });
    if (plafonne) {
      for (const cycle of ["Mat", "Elem", "Col", "Lyc"] as Cycle[]) {
        const idx = niveaux.flatMap((n, i) => (n.cycle === cycle ? [i] : []));
        if (!idx.length) continue;
        const inscrits = somme(idx.map((i) => passants[i]));
        const nouveaux = somme(idx.map((i) => apports[i]));
        const cap = e.capacite(t, cycle);
        if (inscrits + nouveaux > cap) {
          const f = nouveaux > 0 ? Math.max(0, cap - inscrits) / nouveaux : 0;
          idx.forEach((i) => (apports[i] *= f));
        }
      }
    }
    eff[t] = passants.map((p, i) => p + apports[i]);
    app[t] = apports;
  }
  const parCycle = eff.map((ligne) => {
    const o: Record<Cycle, number> = { Mat: 0, Elem: 0, Col: 0, Lyc: 0 };
    niveaux.forEach((n, i) => (o[n.cycle] += ligne[i]));
    return o;
  });
  return { effectifs: eff, apports: app, parCycle, total: eff.map(somme) };
}

/** Années scolaires libellées : 2026-27, 2027-28… */
export const anneesScolaires = (debut: number, n: number) =>
  Array.from({ length: n }, (_, i) => `${debut + i}-${String((debut + i + 1) % 100).padStart(2, "0")}`);

/** Niveau passé reconstitué pour un élève encore présent (hypothèse : pas de redoublement). */
export function niveauPasse(codes: readonly string[], courant: string, ecartAnnees: number): string | null {
  const i = codes.indexOf(courant);
  return i - ecartAnnees >= 0 ? codes[i - ecartAnnees] : null; // null = pas encore scolarisé
}
