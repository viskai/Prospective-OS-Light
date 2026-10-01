# Cahier des charges — School Strategic OS Light

2026-10-01 · 

## 1. Contexte, objectifs et utilisateurs

La version Light de l'OS est un outil de pilotage financier et de moyens, centré sur la chaîne effectifs → structure → emplois → masse salariale → états financiers bouclés. Elle laisse de côté la couche stratégique (consultation, projet d'établissement, plan d'action), le circuit des demandes de moyens, les activités à P&L propre et les restitutions institutionnelles formalisées.

**Objectif.** Donner à la direction, en quelques semaines de déploiement, une base unique qui remplace les classeurs Excel dispersés et répond à trois questions :

- Combien d'élèves, de classes et de postes l'an prochain et à 5 ans, selon quels scénarios ?
- Quel compte de résultat, quel bilan et quelle trésorerie en découlent ?
- Le plan d'investissement (espaces, CAPEX) est-il finançable, et avec quels fonds ?

**Principes conservés de la version complète.**

- Base centrale unique ; l'OS ne remplace ni la comptabilité, ni la paie, ni EDUKA : il en reprend les données.
- Les trois états financiers sont bouclés (compte de résultat, bilan, flux de trésorerie).
- Dimension période : budget initial, budget rectificatif, prévision glissante, réalisé.
- Élèves uniquement sous identifiant EDUKA anonymisé ; aucune donnée personnelle de personnel hors du module RH isolé.
- Documentation produite et tenue à jour par l'IA, pour la maintenance, la passation entre DAF et la transposition entre établissements (LCS, LFKL).

**Utilisateurs.**

| Profil | Usage dans la version Light |
|---|---|
| DAF / Business Director | Administrateur ; paramètre les drivers, construit les scénarios, valide les états |
| Chef d'établissement | Consulte le dashboard, arbitre structure et emplois |
| Direction RH / Payroll | Seuls utilisateurs du module RH & masse salariale (isolé) |
| Directions pédagogiques (primaire, secondaire) | Saisissent ou valident la structure pédagogique |
| Services généraux (facility manager, IT manager) | Renseignent contrats et besoins d'espaces |
| Comptabilité | Importe le réalisé et contrôle les rapprochements |
| Comité de gestion / board | Lecture du dashboard (rôle lecture seule) |

## 2. Périmètre

La version Light retient 19 briques sur les 30 du schéma d'architecture : 4 sources, 10 modules métiers, 4 briques de consolidation et 1 restitution. Les 11 briques barrées sont exclues ; la couche « Stratégie & gouvernance » disparaît entièrement.

**Retenu**

| Couche | Brique | Statut Light |
|---|---|---|
| Systèmes sources | EDUKA | Import (effectifs, facturé) |
| Systèmes sources | Comptabilité | Import (réalisé, balance) |
| Systèmes sources | Banques | Import (relevés, soldes) |
| Systèmes sources | AEFE | Import / saisie (PFC, bourses, détachés) |
| A · Élèves & recettes | Effectifs & capacité | Complet |
| A · Élèves & recettes | Tarifs & recettes | Complet |
| A · Élèves & recettes | Subventions & bourses | Complet |
| B · Moyens humains | Structure pédagogique | Complet |
| B · Moyens humains | Carte des emplois | Complet |
| B · Moyens humains | RH & masse salariale (isolé) | Complet, accès restreint |
| C · Fonctionnement | Services généraux & contrats | Complet |
| D · Investissement & financement | Besoins d'espaces | Complet |
| D · Investissement & financement | Financement & trésorerie | Complet |
| D · Investissement & financement | CAPEX pluriannuel | Complet |
| Prospective | Registre des drivers | Complet |
| Prospective | Scénarios & versions | Complet |
| Prospective | États financiers bouclés | Complet |
| Prospective | Fundraising & fonds affectés | Complet |
| Restitution | Dashboard KPI & alertes | Complet |

**Exclu, et ce qui le remplace provisoirement**

