# B3 — RH & masse salariale (version Light)

Module **isolé** : accès DAF, direction RH et Payroll (§5 et §8 du cahier des charges). Code : `src/lib/rh.ts`, schéma : `migrations/0003_rh.sql`, tests : `test/rh.test.ts`.

## Principes
- Aucun nom : un **poste** a une référence opaque (`ref`). Aucune donnée d'état civil n'est lue à l'import.
- Le module ne publie que des **agrégats** : masse salariale par catégorie × centre de coût, et postes en place par discipline pour B2.
- **Confidentialité** : toute ligne de moins de 3 postes est regroupée (« Autres » de la catégorie, puis « tous / Autres ») ; en dessous de 3 postes au total, le détail est masqué. Le total reste exact.

## Inspiration de la carte des emplois LCS (sans reprendre les noms)
| Constat dans la carte LCS | Reprise en Light |
|---|---|
| Une personne ≠ un poste ; remplaçants, postes à pourvoir, doublons | postes distincts, `anneeDebut` / `anneeFin` pour les arrivées, départs et créations |
| Services : primaire, secondaire, administration, périscolaire ; départements et pools par discipline | `service` + `centre` de coût |
| Statuts : résident, TNR, contractuel, vacataire ; contrats permanent, CDI, CDD, casual, détaché | `statut` et `contrat` |
| Service (heures) comparé à l'apport (ORS × quotité) par discipline, avec HSA | `enPlaceDepuisPostes` → B2 ; HSA saisies par poste |
| Contrôles de rapprochement (hors budget, doublons, service ≠ apport, discipline ou langue manquante) | `controlerPostes` : doublons, centre, quotité, ORS, salaire, contribution du résident, devise |
| Grille de rémunération par échelon | salaire de base saisi par poste ; GVT en % annuel (échelons détaillés non repris) |
| Missions et coordinations | forfaits (ci-dessous) |

## Coût d'un poste
- Non résident : (salaire de base × quotité + primes) × (1 + charges) + avantages.
- Résident AEFE : **contribution** annuelle de l'établissement × quotité (remplace le salaire, pas de GVT).
- HSA : heures hebdomadaires × taux annuel par HSA.
- Projection sur 15 ans : revalorisation annuelle, GVT, dérive éventuelle du change ; devises AUD / MYR / EUR (taux = unités de devise pour 1 AUD, piloté par driver).

## IMP et décharges
Montants **forfaitaires** (nombre d'unités × montant annuel), indexables, sans conversion en heures ni effet sur le besoin en ETP de B1/B2.

## Créations de postes
Les créations calculées par B2 (temps pleins locaux) sont valorisées avec un coût unitaire moyen (`PosteCree`) à partir de leur année d'effet.

## À fournir
Liste des postes par discipline (annoncée), puis pour chaque poste : statut, quotité, ORS, salaire ou contribution, charges, devise. Taux de revalorisation, GVT, taux d'HSA et taux de change à valider par le DAF.
