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
- [ ] A1 effectifs & capacité (montée de cohorte, 3 modes de jauge) — logique de référence dans `prototype/`
- [ ] A2/A3 recettes, PFC AEFE
- [ ] Registre des drivers (P1)

## Décisions (1er octobre 2026)
- **Établissement pilote : LFKL.**
- **Horizon de prévision : 15 ans** (le cahier des charges §6 disait 5 ans ; à reporter dans le moteur et le registre des drivers).
- **Plan de trésorerie : mensuel** (12 à 18 mois, puis annuel).

## Données de départ (LFKL)
`data/lfkl/effectifs_par_niveau.csv` : effectifs agrégés par niveau issus des extractions EDUKA « Listes des élèves par tarif » 2023-24 (677), 2024-25 (762) et 2025-26 (823).
Les fichiers sources contiennent des ID élèves pseudonymisés : ils restent dans `data/raw/` (ignoré par git).
Points d'attention : niveau non renseigné (NR) pour 232 élèves en 2023-24 et 125 en 2024-25 ; pas de colonne section ni de tarif détaillé (seulement le payeur).
