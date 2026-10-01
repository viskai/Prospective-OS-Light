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

## Questions ouvertes (à trancher)
- Établissement pilote : LCS ou LFKL ?
- Horizon de prévision : 5 ans suffisent-ils pour le plan d'investissement ? (le prototype simule 10 ans)
- Plan de trésorerie : mensuel ou hebdomadaire ?
