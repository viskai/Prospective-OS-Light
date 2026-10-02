-- B3 — RH & masse salariale (module isolé). Accès réservé aux rôles admin et rh (contrôlé dans le Worker).
-- Aucun nom ni donnée d'état civil : un poste est identifié par une référence opaque.

CREATE TABLE rh_poste (
  id INTEGER PRIMARY KEY,
  etablissement_id INTEGER NOT NULL REFERENCES etablissement(id),
  ref TEXT NOT NULL,                      -- référence opaque (jamais un nom)
  service TEXT NOT NULL CHECK (service IN ('primaire','secondaire','administration','periscolaire')),
  centre TEXT NOT NULL,                   -- discipline (LET, MAT…) ou département
  categorie TEXT NOT NULL CHECK (categorie IN ('enseignant','non_enseignant')),
  statut TEXT NOT NULL CHECK (statut IN ('resident','tnr','contractuel','vacataire','pe','local')),
  contrat TEXT,
  quotite REAL NOT NULL,
  ors REAL,
  hsa REAL,
  devise TEXT NOT NULL,                   -- devise des montants du poste ; convertie en monnaie de base via monnaie_taux
  salaire_base REAL NOT NULL DEFAULT 0,
  primes REAL,
  charges_pct REAL,
  avantages REAL,
  contribution_resident REAL,
  annee_debut INTEGER,
  annee_fin INTEGER,
  import_id INTEGER REFERENCES import_fichier(id) ON DELETE SET NULL,
  UNIQUE (etablissement_id, ref)
);

CREATE TABLE rh_politique (
  etablissement_id INTEGER PRIMARY KEY REFERENCES etablissement(id),
  revalorisation REAL NOT NULL DEFAULT 3,
  gvt REAL NOT NULL DEFAULT 1,
  taux_hsa REAL NOT NULL DEFAULT 0,       -- monnaie de base, par an et par heure hebdomadaire d'HSA (0 = non renseigné)
  min_groupe INTEGER NOT NULL DEFAULT 3
);

-- IMP et décharges : montants forfaitaires, sans conversion en heures.
CREATE TABLE forfait (
  id INTEGER PRIMARY KEY,
  etablissement_id INTEGER NOT NULL REFERENCES etablissement(id),
  nom TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('imp','decharge','prime','autre')),
  centre TEXT,
  unites REAL NOT NULL,
  montant_unitaire REAL NOT NULL,         -- monnaie de base, par unité et par an
  indexe INTEGER NOT NULL DEFAULT 1
);
