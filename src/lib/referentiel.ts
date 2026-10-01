// Référentiel Light — voie générale, IB Diploma et BFI (maternelle → terminale), tiré de l'outil « TRM en direct ».
// Retirés : section internationale, DNL hors BFI, voies technologiques, enseignements propres à l'établissement.

export type Cat = "LV" | "SCI" | "DED" | "SPE" | "OPT" | "IB";
export type Cycle = "maternelle" | "elementaire" | "college" | "lycee";

export interface Cours {
  id: string;
  label: string;
  parts: Record<string, number>; // ventilation des heures-prof par discipline (somme > 1 = co-intervention)
  h: number;                     // heures hebdomadaires par élève
  cat: Cat;
  kind: "classe" | "choix";
  gr?: number;                   // classe : heures assurées en groupes (le reste en classe entière)
  part?: number;                 // choix : part par défaut des élèves du niveau (peut dépasser 1 : plusieurs choix par élève)
  groupe?: string;               // contrôle de cohérence : "lv2" (somme des parts = 1), "spe" (= nb de spécialités), "ib" (= 6 matières)
  actifDefaut?: boolean;         // false : cours à activer explicitement (NiveauIn.actifs)
}

export interface NiveauDef {
  id: string;
  nom: string;
  court: string;
  cycle: Cycle;
  cycleTerminal?: boolean;       // pondération 1,1 h (hors EPS)
  marge: number;                 // marge horaire par division (information)
  cours: Cours[];
}

export const DISCIPLINES: { id: string; nom: string }[] = [
  { id: "PE", nom: "Professeurs des écoles" }, { id: "LET", nom: "Lettres" }, { id: "ANG", nom: "Anglais" },
  { id: "ESP", nom: "Espagnol" }, { id: "ALL", nom: "Allemand" }, { id: "CHI", nom: "Chinois" },
  { id: "HG", nom: "Histoire-géographie" }, { id: "PHI", nom: "Philosophie" }, { id: "SES", nom: "SES" },
  { id: "MAT", nom: "Mathématiques" }, { id: "SPC", nom: "Physique-chimie" }, { id: "SVT", nom: "SVT" },
  { id: "TEC", nom: "Technologie / NSI" }, { id: "APL", nom: "Arts plastiques" }, { id: "MUS", nom: "Éducation musicale" },
  { id: "EPS", nom: "EPS" },
  { id: "ECO", nom: "Éco-gestion" },
  { id: "LVH", nom: "Langue du pays hôte (malais)" },
];

const PE = { PE: 1 };
const classe = (id: string, label: string, parts: Record<string, number>, h: number, cat: Cat = "DED", gr = 0): Cours =>
  ({ id, label, parts, h, cat, kind: "classe", gr });
const choix = (id: string, label: string, parts: Record<string, number>, h: number, cat: Cat, part: number, groupe?: string): Cours =>
  ({ id, label, parts, h, cat, kind: "choix", part, groupe });

/** LV2 : un choix de langue par élève ; répartition par défaut à paramétrer par l'établissement. */
const LV2_PARTS: [string, string, number][] = [["ESP", "espagnol", 0.5], ["ALL", "allemand", 0.2], ["CHI", "chinois", 0.3]];
const lv2 = (h: number, prefixe: string, actif = 1): Cours[] =>
  LV2_PARTS.map(([d, n, p]) => choix(`lv2-${d}`, `${prefixe} ${n}`, { [d]: 1 }, h, "LV", p * actif, "lv2"));

/** Langue du pays hôte (malais), hors grille : enseignée par un spécialiste (discipline LVH), pas par le PE. Volumes à confirmer. */
const lvh = (h: number, actifDefaut = true): Cours => ({ ...classe("lvh", "Langue du pays hôte", { LVH: 1 }, h, "LV"), actifDefaut });

const maternelle = (id: string, nom: string): NiveauDef =>
  ({ id, nom, court: id.toUpperCase(), cycle: "maternelle", marge: 0, cours: [classe("dom", "Domaines d'apprentissage", PE, 24)] });
