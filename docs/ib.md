# IB : effectifs, tarification et coûts

L'IB **n'existe pas encore** à LFKL. Il est modélisé comme un segment qui s'ouvre à une année paramétrable, retranché de la voie générale, puis différencié en coût et en tarif.

## Effectifs (A1) — `separerIB`, `src/lib/cohort.ts`
- `anneeOuverture` : année de la 1re rentrée IB1 (avant elle, aucun effectif IB).
- `partPremiere` : % des élèves de 1ère qui entrent en IB, constant ou **série depuis l'ouverture** (montée en charge).
- IB2 = IB1 de l'année précédente × `retention`, plafonné à l'effectif de terminale (alerte si plafonné).
- IB est **retranché** de la 1ère et de la terminale générales ; le total du lycée est inchangé (testé).

## Structure pédagogique (B1) — `src/lib/liaison.ts`
`niveauxStructureAnnee` / `structureParAnnee` traduisent chaque année : 1g et tg nets de l'IB, plus `ib1` et `ib2` (TOK, matières HL/SL, groupes de 20). Effectifs arrondis à l'entier.

## Tarification (A2) — `src/lib/recettes.ts`
Segment tarifaire `IB`, **différencié du lycée** : tarif propre (par défaut celui du lycée tant qu'il n'est pas fixé), hausse annuelle propre, ou série explicite par année pour planifier la différenciation. Le PFC peut exclure un segment.

## Coûts
- Heures et ETP : B1 (matières IB) → B2 → B3.
- Coûts propres par élève IB (licence, examens, coordination) : charges variables par segment (C1, `parEleve.IB`).
- Un centre de coût « IB » peut être créé en B3 pour isoler la masse salariale correspondante.

## À renseigner
Année d'ouverture, part de la 1ère, rétention IB1 → IB2, tarif IB et son évolution, coût par élève IB, matières proposées et leur répartition.
