-- D3 (comptes, emprunts, calendriers), P4 (promesses de dons), P3 (paramètres de consolidation).

CREATE TABLE compte_bancaire (
  id INTEGER PRIMARY KEY,
  etablissement_id INTEGER NOT NULL REFERENCES etablissement(id),
  ref TEXT NOT NULL,
  nom TEXT NOT NULL,
  devise TEXT NOT NULL,                   -- convertie en monnaie de base via monnaie_taux
  solde REAL NOT NULL,                    -- en unités de la devise, à la date de l'import bancaire
  date_solde TEXT NOT NULL,
  import_id INTEGER REFERENCES import_fichier(id) ON DELETE SET NULL,
  UNIQUE (etablissement_id, ref, date_solde)
);

CREATE TABLE emprunt (
  id INTEGER PRIMARY KEY,
  etablissement_id INTEGER NOT NULL REFERENCES etablissement(id),
  ref TEXT NOT NULL,
  nom TEXT NOT NULL,
  encours REAL NOT NULL,                  -- milliers de monnaie de base à l'ouverture
  taux REAL NOT NULL,
  duree_restante INTEGER NOT NULL,
  UNIQUE (etablissement_id, ref)
);

CREATE TABLE financement_parametre (
  version_id INTEGER PRIMARY KEY REFERENCES version(id),
  taux_emprunt REAL NOT NULL,
  duree_emprunt INTEGER NOT NULL,
  taux_placement REAL NOT NULL,
  taux_decouvert REAL NOT NULL,
  jours_creances REAL NOT NULL,
  jours_dettes REAL NOT NULL,
  seuil_mois REAL NOT NULL DEFAULT 3,
  calendrier_facturation TEXT NOT NULL,   -- JSON : 12 % par mois depuis la rentrée, somme 100
  mois_depart TEXT NOT NULL,              -- AAAA-MM
  nb_mois INTEGER NOT NULL CHECK (nb_mois BETWEEN 12 AND 18)
);

CREATE TABLE promesse_don (
  id INTEGER PRIMARY KEY,
  version_id INTEGER NOT NULL REFERENCES version(id),
  ref TEXT NOT NULL,
  campagne TEXT NOT NULL,
  montant REAL NOT NULL,
  probabilite REAL NOT NULL CHECK (probabilite BETWEEN 0 AND 1),
  calendrier TEXT NOT NULL,               -- JSON : [{annee, part}], somme des parts = 1
  affectation TEXT NOT NULL DEFAULT 'libre'   -- libre, bourses ou nom d'un projet_capex
);