const cycle2 = (id: string, nom: string): NiveauDef => ({ id, nom, court: id.toUpperCase(), cycle: "elementaire", marge: 0, cours: [
  classe("fr", "Français", PE, 10), classe("ma", "Mathématiques", PE, 5), classe("lv", "Langue vivante", PE, 1.5, "LV"),
  classe("eps", "EPS", PE, 3), classe("art", "Enseignements artistiques", PE, 2), classe("qlm", "Questionner le monde, EMC", PE, 2.5), lvh(2)] });
const cycle3 = (id: string, nom: string): NiveauDef => ({ id, nom, court: id.toUpperCase(), cycle: "elementaire", marge: 0, cours: [
  classe("fr", "Français", PE, 8), classe("ma", "Mathématiques", PE, 5), classe("lv", "Langue vivante", PE, 1.5, "LV"),
  classe("eps", "EPS", PE, 3), classe("art", "Enseignements artistiques", PE, 2), classe("sci", "Sciences et technologie", PE, 2), classe("hg", "Histoire-géographie, EMC", PE, 2.5), lvh(2)] });

interface HCollege { fr: number; ma: number; lv1: number; hg: number; eps: number; lat?: number }
const college = (id: string, h: HCollege): NiveauDef => ({ id, nom: id, court: id, cycle: "college", marge: 3, cours: [
  classe("fr", "Français", { LET: 1 }, h.fr), classe("ma", "Mathématiques", { MAT: 1 }, h.ma),
  classe("lv1", "LV1 anglais", { ANG: 1 }, h.lv1, "LV", id === "6e" ? 0 : h.lv1),
  classe("hg", "Histoire-géographie, EMC", { HG: 1 }, h.hg),
  ...(id === "6e"
    ? [classe("sci", "SVT et physique-chimie", { SPC: 0.5, SVT: 0.5 }, 3, "SCI")]
    : [classe("svt", "SVT", { SVT: 1 }, 1.5, "SCI", 1.5), classe("pc", "Physique-chimie", { SPC: 1 }, 1.5, "SCI", 1.5), classe("tec", "Technologie", { TEC: 1 }, 1.5, "SCI", 1.5)]),
  classe("apl", "Arts plastiques", { APL: 1 }, 1), classe("mus", "Éducation musicale", { MUS: 1 }, 1), classe("eps", "EPS", { EPS: 1 }, h.eps),
  ...(id === "6e" ? [] : lv2(2.5, "LV2")),
  lvh(2),
  ...(h.lat ? [choix("lat", "Latin (LCA)", { LET: 1 }, h.lat, "OPT", 0.1)] : []),
  ...(id === "4e" || id === "3e" ? [choix("lce", "Langues et cultures européennes", { ANG: 1 }, 2, "OPT", 0)] : []),
] });

const optionsLycee = (): Cours[] => [
  choix("lat", "Latin (LCA)", { LET: 1 }, 3, "OPT", 0), choix("the", "Théâtre", { LET: 1 }, 3, "OPT", 0),
  choix("artp", "Arts plastiques (option)", { APL: 1 }, 3, "OPT", 0), choix("epso", "EPS (option)", { EPS: 1 }, 3, "OPT", 0),
  choix("lvc", "LVC", { ESP: 1 }, 3, "OPT", 0),
];

/** Spécialités : 3 par élève en 1ère (4 h), 2 en terminale (6 h). Parts par défaut = placeholders à paramétrer. */
const SPE: [string, string, Record<string, number>, number, number][] = [
  // id, libellé, ventilation, part 1ère, part Tle
  ["hggsp", "Spé HGGSP", { HG: 1 }, 0.45, 0.3], ["hlp", "Spé HLP", { LET: 0.5, PHI: 0.5 }, 0.3, 0.2],
  ["llcer", "Spé LLCER anglais", { ANG: 1 }, 0.35, 0.25], ["ses", "Spé SES", { SES: 1 }, 0.4, 0.3],
  ["ma", "Spé mathématiques", { MAT: 1 }, 0.65, 0.45], ["nsi", "Spé NSI", { TEC: 1 }, 0.15, 0.1],
  ["pc", "Spé physique-chimie", { SPC: 1 }, 0.4, 0.25], ["svt", "Spé SVT", { SVT: 1 }, 0.3, 0.15],
];
const spes = (h: number, terminale: boolean): Cours[] =>
  SPE.map(([id, label, parts, p1, pt]) => choix(`s-${id}`, label, parts, h, "SPE", terminale ? pt : p1, "spe"));


