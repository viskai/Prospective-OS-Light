# B1 / B2 — Structure pédagogique et carte des emplois (version Light)

Source : outils existants « TRM en direct », « Fiches de structure » et « Planning des groupes » (socle commun dans `legacy/`).
Code : `src/lib/referentiel.ts`, `src/lib/structure.ts` (B1), `src/lib/emplois.ts` (B2). Tests : `test/structure.test.ts`.

## Chaîne de calcul retenue
1. **Entrée** : effectif projeté par niveau (sortie de A1) et, au besoin, nombre de divisions imposé.
2. **Divisions** = ⌈effectif ÷ plafond de classe⌉ (26 primaire, 28 collège, 35 lycée), effectifs répartis équitablement.
3. **Heures-professeur** par cours :
   - *classe* : (h − heures en groupes) × divisions + heures en groupes × groupes ;
   - *choix* (LV2, spécialités, options) : h × ⌈part d'élèves × effectif ÷ plafond de groupe⌉.
   - Les groupes de dédoublement reprennent la règle d'origine : regroupement de 1 à 4 classes qui minimise le nombre de groupes.
4. **Ventilation par discipline** (co-interventions comprises), pondération 1,1 h en cycle terminal hors EPS.
5. **ETP** = heures ÷ ORS (18 par défaut, EPS 20, PE 24).
6. **Primaire** : classes = ⌈effectif ÷ 26⌉ par niveau, 1 PE par classe, 1 ASEM par classe de maternelle ; option « LV assurée par un spécialiste d'anglais ».
7. **B2 — couverture** par discipline : apport = postes en place × ORS ; écart → HSA ; au-delà du seuil de HSA par poste (2), création du nombre minimal de temps pleins (22 h).

## Ce qui est simplifié ou retiré par rapport aux outils d'origine
| Retiré | Remplacé par |
|---|---|
| IB Diploma, BFI/sections internationales, DNL, dispositifs | hors périmètre Light |
| Voies technologiques (STMG, STI2D, ST2S…) | voie générale seule |
| Placement des spécialités en barrettes (listes d'élèves réelles) | **part d'élèves** par choix, avec contrôle (LV2 = 1, spécialités = 3 en 1ère, 2 en Tle) |
| Optimisation du primaire multiniveau | 1 classe = 1 niveau |
| Enseignements propres à l'établissement, missions et IMP détaillées | à saisir en forfaits d'heures (à ajouter) |
| Transferts d'excédents entre disciplines, recrutement en sous-service | écarts affichés tels quels |
| Versions du référentiel, statuts détaillés, listes nominatives d'enseignants | postes saisis par discipline ; le nominatif reste dans B3 |
| Planning des groupes / fiches de structure (écrans) | non repris : l'OS Light ne publie que des besoins agrégés |

## À paramétrer pour LFKL (valeurs actuelles = placeholders)
- Parts de choix par défaut : LV2 (espagnol 50 %, allemand 20 %, chinois 30 %), spécialités, options (désactivées). Langue du pays hôte (malais) absente du référentiel : à ajouter si hors grille.
- Plafonds de classe et de groupe, ORS, seuil de HSA, ORS de recrutement local.
- Statut des enseignants (détachés / locaux) : B3.

## Publication au registre des drivers
B1 publie : divisions et heures par niveau, besoin en heures et en ETP par discipline, postes PE, ASEM.
B2 publie : écart, HSA, créations de postes par discipline. B3 en déduit le coût (masse salariale) ; aucun montant n'est calculé ici.
