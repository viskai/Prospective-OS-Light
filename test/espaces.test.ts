import { test } from "node:test";
import assert from "node:assert/strict";
import { capaciteAccueil, confronter, controlerEspaces, divisionsParCycle, projetsDepuisBesoins, sallesDisponibles, type Espace, type ParamsEspaces } from "../src/lib/espaces.ts";
import { calculerCapex, type ProjetCapex } from "../src/lib/capex.ts";
import { calculerStructure } from "../src/lib/structure.ts";

const salle = (ref: string, cycle: Espace["cycle"], x: Partial<Espace> = {}): Espace => ({ ref, nom: ref, type: "salle_classe", cycle, surfaceM2: 60, ...x });
const espaces: Espace[] = [
  ...Array.from({ length: 4 }, (_, i) => salle(`E${i}`, "elementaire")), ...Array.from({ length: 10 }, (_, i) => salle(`C${i}`, "college")),
  { ref: "L1", nom: "Labo 1", type: "salle_specialisee", cycle: "college", sousType: "laboratoire", surfaceM2: 80 },
];
const P: ParamsEspaces = {
  tauxOccupation: { maternelle: 1, elementaire: 1, college: 0.8, lycee: 0.8 }, m2ParSalle: { maternelle: 80, elementaire: 70, college: 65, lycee: 65 },
  plafondClasse: { maternelle: 26, elementaire: 26, college: 28, lycee: 35 }, besoinsSpecialises: [{ sousType: "laboratoire", cycles: ["college", "lycee"], pourDivisions: 6 }],
};
const div = (e: number, c: number) => ({ maternelle: 0, elementaire: e, college: c, lycee: 0 });
const projet = (x: Partial<ProjetCapex> = {}): ProjetCapex => ({ nom: "P", cycle: "elementaire", salles: 2, m2: 140, coutM2: 9000, anneeService: 2, dureeTravaux: 2, dureeAmort: 30, partEmprunt: 0, partFonds: 0, ...x });

test("confrontation : salles manquantes et excédentaires, salles spécialisées", () => {
  const r = confronter([div(3, 8), div(5, 8), div(5, 9)], espaces, [], P);
  assert.equal(r[0].parCycle.elementaire.ecart, 1);                  // 4 salles pour 3 divisions : excédent
  assert.equal(r[1].parCycle.elementaire.ecart, -1);                 // 5 divisions : 1 salle manque
  assert.equal(r[0].parCycle.college.besoin, 10);                    // ⌈8 / 0,8⌉
  assert.equal(r[2].parCycle.college.besoin, 12);                    // ⌈9 / 0,8⌉
  assert.equal(r[2].sallesManquantes, 1 + 2);
  assert.equal(r[1].m2Manquants, 70);
  assert.equal(r[0].specialises[0].besoin, 2); assert.equal(r[0].specialises[0].ecart, -1);   // 8 divisions / 6 → 2 labos pour 1 existant
});

test("les projets mis en service ajoutent des salles", () => {
  assert.equal(sallesDisponibles(espaces, [projet()], 1).elementaire, 4);
  assert.equal(sallesDisponibles(espaces, [projet()], 2).elementaire, 6);
  const r = confronter([div(5, 8), div(5, 8), div(5, 8)], espaces, [projet({ anneeService: 1, salles: 1 })], P);
  assert.equal(r[0].parCycle.elementaire.ecart, -1); assert.equal(r[1].parCycle.elementaire.ecart, 0);
});

test("capacité d'accueil, pour la jauge plafonnée de A1", () => {
  const cap = capaciteAccueil(espaces, [projet()], P);
  assert.equal(cap(0, "Elem"), 4 * 1 * 26);
  assert.equal(cap(2, "Elem"), 6 * 26);
  assert.equal(cap(0, "Col"), 10 * 0.8 * 28);
});

test("projets proposés pour combler les manques, et pas pour un déficit déjà couvert", () => {
  const divisions = [div(4, 8), div(5, 8), div(6, 8), div(6, 8), div(6, 8), div(6, 8)];
  const pr = { coutM2: 9000, dureeTravaux: 2, dureeAmort: 30, partEmprunt: 50, partFonds: 10 };
  const p = projetsDepuisBesoins(divisions, espaces, [], P, pr);
  const ext = p.filter((x) => x.cycle === "elementaire");
  assert.equal(ext.length, 1);
  assert.equal(ext[0].anneeService, 1); assert.equal(ext[0].salles, 2); assert.equal(ext[0].m2, 140);
  assert.equal(confronter(divisions, espaces, p, P).every((x) => x.parCycle.elementaire.ecart >= 0), true);
  assert.equal(projetsDepuisBesoins(divisions, espaces, [projet({ anneeService: 1, salles: 2 })], P, pr).filter((x) => x.cycle === "elementaire").length, 0);
  // les projets sont directement exploitables par D2
  const capex = calculerCapex(p, { indexationConstruction: 0, renouvellementAnnuel: 0, indexationRenouvellement: 0, dureeAmortRenouvellement: 8, vncExistante: 0, dotationExistante: 0 });
  assert.ok(capex.decaissements.some((v) => v > 0));
});

test("divisions issues de B1 → cycles d'espaces", () => {
  const s = calculerStructure([{ id: "cp", eff: 52 }, { id: "6e", eff: 90 }, { id: "ib1", eff: 24 }]);
  const d = divisionsParCycle(s.niveaux.map((n) => ({ cycle: n.cycle === "maternelle" || n.cycle === "elementaire" || n.cycle === "college" || n.cycle === "lycee" ? n.cycle : "lycee", div: n.div })));
  assert.deepEqual(d, { maternelle: 0, elementaire: 2, college: 4, lycee: 1 });
});

test("contrôles de l'inventaire", () => {
  assert.deepEqual(controlerEspaces(espaces), []);
  assert.ok(controlerEspaces([salle("X", "commun")]).length > 0);
  assert.ok(controlerEspaces([salle("A", "college"), salle("A", "college")]).some((m) => /double/.test(m)));
});