/** IB Diploma : 6 matières par élève (3 HL à 4 h, 3 SL à 3 h), TOK 1,5 h. Parts par défaut uniformes = placeholders à paramétrer. */
const IB_MATIERES: [string, string, Record<string, number>][] = [
  ["ENGA", "Group 1 · English A", { ANG: 1 }], ["FRA", "Group 1 · Français A", { LET: 1 }], ["FRB", "Group 2 · French B / ab initio", { LET: 1 }],
  ["ESPB", "Group 2 · Spanish B", { ESP: 1 }], ["CHIB", "Group 2 · Mandarin B", { CHI: 1 }],
  ["ECO", "Group 3 · Economics", { SES: 1 }], ["HIS", "Group 3 · History", { HG: 1 }], ["GEO", "Group 3 · Geography", { HG: 1 }],
  ["PSY", "Group 3 · Psychology", { PHI: 1 }], ["BUS", "Group 3 · Business Management", { ECO: 1 }],
  ["BIO", "Group 4 · Biology", { SVT: 1 }], ["CHE", "Group 4 · Chemistry", { SPC: 1 }], ["PHY", "Group 4 · Physics", { SPC: 1 }],
  ["CS", "Group 4 · Computer Science", { TEC: 1 }], ["MAA", "Group 5 · Maths Analysis & Approaches", { MAT: 1 }],
  ["MAI", "Group 5 · Maths Applications & Interpretation", { MAT: 1 }], ["VA", "Group 6 · Visual Arts", { APL: 1 }], ["MUSI", "Group 6 · Music", { MUS: 1 }],
];
export const IB_HL = 4, IB_SL = 3, IB_TOK = 1.5;
const ib = (id: string, nom: string, court: string): NiveauDef => ({ id, nom, court, cycle: "lycee", marge: 0, cours: [
  classe("tok", "Theory of Knowledge (TOK)", { PHI: 1 }, IB_TOK, "IB"),
  ...IB_MATIERES.flatMap(([k, lib, parts]) => [
    choix(`ib-${k}-hl`, `${lib} HL`, parts, IB_HL, "IB", 1 / IB_MATIERES.length * 3, "ib"),
    choix(`ib-${k}-sl`, `${lib} SL`, parts, IB_SL, "IB", 1 / IB_MATIERES.length * 3, "ib"),
  ]),
  choix("ib-eps", "EPS (établissement)", { EPS: 1 }, 2, "OPT", 0),
] });

/** BFI : composantes ajoutées aux élèves du dispositif en 1ère et terminale. Effectif saisi (NiveauIn.bfi.eff). */
export interface ComposanteDispositif { id: string; label: string; role: "langue" | "dnl"; h: number }
export const BFI: { id: string; nom: string; niveaux: string[]; composantes: ComposanteDispositif[]; langueDefaut: string; dnlDefaut: string[]; effDefaut: number } = {
  id: "bfi", nom: "Baccalauréat français international (BFI)", niveaux: ["1g", "tg"], langueDefaut: "ANG", dnlDefaut: ["HG"], effDefaut: 24,
  composantes: [
    { id: "cdm", label: "Connaissance du monde", role: "langue", h: 2 },
    { id: "acl", label: "Approfondissement culturel et linguistique", role: "langue", h: 2 },
    { id: "dnl", label: "DNL en langue (part en langue)", role: "dnl", h: 2 },
  ],
};

