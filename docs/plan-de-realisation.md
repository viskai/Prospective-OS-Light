# Plan de réalisation

Découpage en 4 lots (cahier des charges §9), chaque lot recetté avant le suivant.

| Lot | Contenu | Recette |
|---|---|---|
| 1 — Socle et élèves | Base, rôles, imports EDUKA, A1, A2, A3, registre des drivers | Recettes 2026-27 recalculées à ±2 % du facturé EDUKA |
| 2 — Moyens humains | B1, B2, B3 (reprise des deux outils existants) | Carte des emplois à l'ETP près ; masse salariale à ±1 % de la paie |
| 3 — Fonctionnement et investissement | C1, D1, D2, D3, P4 | Contrats/immobilisations rapprochés de la compta ; trésorerie rapprochée des soldes bancaires |
| 4 — Consolidation et restitution | P2, P3, dashboard | Réalisé du dernier exercice reproduit en états bouclés, écart nul au bilan ; 3 scénarios sur 5 ans |

## Prochaines étapes (Lot 1)
- [ ] `wrangler d1 create os-light`, renseigner `database_id`, appliquer `migrations/0001_socle.sql`
- [ ] Configurer Cloudflare Access (code à usage unique) et mapper e-mail → rôle
- [ ] Assistant d'import EDUKA + modèle .xlsx
- [x] A1 moteur de projection par montée de cohorte, horizon 15 ans (`src/lib/cohort.ts`, jauge plafonnée / non plafonnée) — reste : bulle conservée, taux de rétention calculés sur 3/5 ans (export EDUKA par rentrée requis), stress tests, part IB
- [ ] A2/A3 recettes, PFC AEFE
- [x] Registre des drivers : catalogue initial (`src/lib/drivers.ts`) — reste : table de valeurs par année/version, API, traçabilité

## Décisions (1er octobre 2026)
- **Établissement pilote : LFKL.**
- **Horizon de prévision : 15 ans** (le cahier des charges §6 disait 5 ans ; à reporter dans le moteur et le registre des drivers).
- **Plan de trésorerie : mensuel** (12 à 18 mois, puis annuel).

## Données de départ (LFKL)
Extractions EDUKA « Listes des élèves par tarif » 2023-24, 2024-25 et 2025-26 (fichiers bruts dans `data/raw/`, ignorés par git : ID élèves pseudonymisés).

**Vérification faite sur les identifiants (1er octobre 2026).**
- Un même identifiant garde le même niveau d'un fichier à l'autre : 442/442 (23-24 → 24-25) et 613/613 (24-25 → 25-26). Ex. les 38 « Terminale » de 24-25 sont tous encore « Terminale » en 25-26.
- Le **niveau est donc le niveau courant de l'élève à la date d'extraction, recopié sur toutes les années**, et non son niveau de l'année du fichier. En revanche la **présence par année est bien historisée** : le fichier de chaque année liste les élèves facturés cette année-là.
- Les lignes **sans niveau (232 en 23-24, 125 en 24-25) sont des élèves partis** : aucun n'est présent en 25-26 et aucun n'a de niveau dans une autre année. Leur niveau historique est inconnu.
- Conséquence : `effectifs_par_niveau.csv` ne contient que 2025-26 (seule année dont les niveaux sont fiables). `effectifs_totaux.csv` donne les totaux par année, valides.
- Pour reconstituer les niveaux passés : niveau_année = niveau courant − nombre d'années d'écart, valable pour les élèves encore présents (hypothèse : scolarité sans redoublement) ; impossible pour les partis. Les taux de rétention doivent donc s'appuyer sur un export datant de chaque rentrée.
- Pas de colonne section ni de tarif détaillé (seulement le payeur).
