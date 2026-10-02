-- IB (n'existe pas encore), contrats (C1), espaces (D1), projets d'investissement (D2).

-- Paramètres de l'IB par scénario : retranché de la 1ère et de la terminale générales, tarifé et coûté à part.
CREATE TABLE ib_parametre (
  scenario_id INTEGER PRIMARY KEY REFERENCES scenario(id),
  annee_ouverture INTEGER NOT NULL,       -- index d'année de la 1re rentrée IB1
  part_premiere TEXT NOT NULL,            -- JSON : % constant ou série depuis l'ouverture
  retention REAL NOT NULL DEFAULT 100
);

CREATE TABLE contrat (
  id INTEGER PRIMARY KEY,
  etablissement_id INTEGER NOT NULL REFERENCES etablissement(id),
  ref TEXT NOT NULL,
  fournisseur TEXT NOT NULL,              -- personne morale
  objet TEXT NOT NULL,
  categorie TEXT NOT NULL CHECK (categorie IN ('energie','maintenance','nettoyage','securite','it','assurances','loyer','autre')),
  montant_annuel REAL NOT NULL,
  devise TEXT NOT NULL,
  date_debut TEXT NOT NULL,
  date_fin TEXT,
  preavis_jours INTEGER NOT NULL DEFAULT 90,
  indexation REAL NOT NULL DEFAULT 0,
  centre_cout TEXT NOT NULL,
  reconduit INTEGER NOT NULL DEFAULT 1,
  UNIQUE (etablissement_id, ref)
);

CREATE TABLE espace (
  id INTEGER PRIMARY KEY,
  etablissement_id INTEGER NOT NULL REFERENCES etablissement(id),
  ref TEXT NOT NULL,
  nom TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('salle_classe','salle_specialisee','gymnase','cdi','administration','autre')),
  cycle TEXT CHECK (cycle IN ('maternelle','elementaire','college','lycee','commun')),
  surface_m2 REAL NOT NULL,
  affectation TEXT,
  sous_type TEXT,
  UNIQUE (etablissement_id, ref)
);

CREATE TABLE projet_capex (
  id INTEGER PRIMARY KEY,
  version_id INTEGER NOT NULL REFERENCES version(id),
  nom TEXT NOT NULL,
  cycle TEXT CHECK (cycle IN ('maternelle','elementaire','college','lycee')),
  salles REAL NOT NULL DEFAULT 0,
  m2 REAL NOT NULL,
  cout_m2 REAL NOT NULL,                  -- monnaie de base par m²
  annee_service INTEGER NOT NULL,
  duree_travaux INTEGER NOT NULL DEFAULT 2,
  duree_amort INTEGER NOT NULL DEFAULT 30,
  part_emprunt REAL NOT NULL DEFAULT 0,
  part_fonds REAL NOT NULL DEFAULT 0,
  origine TEXT NOT NULL DEFAULT 'saisi' CHECK (origine IN ('saisi','propose_d1'))
);
