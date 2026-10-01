-- Lot 1 — Socle : établissements, utilisateurs/rôles, imports, registre des drivers, scénarios/versions, journal.
-- Les clés des briques exclues (axe stratégique, activité, auteur de demande) sont prévues et laissées vides (§9).

CREATE TABLE etablissement (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,            -- LCS, LFKL
  nom TEXT NOT NULL,
  devise_base TEXT NOT NULL DEFAULT 'AUD',
  parametres TEXT NOT NULL DEFAULT '{}' -- plan comptable, calendrier, grilles, statuts
);

CREATE TABLE utilisateur (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('admin','direction','rh','pedago','sg','compta','board')),
  etablissement_id INTEGER REFERENCES etablissement(id)
);

CREATE TABLE import_fichier (
  id INTEGER PRIMARY KEY,
  etablissement_id INTEGER NOT NULL REFERENCES etablissement(id),
  source TEXT NOT NULL CHECK (source IN ('eduka','compta','banque','aefe','rh')),
  date_donnees TEXT NOT NULL,           -- date de constat
  periode TEXT,
  nom_fichier TEXT,
  statut TEXT NOT NULL DEFAULT 'ok',
  importe_par INTEGER REFERENCES utilisateur(id),
  importe_le TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (etablissement_id, source, date_donnees)
);

CREATE TABLE scenario (
  id INTEGER PRIMARY KEY,
  etablissement_id INTEGER NOT NULL REFERENCES etablissement(id),
  nom TEXT NOT NULL
);

CREATE TABLE version (
  id INTEGER PRIMARY KEY,
  scenario_id INTEGER NOT NULL REFERENCES scenario(id),
  type_periode TEXT NOT NULL CHECK (type_periode IN ('budget_initial','budget_rectificatif','prevision_glissante','realise')),
  statut TEXT NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon','soumis','arrete')),
  motif_decision TEXT,                  -- remplace le registre des décisions
  fige_le TEXT,
  cree_le TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE driver (
  id INTEGER PRIMARY KEY,
  etablissement_id INTEGER NOT NULL REFERENCES etablissement(id),
  code TEXT NOT NULL,
  libelle TEXT NOT NULL,
  unite TEXT,
  module_source TEXT,
  proprietaire TEXT,
  calcule INTEGER NOT NULL DEFAULT 0,   -- 1 = publié par un module
  commentaire TEXT,
  axe_strategique_id INTEGER,           -- réservé version complète
  UNIQUE (etablissement_id, code)
);

CREATE TABLE driver_valeur (
  driver_id INTEGER NOT NULL REFERENCES driver(id),
  version_id INTEGER NOT NULL REFERENCES version(id),
  annee_scolaire TEXT NOT NULL,         -- ex. 2026-27
  valeur REAL,
  maj_le TEXT NOT NULL DEFAULT (datetime('now')),
  revision INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (driver_id, version_id, annee_scolaire)
);

CREATE TABLE journal (
  id INTEGER PRIMARY KEY,
  table_nom TEXT NOT NULL,
  cle TEXT NOT NULL,
  etat_precedent TEXT,
  utilisateur_id INTEGER REFERENCES utilisateur(id),
  date_modif TEXT NOT NULL DEFAULT (datetime('now'))
);
