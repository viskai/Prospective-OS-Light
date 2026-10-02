# Documents et extractions à fournir (LFKL)

Règles : fichiers `.xlsx` ou `.csv` ; **aucun nom, prénom, date de naissance ni adresse** (ID EDUKA pseudonymisé pour les élèves, référence opaque pour les postes) ; une date de constat sur chaque extraction. Les fichiers bruts restent hors de git (`data/raw/`).

## Priorité 1 — pour un premier calcul calibré
- [x] **Cadrage** : monnaie MYR ; autres devises euro et Asie-Pacifique ; rentrée en septembre ; constat AEFE au 30 septembre. *Reste : taux de change à confirmer (≈ 4,85 RM pour 1 euro dans le classeur).*
- [~] **EDUKA — effectifs par rentrée** : l'historique par niveau 2014-15 à 2025-26 est dans le classeur Budget (dates de constat mêlées : 1er et 15 décembre). *Reste : les effectifs **au 30 septembre**, et par section.*
- [ ] **EDUKA — structure actuelle** : nombre de divisions et effectif par classe, par niveau (2025-26 et 2026-27).
- [ ] **EDUKA — facturé** par rubrique (scolarité, inscription, annexes, remises, fratries) et par type tarifaire, 2025-26 et 2026-27.
- [x] **Grille tarifaire** 2025-26 et 2026-27, frais de première inscription, remises (règlement financier et budget). *Reste : politique d'évolution tarifaire au-delà de 2027, effectifs en section internationale.*
- [ ] **Postes par discipline** (annoncé) : référence opaque, service, discipline ou département, catégorie, statut, contrat, quotité, ORS, HSA, devise, salaire de base, primes, charges, avantages, contribution du résident, dates d'arrivée et de départ prévues.
- [ ] **Grille horaire LFKL** : heures par discipline et par niveau, malais (volumes), LV2 offertes, spécialités, options, dispositifs BFI, plafonds de classe et de groupe, ORS par statut.
- [ ] **Choix des élèves** : nombre d'élèves par LV2, spécialité et option, par niveau (agrégé).

## Priorité 2 — pour les états financiers
- [x] **PFC** : taux 6 %, abattement 6 %, assiette au tarif particulier. *Reste : subventions, bourses, coût d'un résident par poste.*
- [~] **Politique salariale** : GVT 1,66 %, IMP à 6 000 RM, charges sociales locales connus. *Reste : taux d'une heure d'HSA, HSA maximales, décharges, coût moyen d'un temps plein local, hypothèse de revalorisation générale.*
- [~] **Comptabilité** : synthèse budget 2026 reçue. *Reste :* balance générale et grand livre analytique du dernier exercice clos ; plan comptable et rattachement aux natures et centres de coût ; budget en cours ; réalisé.
- [ ] **Immobilisations** : valeur nette, dotations, durées d'amortissement.
- [ ] **Créances familles et dettes fournisseurs** : encours et délais moyens de règlement.
- [ ] **Banques** : soldes par compte et devise à une date, relevés sur 12 à 18 mois (pour la saisonnalité), placements.
- [x] **Emprunts** : aucun à ce jour. *Reste : lignes de crédit éventuelles, placements.*
- [ ] **Calendriers** : dates et parts de facturation aux familles, calendrier de paie, seuil de trésorerie minimale souhaité.

## Priorité 3 — fonctionnement et investissement
- [ ] **Contrats** : fournisseur, objet, montant et devise, dates de début et de fin, préavis, indexation, centre de coût, reconduction.
- [~] **Charges variables** (maintenance et énergie : budget 2026 reçu ; partenaire du campus 22,5 %) : : énergie et entretien par m², coût par élève, enveloppes de fonctionnement pédagogique par cycle, indexation.
- [ ] **Inventaire des espaces** : salles de classe par cycle, salles spécialisées (laboratoires, arts), gymnase, CDI, administration, avec surfaces ; taux d'occupation observé.
- [~] **Projets d'investissement** (liste priorisée 2026-27 reçue ; extension du lycée en phase d'étude) : : surface, coût au m², calendrier, durée des travaux, durée d'amortissement, financement (emprunt, fonds, autofinancement).
- [ ] **Fundraising** : campagnes, promesses, probabilité, calendrier d'encaissement, affectation ; fonds affectés existants.

## IB (n'existe pas encore)
- [ ] Année d'ouverture envisagée, part attendue de la 1ère et montée en charge, passage IB1 → IB2.
- [ ] Matières proposées et répartition HL / SL.
- [ ] Tarif envisagé et son évolution ; licence, examens, formation et coordination.

## Pour la recette (preuves de calibrage)
- [ ] Recettes 2026-27 à ± 2 % du facturé EDUKA.
- [ ] Carte des emplois de la rentrée en cours à l'ETP près ; masse salariale à ± 1 % de la paie annuelle.
- [ ] Contrats et immobilisations rapprochés de la comptabilité ; trésorerie rapprochée des soldes bancaires.
- [ ] Dernier exercice clos reproduit en états bouclés (écart nul au bilan).

## Paramétrage de l'application
- [ ] Scénarios souhaités (entrées en PS, croissance, stress) et seuils d'alerte des KPI.
- [ ] Liste des utilisateurs avec leur rôle (e-mail → rôle) pour l'accès par code à usage unique.
- [ ] Accès Cloudflare (compte, base D1, Access) pour le déploiement du pilote.
