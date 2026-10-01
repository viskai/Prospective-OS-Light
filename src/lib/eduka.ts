// Import EDUKA « Listes des élèves par tarif » : lignes déjà extraites du .xlsx
// (colonnes : Code identifiant, Payeur des frais de scolarité, Nationalité 1, Niveau).
// Seuls l'ID pseudonymisé et ces colonnes sont lues ; aucune colonne d'état civil (§4).

export const NIVEAUX = ["TPS", "PS", "MS", "GS", "CP", "CE1", "CE2", "CM1", "CM2", "6e", "5e", "4e", "3e", "2nde", "1ere", "Tle"] as const;
export type Niveau = (typeof NIVEAUX)[number] | "NR"; // NR = niveau non renseigné

const LIBELLES: Record<string, Niveau> = {
  "toute petite section": "TPS", "petite section": "PS", "moyenne section": "MS", "grande section": "GS",
  cp: "CP", ce1: "CE1", ce2: "CE2", cm1: "CM1", cm2: "CM2",
  "6ème": "6e", "5ème": "5e", "4ème": "4e", "3ème": "3e",
  "2nde": "2nde", "1ère": "1ere", terminale: "Tle",
};

export type Payeur = "famille" | "entreprise" | "entreprise_facture_famille" | "autre";

export interface LigneEleve {
  idEduka: string;
  payeur: Payeur;
  nationalite: string | null;
  niveau: Niveau;
}

export function normaliseNiveau(libelle: unknown): Niveau {
  return LIBELLES[String(libelle ?? "").trim().toLowerCase()] ?? "NR";
}

export function normalisePayeur(libelle: unknown): Payeur {
  const s = String(libelle ?? "").trim().toLowerCase();
  if (s === "famille") return "famille";
  if (s.startsWith("entreprise (facturation")) return "entreprise_facture_famille";
  if (s === "entreprise") return "entreprise";
  return "autre";
}

export interface ResultatImport {
  lignes: LigneEleve[];
  effectifParNiveau: Record<string, number>;
  erreurs: string[]; // contrôles bloquants (§4)
}

export function parseListeEleves(lignes: unknown[][]): ResultatImport {
  const [entete, ...corps] = lignes;
  const erreurs: string[] = [];
  const attendu = ["code identifiant", "payeur", "nationalit", "niveau"];
  attendu.forEach((a, i) => {
    if (!String(entete?.[i] ?? "").toLowerCase().includes(a)) erreurs.push(`Colonne ${i + 1} inattendue : « ${entete?.[i] ?? ""} » (attendu : ${a})`);
  });
  const vus = new Set<string>();
  const out: LigneEleve[] = [];
  for (const r of corps) {
    if (!r || r.every((c) => c == null || c === "")) continue;
    const idEduka = String(r[0] ?? "").trim();
    if (!idEduka) { erreurs.push("Ligne sans code identifiant"); continue; }
    if (vus.has(idEduka)) { erreurs.push(`Code identifiant en double : ${idEduka}`); continue; }
    vus.add(idEduka);
    out.push({ idEduka, payeur: normalisePayeur(r[1]), nationalite: r[2] ? String(r[2]).trim() : null, niveau: normaliseNiveau(r[3]) });
  }
  const effectifParNiveau: Record<string, number> = {};
  for (const l of out) effectifParNiveau[l.niveau] = (effectifParNiveau[l.niveau] ?? 0) + 1;
  return { lignes: out, effectifParNiveau, erreurs };
}