export const NIVEAUX_DEF: NiveauDef[] = [
  maternelle("ps", "Petite section"), maternelle("ms", "Moyenne section"), maternelle("gs", "Grande section"),
  cycle2("cp", "CP"), cycle2("ce1", "CE1"), cycle2("ce2", "CE2"), cycle3("cm1", "CM1"), cycle3("cm2", "CM2"),
  college("6e", { fr: 4.5, ma: 4.5, lv1: 4, hg: 3, eps: 4 }), college("5e", { fr: 4.5, ma: 3.5, lv1: 3, hg: 3, eps: 3, lat: 1 }),
  college("4e", { fr: 4.5, ma: 3.5, lv1: 3, hg: 3, eps: 3, lat: 2 }), college("3e", { fr: 4, ma: 3.5, lv1: 3, hg: 3.5, eps: 3, lat: 3 }),
  { id: "2nde", nom: "Seconde", court: "2nde", cycle: "lycee", marge: 12, cours: [
    classe("fr", "Français", { LET: 1 }, 4), classe("ma", "Mathématiques", { MAT: 1 }, 4), classe("hg", "Histoire-géographie", { HG: 1 }, 3),
    classe("emc", "EMC", { HG: 1 }, 0.5), classe("lva", "LVA anglais", { ANG: 1 }, 3, "LV", 3), classe("ses", "SES", { SES: 1 }, 1.5),
    classe("pc", "Physique-chimie", { SPC: 1 }, 3, "SCI"), classe("svt", "SVT", { SVT: 1 }, 1.5, "SCI"), classe("snt", "SNT", { TEC: 1 }, 1.5, "SCI"),
    classe("eps", "EPS", { EPS: 1 }, 2), lvh(1, false), ...lv2(2.5, "LV2"), ...optionsLycee()] },
  { id: "1g", nom: "Première générale", court: "1ère", cycle: "lycee", cycleTerminal: true, marge: 8, cours: [
    classe("fr", "Français", { LET: 1 }, 4), classe("hg", "Histoire-géographie", { HG: 1 }, 3), classe("emc", "EMC", { HG: 1 }, 0.5),
    classe("lva", "LVA anglais", { ANG: 1 }, 2.5, "LV", 2.5), classe("es", "Enseignement scientifique", { SPC: 0.5, SVT: 0.5 }, 2, "SCI"),
    classe("eps", "EPS", { EPS: 1 }, 2), lvh(1, false), ...lv2(2, "LV2"), ...spes(4, false), ...optionsLycee()] },
  { id: "tg", nom: "Terminale générale", court: "Tle", cycle: "lycee", cycleTerminal: true, marge: 8, cours: [
    classe("phi", "Philosophie", { PHI: 1 }, 4), classe("hg", "Histoire-géographie", { HG: 1 }, 3), classe("emc", "EMC", { HG: 1 }, 0.5),
    classe("lva", "LVA anglais", { ANG: 1 }, 2, "LV", 2), classe("es", "Enseignement scientifique", { SPC: 0.5, SVT: 0.5 }, 2, "SCI"),
    classe("eps", "EPS", { EPS: 1 }, 2), lvh(1, false), ...lv2(2, "LV2"), ...spes(6, true),
    choix("mex", "Option maths expertes", { MAT: 1 }, 3, "OPT", 0), choix("mco", "Option maths complémentaires", { MAT: 1 }, 3, "OPT", 0),
    choix("dgemc", "Option DGEMC", { ECO: 1 }, 3, "OPT", 0), ...optionsLycee()] },
  ib("ib1", "IB Diploma — 1re année (Y12)", "IB1"), ib("ib2", "IB Diploma — 2e année (Y13)", "IB2"),
];

export const REGLAGES_DEFAUT = {
  plafondClasse: { maternelle: 26, elementaire: 26, college: 28, lycee: 35 } as Record<Cycle, number>,
  plafondGroupe: { LV: 24, SCI: 22, DED: 24, SPE: 32, OPT: 30, IB: 20 } as Record<Cat, number>,
  maxBloc: 4,
  ponderation: true,   // 1,1 h en cycle terminal, hors EPS (décret 2014-940)
  ponderationFacteur: 1.1,
  ors: { defaut: 18, EPS: 20, PE: 24 } as Record<string, number>,
  asemParClasseMaternelle: 1,
  lvSpecialistePrimaire: false, // LV du primaire assurée par un professeur d'anglais plutôt que par le PE
};
export type Reglages = typeof REGLAGES_DEFAUT;
