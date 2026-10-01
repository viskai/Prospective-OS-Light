-- A1 — Effectifs réels issus des imports EDUKA. Élèves identifiés par ID EDUKA pseudonymisé uniquement.
CREATE TABLE effectif_eleve (
  import_id INTEGER NOT NULL REFERENCES import_fichier(id) ON DELETE CASCADE,
  id_eduka TEXT NOT NULL,
  niveau TEXT NOT NULL,                 -- TPS..Tle ou NR (non renseigné)
  section TEXT,                         -- absent des exports « par tarif » actuels
  payeur TEXT NOT NULL CHECK (payeur IN ('famille','entreprise','entreprise_facture_famille','autre')),
  nationalite TEXT,
  PRIMARY KEY (import_id, id_eduka)
);

CREATE VIEW effectif_par_niveau AS
SELECT import_id, niveau, COUNT(*) AS effectif FROM effectif_eleve GROUP BY import_id, niveau;
