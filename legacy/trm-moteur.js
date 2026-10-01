/* =====================================================================
   MOTEUR DE CALCUL v2 — heures-professeur par niveau et par discipline
   Partagé à l'identique par toutes les maquettes. Aucune dépendance.
   Nécessite REFERENTIEL (referentiel.js) chargé avant.

   etat = {
     config:    { etablissement, niveaux:{id:bool}, offre:{cle:bool}, dispositifs:{id:{actif, niveaux:[], langue, dnl, heures:{comp:{cycle:h}}, eff:{niv:n}}} },
     reglages:  { plafondClasse:{primaire,college,lycee,[idNiveau]}, plafondGroupe:{LV,SCI,DED,SPE,OPT,IB}, maxBloc, ponderation, ors:{defaut,EPS,PE}, margeParDivision:{} },
     niveaux:   [{ id, div, eff, effClasses|null, plafondClasse|null, cours:{[idCours]:{gr, bloc, plafond, eff, actif, groupesFixes}} }]   ← TOUS les niveaux du catalogue
     ressources:{ [disc]: { apport, postes } }
   }
   ===================================================================== */
const Moteur = (() => {
  const LETTRES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const r2 = x => Math.round(x * 100) / 100;
  const clone = o => JSON.parse(JSON.stringify(o));

  /** Répartit un effectif total sur n classes, le plus équitablement possible. */
  function repartir(total, n) {
    if (n <= 0) return [];
    const base = Math.floor(total / n), reste = total - base * n;
    return Array.from({ length: n }, (_, i) => base + (i < reste ? 1 : 0));
  }

  /** Découpe n classes consécutives en blocs d'environ b classes (jamais plus de maxBloc). */
  function tailleBlocs(n, b, maxBloc) {
    if (n <= 0) return [];
    b = Math.max(1, Math.min(b, n, maxBloc));
    let nb = Math.max(1, Math.floor(n / b));
    if (Math.ceil(n / nb) > maxBloc) nb = Math.ceil(n / b);
    nb = Math.min(nb, n);
    const base = Math.floor(n / nb), reste = n % nb;
    return Array.from({ length: nb }, (_, i) => base + (i >= nb - reste ? 1 : 0));
  }

  /** Blocs {classes:[i..], eff, groupes, tailles:[...]} pour un regroupement de b classes. */
  function regrouper(effClasses, b, plafond, maxBloc) {
    const tailles = tailleBlocs(effClasses.length, b, maxBloc);
    const blocs = []; let i = 0;
    for (const t of tailles) {
      const idx = Array.from({ length: t }, (_, k) => i + k);
      const eff = idx.reduce((s, k) => s + effClasses[k], 0);
      const groupes = eff > 0 ? Math.ceil(eff / plafond) : 0;
      blocs.push({ classes: idx, eff, groupes, tailles: repartir(eff, groupes) });
      i += t;
    }
    return blocs;
  }

  /** Auto : le regroupement (1..maxBloc classes) qui donne le moins de groupes ; à égalité, le plus petit. */
  function meilleurRegroupement(effClasses, plafond, maxBloc) {
    let best = null;
    for (let b = 1; b <= Math.min(maxBloc, effClasses.length); b++) {
      const blocs = regrouper(effClasses, b, plafond, maxBloc);
      const g = blocs.reduce((s, x) => s + x.groupes, 0);
      if (!best || g < best.g) best = { b, g, blocs };
    }
    return best || { b: 1, g: 0, blocs: [] };
  }

  /** Notation lisible : « (2 cl → 3 gr) ×4 + (3 cl → 4 gr) ×1 » */
  function notation(blocs) {
    const m = new Map();
    for (const x of blocs) {
      const k = x.classes.length + '|' + x.groupes;
      m.set(k, (m.get(k) || 0) + 1);
    }
    return [...m.entries()].map(([k, n]) => {
      const [c, g] = k.split('|');
      return `(${c} cl → ${g} gr) ×${n}`;
    }).join(' + ');
  }

  function ventiler(parts, heures, acc) {
    for (const [d, p] of Object.entries(parts)) acc[d] = (acc[d] || 0) + heures * p;
  }

  /* ----------------------------- Offre ----------------------------- */
  const OFFRES = Object.fromEntries(REFERENTIEL.offres.map(o => [o.cle, o]));

  /** Une clé d'offre est-elle ouverte ? (config, sinon valeur par défaut du catalogue) */
  function offert(etat, cle) {
    if (!cle) return true;
    if (Array.isArray(cle)) return cle.every(k => offert(etat, k));
    if (cle[0] === '!') return !offert(etat, cle.slice(1));
    const v = etat.config.offre[cle];
    return v != null ? v : !!(OFFRES[cle] && OFFRES[cle].defaut);
  }

  function niveauOuvert(etat, id) {
    const v = etat.config.niveaux[id];
    if (v != null) return v;
    const d = REFERENTIEL.niveaux.find(x => x.id === id);
    return !!(d && d.ouvertParDefaut);
  }

  const defNiveau = id => REFERENTIEL.niveaux.find(x => x.id === id);

  /* ----------------------- Référentiel éditable ----------------------- */
  /**
   * etat.referentiel = { actif, versions: [{ id, nom, dateEffet, semaines, disciplines: [{id, nom, fam}],
   *                      niveaux: { [idNiveau]: { modifs: {[idCours]: {...}}, retires: [idCours], ajouts: [cours] } } }] }
   * Sans version active : référentiel de base (Éducation nationale, IB).
   */
  const referentielActif = etat => { const R = etat.referentiel; return R && R.actif ? (R.versions || []).find(v => v.id === R.actif) || null : null; };
  const semainesAn = etat => Math.max(1, referentielActif(etat)?.semaines || 36);
  /** Cours du catalogue d'un niveau, modifiés par la version active du référentiel (retraits, horaires, ajouts ; horaires annuels convertis). */
  function coursReferentiel(etat, def) {
    const V = referentielActif(etat), N = V?.niveaux?.[def.id];
    const sem = semainesAn(etat);
    // horaires annuels, ou sur le cursus (IB : 240 h HL sur deux ans) → horaire hebdomadaire
    const conv = c => (c.hCursus != null ? { ...c, h: c.hCursus / Math.max(1, c.anneesCursus || 2) / sem, hRegle: undefined }
      : c.hAnnuel != null ? { ...c, h: c.hAnnuel / sem, hRegle: undefined } : c);
    if (!N) return def.cours.map(conv);
    const retires = new Set(N.retires || []);
    return def.cours.filter(c => !retires.has(c.id)).map(c => {
      const m = N.modifs?.[c.id];
      if (!m) return conv(c);
      const x = { ...c, ...m, modifie: true };
      if (m.h != null || m.hAnnuel != null || m.hCursus != null) delete x.hRegle;
      if (m.h != null) { delete x.hAnnuel; delete x.hCursus; }
      if (m.hAnnuel != null) delete x.hCursus;
      return conv(x);
    }).concat((N.ajouts || []).map(c => conv({ ...c, ajoute: true })));
  }
  /** Disciplines : celles du référentiel de base, plus celles ajoutées ou renommées dans la version active. */
  const DISCIPLINES_BASE = REFERENTIEL.disciplines.map(d => ({ ...d }));
  function appliquerDisciplines(etat) {
    const V = referentielActif(etat);
    const liste = DISCIPLINES_BASE.map(d => ({ ...d }));
    for (const d of V?.disciplines || []) {
      const x = liste.find(y => y.id === d.id);
      if (x) Object.assign(x, d); else liste.push({ degre: 2, fam: 'autre', ...d, ajoutee: true });
    }
    REFERENTIEL.disciplines.splice(0, REFERENTIEL.disciplines.length, ...liste);
    return liste;
  }

  /* ---------------------- Groupes d'après les choix ---------------------- */
  /**
   * Placement des spécialités dans les barrettes : chaque élève doit avoir ses spécialités dans des barrettes différentes.
   * Recherche exacte en deux temps :
   *   1. on énumère, pour chaque spécialité, l'ensemble des barrettes où elle est ouverte (séparation-évaluation :
   *      borne = max(barrettes ouvertes, effectif ÷ plafond) ; chaque combinaison doit trouver une place) ;
   *   2. pour chaque ouverture retenue, les élèves sont répartis entre les placements permis (plafonds respectés).
   *   combinaisons = { 'a|b|c': n }, nb = nombre de barrettes, plafond = id → plafond du groupe
   */
  function placerSpecialites(combinaisons, nb, plafond) {
    const alertes = [];
    const combos = Object.entries(combinaisons || {}).map(([k, n]) => ({ sp: k.split('|').filter(Boolean), n })).filter(c => c.n > 0 && c.sp.length);
    if (!combos.length || nb < 1) return null;
    const trop = combos.filter(c => c.sp.length > nb).reduce((s, c) => s + c.n, 0);
    if (trop) alertes.push(`${trop} élève(s) avec plus de spécialités que de barrettes : spécialités en trop ignorées`);
    combos.forEach(c => { c.sp = c.sp.slice(0, nb); });
    const cleCache = JSON.stringify([combinaisons, nb, [...new Set(combos.flatMap(c => c.sp))].sort().map(s => [s, plafond(s)])]);
    if (CACHE_PLACEMENT.has(cleCache)) return clone(CACHE_PLACEMENT.get(cleCache));
    const tot = {}; combos.forEach(c => c.sp.forEach(s => { tot[s] = (tot[s] || 0) + c.n; }));
    const spes = Object.keys(tot).sort((a, b) => combos.filter(c => c.sp.includes(b)).length - combos.filter(c => c.sp.includes(a)).length || tot[b] - tot[a]);
    const min = s => Math.ceil(tot[s] / plafond(s));
    const pop = m => { let k = 0; for (; m; m &= m - 1) k++; return k; };
    const masques = Array.from({ length: (1 << nb) - 1 }, (_, i) => i + 1).sort((a, b) => pop(a) - pop(b) || a - b);
    const perms = k => { const out = []; const rec = (pre) => { if (pre.length === k) { out.push(pre); return; } for (let b = 0; b < nb; b++) if (!pre.includes(b)) rec([...pre, b]); }; rec([]); return out; };
    const P = {}; combos.forEach(c => { P[c.sp.length] ||= perms(c.sp.length); });
    const permis = (c, supp) => P[c.sp.length].filter(p => c.sp.every((s, j) => (supp[s] >> p[j]) & 1));

    /** Répartition des élèves pour une ouverture donnée : glouton puis amélioration, plafonds pris en compte */
    function repartir(supp) {
      const opts = combos.map(c => permis(c, supp));
      if (opts.some(o => !o.length)) return null;
      const cnt = {}; const k = (s, b) => s + '@' + b;
      const eleves = []; combos.forEach((c, i) => { for (let j = 0; j < c.n; j++) eleves.push(i); });
      const choix = [];
      const cout1 = (i, p, sgn) => combos[i].sp.reduce((a, s, j) => { const v = cnt[k(s, p[j])] || 0, pl = plafond(s); return a + 1000 * (Math.ceil((v + sgn) / pl) - Math.ceil(v / pl)) - (2 * (v % pl) + 1); }, 0);
      const pose = (i, p, sgn) => combos[i].sp.forEach((s, j) => { cnt[k(s, p[j])] = (cnt[k(s, p[j])] || 0) + sgn; });
      eleves.forEach((i, e) => { let bp = opts[i][0], bd = Infinity; for (const p of opts[i]) { const d = cout1(i, p, 1); if (d < bd) { bd = d; bp = p; } } choix[e] = bp; pose(i, bp, 1); });
      for (let passe = 0; passe < 12; passe++) {
        let change = false;
        eleves.forEach((i, e) => { pose(i, choix[e], -1); let bp = choix[e], bd = cout1(i, choix[e], 1); for (const p of opts[i]) { const d = cout1(i, p, 1); if (d < bd) { bd = d; bp = p; } } if (bp !== choix[e]) change = true; choix[e] = bp; pose(i, bp, 1); });
        if (!change) break;
      }
      const cout = Object.entries(cnt).reduce((a, [kk, v]) => a + (v > 0 ? Math.ceil(v / plafond(kk.split('@')[0])) : 0), 0);
      return { cout, cnt };
    }

    let meilleur = null, noeuds = 0;
    const supp = {};
    const borne = i => spes.reduce((a, s, j) => a + (j < i ? Math.max(pop(supp[s]), min(s)) : min(s)), 0);
    const placable = i => { const assignees = new Set(spes.slice(0, i)); return combos.every(c => !c.sp.every(s => assignees.has(s)) || permis(c, supp).length > 0); };
    (function dfs(i) {
      if (++noeuds > 60000) return;
      if (meilleur && borne(i) >= meilleur.cout) return;
      if (!placable(i)) return;
      if (i === spes.length) { const r = repartir(supp); if (r && (!meilleur || r.cout < meilleur.cout)) meilleur = { ...r, supp: { ...supp } }; return; }
      const s = spes[i];
      for (const m of masques) {
        if (i === 0 && (m & (m + 1)) !== 0) continue; // symétrie des barrettes : la première spécialité occupe A, ou A et B…
        if (pop(m) > Math.max(min(s), 1) + 1) continue; // au plus une barrette de plus que nécessaire
        supp[s] = m; dfs(i + 1);
      }
      delete supp[s];
    })(0);
    if (!meilleur) { alertes.push('Aucun placement possible : trop de combinaisons différentes pour le nombre de barrettes'); return { groupes: {}, barrettes: [], cout: 0, coutNaif: 0, groupesNaifs: {}, effectifs: tot, alertes, eleves: 0, impossible: true }; }
    const groupes = {}, barrettes = Array.from({ length: nb }, () => ({}));
    for (const [kk, v] of Object.entries(meilleur.cnt)) { if (v <= 0) continue; const [s, b] = kk.split('@'); const g = Math.ceil(v / plafond(s)); groupes[s] = (groupes[s] || 0) + g; barrettes[+b][s] = { eff: v, groupes: g }; }
    const groupesNaifs = Object.fromEntries(Object.keys(tot).map(s => [s, min(s)]));
    const resultat = { groupes, barrettes, cout: meilleur.cout, coutNaif: Object.values(groupesNaifs).reduce((a, x) => a + x, 0), groupesNaifs, effectifs: tot, alertes,
      eleves: combos.reduce((s, c) => s + c.n, 0), exact: noeuds <= 60000 };
    if (CACHE_PLACEMENT.size > 300) CACHE_PLACEMENT.clear();
    CACHE_PLACEMENT.set(cleCache, clone(resultat));
    return resultat;
  }
  const CACHE_PLACEMENT = new Map();
  /** Combinaisons qui coûtent un groupe : gain obtenu si leurs élèves changeaient de choix */
  function combinaisonsCouteuses(combinaisons, nb, plafond) {
    const base = placerSpecialites(combinaisons, nb, plafond); if (!base) return [];
    return Object.entries(combinaisons).map(([k, n]) => {
      const sans = { ...combinaisons }; delete sans[k];
      const r = placerSpecialites(sans, nb, plafond);
      const naifSans = r ? r.coutNaif : 0;
      // gain propre à la combinaison : groupes économisés au-delà de ce que ses élèves occupent « naturellement »
      const gain = (base.cout - (r ? r.cout : 0)) - (base.coutNaif - naifSans);
      return { combinaison: k.split('|'), n, gain };
    }).filter(x => x.gain > 0).sort((a, b) => b.gain - a.gain || a.n - b.n);
  }
  /** Réglages IB par matière : cours HL/SL séparés ou communs, IB1 et IB2 ensemble */
  const regleIB = (etat, k) => Object.assign({ mode: etat.reglages.ibMode || 'separes', biAnnee: false }, etat.reglages.ibMatieres?.[k] || {});

  /**
   * Nombre de groupes d'un cours à effectif (option, LV2, spécialité, section, matière IB) :
   *   alignement : barrette de niveau (défaut), par blocs de classes alignées, ou classe par classe (composition réelle importée) ;
   *   spécialités : résultat du placement en barrettes ;
   *   IB : HL et SL séparés ou communs (heures HL en plus), IB1 et IB2 ensemble.
   * Renvoie { auto, h (heures par groupe), note }.
   */
  function groupesDepuisChoix(etat, def, nv, c, p, eff, plafond, placement, defs) {
    let auto = eff > 0 ? Math.ceil(eff / plafond) : 0, h = c.h, note = null;
    const al = p.alignement || 'niveau';
    if (al !== 'niveau' && nv.compoClasses?.length) {
      const parCl = nv.compoClasses.map(cl => c.dispositif ? (cl.sections?.[c.dispositif] || 0) : (cl.choix?.[c.id] || 0));
      const tot = parCl.reduce((s, x) => s + x, 0);
      if (tot > 0) {
        const f = eff / tot; // l'effectif du niveau peut avoir été ajusté après l'import
        const b = al === 'classe' ? 1 : Math.max(1, p.blocAlign || 2);
        auto = 0;
        for (let i = 0; i < parCl.length; i += b) { const s = parCl.slice(i, i + b).reduce((a, x) => a + x, 0) * f; if (s > 0) auto += Math.ceil(s / plafond - 1e-9); }
        note = al === 'classe' ? 'classe par classe' : `blocs de ${b} classes alignées`;
      }
    } else if (placement && placement.groupes[c.id] != null) {
      auto = placement.groupes[c.id]; note = `placement en ${placement.nb} barrettes`;
    }
    const m = /^ib-(\w+)-(hl|sl)$/.exec(c.id);
    if (m) {
      const r = regleIB(etat, m[1]);
      const effDe = (niv, suf) => { if (!niveauOuvert(etat, niv)) return 0; const x = etat.niveaux.find(v => v.id === niv); const cd = defs.find(d => d.id === `ib-${m[1]}-${suf}`); return x ? Math.max(0, x.cours[`ib-${m[1]}-${suf}`]?.eff ?? cd?.eff ?? 0) : 0; };
      let hl = effDe(def.id, 'hl'), sl = effDe(def.id, 'sl');
      if (r.biAnnee && def.id === 'ib2' && niveauOuvert(etat, 'ib1')) return { auto: 0, h, note: 'enseigné avec IB1' };
      if (r.biAnnee && def.id === 'ib1') { hl += effDe('ib2', 'hl'); sl += effDe('ib2', 'sl'); note = 'IB1 et IB2 ensemble'; }
      const hSL = defs.find(d => d.id === `ib-${m[1]}-sl`)?.h ?? 3;
      if (r.mode === 'communs') {
        if (m[2] === 'sl') { auto = hl + sl > 0 ? Math.ceil((hl + sl) / plafond) : 0; note = [note, 'cours commun HL + SL'].filter(Boolean).join(' · '); }
        else { auto = hl > 0 ? Math.ceil(hl / plafond) : 0; h = Math.max(0, c.h - hSL); note = [note, `${Moteur_fmt(h)} h HL en plus du cours commun`].filter(Boolean).join(' · '); }
      } else {
        const e = m[2] === 'hl' ? hl : sl;
        auto = e > 0 ? Math.ceil(e / plafond) : 0;
      }
    }
    return { auto, h, note };
  }
  const Moteur_fmt = x => String(Math.round(x * 100) / 100).replace('.', ',');

  /** Cours ordinaires auxquels une DNL de section internationale se rattache */
  const COURS_DNL = { HG: ['hg'], MAT: ['ma'], SPC: ['pc', 'sci'], SVT: ['svt', 'sci'] };
  /**
   * DNL de section internationale, discipline par discipline :
   *   substitution : groupe propre aux élèves de la section, qui remplace pour eux le cours ordinaire
   *                  (horaire normal au collège, dont une partie en langue ; horaire propre en 2nde, ex. HG 4 h) ;
   *   ajout        : heures en plus du cours ordinaire (ex. maths ou sciences +1,5 h en 2nde).
   */
  function coursDnlSection(etat, def, d, dc, comp, liste) {
    const out = [];
    const langue = dc.langue || d.langueDefaut || 'ANG';
    for (const x of (dc.dnl && dc.dnl.length ? dc.dnl : d.dnlDefaut)) {
      const regle = comp.regles?.[x]?.[def.cycle];
      if (!regle) continue;
      const base = liste.find(c => (COURS_DNL[x] || []).includes(c.id) && c.type === 'tc');
      const h = dc.dnlH?.[x]?.[def.cycle] ?? regle.h ?? base?.h ?? 0;
      if (!h) continue;
      let parts = { [x]: 1 };
      if (dc.coIntervention ?? d.coInterventionDefaut) parts = { ...parts, [langue]: (parts[langue] || 0) + 1 };
      const substitution = regle.mode === 'substitution' && base;
      out.push({ id: `${d.id}.dnl.${x}`, label: `${d.nom} : DNL ${REFERENTIEL.disciplines.find(z => z.id === x)?.nom || x} en langue${substitution ? ` (remplace « ${base.label} » pour les élèves de la section)` : ' (heures en plus)'}`,
        parts, h, type: 'opt', cat: 'OPT', eff: dc.eff?.[def.id] ?? dc.effDefaut ?? d.effDefaut ?? 24, role: 'dnl',
        section: d.section, src: d.src || 'local', dispositif: d.id, remplace: substitution ? base.id : null, dnlMode: substitution ? 'substitution' : 'ajout' });
    }
    return out;
  }

  /** Définitions des cours d'un niveau selon la configuration : catalogue filtré + cours générés par les dispositifs. */
  function coursDuNiveau(etat, def) {
    const lireRegle = chemin => chemin.split('.').reduce((o, k) => (o == null ? o : o[k]), etat.reglages);
    const liste = coursReferentiel(etat, def).filter(c => offert(etat, c.offre))
      .map(c => c.hRegle && lireRegle(c.hRegle) != null ? { ...c, h: lireRegle(c.hRegle) } : c);
    for (const d of REFERENTIEL.dispositifs) {
      const dc = etat.config.dispositifs[d.id];
      if (!dc || !dc.actif || !(dc.niveaux || []).includes(def.id)) continue;
      for (const comp of d.composantes) {
        if (comp.mode === 'dnl-si') { liste.push(...coursDnlSection(etat, def, d, dc, comp, liste)); continue; }
        const h = dc.heures?.[comp.id]?.[def.cycle] ?? comp.h[def.cycle] ?? 0;
        if (!h) continue;
        let parts = comp.parts;
        if (comp.role === 'langue') parts = { [dc.langue || d.langueDefaut || 'ANG']: 1 };
        if (comp.role === 'dnl') {
          parts = Object.fromEntries((dc.dnl && dc.dnl.length ? dc.dnl : d.dnlDefaut).map((x, _, a) => [x, 1 / a.length]));
          // co-intervention : le professeur de langue est présent avec le professeur de DNL
          if (dc.coIntervention ?? d.coInterventionDefaut) { const l = dc.langue || d.langueDefaut || 'ANG'; parts = { ...parts, [l]: (parts[l] || 0) + 1 }; }
        }
        const type = comp.type || d.type || 'opt';
        liste.push({
          id: `${d.id}.${comp.id}`, label: `${d.nom} : ${comp.label}`, parts, h, type, cat: comp.cat || (type === 'tc' ? 'LV' : 'OPT'),
          gr: comp.gr ?? (type === 'tc' ? h : 0), eff: dc.eff?.[def.id] ?? dc.effDefaut ?? d.effDefaut ?? 24, horsGrille: type === 'tc', role: comp.role,
          section: d.section, src: d.src || 'local', dispositif: d.id, groupesFixes: comp.groupesFixes
        });
      }
    }
    // Enseignements créés par l'établissement (heures de dialogue, AP, FLSco, ateliers…)
    for (const p of etat.config.personnalises || []) {
      if (!p.actif || !(p.niveaux || []).includes(def.id) || !p.h) continue;
      const parts = p.parts && Object.keys(p.parts).length ? p.parts : { LET: 1 };
      const base = { id: `perso.${p.id}`, label: p.nom, parts, h: p.h, section: 'Établissement', src: 'local', personnalise: p.id };
      if (p.calcul === 'division') liste.push({ ...base, type: 'tc', cat: p.cat || 'DED', gr: p.gr ?? 0, horsGrille: true });
      else if (p.calcul === 'forfait') liste.push({ ...base, type: 'opt', cat: 'OPT', eff: 0, groupesFixes: p.groupes ?? 1 });
      else liste.push({ ...base, type: 'opt', cat: p.cat || 'OPT', eff: p.eff ?? 24 });
    }
    return liste;
  }

  /* --------------------- Missions, décharges, indemnités --------------------- */
  /**
   * mission = { id, nom, categorie, actif, parts:{disc:1}|null (null = toutes disciplines au prorata),
   *             base:'forfait'|'enseignant'|'division', niveaux:[], unites, h (h/unité),
   *             compensation:'heures'|'prime'|'mixte', partHeures (0..1), imp (nb d'IMP par unité rémunérée en prime) }
   */
  /* ------------------------- Enseignants et apport ------------------------- */
  const statutsDe = etat => (etat.reglages.statuts && etat.reglages.statuts.length ? etat.reglages.statuts : REFERENTIEL.statutsDefaut);
  /** Seuil d'HSA par poste au-delà duquel on envisage un recrutement (par discipline, sinon défaut) */
  const hsaMax = (etat, d) => etat.reglages.hsaMax?.[d] ?? etat.reglages.hsaMax?.defaut ?? 2;
  const categorieStatut = st => st?.categorie || (/^(certifie|agrege|eps|expat)$/.test(st?.id) ? 'detache' : st?.id === 'pe' ? 'pe' : 'local');
  /** Statut et ORS des postes créés (temps plein local) */
  function statutRecrutement(etat) {
    const S = statutsDe(etat);
    return S.find(s => s.id === etat.reglages.statutRecrutement) || S.find(s => s.id === 'contractuel') || S.find(s => categorieStatut(s) === 'local') || S[0];
  }

  /**
   * Postes en place par discipline, chacun compté À TEMPS PLEIN à l'ORS de son statut
   * (les quotités et décharges des feuilles de calcul sont ignorées).
   * Un enseignant partagé entre plusieurs disciplines compte pour la part indiquée dans chacune.
   * Sans liste d'enseignants : saisie globale (etat.ressources : apport, postes).
   */
  function agregerEnseignants(etat) {
    const liste = etat.enseignants || [];
    const S = Object.fromEntries(statutsDe(etat).map(s => [s.id, s]));
    const parDisc = {};
    const par = d => (parDisc[d] ||= { postes: 0, postesDetaches: 0, postesLocaux: 0, apport: 0, apportDetaches: 0, apportLocaux: 0, orsPond: 0 });
    if (!liste.length) {
      for (const [d, r] of Object.entries(etat.ressources || {})) {
        if (!r || (!r.apport && !r.postes)) continue;
        const x = par(d);
        Object.assign(x, { postes: r.postes || 0, apport: r.apport || 0, orsPond: r.postes ? (r.apport || 0) : 0 });
      }
      return { actif: false, parDisc, detail: [] };
    }
    const detail = liste.map(e => {
      const st = S[e.statut] || { id: e.statut, nom: e.statut || 'Statut inconnu', ors: etat.reglages.ors.defaut || 18 };
      const cat = categorieStatut(st);
      const o = Math.max(1, st.ors ?? 18);
      const brut = Object.entries(e.parts || {}).filter(([, p]) => p > 0);
      const s = brut.reduce((a, [, p]) => a + p, 0) || 1;
      const repartition = {};
      for (const [d, p0] of brut) {
        const p = p0 / s, x = par(d);
        repartition[d] = p;
        x.postes += p; x.apport += o * p; x.orsPond += o * p;
        if (cat === 'detache') { x.postesDetaches += p; x.apportDetaches += o * p; } else { x.postesLocaux += p; x.apportLocaux += o * p; }
      }
      return { ...e, ors: o, statutNom: st.nom, categorie: cat, repartition };
    });
    return { actif: true, parDisc, detail };
  }

  /**
   * Couverture d'une discipline, selon la logique de l'établissement :
   *   apport = Σ ORS à temps plein des postes en place (détachés puis locaux)
   *   écart = besoin − apport → HSA à distribuer, ou excédent d'apport à résorber
   *   HSA / poste comparées au seuil de la discipline ; au-delà, créations de temps plein local
   *   (nombre minimal qui ramène les HSA par poste sous le seuil, dans la limite des temps pleins que les HSA permettent de créer).
   */
  /** Recrutement en sous-service : autorisé ou non (par défaut, ou discipline par discipline), minimum d'heures, pas d'arrondi */
  const reglesSousService = (etat, d) => {
    const S = etat.reglages.sousService || {};
    const actif = S.parDisc?.[d] ?? S.actif ?? false;
    return { actif, minimum: Math.max(0.5, S.minimum ?? 6), pas: Math.max(0.5, S.pas ?? 1) };
  };
  /** Réglages des transferts d'excédents entre disciplines */
  const reglesTransferts = etat => {
    const T = etat.reglages.transferts || {};
    return { actif: T.actif ?? true, bivalents: T.bivalents ?? true, partExcedent: T.partExcedent ?? 100, famille: T.famille ?? true,
      ouvertes: Object.assign({ emc: true, dnl: true, perso: true, missions: false }, T.ouvertes || {}), passerelles: T.passerelles || [] };
  };

  /**
   * Transferts d'excédents : l'excédent d'apport d'une discipline absorbe les HSA d'une autre, dans l'ordre
   *   1. enseignants bivalents (dans la limite de leur service dans la discipline excédentaire),
   *   2. passerelles déclarées (de → vers, plafond en heures),
   *   3. heures « ouvertes » de la discipline receveuse (EMC, DNL, AP et enseignements propres, missions).
   */
  const familleVoisine = (a, b) => {
    const fa = REFERENTIEL.disciplines.find(d => d.id === a)?.fam, fb = REFERENTIEL.disciplines.find(d => d.id === b)?.fam;
    const g = f => f === 'lettres' ? 'humanites' : f;
    return !!fa && g(fa) === g(fb);
  };
  function calculerTransferts(etat, base, ens, pools) {
    const T = reglesTransferts(etat);
    const exc = {}, hsa = {}, transferts = [];
    for (const [d, b] of Object.entries(base)) { exc[d] = Math.max(0, -b.ecart) * Math.max(0, Math.min(100, T.partExcedent)) / 100; hsa[d] = Math.max(0, b.ecart); }
    if (!T.actif) return { transferts, exc, hsa };
    const ajouter = (de, vers, h, motif, detail) => {
      const t = transferts.find(x => x.de === de && x.vers === vers && x.motif === motif);
      if (t) { t.h += h; if (detail && !t.details.includes(detail)) t.details.push(detail); }
      else transferts.push({ de, vers, h, motif, details: detail ? [detail] : [] });
    };
    const deplacer = (de, vers, plafond, motif, detail) => {
      if (de === vers || !base[de] || !base[vers]) return 0;
      const h = Math.min(exc[de] || 0, hsa[vers] || 0, plafond);
      if (h <= 0.05) return 0;
      exc[de] -= h; hsa[vers] -= h;
      ajouter(de, vers, h, motif, detail);
      return h;
    };
    // 1. Bivalents : uniquement les valences déclarées dans la liste des enseignants
    if (T.bivalents) for (const e of ens.detail || []) {
      const valences = (e.valences || []).filter(v => v && v !== 'PE');
      if (!valences.length) continue;
      for (const [de, pDe] of Object.entries(e.repartition || {})) {
        let capacite = e.ors * pDe;
        for (const vers of valences) if (vers !== de && capacite > 0.05) capacite -= deplacer(de, vers, capacite, 'bivalent', e.nom);
      }
    }
    // 2. Passerelles déclarées
    for (const p of T.passerelles) if (p.actif !== false) deplacer(p.de, p.vers, p.max ?? Infinity, 'passerelle', p.motif || '');
    // 3. Heures ouvertes de la discipline receveuse
    const cats = Object.entries(T.ouvertes).filter(([, on]) => on).map(([k]) => k);
    if (cats.length) {
      const LIB = { emc: 'EMC', dnl: 'DNL', perso: 'AP et enseignements propres', missions: 'missions' };
      const receveurs = Object.keys(base).filter(d => hsa[d] > 0.05).sort((a, b) => hsa[b] - hsa[a]);
      for (const vers of receveurs) {
        let pool = cats.reduce((s, k) => s + (pools[vers]?.[k] || 0), 0);
        const libelle = cats.filter(k => (pools[vers]?.[k] || 0) > 0.05).map(k => LIB[k]).join(', ');
        // donneurs de la même famille (lettres et humanités sont voisines) d'abord ; les autres seulement si la restriction est levée
        const proche = d => familleVoisine(d, vers);
        const donneurs = Object.keys(base).filter(d => exc[d] > 0.05 && (!T.famille || proche(d)))
          .sort((a, b) => (proche(b) - proche(a)) || (exc[b] - exc[a]));
        for (const de of donneurs) { if (pool <= 0.05) break; pool -= deplacer(de, vers, pool, 'ouvertes', libelle); }
      }
    }
    return { transferts, exc, hsa };
  }

  function calculerCouverture(etat, besoins, ens, primaire, pools = {}) {
    const out = {};
    const rec = statutRecrutement(etat);
    const orsL = Math.max(1, rec.ors || 22);
    const discs = [...new Set([...Object.keys(besoins), ...Object.keys(ens.parDisc)])].filter(d => d !== 'PE');
    // écarts initiaux
    const base = {};
    for (const d of discs) {
      const x = ens.parDisc[d] || { postes: 0, postesDetaches: 0, postesLocaux: 0, apport: 0, apportDetaches: 0, apportLocaux: 0, orsPond: 0 };
      const besoin = besoins[d] || 0;
      if (!besoin && !x.apport && !x.postes) continue;
      base[d] = { x, besoin, ecart: besoin - x.apport };
    }
    const { transferts } = calculerTransferts(etat, base, ens, pools);
    const recu = {}, cede = {};
    for (const t of transferts) { recu[t.vers] = (recu[t.vers] || 0) + t.h; cede[t.de] = (cede[t.de] || 0) + t.h; }
    for (const d of Object.keys(base)) {
      const { x, besoin, ecart } = base[d];
      const seuil = hsaMax(etat, d);
      const orsRef = x.postes ? x.orsPond / x.postes : ors(etat, d);
      // après transferts : HSA restantes et excédent restant
      const hsa = Math.max(0, ecart - (recu[d] || 0)), excedent = Math.max(0, -ecart - (cede[d] || 0));
      const P = x.postes;
      const hsaParPoste = P > 0 ? hsa / P : null;
      const tpPossibles = Math.floor((hsa + 1e-6) / orsL);
      let creations = 0;
      if (hsa > 0.05) {
        if (P <= 0) creations = tpPossibles;
        else if (hsaParPoste > seuil + 1e-9) {
          creations = tpPossibles;
          for (let k = 1; k <= tpPossibles; k++) if ((hsa - k * orsL) / (P + k) <= seuil + 1e-9) { creations = k; break; }
        }
      }
      const hsaApresTP = Math.max(0, hsa - creations * orsL);
      // Recrutement en sous-service (temps partiel) : après les temps pleins, les heures qui dépassent encore le seuil
      // d'HSA par poste sont confiées à un poste à temps incomplet (arrondi au pas, au moins le minimum, moins qu'un temps plein).
      const SS = reglesSousService(etat, d);
      let sousServiceH = 0;
      if (SS.actif && hsaApresTP > 0.05) {
        const pTP = P + creations;
        const exces = pTP > 0 ? hsaApresTP - seuil * pTP : hsaApresTP;
        if (exces > 0.05) {
          let t = Math.ceil(exces / SS.pas - 1e-9) * SS.pas;
          t = Math.min(Math.max(t, SS.minimum), hsaApresTP, orsL - SS.pas);
          if (t >= SS.minimum - 1e-9) sousServiceH = t;
        }
      }
      const hsaApres = Math.max(0, hsaApresTP - sousServiceH);
      const postesApres = P + creations; // temps pleins (les HSA ne se répartissent pas sur un poste en sous-service)
      const hsaParPosteApres = postesApres > 0 ? hsaApres / postesApres : null;
      let etat_;
      if (excedent > 0.05) etat_ = 'excedent';
      else if (hsa <= 0.05) etat_ = 'equilibre';
      else if (P <= 0) etat_ = creations ? 'creer' : sousServiceH ? 'sousService' : 'sansPoste';
      else if (hsaParPoste <= seuil + 1e-9) etat_ = 'soutenable';
      else etat_ = creations ? 'recruter' : sousServiceH ? 'sousService' : 'tension';
      out[d] = { besoin, besoinETP: besoin / orsRef, orsRef, postes: P, postesDetaches: x.postesDetaches, postesLocaux: x.postesLocaux,
        apport: x.apport, apportDetaches: x.apportDetaches, apportLocaux: x.apportLocaux, ecart, recu: recu[d] || 0, cede: cede[d] || 0,
        hsaAvantTransferts: Math.max(0, ecart), excedentAvantTransferts: Math.max(0, -ecart), hsa, excedent, seuil, hsaMax: seuil, hsaParPoste,
        orsRecrutement: orsL, tpPossibles, creations, sousServiceH, sousServiceAutorise: SS.actif, sousServiceETP: sousServiceH / orsL, emploisCrees: creations + sousServiceH / orsL,
        hsaApresTempsPlein: hsaApresTP, hsaApres, postesApres, hsaParPosteApres, etat: etat_,
        // compatibilité avec les vues précédentes
        etp: P, tempsPlein: P, recrutement: creations * orsL + sousServiceH, recrutementETP: creations + sousServiceH / orsL, capaciteHSA: P * seuil, complement: 0 };
    }
    const pe = ens.parDisc.PE || { postes: 0 };
    out.PE = { besoinPostes: primaire.postesPE, postes: pe.postes, etp: pe.postes, manque: Math.max(0, primaire.postesPE - (pe.postes || 0)), renseigne: !!pe.postes };
    Object.defineProperty(out, 'transferts', { value: transferts, enumerable: false }); // hors des disciplines itérées
    return out;
  }

  function calculerMissions(etat, niveaux, besoinsParDisc, primaire, ens) {
    const liste = [];
    const parDisc = {}; let heures = 0, imp = 0;
    const totalBesoins = Object.entries(besoinsParDisc).filter(([d]) => d !== 'PE').reduce((s, [, x]) => s + x, 0) || 1;
    // nombre d'enseignants d'une discipline : liste ou saisie globale, sinon ETP nécessaires
    const enseignantsDe = d => (ens && ens.parDisc[d]?.postes) || Math.ceil((besoinsParDisc[d] || 0) / ors(etat, d) - 1e-9);
    for (const m of etat.config.missions || []) {
      if (!m.actif) continue;
      let unites = m.unites ?? 1;
      const disciplines = m.parts && Object.keys(m.parts).length ? m.parts : null;
      const partH = m.compensation === 'heures' ? 1 : m.compensation === 'prime' ? 0 : Math.max(0, Math.min(1, m.partHeures ?? 0.5));
      const md = {};
      if (m.base === 'division') {
        const garde = id => !m.niveaux || !m.niveaux.length || m.niveaux.includes(id);
        unites = niveaux.filter(n => garde(n.id)).reduce((s, n) => s + n.div, 0)
          + (primaire ? primaire.classes.filter(c => c.eff > 0 && c.niveaux.some(x => garde(x.id))).length : 0);
      }
      if (m.base === 'enseignant') {
        // chaque discipline reçoit h × ses propres enseignants
        const discs = disciplines ? Object.keys(disciplines) : Object.keys(besoinsParDisc).filter(d => d !== 'PE' && besoinsParDisc[d] > 0);
        unites = 0;
        for (const d of discs) { const u = enseignantsDe(d); unites += u; md[d] = u * (m.h || 0) * partH; }
      }
      const h = unites * (m.h || 0) * partH;
      const nbImp = unites * (1 - partH) * (m.imp ?? 1);
      if (m.base !== 'enseignant') {
        if (disciplines) {
          const s = Object.values(disciplines).reduce((a, b) => a + b, 0) || 1;
          for (const [d, p] of Object.entries(disciplines)) md[d] = h * p / s;
        } else {
          for (const [d, v] of Object.entries(besoinsParDisc)) if (d !== 'PE') md[d] = h * v / totalBesoins;
        }
      }
      for (const [d, v] of Object.entries(md)) parDisc[d] = (parDisc[d] || 0) + v;
      heures += h; imp += nbImp;
      liste.push({ def: m, id: m.id, unites, heures: h, imp: nbImp, parDisc: md });
    }
    return { liste, parDisc, heures, imp };
  }

  /* ============================= PRIMAIRE ============================= */
  const PRIM_IDS = REFERENTIEL.niveaux.filter(n => n.cycle === 'primaire').map(n => n.id);
  const reglesPrim = etat => Object.assign({ multiniveau: true, maxNiveaux: 3, traverserCycles: false, plafondMulti: null, effMin: 0,
    asem: { ps: 1, ms: 1, gs: 1 }, lvMode: 'decharge', lvPanachage: 'niveau' }, etat.reglages.primaire || {});
  const primOuverts = etat => PRIM_IDS.filter(id => niveauOuvert(etat, id));
  const plafondPrim = (etat, id) => {
    const nv = etat.niveaux.find(n => n.id === id);
    return Math.max(1, nv?.plafondClasse ?? etat.reglages.plafondClasse[id] ?? etat.reglages.plafondClasse.primaire ?? 26);
  };
  const courtNiv = id => defNiveau(id)?.court || id;

  /**
   * Structure optimisée : le moins de classes possible, sans dépasser les plafonds,
   * en créant des classes multiniveaux (niveaux consécutifs, jusqu'à maxNiveaux) quand cela économise une classe.
   * Programmation dynamique sur les niveaux ordonnés ; l'état porte le « reliquat » d'élèves en attente d'une classe mixte.
   */
  function optimiserPrimaire(etat) {
    const P = reglesPrim(etat);
    const ids = primOuverts(etat);
    const L = ids.length;
    if (!L) return [];
    const eff = ids.map(id => Math.max(0, Math.round(etat.niveaux.find(n => n.id === id)?.eff || 0)));
    const cap = ids.map(id => plafondPrim(etat, id));
    const bloc = id => defNiveau(id).bloc;
    const maxN = P.multiniveau ? Math.max(1, Math.min(4, P.maxNiveaux || 2)) : 1;
    const peutEnchainer = i => maxN > 1 && i + 1 < L && PRIM_IDS.indexOf(ids[i + 1]) === PRIM_IDS.indexOf(ids[i]) + 1
      && (P.traverserCycles || bloc(ids[i]) === bloc(ids[i + 1]));
    const capMixte = comps => P.plafondMulti || Math.min(...comps.map(c => cap[c.i]));
    const penaliteClasse = (taille) => (P.effMin && taille < P.effMin ? 1.5 : 0);

    const cle = JSON.stringify([ids, eff, cap, maxN, P.traverserCycles, P.plafondMulti, P.effMin]);
    if (CACHE_PRIM.has(cle)) return clone(CACHE_PRIM.get(cle));
    // chaque état garde un pointeur vers son parent et les classes ajoutées à l'étape (pas de copie de tableaux)
    let etats = new Map([['0|0', { cout: 0, parent: null, ajout: [], carry: [] }]]);
    const garder = (map, st) => {
      const tot = st.carry.reduce((s, c) => s + c.n, 0);
      const key = `${tot}|${st.carry.length}|${st.carry.map(c => c.i).join(',')}`;
      const cur = map.get(key);
      if (!cur || st.cout < cur.cout - 1e-9) map.set(key, st);
    };
    for (let i = 0; i < L; i++) {
      const suivants = new Map();
      for (const st of etats.values()) {
        const a = eff[i];
        const carryTot = st.carry.reduce((s, c) => s + c.n, 0);
        const k = st.carry.length;
        const tMax = k ? Math.min(a, capMixte([...st.carry, { i }]) - carryTot) : 0;
        for (let t = 0; t <= Math.max(0, tMax); t++) {
          const comps = t > 0 ? [...st.carry, { i, n: t }] : st.carry.slice();
          const chemins = [];
          if (k) chemins.push({ ferme: comps, base: [] });
          if (k && t > 0 && comps.length < maxN && peutEnchainer(i)) chemins.push({ ferme: null, base: comps });
          if (!k) chemins.push({ ferme: null, base: [] });
          for (const ch of chemins) {
            const r = a - t;
            const cMax = (!ch.base.length && peutEnchainer(i)) ? Math.min(r, (P.plafondMulti || cap[i]) - 1) : 0;
            for (let c = 0; c <= cMax; c++) {
              const pur = r - c;
              const n = pur > 0 ? Math.ceil(pur / cap[i]) : 0;
              const ajout = [];
              let cout = st.cout + n;
              if (n) repartir(pur, n).forEach(x => { ajout.push([{ i, n: x }]); cout += penaliteClasse(x); });
              if (ch.ferme) {
                const taille = ch.ferme.reduce((s, x) => s + x.n, 0);
                ajout.push(ch.ferme);
                cout += 1 + 0.02 * (ch.ferme.length - 1) + penaliteClasse(taille);
              }
              const carry = ch.base.length ? ch.base : (c > 0 ? [{ i, n: c }] : []);
              if (carry.length) cout += 0.001; // reliquat en attente : léger coût pour éviter les mixités inutiles
              garder(suivants, { cout, parent: st, ajout, carry });
            }
          }
        }
      }
      etats = suivants;
    }
    let meilleur = null;
    for (const st of etats.values()) {
      const cout = st.cout + (st.carry.length ? 1 + 0.02 * (st.carry.length - 1) : 0);
      if (!meilleur || cout < meilleur.cout - 1e-9) meilleur = { cout, st };
    }
    const brut = [];
    if (meilleur) {
      if (meilleur.st.carry.length) brut.push(meilleur.st.carry);
      for (let s = meilleur.st; s; s = s.parent) for (let q = s.ajout.length - 1; q >= 0; q--) brut.push(s.ajout[q]);
      brut.reverse();
    }
    const resultat = nommerClassesPrimaire(brut.filter(cl => cl.some(x => x.n > 0))
      .map((cl, j) => ({ id: 'auto' + j, niveaux: Object.fromEntries(cl.filter(x => x.n > 0).map(x => [ids[x.i], x.n])) })));
    if (CACHE_PRIM.size > 200) CACHE_PRIM.clear();
    CACHE_PRIM.set(cle, clone(resultat));
    return resultat;
  }
  const CACHE_PRIM = new Map();

  function nommerClassesPrimaire(classes) {
    const compte = {};
    const ordre = cl => Object.keys(cl.niveaux).filter(id => cl.niveaux[id] > 0).sort((a, b) => PRIM_IDS.indexOf(a) - PRIM_IDS.indexOf(b));
    classes.sort((x, y) => {
      const a = ordre(x), b = ordre(y);
      return PRIM_IDS.indexOf(a[0]) - PRIM_IDS.indexOf(b[0]) || a.length - b.length || PRIM_IDS.indexOf(a[a.length - 1]) - PRIM_IDS.indexOf(b[b.length - 1]);
    });
    for (const cl of classes) {
      const sig = ordre(cl).map(courtNiv).join('-') || 'Classe';
      compte[sig] = (compte[sig] || 0) + 1;
      if (!cl.nom || cl.nomAuto !== false) { cl.nom = `${sig} ${LETTRES[compte[sig] - 1] || compte[sig]}`; cl.nomAuto = true; }
    }
    return classes;
  }

  /**
   * Groupes de langue inter-classes : les classes sont alignées en barrette par niveau (niveau dominant d'une classe multiniveau).
   * Panachage « adjacent » : deux niveaux consécutifs peuvent partager une barrette quand cela économise des groupes
   * (programmation dynamique sur les niveaux ; maternelle et élémentaire ne sont jamais mêlées).
   */
  function alignementsLangue(classes, P, plafond, maxBloc) {
    const idx = id => PRIM_IDS.indexOf(id);
    const parNiv = new Map();
    classes.forEach(c => { const k = c.dominant; if (!parNiv.has(k)) parNiv.set(k, []); parNiv.get(k).push(c); });
    const nivs = [...parNiv.keys()].sort((a, b) => idx(a) - idx(b));
    const faire = ids => { const cl = ids.flatMap(id => parNiv.get(id)); return { niveaux: ids, classes: cl, best: meilleurRegroupement(cl.map(c => c.eff), plafond, maxBloc) }; };
    const adjacents = (a, b) => P.lvPanachage === 'adjacent' && idx(b) === idx(a) + 1 && defNiveau(a).bloc === defNiveau(b).bloc;
    const dp = [{ g: 0, als: [] }];
    for (let i = 0; i < nivs.length; i++) {
      const seul = faire([nivs[i]]);
      let m = { g: dp[i].g + seul.best.g, als: [...dp[i].als, seul] };
      if (i > 0 && adjacents(nivs[i - 1], nivs[i])) {
        const duo = faire([nivs[i - 1], nivs[i]]);
        if (dp[i - 1].g + duo.best.g < m.g) m = { g: dp[i - 1].g + duo.best.g, als: [...dp[i - 1].als, duo] };
      }
      dp.push(m);
    }
    return dp[nivs.length].als;
  }

  /** Besoins du primaire : 1 professeur des écoles par classe, heures de spécialistes selon le mode, ASEM, sections. */
  function calculerPrimaire(etat) {
    const R = etat.reglages, P = reglesPrim(etat);
    const ids = primOuverts(etat);
    const vide = { classes: [], cours: [], parDisc: {}, postesPE: 0, heuresPE: 0, asem: 0, eleves: 0, alertes: [], parNiveau: {}, niveauxOuverts: ids, mode: 'auto' };
    if (!ids.length) return vide;
    const manuel = etat.primaire?.mode === 'manuel' && Array.isArray(etat.primaire.classes);
    const source = manuel ? etat.primaire.classes : optimiserPrimaire(etat);
    const plafondLV = Math.max(1, R.plafondGroupe.LV || 24);
    const alertes = [];
    const parDisc = {};
    const defsParNiveau = Object.fromEntries(ids.map(id => [id, coursDuNiveau(etat, defNiveau(id))]));

    const classes = source.map((cl, j) => {
      const comp = ids.map(id => ({ id, n: Math.max(0, Math.round(cl.niveaux?.[id] || 0)) })).filter(x => x.n > 0);
      const eff = comp.reduce((s, x) => s + x.n, 0);
      const plafond = comp.length > 1 ? (P.plafondMulti || Math.min(...comp.map(x => plafondPrim(etat, x.id)))) : plafondPrim(etat, comp[0]?.id || ids[0]);
      const mater = comp.filter(x => defNiveau(x.id).bloc === 'maternelle');
      const asemDefaut = mater.length ? Math.max(...mater.map(x => P.asem?.[x.id] ?? 1)) : 0;
      const asem = mater.length ? Math.max(0, cl.asem ?? asemDefaut) : 0;
      const lvMode = cl.lvMode || P.lvMode;
      // heures du professeur des écoles : la grille la plus lourde des niveaux présents (24 h)
      const pe = Math.max(0, ...comp.map(x => defsParNiveau[x.id].filter(c => c.type === 'tc').reduce((s, c) => s + c.h * (c.parts.PE || 0), 0)));
      if (eff > plafond) alertes.push({ niveau: 'critique', texte: `${cl.nom || 'Classe'} : ${eff} élèves pour un plafond de ${plafond}` });
      if (P.effMin && eff && eff < P.effMin) alertes.push({ niveau: 'alerte', texte: `${cl.nom || 'Classe'} : ${eff} élèves, sous le minimum de ${P.effMin}` });
      return { id: cl.id || 'c' + j, nom: cl.nom || `Classe ${j + 1}`, niveaux: comp, eff, plafond, sur: eff > plafond, asem, asemDefaut, asemForce: cl.asem != null,
        lvMode, lvModeForce: !!cl.lvMode, pe, multiniveau: comp.length > 1, maternelle: mater.length > 0, heures: { PE: pe },
        dominant: comp.length ? comp.reduce((m, x) => x.n > m.n ? x : m).id : null };
    });
    const classesOk = classes.filter(c => c.eff > 0);
    const postesPE = classesOk.length;
    const heuresPE = classesOk.reduce((s, c) => s + c.pe, 0);
    parDisc.PE = heuresPE;

    // Cours de spécialistes suivis par toute la classe (langue par un spécialiste, langue renforcée, langue du pays hôte…)
    const coursTC = new Map();
    for (const c of classesOk) for (const x of c.niveaux) for (const d of defsParNiveau[x.id]) {
      if (d.type !== 'tc' || (d.parts.PE || 0) >= 1) continue;
      const cur = coursTC.get(d.id) || { def: d, h: 0, classes: new Set() };
      cur.h = Math.max(cur.h, d.h); cur.classes.add(c.id); coursTC.set(d.id, cur);
    }
    const cours = [];
    for (const { def, h, classes: ens } of coursTC.values()) {
      const cls = classesOk.filter(c => ens.has(c.id));
      let groupes = 0, detail = [];
      const parMode = { decharge: [], dedoublement: [], groupes: [] };
      cls.forEach(c => parMode[c.lvMode in parMode ? c.lvMode : 'decharge'].push(c));
      parMode.decharge.forEach(c => { groupes += 1; detail.push({ classes: [c.nom], groupes: 1, mode: 'decharge' }); });
      parMode.dedoublement.forEach(c => { const g = Math.max(2, Math.ceil(c.eff / plafondLV)); groupes += g; detail.push({ classes: [c.nom], groupes: g, mode: 'dedoublement' }); });
      if (parMode.groupes.length) {
        // Alignements en barrette : classes d'un même niveau (niveau dominant pour une classe multiniveau),
        // ou de deux niveaux consécutifs si le panachage le permet (jamais maternelle avec élémentaire).
        for (const al of alignementsLangue(parMode.groupes, P, plafondLV, R.maxBloc)) {
          al.best.blocs.forEach(b => { groupes += b.groupes; detail.push({ classes: b.classes.map(i => al.classes[i].nom), groupes: b.groupes, mode: 'groupes', tailles: b.tailles, alignement: al.niveaux }); });
        }
      }
      const prof = h * groupes;
      const pd = {}; ventiler(def.parts, prof, pd);
      delete pd.PE;
      for (const [d, v] of Object.entries(pd)) parDisc[d] = (parDisc[d] || 0) + v;
      // heures par classe (au prorata des effectifs dans un groupe inter-classes), pour les statistiques par niveau
      for (const dt of detail) {
        const cl = dt.classes.map(nom => cls.find(c => c.nom === nom)).filter(Boolean);
        const s = cl.reduce((a, c) => a + c.eff, 0) || 1;
        cl.forEach(c => { const hc = h * dt.groupes * c.eff / s; for (const [d, p] of Object.entries(def.parts)) if (d !== 'PE') c.heures[d] = (c.heures[d] || 0) + hc * p; });
      }
      cours.push({ def, id: def.id, h, classes: cls.length, groupes, prof, detail, parDisc: pd,
        decharge: parMode.decharge.length * h, supplementDedoublement: parMode.dedoublement.reduce((s, c) => s + h * (Math.max(2, Math.ceil(c.eff / plafondLV)) - 1), 0) });
    }
    // Sections et options par niveau (barrette sur les classes du niveau)
    const parNiveau = {};
    for (const id of ids) {
      const nv = etat.niveaux.find(n => n.id === id);
      const effNiv = classesOk.reduce((s, c) => s + (c.niveaux.find(x => x.id === id)?.n || 0), 0);
      const nbClasses = classesOk.filter(c => c.niveaux.some(x => x.id === id)).length;
      const nbMixtes = classesOk.filter(c => c.multiniveau && c.niveaux.some(x => x.id === id)).length;
      parNiveau[id] = { eff: effNiv, effSaisi: nv?.eff || 0, nbClasses, nbMixtes };
      if (manuel && nv && Math.round(nv.eff || 0) !== effNiv) alertes.push({ niveau: 'info', texte: `${defNiveau(id).nom} : ${effNiv} élèves répartis dans les classes pour ${nv.eff} saisis` });
      for (const d of defsParNiveau[id]) {
        if (d.type === 'tc') continue;
        const p = nv?.cours?.[d.id] || {};
        const actif = p.actif ?? d.actif ?? true;
        const e = actif ? Math.max(0, p.eff ?? d.eff ?? 0) : 0;
        const plafond = Math.max(1, p.plafond ?? R.plafondGroupe[d.cat] ?? 30);
        const auto = e > 0 ? Math.ceil(e / plafond) : 0;
        const G = actif ? (p.groupesFixes ?? d.groupesFixes ?? auto) : 0;
        const prof = d.h * G;
        const pd = {}; ventiler(d.parts, prof, pd);
        for (const [k, v] of Object.entries(pd)) parDisc[k] = (parDisc[k] || 0) + v;
        cours.push({ def: d, id: `${id}:${d.id}`, niveau: id, h: d.h, eff: e, actif, plafond, groupes: G, groupesAuto: auto, groupesFixes: p.groupesFixes ?? null, prof, parDisc: pd, tailles: repartir(e, G) });
      }
    }
    const asem = classesOk.reduce((s, c) => s + c.asem, 0);
    const eleves = classesOk.reduce((s, c) => s + c.eff, 0);
    return { classes, cours, parDisc, postesPE, heuresPE, asem, eleves, alertes, parNiveau, niveauxOuverts: ids, mode: manuel ? 'manuel' : 'auto',
      multiniveaux: classesOk.filter(c => c.multiniveau).length };
  }

  /* ============================ PROJECTION ============================ */
  /**
   * Applique des effectifs cibles à une copie de l'état en suivant les règles d'optimisation :
   *   cible = { [idNiveau]: { total, sections: { si, euro, bfi } } }
   * - divisions du secondaire recalculées (plafond + tolérance, ou stabilité avec seuil de fermeture) ;
   * - effectifs d'options, spécialités, LV et dispositifs mis à l'échelle du niveau (ou sections fournies) ;
   * - primaire : structure optimisée recalculée.
   */
  function projeter(etat, cible, options = {}) {
    const e = clone(etat);
    const R = e.reglages;
    const regles = Object.assign({ mode: 'stabilite', tolerance: 0, seuilFermeture: 0.9 }, R.projection || {}, options);
    const avant = calculer(etat);
    for (const nv of e.niveaux) {
      const def = defNiveau(nv.id);
      const c = cible[nv.id];
      if (!def || c == null || !niveauOuvert(e, nv.id)) continue;
      const total = Math.max(0, Math.round(typeof c === 'number' ? c : c.total || 0));
      const rn = avant.niveaux.find(x => x.id === nv.id);
      const ancien = rn ? rn.effTotal : (nv.eff || 0);
      const ratio = ancien > 0 ? total / ancien : 1;
      nv.eff = total; nv.effClasses = null;
      if (def.cycle !== 'primaire') {
        const cap = Math.max(1, nv.plafondClasse ?? R.plafondClasse[def.id] ?? R.plafondClasse[def.cycle] ?? 28);
        const mini = total ? Math.ceil(total / (cap + (regles.tolerance || 0))) : 0;
        let div = mini;
        if (regles.mode === 'stabilite' && nv.div > mini) div = total > (nv.div - 1) * cap * (regles.seuilFermeture ?? 0.9) ? nv.div : Math.max(mini, nv.div - 1);
        nv.div = div;
        if (rn) for (const cr of rn.cours) {
          if (cr.def.type === 'tc') continue;
          const p = (nv.cours[cr.id] ||= {});
          const sec = typeof c === 'object' && c.sections && cr.def.dispositif && c.sections[cr.def.dispositif];
          if (sec != null) p.eff = Math.max(0, Math.round(sec));
          else if (cr.eff) p.eff = Math.max(0, Math.round(cr.eff * ratio));
        }
      }
    }
    if (e.primaire && e.primaire.mode === 'manuel' && !options.garderPrimaireManuel) e.primaire.mode = 'auto';
    return e;
  }

  /* -------------------------- Statistiques ------------------------- */
  const etpDe = (etat, parDisc) => Object.entries(parDisc).reduce((s, [d, h]) => s + h / Math.max(1, ors(etat, d)), 0);
  const AXE_STATS = [['ps', 'PS'], ['ms', 'MS'], ['gs', 'GS'], ['cp', 'CP'], ['ce1', 'CE1'], ['ce2', 'CE2'], ['cm1', 'CM1'], ['cm2', 'CM2'],
    ['6e', '6e'], ['5e', '5e'], ['4e', '4e'], ['3e', '3e'], ['2nde', '2nde'], ['1re', '1re'], ['tle', 'Tle']];
  const POSITION_STATS = { '1g': '1re', '1t': '1re', '1sti': '1re', '1st2s': '1re', ib1: '1re', tg: 'tle', tt: 'tle', tsti: 'tle', tst2s: 'tle', ib2: 'tle' };
  const SERIES_STATS = [
    { id: 'fr', nom: 'Section française', court: 'Française' },
    { id: 'si', nom: 'Section internationale / BFI', court: 'SI / BFI' },
    { id: 'techno', nom: 'Voies technologiques', court: 'Techno.' },
    { id: 'ib', nom: 'IB Diploma', court: 'IB' },
  ];
  const DISPOSITIFS_SI = new Set(['si', 'bfi']);
  /**
   * Heures-professeur et ETP déployés par division, par niveau (PS → Tle) et par cursus.
   *   Section française : heures du niveau hors section internationale / BFI, divisées par le nombre de divisions.
   *   SI / BFI : une division française + les heures propres de la section rapportées à ses divisions équivalentes
   *              (effectif de section / effectif moyen d'une division).
   *   Primaire : chaque classe multiniveau compte pour chaque niveau au prorata de ses élèves.
   *   ETP = Σ heures / ORS de la discipline. Heures d'enseignement non pondérées, hors missions.
   */
  function calculerStatistiques(etat, niveaux, primaire) {
    const pts = {}; SERIES_STATS.forEach(s => { pts[s.id] = {}; });
    const acc = (serie, pos, o) => {
      const p = (pts[serie][pos] ||= { h: 0, etp: 0, div: 0, eff: 0, niveaux: [] });
      p.h += o.h; p.etp += o.etp; p.div += o.div; p.eff += o.eff; if (o.niveau && !p.niveaux.includes(o.niveau)) p.niveaux.push(o.niveau);
    };
    const partSI = (base, divBase, effTotal, hSI, etpSI, effSI) => {
      const moy = divBase ? effTotal / divBase : 0;
      const divEq = moy ? effSI / moy : 0;
      return divEq ? { divEq, h: base.h / divBase + hSI / divEq, etp: base.etp / divBase + etpSI / divEq } : null;
    };
    // Secondaire
    for (const n of niveaux) {
      if (!n.div) continue;
      const pos = POSITION_STATS[n.id] || n.id;
      const serie = n.filiere === 'IB' ? 'ib' : n.filiere ? 'techno' : 'fr';
      const base = {}, si = {}; let effSI = 0;
      for (const c of n.cours) {
        const cible = DISPOSITIFS_SI.has(c.def.dispositif) ? si : base;
        for (const [d, h] of Object.entries(c.parDisc)) cible[d] = (cible[d] || 0) + h;
        if (DISPOSITIFS_SI.has(c.def.dispositif) && c.actif) effSI = Math.max(effSI, c.eff || 0);
      }
      const hB = Object.values(base).reduce((s, x) => s + x, 0), eB = etpDe(etat, base);
      acc(serie, pos, { h: hB, etp: eB, div: n.div, eff: n.effTotal, niveau: n.court });
      const hS = Object.values(si).reduce((s, x) => s + x, 0);
      const ps = hS && effSI ? partSI({ h: hB, etp: eB }, n.div, n.effTotal, hS, etpDe(etat, si), effSI) : null;
      if (ps) acc('si', pos, { h: ps.h * ps.divEq, etp: ps.etp * ps.divEq, div: ps.divEq, eff: effSI, niveau: n.court });
    }
    // Primaire
    for (const id of primaire.niveauxOuverts || []) {
      let h = 0, etp = 0, div = 0, eff = 0;
      for (const c of primaire.classes) {
        const x = c.eff > 0 && c.niveaux.find(v => v.id === id);
        if (!x) continue;
        const part = x.n / c.eff;
        div += part; eff += x.n;
        h += part * Object.values(c.heures || {}).reduce((s, v) => s + v, 0);
        etp += part * etpDe(etat, c.heures || {});
      }
      const si = {}; let effSI = 0;
      for (const c of primaire.cours.filter(k => k.niveau === id)) {
        const cible = DISPOSITIFS_SI.has(c.def.dispositif) ? si : null;
        if (cible) { for (const [d, v] of Object.entries(c.parDisc)) si[d] = (si[d] || 0) + v; if (c.actif) effSI = Math.max(effSI, c.eff || 0); }
        else { h += Object.values(c.parDisc).reduce((s, v) => s + v, 0); etp += etpDe(etat, c.parDisc); }
      }
      if (!div) continue;
      const court = defNiveau(id).court;
      acc('fr', id, { h, etp, div, eff, niveau: court });
      const hS = Object.values(si).reduce((s, x) => s + x, 0);
      const ps = hS && effSI ? partSI({ h, etp }, div, eff, hS, etpDe(etat, si), effSI) : null;
      if (ps) acc('si', id, { h: ps.h * ps.divEq, etp: ps.etp * ps.divEq, div: ps.divEq, eff: effSI, niveau: court });
    }
    const series = SERIES_STATS.map(s => ({ ...s, points: AXE_STATS.map(([pos]) => {
      const p = pts[s.id][pos];
      return p && p.div > 1e-9 ? { pos, hTotal: p.h, etpTotal: p.etp, div: p.div, eff: p.eff, niveaux: p.niveaux, hParDiv: p.h / p.div, etpParDiv: p.etp / p.div } : null;
    }) })).filter(s => s.points.some(Boolean));
    return { axe: AXE_STATS.map(([id, nom]) => ({ id, nom })), series };
  }

  /* ----------------------------- Calcul ---------------------------- */
  function calculer(etat) {
    appliquerDisciplines(etat);
    const R = etat.reglages;
    const totaux = {}, totauxPond = {};
    const niveaux = [];
    for (const nv of etat.niveaux) {
      const def = defNiveau(nv.id);
      if (!def || !niveauOuvert(etat, nv.id)) continue;
      if (def.cycle === 'primaire') continue; // traité par calculerPrimaire (classes, multiniveaux, ASEM)
      const n = Math.max(0, nv.div | 0);
      const plafondClasse = Math.max(1, nv.plafondClasse ?? R.plafondClasse[def.id] ?? R.plafondClasse[def.cycle] ?? 28);
      const effClasses = (nv.effClasses && nv.effClasses.length === n) ? nv.effClasses.slice() : repartir(nv.eff, n);
      const effTotal = n ? effClasses.reduce((s, x) => s + x, 0) : (nv.eff || 0);
      const classes = effClasses.map((e, i) => ({ nom: `${def.court} ${LETTRES[i] || i + 1}`, lettre: LETTRES[i] || String(i + 1), eff: e, surPlafond: e > plafondClasse }));
      const parDisc = {}; const alertes = []; const cours = [];
      let theorique = 0, surcout = 0;
      const defs = coursDuNiveau(etat, def);
      // spécialités : placement des combinaisons réelles dans les barrettes (liste d'élèves importée)
      let placement = null;
      const nbBarrettes = nv.barrettes?.nb ?? (def.id === '1g' ? 3 : def.id === 'tg' ? 2 : 0);
      if (nbBarrettes && nv.barrettes?.actif !== false && nv.combinaisons && Object.keys(nv.combinaisons).length) {
        const plafSpe = id => Math.max(1, nv.cours[id]?.plafond ?? R.plafondGroupe[defs.find(d => d.id === id)?.cat || 'SPE'] ?? 30);
        // les spécialités exclues de la répartition (effectif orphelin) sortent des combinaisons
        const combos = {};
        for (const [k, n] of Object.entries(nv.combinaisons)) { const ids = k.split('|').filter(id => id && nv.cours[id]?.actif !== false); if (ids.length) combos[ids.join('|')] = (combos[ids.join('|')] || 0) + n; }
        placement = placerSpecialites(combos, nbBarrettes, plafSpe);
        if (placement) placement.nb = nbBarrettes;
      }

      for (const c of defs) {
        const p = nv.cours[c.id] || {};
        const actif = c.type === 'tc' ? true : (p.actif ?? c.actif ?? true);
        // un groupe de DNL qui remplace le cours ordinaire suit le plafond de classe
        const plafond = Math.max(1, p.plafond ?? (c.remplace ? plafondClasse : R.plafondGroupe[c.cat]) ?? 30);
        const sParts = Object.values(c.parts).reduce((s, x) => s + x, 0);
        if (sParts > 0 && sParts < 1) c.parts = Object.fromEntries(Object.entries(c.parts).map(([d, p]) => [d, p / sParts])); // ventilation incomplète : normalisée
        const k = sParts > 1 + 1e-9 ? sParts : 1; // co-intervention
        const res = { def: c, id: c.id, actif, plafond, h: c.h, coIntervention: k > 1 ? k : null, prof: 0, parDisc: {} };

        if (c.type === 'tc') {
          const gr = Math.min(c.h, Math.max(0, p.gr ?? c.gr ?? 0));
          const ce = c.h - gr;
          let blocs = [], b = 1, G = 0;
          if (gr > 0 && n > 0) {
            if (p.bloc && p.bloc !== 'auto') { b = Math.min(+p.bloc, R.maxBloc, n); blocs = regrouper(effClasses, b, plafond, R.maxBloc); }
            else { const best = meilleurRegroupement(effClasses, plafond, R.maxBloc); b = best.b; blocs = best.blocs; }
            G = blocs.reduce((s, x) => s + x.groupes, 0);
          }
          Object.assign(res, { gr, ce, bloc: p.bloc ?? 'auto', b, blocs, groupes: G, notation: gr > 0 ? notation(blocs) : 'classe entière',
            profCE: ce * n * k, profGR: gr * G * k });
          res.prof = res.profCE + res.profGR;
          if (!c.horsGrille) theorique += c.h * n;
          surcout += res.prof - (c.horsGrille ? 0 : c.h * n);
        } else {
          const eff = actif ? Math.max(0, p.eff ?? c.eff ?? 0) : 0;
          const ga = groupesDepuisChoix(etat, def, nv, c, p, eff, plafond, placement, defs);
          const auto = ga.auto;
          const G = actif ? (p.groupesFixes ?? c.groupesFixes ?? auto) : 0;
          const tailles = repartir(eff, G);
          Object.assign(res, { eff, groupes: G, groupesAuto: auto, groupesFixes: p.groupesFixes ?? c.groupesFixes ?? null, tailles, hGroupe: ga.h, origineGroupes: ga.note,
            notation: G ? `${G} gr · ${eff} él. (${ga.note || 'barrette niveau'})` : (ga.note && actif ? ga.note : '—') });
          res.prof = ga.h * G * k;
          if (c.type === 'opt') surcout += res.prof;
          if (G && eff && Math.max(...tailles) > plafond) alertes.push({ niveau: 'alerte', texte: `${c.label} : ${Math.max(...tailles)} élèves par groupe (plafond ${plafond})` });
        }
        ventiler(c.parts, res.prof / k, res.parDisc);
        ventiler(c.parts, res.prof / k, parDisc);
        cours.push(res);
      }

      // DNL en substitution : les classes composées uniquement d'élèves de la section n'ont plus le cours ordinaire
      for (const c of cours) {
        if (!c.def.remplace || !c.actif || !c.groupes) continue;
        const base = cours.find(x => x.id === c.def.remplace);
        const pures = Math.min(n, Math.max(0, etat.config.dispositifs[c.def.dispositif]?.classesPures?.[def.id] || 0));
        if (!base || !pures || !n) continue;
        const retrait = base.prof / n * pures, k = base.coIntervention || 1;
        base.prof -= retrait; base.retraitSubstitution = (base.retraitSubstitution || 0) + retrait;
        ventiler(base.def.parts, -retrait / k, base.parDisc); ventiler(base.def.parts, -retrait / k, parDisc);
        surcout -= retrait;
        c.classesPures = pures; c.economie = retrait;
      }

      // Contrôles de cohérence
      const moyenne = n ? effTotal / n : 0;
      const divMin = Math.ceil(effTotal / plafondClasse);
      if (!n && effTotal > 0) alertes.unshift({ niveau: 'critique', texte: `${effTotal} élèves sans division : il faut ${divMin} divisions` });
      else if (n && divMin > n) alertes.unshift({ niveau: 'critique', texte: `${effTotal} élèves pour ${n} divisions : plafond ${plafondClasse} dépassé, il faut ${divMin} divisions` });
      else if (classes.some(x => x.surPlafond)) alertes.unshift({ niveau: 'critique', texte: `Classe au-dessus du plafond de ${plafondClasse} élèves` });
      for (const [cle, attendu] of Object.entries(def.controles || {})) {
        const concernes = cours.filter(x => x.def.groupe === cle && x.actif);
        if (!concernes.length) continue;
        const somme = concernes.reduce((s, x) => s + x.eff, 0);
        const cible = attendu * effTotal;
        if (somme !== cible) alertes.push({ niveau: 'info', texte: `${REFERENTIEL.libellesControles[cle]} : ${somme} choix pour ${cible} attendus` });
      }

      const marge = R.margeParDivision[def.id] != null ? R.margeParDivision[def.id] * n
        : def.margeEleves ? def.margeEleves.h * effTotal / def.margeEleves.pour : (def.marge ?? 0) * n;
      const pond = R.ponderation && def.cycleTerminal;
      const parDiscPond = {};
      for (const [d, h] of Object.entries(parDisc)) {
        parDiscPond[d] = pond && d !== 'EPS' ? h * 1.1 : h;
        totaux[d] = (totaux[d] || 0) + h;
        totauxPond[d] = (totauxPond[d] || 0) + parDiscPond[d];
      }
      const total = Object.values(parDisc).reduce((s, x) => s + x, 0);
      const totalPond = Object.values(parDiscPond).reduce((s, x) => s + x, 0);
      const etp = etpDe(etat, parDisc);
      if (placement) placement.alertes.forEach(t => alertes.push({ niveau: 'alerte', texte: t }));
      niveaux.push({ etp, hParDiv: n ? total / n : 0, etpParDiv: n ? etp / n : 0, placement, nbBarrettes, def, id: def.id, nom: def.nom, court: def.court, cycle: def.cycle, filiere: def.filiere || null, div: n, effTotal, moyenne: r2(moyenne),
        plafondClasse, divMin, classes, cours, parDisc, parDiscPond, total, totalPond, theorique, surcout, marge, alertes });
    }
    // Primaire : ajouté aux totaux (sans pondération)
    const primaire = calculerPrimaire(etat);
    for (const [d, h] of Object.entries(primaire.parDisc)) { totaux[d] = (totaux[d] || 0) + h; totauxPond[d] = (totauxPond[d] || 0) + h; }
    const ens = agregerEnseignants(etat);
    // Pondération plafonnée (1 h par enseignant) : si l'option est active et que les enseignants sont connus
    if (R.ponderation && R.ponderationPlafonnee) {
      for (const d of Object.keys(totauxPond)) {
        const bonus = totauxPond[d] - totaux[d];
        const po = ens.parDisc[d]?.postes || 0;
        if (po && bonus > po) totauxPond[d] = totaux[d] + po;
      }
    }
    const total = Object.values(totaux).reduce((s, x) => s + x, 0);
    const totalPond = Object.values(totauxPond).reduce((s, x) => s + x, 0);
    // besoins du secondaire (hors heures du primaire, y compris spécialistes du primaire)
    const pondSec = {};
    for (const [d, h] of Object.entries(totauxPond)) { const v = h - (primaire.parDisc[d] || 0); if (Math.abs(v) > 1e-9) pondSec[d] = v; }
    const missions = calculerMissions(etat, niveaux, pondSec, primaire, ens);
    const besoins = { ...totauxPond };
    for (const [d, h] of Object.entries(missions.parDisc)) besoins[d] = (besoins[d] || 0) + h;
    const besoinTotal = Object.values(besoins).reduce((s, x) => s + x, 0);
    const besoinSecondDegre = besoinTotal - (besoins.PE || 0);
    // Totaux du seul secondaire (hors primaire) pour les vues collège-lycée
    const totauxSecondaire = {}, totauxPondSecondaire = {};
    for (const n of niveaux) for (const [d, h] of Object.entries(n.parDisc)) { totauxSecondaire[d] = (totauxSecondaire[d] || 0) + h; totauxPondSecondaire[d] = (totauxPondSecondaire[d] || 0) + n.parDiscPond[d]; }
    const besoinsSecondaire = { ...pondSec };
    for (const [d, h] of Object.entries(missions.parDisc)) besoinsSecondaire[d] = (besoinsSecondaire[d] || 0) + h;
    // heures « ouvertes » par discipline (pondérées comme le reste du niveau) : EMC, DNL, AP et enseignements propres, missions
    const pools = {};
    const ajoutPool = (d, cat, h) => { (pools[d] ||= { emc: 0, dnl: 0, perso: 0, missions: 0 })[cat] += h; };
    for (const n of niveaux) for (const c of n.cours) {
      const cat = c.def.id === 'emc' ? 'emc' : c.def.role === 'dnl' ? 'dnl' : c.def.personnalise ? 'perso' : null;
      if (!cat) continue;
      for (const [d, h] of Object.entries(c.parDisc)) ajoutPool(d, cat, h * (n.parDisc[d] ? n.parDiscPond[d] / n.parDisc[d] : 1));
    }
    for (const [d, h] of Object.entries(missions.parDisc)) ajoutPool(d, 'missions', h);
    const couverture = calculerCouverture(etat, besoinsSecondaire, ens, primaire, pools);
    const cout = calculerCout(etat, couverture, primaire, missions);
    const statistiques = calculerStatistiques(etat, niveaux, primaire);
    return { statistiques, niveaux, primaire, totaux, totauxPond, total, totalPond, totauxSecondaire, totauxPondSecondaire, missions, besoins, besoinsSecondaire, besoinTotal, besoinSecondDegre,
      enseignants: ens, couverture, transferts: couverture.transferts, heuresOuvertes: pools, cout };
  }

  /** Coût indicatif annuel de la structure : ETP du second degré, postes PE, ASEM, primes. */
  function calculerCout(etat, couverture, primaire, missions) {
    const C = Object.assign({ etp2d: 0, etpPE: 0, asem: 0 }, etat.config.couts || {});
    const valeurImp = etat.config.etablissement?.valeurImp || 0;
    let etp2d = 0;
    for (const [d, c] of Object.entries(couverture)) if (d !== 'PE') etp2d += c.besoinETP;
    // enseignants spécialistes du primaire (langues, sections) : ETP à l'ORS de la discipline
    for (const [d, h] of Object.entries(primaire.parDisc)) if (d !== 'PE') etp2d += h / ors(etat, d);
    const parPoste = { second: etp2d * (C.etp2d || 0), pe: primaire.postesPE * (C.etpPE || 0), asem: primaire.asem * (C.asem || 0), primes: missions.imp * valeurImp };
    return { etp2d, postesPE: primaire.postesPE, asem: primaire.asem, imp: missions.imp, ...parPoste, total: parPoste.second + parPoste.pe + parPoste.asem + parPoste.primes, renseigne: !!(C.etp2d || C.etpPE || C.asem) };
  }

  /* ------------------------ État initial / presets ------------------------ */
  /** Construit un état complet à partir d'un preset du référentiel (id). */
  function etatInitial(idPreset) {
    const P = REFERENTIEL.presets.find(p => p.id === idPreset) || REFERENTIEL.presets[0];
    const etat = {
      preset: P.id,
      config: clone(P.config),
      reglages: (() => {
        const r = clone(REFERENTIEL.reglagesDefaut);
        for (const [k, v] of Object.entries(clone(P.reglages || {}))) r[k] = v && typeof v === 'object' && !Array.isArray(v) ? Object.assign(r[k] || {}, v) : v;
        return r;
      })(),
      niveaux: REFERENTIEL.niveaux.map(nv => {
        const ex = (P.structure && P.structure[nv.id]) || { div: 0, eff: 0 };
        return { id: nv.id, div: ex.div, eff: ex.eff, effClasses: null, plafondClasse: null,
          cours: Object.fromEntries(Object.entries(ex.cours || {}).map(([k, v]) => [k, clone(v)])) };
      }),
      ressources: Object.fromEntries(REFERENTIEL.disciplines.map(d => [d.id, clone((P.ressources && P.ressources[d.id]) || { apport: 0, postes: 0 })])),
      primaire: clone(P.primaire || { mode: 'auto', classes: [] }),
      enseignants: clone(P.enseignants || []),
      effectifs: { source: { type: 'theorique' }, theorique: null },
    };
    return etat;
  }

  /** Remplace le contenu d'un état en place (les références détenues par les pages restent valides). */
  function remplacer(etat, nouveau) {
    for (const k of Object.keys(etat)) delete etat[k];
    Object.assign(etat, clone(nouveau));
    return etat;
  }

  /** Complète un état chargé (ancienne version, niveaux ajoutés au catalogue…). */
  function normaliser(etat) {
    const base = etatInitial(etat && etat.preset);
    if (!etat || !etat.config || !Array.isArray(etat.niveaux)) return base;
    const lu = { config: etat.config, reglages: etat.reglages || {} };
    etat.config = Object.assign(clone(base.config), lu.config);
    if (!Array.isArray(etat.config.personnalises)) etat.config.personnalises = base.config.personnalises || [];
    if (!Array.isArray(etat.config.missions)) etat.config.missions = base.config.missions || [];
    for (const k of ['etablissement', 'niveaux', 'offre', 'dispositifs']) etat.config[k] = Object.assign({}, base.config[k], lu.config[k] || {});
    etat.reglages = Object.assign(clone(base.reglages), lu.reglages);
    for (const k of ['plafondClasse', 'plafondGroupe', 'ors', 'ib', 'margeParDivision', 'primaire', 'projection']) etat.reglages[k] = Object.assign({}, base.reglages[k], lu.reglages[k] || {});
    etat.config.couts = Object.assign({}, base.config.couts, lu.config.couts || {});
    if (!etat.primaire || !Array.isArray(etat.primaire.classes)) etat.primaire = base.primaire;
    if (!etat.effectifs || !etat.effectifs.source) etat.effectifs = base.effectifs;
    if (!Array.isArray(etat.enseignants)) etat.enseignants = base.enseignants;
    if (!Array.isArray(etat.reglages.statuts) || !etat.reglages.statuts.length) etat.reglages.statuts = base.reglages.statuts;
    etat.reglages.hsaMax = Object.assign({}, base.reglages.hsaMax, lu.reglages.hsaMax || {});
    etat.niveaux = base.niveaux.map(b => etat.niveaux.find(x => x.id === b.id) || b);
    etat.ressources = Object.assign(base.ressources, etat.ressources || {});
    return etat;
  }

  let LOCALE = 'fr-FR'; // format des nombres (fr-FR, en-GB…), réglé par le sélecteur de langue
  const definirLocale = l => { LOCALE = l || 'fr-FR'; };
  const fmt = (x, d = 1) => (Math.round(x * 10 ** d) / 10 ** d).toLocaleString(LOCALE, { minimumFractionDigits: 0, maximumFractionDigits: d });

  /** ORS applicable à une discipline (pour convertir des heures en équivalents temps plein). */
  const ors = (etat, disc) => etat.reglages.ors[disc] ?? etat.reglages.ors.defaut ?? 18;

  return { calculer, etatInitial, normaliser, remplacer, coursDuNiveau, niveauOuvert, offert, defNiveau, ors,
    optimiserPrimaire, calculerPrimaire, nommerClassesPrimaire, projeter, PRIM_IDS, reglesPrim, statutsDe, hsaMax, statutRecrutement, categorieStatut, reglesTransferts,
    repartir, regrouper, meilleurRegroupement, notation, fmt, definirLocale, clone, LETTRES,
    referentielActif, coursReferentiel, appliquerDisciplines, reglesSousService, semainesAn, DISCIPLINES_BASE, placerSpecialites, combinaisonsCouteuses, regleIB };
})();
