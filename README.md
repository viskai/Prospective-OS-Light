# Prospective OS Light

Outil web de pilotage financier et de moyens pour établissements scolaires (pilote : LFKL) :
effectifs → structure → emplois → masse salariale → états financiers bouclés.

- **Spécifications :** [`docs/cahier-des-charges.md`](docs/cahier-des-charges.md) (issu du doc « Cahier des charges — School Strategic OS Light »)
- **Plan et lots :** [`docs/plan-de-realisation.md`](docs/plan-de-realisation.md)
- **Prototype d'ergonomie :** [`prototype/os-light-prototype.html`](prototype/os-light-prototype.html) — page autonome, valeurs fictives (milliers dans une monnaie d'exemple), à ouvrir dans un navigateur
- **Pile :** Cloudflare Workers + D1 + Cloudflare Access (code à usage unique) ; n8n uniquement pour invitations/notifications

## Démarrage
```bash
npm install
npx wrangler d1 create os-light      # reporter database_id dans wrangler.toml
npm run db:migrate:local
npm run dev                          # http://localhost:8787/api/health
```

## Structure
```
docs/         cahier des charges, plan
prototype/    prototype HTML d'ergonomie
src/          Worker (index.ts) et modules métiers (src/modules)
migrations/   schéma D1
templates/    modèles d'import .xlsx/.csv
```
