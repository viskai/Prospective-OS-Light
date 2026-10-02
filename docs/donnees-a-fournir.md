# Documents et extractions à fournir (LFKL)

Règles : fichiers `.xlsx` ou `.csv` ; **aucun nom, prénom, date de naissance ni adresse** (ID EDUKA pseudonymisé pour les élèves, référence opaque pour les postes) ; une date de constat sur chaque extraction. Les fichiers bruts restent hors de git (`data/raw/`).

## Priorité 1 — pour un premier calcul calibré
- [ ] **Cadrage** : monnaie de pilotage de LFKL ; devises utilisées et taux de change ; mois de rentrée et date de constat AEFE (30 septembre ?).
- [ ] **EDUKA — effectifs par rentrée** : un export **par année, daté de la rentrée**, avec le niveau de l'année (pas le niveau courant), idéalement 5 ans ; niveau × section × classe ; élèves entrants et sortants.
- [ ] **EDUKA — structure actuelle** : nombre de divisions et effectif par classe, par niveau (2025-26 et 2026-27).
- [ ] **EDUKA — facturé** par rubrique (scolarité, inscription, annexes, remises, fratries) et par type tarifaire, 2025-26 et 2026-27.
- [ ] **Grille tarifaire** 2026-27 par niveau ou cycle, frais de première inscription, services annexes, ratios de remises, politique d'évolution tarifaire.
- [ ] **Postes par discipline** (annoncé) : référence opaque, service, discipline ou département, catégorie, statut, contrat, quotité, ORS, HSA, devise, salaire de base, primes, charges, avantages, contribution du résident, dates d'arrivée et de départ prévues.
- [ ] **Grille horaire LFKL** : heures par discipline et par niveau, malais (volumes), LV2 offertes, spécialités, options, dispositifs BFI, plafonds de classe et de groupe, ORS par statut.
- [ ] **Choix des élèves** : nombre d'élèves par LV2, spécialité et option, par niveau (agrégé).

## Priorité 2 — pour les états financiers
- [ ] **AEFE** : notification de PFC (taux, assiette, abattement), subventions, bourses, coût d'un résident pour l'établissement.
- [ ] **Politique salariale** : revalorisation, GVT, taux d'une heure d'HSA, HSA maximales par poste, nombre et montant des **IMP** et des **décharges**, coût moyen d'un temps plein local.
- [ ] **Comptabilité** : balance générale et grand livre analytique du dernier exercice clos ; plan comptable et rattachement aux natures et centres de coût ; budget en cours ; réalisé.
- [ ] **Immobilisations** : valeur nette, dotations, durées d'amortissement.
- [ ] **Créances familles et dettes fournisseurs** : encours et délais moyens de règlement.
- [ ] **Banques** : soldes par compte et devise à une date, relevés sur 12 à 18 mois (pour la saisonnalité), placements.
- [ ] **Emprunts et lignes de crédit** : capital restant dû, taux, échéancier, durée résiduelle.
- [ ] **Calendriers** : dates et parts de facturation aux familles, calendrier de paie, seuil de trésorerie minimale souhaité.

## Priorité 3 — fonctionnement et investissement
- [ ] **Contrats** : fournisseur, objet, montant et devise, dates de début et de fin, préavis, indexation, centre de coût, reconduction.
- [ ] **Charges variables** : énergie et entretien par m², coût par élève, enveloppes de fonctionnement pédagogique par cycle, indexation.
- [ ] **Inventaire des espaces** : salles de classe par cycle, salles spécialisées (laboratoires, arts), gymnase, CDI, administration, avec surfaces ; taux d'occupation observé.
- [ ] **Projets d'investissement** envisagés : surface, coût au m², calendrier, durée des travaux, durée d'amortissement, financement (emprunt, fonds, autofinancement).
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
