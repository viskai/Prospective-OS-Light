// Passage entre l'exercice comptable (année civile, celui du budget et de la comptabilité LFKL) et l'année scolaire (celle du moteur).
// L'année scolaire Y-(Y+1) commence en septembre : une part `w` de ses flux tombe dans l'année civile Y, le reste dans Y+1.
//   flux mensuels (salaires, charges) : w = 4/12 (septembre à décembre)
//   frais de scolarité facturés       : w = 0,4 (1re période de facturation, 40 %)
//   PFC (budget LFKL)                 : w = 1/3 (la charge d'une année civile pondère 2/3 l'année scolaire en cours, 1/3 la suivante)

export const PART_FLUX_MENSUELS = 4 / 12;
export const PART_FACTURATION = 0.4;

/** Valeur de l'année civile Y = w × année scolaire Y + (1 − w) × année scolaire Y−1. `precedente` : année scolaire Y0−1 (sinon égale à la 1re). */
export function anneeCivileDepuisScolaire(scolaires: number[], w = PART_FLUX_MENSUELS, precedente?: number): number[] {
  return scolaires.map((v, i) => w * v + (1 - w) * (i > 0 ? scolaires[i - 1] : precedente ?? v));
}

/** Inverse : année scolaire Y = w × année civile Y + (1 − w) × année civile Y+1. `suivante` : année civile après la dernière (sinon égale à la dernière). */
export function anneeScolaireDepuisCivile(civiles: number[], w = PART_FLUX_MENSUELS, suivante?: number): number[] {
  return civiles.map((v, i) => w * v + (1 - w) * (i < civiles.length - 1 ? civiles[i + 1] : suivante ?? v));
}