| Brique exclue | Traitement dans la version Light |
|---|---|
| Consultation | Hors OS |
| Projet d'établissement | Hors OS ; pas de rattachement obligatoire des modules à un axe |
| Stratégie d'établissement | Hors OS ; les cibles stratégiques chiffrées deviennent des drivers |
| Plan d'action & KPI cibles | Les seuils d'alerte des KPI sont paramétrés dans le dashboard |
| Registre des décisions | Un champ « motif / décision » sur chaque version de scénario suffit |
| Paie (source) | Pas de connexion ; la masse salariale est reconstituée dans le module RH par import fichier |
| Adaptateurs & alertes n8n | Pas de flux automatisés ; imports manuels de fichiers modèles |
| Demandes de moyens | Pas de circuit de saisie par les enseignants ; besoins de fonctionnement saisis en enveloppes |
| Activités à P&L propre | Cantine, AES, voyages, CVL suivis comme lignes de recettes et de charges, sans compte d'activité dédié |
| Board pack / rapport annuel | Export PDF ou Excel des vues du dashboard |
| Instances & AEFE | Pas de format dédié ; les états bouclés restent exportables |

## 3. Architecture cible

L'OS Light s'organise en quatre couches qui ne communiquent que vers le bas : les sources alimentent les modules, les modules publient des drivers, le moteur les consolide, le dashboard les restitue.

Les cinq modules en surbrillance forment la chaîne minimale à livrer en premier ; les autres s'y raccordent par le registre des drivers, sans dépendance directe entre colonnes.

## 4. Sources de données et imports

Toutes les données externes entrent par import de fichier (.xlsx ou .csv) selon un modèle fourni par l'OS ; aucun connecteur automatique n'est requis dans la version Light. Chaque import est daté, rattaché à une période et conservé en historique ; un import à une date déjà présente remplace le précédent après confirmation.

| Source | Données importées | Fréquence | Modules alimentés |
|---|---|---|---|
| EDUKA | Effectifs par niveau × section × classe à date ; liste élèves pseudonymisée (ID EDUKA, niveau, section, type tarifaire, choix pédagogiques) ; facturé par rubrique | Rentrée, date de constat AEFE, puis mensuel | Effectifs & capacité, Tarifs & recettes, Subventions & bourses |
| Comptabilité (Odoo ou autre) | Balance générale, grand livre analytique, immobilisations | Mensuel et clôture | États financiers bouclés (réalisé), CAPEX, Services généraux |
| Banques | Soldes et relevés par compte et par devise | Mensuel (hebdomadaire en option) | Financement & trésorerie |
| AEFE | Taux et assiette de la PFC, bourses, coût des détachés (résidents), subventions | Annuel, mise à jour à la notification | Subventions & bourses, RH & masse salariale |
| Fichier RH (export manuel de la paie) | Postes, statuts, grilles, coûts employeur | Rentrée et à chaque révision budgétaire | RH & masse salariale (isolé) |

**Règles d'import.**

