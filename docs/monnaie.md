# Monnaie unique de pilotage

Toute l'application travaille dans **une seule monnaie, modifiable** : la monnaie de pilotage de l'établissement (`etablissement.monnaie_base`).
Code : `src/lib/monnaie.ts`. Aucune devise n'est écrite en dur dans les calculs, les unités de drivers ni la base de données.

## Règles
- **Tout montant** (tarifs, salaires, HSA, forfaits IMP et décharges, contrats, coût au m², CAPEX, états financiers) est exprimé dans la monnaie de pilotage ; les stocks et flux agrégés sont en milliers.
- Un montant libellé dans une autre devise (salaire local, contrat étranger) porte sa `devise` et est converti **à la saisie ou au calcul** avec le taux de change (`monnaie_taux`, drivers `fin.change.*`) : `taux` = unités de la devise pour 1 unité de monnaie de pilotage, avec une dérive annuelle optionnelle.
- **HSA** : les heures sont saisies en heures. Seul le **taux** d'une heure d'HSA hebdomadaire est un montant, saisi dans la monnaie de pilotage (`pay.tauxHSA`).
- **Aucune valeur par défaut** pour les montants et les taux de change : un taux inventé fausserait les résultats. Un contrôle signale tout poste ou contrat dont la devise n'a pas de taux, et les HSA saisies sans taux d'HSA.
- Les unités de drivers utilisent le jeton `{M}` (« {M}/an », « k{M} »), remplacé à l'affichage par le code de la monnaie de pilotage.

## Changer de monnaie de pilotage
1. `rebaser(monnaies, nouvelle)` produit la table des taux dans la nouvelle base (dérive relative recalculée) ; le taux de la nouvelle monnaie doit exister.
2. `facteurRebasage(monnaies, nouvelle)` donne le coefficient à appliquer à **tous les montants** exprimés dans l'ancienne base.
3. `rebaserDrivers(valeurs, registre, facteur)` multiplie les seuls drivers `monetaire` ; les pourcentages, heures et effectifs ne bougent pas.
4. Les montants libellés dans leur propre devise ne changent pas (ex. un poste en MYR reste en MYR) : seule leur conversion change.
La valeur économique est conservée : un aller-retour de monnaie redonne les mêmes résultats (testé).

## À renseigner
Monnaie de pilotage de LFKL (la structure est prête à recevoir MYR, EUR ou AUD) et taux de change des devises utilisées.
