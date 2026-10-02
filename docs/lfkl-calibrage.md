# Calibrage LFKL — ce que les documents fournis ont permis de fixer

Sources : règlement financier 2025-26 (6 octobre 2025) et 2026-27 (1er février 2026), classeur « Budget 2026 ». Monnaie de pilotage : **ringgit malaisien (MYR)**. Autres devises : euro, et potentiellement toute devise d'Asie-Pacifique. Rentrée en **septembre**, constat AEFE au **30 septembre**. **Pas d'emprunt** à ce jour. Données agrégées dans `data/lfkl/`, aucune donnée nominative.

## Fichiers de données
| Fichier | Contenu |
|---|---|
| `parametres.json` | monnaie, tarifs 2025-26 et 2026-27, frais, remises, facturation, PFC, charges sociales locales, IMP, partenaire du campus |
| `effectifs_historiques.csv` | effectifs réels par niveau, **12 années** (2014-15 à 2025-26) |
| `revenus_2026_hypotheses.json` | effectifs, mix familles / entreprises et tarifs par niveau (base du budget de recettes 2026) |
| `budget_2026_synthese.csv` | synthèse par catégorie : exécution 2025, budget 2026, perspective 2027 |
| `capex_priorisation_2026.csv` | investissements priorisés (objet, estimation, période, part LFKL) — à relire, certaines lignes peuvent être des variantes |
| `effectifs_par_niveau.csv`, `effectifs_totaux.csv` | extractions EDUKA « par tarif » (niveau courant, voir `docs/plan-de-realisation.md`) |

## Ce qui est résolu
- **Rétention** : l'historique par niveau permet de calculer les taux sur 3 ou 5 ans (`src/lib/historique.ts`). L'export EDUKA « par rentrée » n'est plus bloquant. Résultat sur 3 ans : MS 180 %, GS 174 %, CP 127 %, CE1 111 %, … 6e 108 %, 3e 88 %, Tle 97 % ; entrées en PS : 13 à 19 par an. Les effectifs sont à date de constat différente selon les années (1er ou 15 décembre) : à remplacer par le 30 septembre.
- **Tarifs** : écolage « particulier » et « entreprise » par cycle, supplément de section internationale (9 600 RM en 2026-27), première inscription (8 800 / 13 200 RM), caution, acompte de 1 000 RM en juin déduit de la facture de septembre, calendrier 40 / 30 / 30 (septembre, janvier, avril), ristourne de 3 % pour paiement annuel.
- **Remises** : fratrie (10 / 15 / 20 % dès le 3e enfant), enfants du personnel (le poste le plus lourd), paiement annuel. Observé au budget 2026 : 0,65 %, 4,45 % et 0,86 % du brut, soit 5,96 %.
- **Mix de payeurs** : famille ≈ 76 % (particulier), entreprise ≈ 24 %. Avec ce mix, les tarifs et les effectifs, le modèle retrouve les recettes de scolarité brutes 2026 du budget à **0,11 %** (test `test/lfkl_calibrage.test.ts`).
- **PFC** : charge (compte 521130) = taux 6 % × effectifs × tarif « particulier » × (1 − abattement 6 %). `HypothesesPFC.tarifsAssiette` porte cette règle.
- **Paie locale** : EPF 13 %, SOCSO 1,75 % plafonnée à 1 249,8 RM par an, EIS 0,2 % et HRDF 1 % (malaisiens), provision de bonus 1,3 mois : `coutEmployeurLocal` reproduit deux cas chiffrés du classeur.
- **Pension civile des détachés** : montée en charge (597 k RM en 2026, 1 631 k RM en 2027 d'après le budget) par la série `pensionCivileMontee`.
- **IMP** : 6 000 RM par IMP et par an ; **partenaire du campus** : 22,5 % des charges communes et des investissements partagés (`refacturation`, `quotePart`).
- **Sociaux et indexation** : GVT 1,66 %, indexation des charges ≈ 4 % entre 2026 et 2027.

## Anomalie détectée dans le classeur : PFC surévaluée d'environ 317 000 RM
Dans la feuille PFC, la colonne « Recettes théoriques pondérées (40 %) — T1 » est multipliée par **0,4 en maternelle mais par 0,6 en primaire, collège et lycée** (formules F3:F5). L'assiette passe ainsi de 30,74 M à 36,33 M RM et la ligne 521130 de 1,75 M à **2,07 M RM**. À vérifier par le DAF avant le vote du budget (reproduit dans le test de calibrage).

## Point de méthode : année civile et année scolaire
Le budget et la comptabilité sont en **année civile** ; le moteur est en **année scolaire**. Passage par `src/lib/exercice.ts` : une année civile pèse 60 % de la scolarité de l'année scolaire précédente (périodes 2 et 3) et 40 % de la courante (période 1) ; 8/12 et 4/12 pour les flux mensuels ; 2/3 et 1/3 pour la PFC. À arbitrer : présenter les états de LFKL en année civile (comptabilité) ou scolaire (AEFE et pilotage).

## Questions ouvertes
1. **Constat au 30 septembre** : fournir les effectifs à cette date pour 2023-24 à 2025-26 (l'historique mélange 1er et 15 décembre).
2. **Enfants du personnel** : 4,45 % du brut, soit environ 1,5 M RM par an — confirmer qu'ils sont suivis comme une remise et non un tarif.
3. **Section internationale britannique** : effectifs par niveau (le supplément est de 9 600 RM par élève).
4. **Taux de change** : confirmer un taux euro/ringgit et les devises à suivre (le classeur utilise environ 4,85 RM pour 1 euro).
5. **SST (taxe sur les services, 8 %)** : collectée pour l'État au-delà de 60 000 RM par famille et par an ; traitée hors recettes — à confirmer avec la comptabilité.
6. **Investissements du campus** : arbitrage entre projets propres et projets partagés ; la liste `capex_priorisation_2026.csv` contient des doublons possibles.
7. **Données personnelles dans le classeur** : plusieurs feuilles (structure RH, IMP, pension civile, cursus malaisien) contiennent des noms et des rémunérations individuels. Elles n'ont pas été reprises ; il est recommandé de fournir des versions pseudonymisées pour la suite.