- L'assistant d'import propose le rôle de chaque colonne puis la correspondance des libellés (sections EDUKA, comptes, rubriques) ; le format est mémorisé par établissement.
- Les colonnes d'état civil (nom, prénom, date de naissance, adresse, responsables) ne sont jamais lues.
- Un contrôle de cohérence bloque l'import si les totaux ne rapprochent pas (sous-totaux EDUKA, balance équilibrée, solde bancaire d'ouverture).
- Les deux outils existants (simulation d'effectifs LCS, besoins et structure pédagogique) sont repris comme modules, avec leurs formats d'import-export actuels.

## 5. Spécifications fonctionnelles des modules métiers

Chaque module produit des drivers publiés dans le registre (§ 6) ; aucun module n'écrit directement dans les états financiers.

### A · Élèves & recettes

**A1 — Effectifs & capacité**

- Effectifs réels par école → niveau → branche → section → classe, depuis les imports EDUKA datés ; classes multiniveaux gérées.
- Capacité = nombre de classes × capacité par classe, paramétrable par niveau (presets possibles).
- Projection par montée de cohorte : taux de rétention calculés sur 3 ou 5 ans, surcharge manuelle, entrée en PS, part IB en 1ère.
- Trois modes de jauge : bulle conservée (défaut), plafond strict, demande non plafonnée ; stress tests paramétrables.
- Sorties : effectifs projetés par scénario × année × niveau × section, taux d'occupation, qualification du seuil (saturé, tendu, optimal, sous-occupé).

**A2 — Tarifs & recettes**

- Grille tarifaire par niveau × section × type tarifaire (ex. contrat expatrié, student visa), par année scolaire et par devise.
- Rubriques : droits de scolarité, frais d'inscription et de première inscription, services annexes (cantine, AES, AS, transport).
- Recettes brutes = effectifs projetés × répartition par type tarifaire × tarif ; remises et fratries modélisées par ratios observés sur le réalisé.
- Simulation d'évolution tarifaire (% uniforme ou ciblé par cycle) et lecture de l'effet sur le résultat.
- Rapprochement recettes calculées / facturé EDUKA sur l'année en cours.

**A3 — Subventions & bourses**

- PFC AEFE : assiette théorique (tarif de référence, tarif moyen ou tarif moyen pondéré) × effectif constaté à la date fixe × taux, avec abattement paramétrable.
- Bourses de l'État français traitées comme un changement de payeur (pas de recette nouvelle).
- Autres subventions et aides locales, avec leur affectation éventuelle.

### B · Moyens humains

**B1 — Structure pédagogique**

- Reprise du moteur existant : divisions, classes et groupes par niveau, plafonds, alignements, offre (LV, options, spécialités, sections, IB).
- Calcul des heures-professeur par discipline et par niveau, pondération du cycle terminal, missions converties en heures ou en primes.
- Entrée : effectifs projetés (A1) ; sortie : besoin en heures et en ETP par discipline.

**B2 — Carte des emplois**

- Postes en place par discipline et statut (détaché, local, contractuel), ORS par statut.
- Écarts besoin / apport, transferts entre disciplines, HSA, créations et suppressions de postes, sous-service.
- Emplois non enseignants (administration, vie scolaire, ASEM, services) par service, avec les casuals.
- Sortie : carte des emplois annuelle par scénario, sans donnée nominative.

**B3 — RH & masse salariale (isolé)**

- Seul module contenant des données individuelles ; accès limité au DAF, à la direction RH et à la Payroll.
- Coût par poste : salaire de base, primes, charges employeur, avantages, contribution aux détachés (résidents AEFE).
- Politique salariale : revalorisation annuelle, GVT, échelons, indexation, change pour les coûts en devise.
- Publie au registre des coûts agrégés par catégorie et par centre de coût uniquement.

### C · Fonctionnement

**C1 — Services généraux & contrats**

- Registre des contrats : fournisseur, objet, montant annuel, devise, dates, préavis, indexation, centre de coût.
- Charges récurrentes (énergie, maintenance, nettoyage, sécurité, IT, assurances, loyers) projetées avec leurs règles d'indexation.
- Enveloppes de fonctionnement pédagogique saisies par cycle (remplacent le circuit des demandes de moyens).
- Alertes d'échéance et de renouvellement de contrats.

### D · Investissement & financement

**D1 — Besoins d'espaces**

- Inventaire des espaces (salles, surfaces, affectation) et capacité d'accueil.
- Confrontation aux effectifs et à la structure projetés (A1, B1) : salles manquantes ou excédentaires par année.
- Sortie : besoins d'extension ou de réaménagement, transmis comme projets au CAPEX.

**D2 — CAPEX pluriannuel**

- Projets d'investissement : montant, calendrier de décaissement, catégorie, durée d'amortissement, source de financement.
- Renouvellement du parc existant (immobilisations importées de la comptabilité).
- Sorties : décaissements, dotations aux amortissements, valeur nette des immobilisations par année.

**D3 — Financement & trésorerie**

- Comptes bancaires et soldes, placements, emprunts (capital, taux, échéancier), lignes de crédit.
- Saisonnalité des encaissements (calendrier de facturation) et des décaissements (paie, fournisseurs, CAPEX).
- Plan de trésorerie mensuel sur 12 à 18 mois et annuel sur 5 ans, multidevise.
- Simulation d'emprunt et de son effet sur la trésorerie et le résultat.

## 6. Moteur de consolidation prospective

Le moteur transforme les drivers des modules en un jeu d'états financiers bouclés, par scénario et par version, sur un horizon de 5 ans en année scolaire (aligné sur le compte financier AEFE).

**P1 — Registre des drivers**

- Catalogue unique de toutes les hypothèses : nom, unité, valeur par année, module source, propriétaire, date de mise à jour, commentaire.
- Drivers calculés (publiés par les modules) et drivers saisis (inflation, change, taux d'intérêt, revalorisation salariale, abattement PFC).
- Traçabilité : chaque montant des états remonte à ses drivers en deux clics.

**P2 — Scénarios & versions**

- Un scénario = un jeu de valeurs de drivers ; une version = un instantané figé et daté d'un scénario.
- Types de période : budget initial, budget rectificatif, prévision glissante, réalisé.
- Duplication, comparaison côte à côte de 2 à 4 scénarios, écarts en valeur et en %.
- Champ « motif / décision » et statut (brouillon, soumis, arrêté) sur chaque version, en remplacement du registre des décisions.

**P3 — États financiers bouclés**

- Compte de résultat par nature et par centre de coût (analytique transversale).
- Bilan : immobilisations (D2), créances familles, dettes fournisseurs, emprunts (D3), fonds propres, fonds affectés (P4).
- Tableau des flux de trésorerie : exploitation, investissement, financement ; trésorerie de clôture = trésorerie du bilan.
- Contrôles bloquants : bilan équilibré, résultat du compte de résultat = variation des fonds propres hors apports, flux = variation de trésorerie.
- Comparaison réalisé (import comptable) / budget / prévision.

**P4 — Fundraising & fonds affectés**

- Campagnes et promesses de dons : montant, probabilité, calendrier d'encaissement.
- Fonds affectés à un projet (CAPEX ou bourses internes) : suivi des ressources reçues, utilisées et restant à employer.
- Lien avec D2 : part du CAPEX financée par fonds affectés, par emprunt et par autofinancement.

## 7. Restitution : dashboard KPI & alertes

Le dashboard est l'unique restitution de la version Light ; il remplace le board pack et les formats d'instances par des vues exportables en PDF et en Excel.

**Vues**

- Synthèse : effectifs, résultat, trésorerie de clôture, CAPEX de l'année, pour le scénario de référence.
- Trajectoire 5 ans : un indicateur au choix, une courbe par scénario, réalisé en trait plein.
- Comparaison de scénarios : états financiers côte à côte et écarts.
- Suivi budgétaire : réalisé cumulé / budget / prévision, par nature et par centre de coût.
- Trésorerie : plan mensuel, point bas, couverture en mois de charges.

**KPI de référence** (liste paramétrable, seuils fixés par l'administrateur)

| Domaine | Indicateur | Source |
|---|---|---|
| Élèves | Effectif total et par école ; taux d'occupation ; taux de rétention | A1 |
| Recettes | Recette moyenne par élève ; part des remises ; PFC en % des recettes | A2, A3 |
| Moyens humains | Masse salariale / recettes ; heures-professeur par division ; ETP par cycle ; HSA par poste | B1, B2, B3 |
| Fonctionnement | Charges de fonctionnement par élève ; contrats arrivant à échéance sous 6 mois | C1 |
| Investissement | CAPEX annuel ; taux d'autofinancement du CAPEX ; salles manquantes | D1, D2 |
| Finances | Résultat net et marge ; trésorerie de clôture ; jours de charges couverts ; endettement / fonds propres | P3, D3 |
| Fonds affectés | Montant collecté / objectif ; fonds restant à employer | P4 |

**Alertes**

- Calculées à chaque recalcul de scénario, sans moteur d'alerte externe.
- Trois niveaux (information, vigilance, critique) selon les seuils de chaque KPI.
- Affichées dans un bandeau du dashboard et listables ; pas d'envoi d'e-mail automatique dans la version Light.
- Alertes minimales : niveau saturé, trésorerie projetée sous le seuil, masse salariale au-dessus du ratio cible, états non bouclés, import périmé (plus de 45 jours).

## 8. Exigences non fonctionnelles, sécurité et rôles

**Socle technique.** Application web partagée reprenant la pile déjà utilisée pour l'outil des besoins de Sydney : Cloudflare Workers, base D1, authentification Cloudflare Access par code à usage unique. n8n n'est mobilisé que pour les invitations et les notifications d'administration, pas pour les flux de données.

**Droits d'accès par module**

| Rôle | Lecture | Saisie | Accès RH isolé |
|---|---|---|---|
| Administrateur (DAF) | Tous modules | Tous modules | Oui |
| Direction | Tous modules sauf B3 | Arbitrages, statut des versions | Non |
| RH / Payroll | B2, B3 | B3 | Oui |
| Directions pédagogiques | A1, B1, B2, dashboard | B1 | Non |
| Services généraux | C1, D1, D2 | C1, D1 | Non |
| Comptabilité | P3, D3, C1 | Imports comptables et bancaires | Non |
| Board / lecture seule | Dashboard | Aucune | Non |

**Confidentialité et données.**

- Élèves identifiés uniquement par ID EDUKA ; rapprochements nominatifs faits hors OS.
- Les modules autres que B3 ne reçoivent que des agrégats de masse salariale (par catégorie et centre de coût, jamais en dessous de 3 personnes).
- Journal de toutes les modifications avec état précédent, restaurable ; numéro de révision par élément et gestion des conflits d'édition.
- Export complet réservé à l'administrateur ; sauvegarde quotidienne.

**Ergonomie et performance.**

- Interface bilingue français / anglais ; multidevise (AUD, MYR, EUR) avec taux de change pilotés par driver.
- Recalcul complet d'un scénario en moins de 5 secondes.
- Encart « configuration active » sur chaque page : établissement, scénario, version, date des imports.
- Paramétrage par établissement (plan comptable, calendrier, grilles, statuts) pour déployer à l'identique à LCS et LFKL.

**Documentation.** Documentation fonctionnelle et technique générée et maintenue avec l'IA, à chaque version : formules de chaque driver, formats d'import, guide de passation DAF.

## 9. Livrables, phasage et recette

Le déploiement suit la colonne vertébrale en quatre lots ; chaque lot est utilisable seul et recetté avant le suivant.
- **Lot 1 — Socle et élèves.** Base, rôles, imports EDUKA, A1, A2, A3, registre des drivers. Recette : recettes 2026-2027 recalculées à ± 2 % du facturé EDUKA.

- **Lot 2 — Moyens humains.** B1, B2, B3 (intégration des deux outils existants). Recette : carte des emplois de la rentrée en cours retrouvée à l'ETP près ; masse salariale à ± 1 % de la paie annuelle.

- **Lot 3 — Fonctionnement et investissement.** C1, D1, D2, D3, P4. Recette : contrats et immobilisations rapprochés de la comptabilité ; plan de trésorerie rapproché des soldes bancaires.

- **Lot 4 — Consolidation et restitution.** P2, P3, dashboard. Recette : réalisé du dernier exercice clôturé reproduit en états bouclés, écart nul au bilan ; trois scénarios comparés sur 5 ans.

**Livrables**

- Application web déployée pour un premier établissement pilote
- Modèles d'import (.xlsx) pour chaque source
- Jeu de données de recette anonymisé
- Documentation fonctionnelle, technique et guide de passation
- Dossier de paramétrage pour transposition à un second établissement

**Trajectoire vers la version complète.** Le modèle de données prévoit dès la version Light les clés nécessaires aux briques exclues (rattachement à un axe stratégique, identifiant d'activité, auteur d'une demande), laissées vides, pour qu'elles s'ajoutent sans migration.

**Questions ouvertes**

- Établissement pilote : LCS ou LFKL ?
- Horizon de prévision : 5 ans suffisent-ils pour le plan d'investissement ?
- Granularité du plan de trésorerie : mensuelle ou hebdomadaire ?
