/* =====================================================================
   RÉFÉRENTIEL v2 — catalogue des niveaux, enseignements, offres,
   dispositifs et profils d'établissement.
   type : 'tc'  = suivi par toutes les divisions (classe entière et/ou groupes)
          'spe' = au choix des élèves (effectif, barrette de niveau)
          'opt' = option, section, dispositif (effectif, barrette de niveau)
   cat  : catégorie de plafond de groupe (LV, SCI, DED, SPE, OPT, IB)
   parts: ventilation des heures-prof par discipline (somme > 1 = co-intervention)
   offre: clé(s) d'offre qui conditionnent la présence du cours
   ===================================================================== */
const REFERENTIEL = (() => {
  const tc = (id, label, parts, h, cat = 'DED', gr = 0, x = {}) => ({ id, label, parts, h, type: 'tc', cat, gr, src: 'EN', ...x });
  const spe = (id, label, parts, h, eff, x = {}) => ({ id, label, parts, h, type: 'spe', cat: 'SPE', eff, groupe: 'spe', src: 'EN', ...x });
  const opt = (id, label, parts, h, eff, x = {}) => ({ id, label, parts, h, type: 'opt', cat: 'OPT', eff, section: 'Options', src: 'EN', ...x });
  const PE = { PE: 1 };

  const LANGUES = [['ESP', 'espagnol'], ['ALL', 'allemand'], ['CHI', 'chinois'], ['ITA', 'italien'], ['ARA', 'arabe']];
  /** LV2 / LVB : un cours au choix par langue offerte */
  const lv2 = (h, prefixe = 'LVB', extraOffre = null) => LANGUES.map(([d, n]) => ({
    id: `lv2-${d}`, label: `${prefixe} ${n}`, parts: { [d]: 1 }, h, type: 'spe', cat: 'LV', eff: 0, groupe: 'lv2', src: 'EN', alias: [n[0].toUpperCase() + n.slice(1), ...(d === 'CHI' ? ['Mandarin'] : [])],
    offre: extraOffre ? [`lv:${d}`, extraOffre] : `lv:${d}`
  }));

  /* ------------------------------ Niveaux ------------------------------ */
  const maternelle = (id, nom) => ({ id, nom, court: id.toUpperCase(), cycle: 'primaire', bloc: 'maternelle', marge: 0, exempleOuverture: { div: 2, eff: 48 },
    cours: [tc('dom', 'Domaines d\'apprentissage (programme maternelle)', PE, 24, 'DED', 0)] });
  const cycle2 = (id, nom) => ({ id, nom, court: id.toUpperCase(), cycle: 'primaire', bloc: 'elementaire', marge: 0, exempleOuverture: { div: 2, eff: 50 },
    cours: [
      tc('fr', 'Français', PE, 10), tc('ma', 'Mathématiques', PE, 5),
      tc('lv', 'Langue vivante (par le PE)', PE, 1.5, 'LV', 0, { offre: '!prim:lv-specialiste' }),
      tc('lvs', 'Langue vivante (enseignant spécialiste)', { ANG: 1 }, 1.5, 'LV', 0, { offre: 'prim:lv-specialiste' }),
      tc('eps', 'EPS', PE, 3), tc('art', 'Enseignements artistiques', PE, 2), tc('qlm', 'Questionner le monde, EMC', PE, 2.5),
    ] });
  const cycle3 = (id, nom) => ({ id, nom, court: id.toUpperCase(), cycle: 'primaire', bloc: 'elementaire', marge: 0, exempleOuverture: { div: 2, eff: 54 },
    cours: [
      tc('fr', 'Français', PE, 8), tc('ma', 'Mathématiques', PE, 5),
      tc('lv', 'Langue vivante (par le PE)', PE, 1.5, 'LV', 0, { offre: '!prim:lv-specialiste' }),
      tc('lvs', 'Langue vivante (enseignant spécialiste)', { ANG: 1 }, 1.5, 'LV', 0, { offre: 'prim:lv-specialiste' }),
      tc('eps', 'EPS', PE, 3), tc('art', 'Enseignements artistiques', PE, 2), tc('sci', 'Sciences et technologie', PE, 2), tc('hg', 'Histoire-géographie, EMC', PE, 2.5),
    ] });

  const college = (id, nom, h) => ({ id, nom, court: id, cycle: 'college', bloc: 'college', marge: 3, exempleOuverture: { div: 2, eff: 52 },
    controles: id === '6e' ? {} : { lv2: 1 },
    cours: [
      // réforme « groupes de besoins » en 6e-5e : désormais en classe entière par défaut (heures en groupes réglables niveau par niveau)
      tc('fr', 'Français', { LET: 1 }, h.fr, 'DED', 0),
      tc('ma', 'Mathématiques', { MAT: 1 }, h.ma, 'DED', 0),
      tc('lv1', 'LV1 anglais', { ANG: 1 }, h.lv1, 'LV', id === '6e' ? 0 : h.lv1, { alias: ['Anglais'] }),
      tc('hg', 'Histoire-géographie, EMC', { HG: 1 }, h.hg),
      ...(id === '6e'
        ? [tc('sci', 'SVT et physique-chimie', { SPC: 0.5, SVT: 0.5 }, 3, 'SCI', 0)]
        : [tc('svt', 'SVT', { SVT: 1 }, 1.5, 'SCI', 1.5), tc('pc', 'Physique-chimie', { SPC: 1 }, 1.5, 'SCI', 1.5), tc('tec', 'Technologie', { TEC: 1 }, 1.5, 'SCI', 1.5)]),
      tc('apl', 'Arts plastiques', { APL: 1 }, 1), tc('mus', 'Éducation musicale', { MUS: 1 }, 1),
      tc('eps', 'EPS', { EPS: 1 }, h.eps),
      ...(id === '6e' ? lv2(2, 'Bilangue LV2', 'opt:bilangue').map(c => ({ ...c, type: 'opt', section: 'Langues', groupe: undefined })) : lv2(2.5, 'LV2')),
      ...(id !== '6e' ? [opt('lat', 'Latin (LCA)', { LET: 1 }, h.lat, 25, { offre: 'opt:latin', alias: ['Latin'] })] : []),
      ...(id === '4e' || id === '3e' ? [opt('lce', 'Langues et cultures européennes', { ANG: 1 }, 2, 24, { offre: 'opt:lce', section: 'Langues' })] : []),
      opt('cho', 'Chant choral', { MUS: 1 }, 1, 30, { offre: 'opt:chorale', alias: ['Chorale'] }),
    ] });

  const LV_LYCEE = { '2nde': 2.5, '1g': 2, 'tg': 2 };
  const optionsLycee = id => [
    opt('lat', 'Latin (LCA)', { LET: 1 }, 3, 12, { offre: 'opt:latin-lycee', alias: ['Latin'] }),
    opt('the', 'Théâtre', { LET: 1 }, 3, 18, { offre: 'opt:theatre' }),
    opt('artp', 'Arts plastiques (option)', { APL: 1 }, 3, 18, { offre: 'opt:arts-lycee' }),
    opt('epso', 'EPS (option)', { EPS: 1 }, 3, 24, { offre: 'opt:eps-lycee' }),
    opt('lvc', 'LVC', { ESP: 1 }, 3, 15, { offre: 'opt:lvc', section: 'Langues' }),
  ];
  const spes = (h, effs) => [
    spe('s-hggsp', 'Spé HGGSP', { HG: 1 }, h, effs.hggsp ?? 0, { offre: 'spe:HGGSP', alias: ['Histoire géographie, géopolitique et sciences politiques', 'HGGSP'] }),
    spe('s-hlp', 'Spé HLP', { LET: 0.5, PHI: 0.5 }, h, effs.hlp ?? 0, { offre: 'spe:HLP', alias: ['Humanités, littérature et philosophie', 'HLP'] }),
    spe('s-llcer', 'Spé LLCER anglais', { ANG: 1 }, h, effs.llcer ?? 0, { offre: 'spe:LLCER', alias: ['Langues, littérature et cultures étrangères (ANGLAIS)', 'Langues, littératures et cultures étrangères et régionales anglais', 'LLCER anglais'] }),
    spe('s-llcerb', 'Spé LLCER espagnol', { ESP: 1 }, h, 0, { offre: 'spe:LLCER-ESP' }),
    spe('s-llca', 'Spé LLCA (latin, grec)', { LET: 1 }, h, 0, { offre: 'spe:LLCA' }),
    spe('s-ses', 'Spé SES', { SES: 1 }, h, effs.ses ?? 0, { offre: 'spe:SES', alias: ['Sciences économiques et sociales'] }),
    spe('s-ma', 'Spé mathématiques', { MAT: 1 }, h, effs.ma ?? 0, { offre: 'spe:MATHS', alias: ['Mathématiques'] }),
    spe('s-nsi', 'Spé NSI', { TEC: 1 }, h, effs.nsi ?? 0, { offre: 'spe:NSI', alias: ['Numérique et Sciences Informatiques (NSI)', 'Numérique et sciences informatiques', 'NSI'] }),
    spe('s-pc', 'Spé physique-chimie', { SPC: 1 }, h, effs.pc ?? 0, { offre: 'spe:PC', alias: ['Physique-chimie'] }),
    spe('s-svt', 'Spé SVT', { SVT: 1 }, h, effs.svt ?? 0, { offre: 'spe:SVT', alias: ['Sciences et vie de la terre', 'Sciences de la vie et de la Terre'] }),
    spe('s-si', 'Spé sciences de l\'ingénieur', { STI: 1 }, h, 0, { offre: 'spe:SI', alias: ['Sciences de l\'ingénieur'] }),
    spe('s-apl', 'Spé arts plastiques', { APL: 1 }, h, 0, { offre: 'spe:ARTS' }),
    spe('s-mus', 'Spé musique', { MUS: 1 }, h, 0, { offre: 'spe:MUSIQUE' }),
    spe('s-eppcs', 'Spé EPPCS', { EPS: 1 }, h, 0, { offre: 'spe:EPPCS' }),
  ];

  const techno = (id, nom, court, bloc, terminale, specialites, etlvDisc) => ({
    id, nom, court, cycle: 'lycee', filiere: bloc.toUpperCase(), bloc, cycleTerminal: true, marge: 8, margeEleves: { h: 8, pour: 29 },
    exempleOuverture: { div: 1, eff: 28 }, controles: { lv2: 1 },
    cours: [
      terminale ? tc('phi', 'Philosophie', { PHI: 1 }, 2) : tc('fr', 'Français', { LET: 1 }, 3),
      tc('hg', 'Histoire-géographie', { HG: 1 }, 1.5), tc('emc', 'EMC', { HG: 1 }, 0.5),
      tc('lva', 'LVA anglais', { ANG: 1 }, 1.5, 'LV', 0, { alias: ['Anglais'] }),
      ...lv2(1.5, 'LVB'),
      tc('etlv', 'ETLV (co-intervention)', { ANG: 1, [etlvDisc]: 1 }, 1, 'LV'),
      tc('eps', 'EPS', { EPS: 1 }, 2), tc('ma', 'Mathématiques', { MAT: 1 }, 3),
      ...specialites,
    ]
  });

  /* ------------------------------- IB DP ------------------------------- */
  const IB_MATIERES = [
    ['ENGA', 'Group 1 · English A', { ANG: 1 }], ['FRA', 'Group 1 · Français A', { LET: 1 }],
    ['FRB', 'Group 2 · French B / ab initio', { LET: 1 }], ['ESPB', 'Group 2 · Spanish B', { ESP: 1 }], ['CHIB', 'Group 2 · Mandarin B', { CHI: 1 }],
    ['ECO', 'Group 3 · Economics', { SES: 1 }], ['HIS', 'Group 3 · History', { HG: 1 }], ['GEO', 'Group 3 · Geography', { HG: 1 }], ['PSY', 'Group 3 · Psychology', { PHI: 1 }], ['BUS', 'Group 3 · Business Management', { ECO: 1 }],
    ['BIO', 'Group 4 · Biology', { SVT: 1 }], ['CHE', 'Group 4 · Chemistry', { SPC: 1 }], ['PHY', 'Group 4 · Physics', { SPC: 1 }], ['CS', 'Group 4 · Computer Science', { TEC: 1 }],
    ['MAA', 'Group 5 · Maths Analysis & Approaches', { MAT: 1 }], ['MAI', 'Group 5 · Maths Applications & Interpretation', { MAT: 1 }],
    ['VA', 'Group 6 · Visual Arts', { APL: 1 }], ['MUSI', 'Group 6 · Music', { MUS: 1 }],
  ];
  const ib = (id, nom, court) => ({
    id, nom, court, cycle: 'lycee', filiere: 'IB', bloc: 'ib', marge: 0, exempleOuverture: { div: 1, eff: 24 }, controles: { ib: 6 },
    cours: [
      tc('tok', 'Theory of Knowledge (TOK)', { PHI: 1 }, 1.5, 'IB', 0, { src: 'IB', hRegle: 'ib.TOK' }),
      ...IB_MATIERES.flatMap(([k, lib, parts]) => [
        { id: `ib-${k}-hl`, label: `${lib} HL`, parts, h: 4, hRegle: 'ib.HL', type: 'spe', cat: 'IB', eff: 0, groupe: 'ib', src: 'IB', offre: `ib:${k}` },
        { id: `ib-${k}-sl`, label: `${lib} SL`, parts, h: 3, hRegle: 'ib.SL', type: 'spe', cat: 'IB', eff: 0, groupe: 'ib', src: 'IB', offre: `ib:${k}` },
      ]),
      opt('ib-eps', 'EPS (établissement)', { EPS: 1 }, 2, 0, { offre: 'ib:eps', src: 'local' }),
    ]
  });

  const niveaux = [
    maternelle('ps', 'Petite section'), maternelle('ms', 'Moyenne section'), maternelle('gs', 'Grande section'),
    cycle2('cp', 'CP'), cycle2('ce1', 'CE1'), cycle2('ce2', 'CE2'), cycle3('cm1', 'CM1'), cycle3('cm2', 'CM2'),
    college('6e', '6e', { fr: 4.5, ma: 4.5, lv1: 4, hg: 3, eps: 4, frGroupes: true }),
    college('5e', '5e', { fr: 4.5, ma: 3.5, lv1: 3, hg: 3, eps: 3, frGroupes: true, lat: 1 }),
    college('4e', '4e', { fr: 4.5, ma: 3.5, lv1: 3, hg: 3, eps: 3, lat: 2 }),
    college('3e', '3e', { fr: 4, ma: 3.5, lv1: 3, hg: 3.5, eps: 3, lat: 3 }),
    { id: '2nde', nom: 'Seconde', court: '2nde', cycle: 'lycee', bloc: 'lyceeGT', marge: 12, exempleOuverture: { div: 2, eff: 64 }, controles: { lv2: 1 },
      cours: [
        tc('fr', 'Français', { LET: 1 }, 4), tc('ma', 'Mathématiques', { MAT: 1 }, 4), tc('hg', 'Histoire-géographie', { HG: 1 }, 3), tc('emc', 'EMC', { HG: 1 }, 0.5),
        tc('lva', 'LVA anglais', { ANG: 1 }, 3, 'LV', 3, { alias: ['Anglais'] }), tc('ses', 'SES', { SES: 1 }, 1.5, 'DED', 0, { alias: ['SES en anglais', 'SES en français'] }),
        tc('pc', 'Physique-chimie', { SPC: 1 }, 3, 'SCI', 0), tc('svt', 'SVT', { SVT: 1 }, 1.5, 'SCI', 0), tc('snt', 'SNT', { TEC: 1 }, 1.5, 'SCI', 0), tc('eps', 'EPS', { EPS: 1 }, 2),
        ...lv2(LV_LYCEE['2nde']), ...optionsLycee('2nde'),
        opt('mg', 'Management et gestion (option techno.)', { ECO: 1 }, 1.5, 15, { offre: 'opt2:MG' }),
        opt('sl', 'Sciences et laboratoire (option techno.)', { SPC: 1 }, 1.5, 15, { offre: 'opt2:SL' }),
        opt('si2', 'Sciences de l\'ingénieur (option techno.)', { STI: 1 }, 1.5, 15, { offre: 'opt2:SI' }),
        opt('cit', 'Création et innovation technologiques', { STI: 1 }, 1.5, 15, { offre: 'opt2:CIT' }),
        opt('bt', 'Biotechnologies (option techno.)', { BIO: 1 }, 1.5, 15, { offre: 'opt2:BIO' }),
        opt('ss', 'Santé et social (option techno.)', { BIO: 1 }, 1.5, 15, { offre: 'opt2:SS' }),
      ] },
    { id: '1g', nom: 'Première générale', court: '1ère', cycle: 'lycee', bloc: 'lyceeGT', cycleTerminal: true, marge: 8, exempleOuverture: { div: 2, eff: 64 }, controles: { lv2: 1, spe: 3 },
      cours: [
        tc('fr', 'Français', { LET: 1 }, 4), tc('hg', 'Histoire-géographie', { HG: 1 }, 3), tc('emc', 'EMC', { HG: 1 }, 0.5),
        tc('lva', 'LVA anglais', { ANG: 1 }, 2.5, 'LV', 2.5, { alias: ['Anglais'] }), tc('es', 'Enseignement scientifique', { SPC: 0.5, SVT: 0.5 }, 2, 'SCI', 0), tc('eps', 'EPS', { EPS: 1 }, 2),
        ...lv2(LV_LYCEE['1g']),
        spe('mspe', 'Maths dans l\'enseignement scientifique (sans spé maths)', { MAT: 1 }, 1.5, 0, { groupe: undefined }),
        ...spes(4, {}), ...optionsLycee('1g'),
      ] },
    { id: 'tg', nom: 'Terminale générale', court: 'Tle', cycle: 'lycee', bloc: 'lyceeGT', cycleTerminal: true, marge: 8, exempleOuverture: { div: 2, eff: 64 }, controles: { lv2: 1, spe: 2 },
      cours: [
        tc('phi', 'Philosophie', { PHI: 1 }, 4), tc('hg', 'Histoire-géographie', { HG: 1 }, 3), tc('emc', 'EMC', { HG: 1 }, 0.5),
        tc('lva', 'LVA anglais', { ANG: 1 }, 2, 'LV', 2, { alias: ['Anglais'] }), tc('es', 'Enseignement scientifique', { SPC: 0.5, SVT: 0.5 }, 2, 'SCI', 0), tc('eps', 'EPS', { EPS: 1 }, 2),
        ...lv2(LV_LYCEE.tg), ...spes(6, {}),
        spe('s-si-pc', 'Spé SI : physique-chimie', { SPC: 1 }, 2, 0, { offre: 'spe:SI', groupe: undefined }),
        opt('mex', 'Option maths expertes', { MAT: 1 }, 3, 0, { offre: 'opt:mex', alias: ['Mathématiques expertes'] }),
        opt('mco', 'Option maths complémentaires', { MAT: 1 }, 3, 0, { offre: 'opt:mco', alias: ['Mathématiques complémentaires'] }),
        opt('dgemc', 'Option DGEMC', { ECO: 1 }, 3, 0, { offre: 'opt:dgemc', alias: ['Droit et grands enjeux du monde contemporain'] }),
        ...optionsLycee('tg'),
      ] },
    techno('1t', 'Première STMG', '1STMG', 'stmg', false, [
      tc('sgn', 'Sciences de gestion et numérique', { ECO: 1 }, 7), tc('man', 'Management', { ECO: 1 }, 4), tc('dre', 'Droit et économie', { ECO: 1 }, 4)], 'ECO'),
    techno('tt', 'Terminale STMG', 'TSTMG', 'stmg', true, [
      tc('dre', 'Droit et économie', { ECO: 1 }, 6), tc('msgn', 'Management, sciences de gestion et numérique', { ECO: 1 }, 10)], 'ECO'),
    techno('1sti', 'Première STI2D', '1STI2D', 'sti2d', false, [
      tc('it', 'Innovation technologique', { STI: 1 }, 3), tc('i2d', 'Ingénierie et développement durable', { STI: 1 }, 9, 'SCI', 0), tc('pcm', 'Physique-chimie et mathématiques', { SPC: 0.5, MAT: 0.5 }, 6)], 'STI'),
    techno('tsti', 'Terminale STI2D', 'TSTI2D', 'sti2d', true, [
      tc('2i2d', 'Ingénierie, innovation et développement durable', { STI: 1 }, 12, 'SCI', 0), tc('pcm', 'Physique-chimie et mathématiques', { SPC: 0.5, MAT: 0.5 }, 6)], 'STI'),
    techno('1st2s', 'Première ST2S', '1ST2S', 'st2s', false, [
      tc('pcs', 'Physique-chimie pour la santé', { SPC: 1 }, 3), tc('bph', 'Biologie et physiopathologie humaines', { BIO: 1 }, 5), tc('stss', 'Sciences et techniques sanitaires et sociales', { BIO: 1 }, 7)], 'BIO'),
    techno('tst2s', 'Terminale ST2S', 'TST2S', 'st2s', true, [
      tc('cbph', 'Chimie, biologie et physiopathologie humaines', { BIO: 0.6, SPC: 0.4 }, 8), tc('stss', 'Sciences et techniques sanitaires et sociales', { BIO: 1 }, 8)], 'BIO'),
    ib('ib1', 'IB Diploma, année 1', 'IB1'), ib('ib2', 'IB Diploma, année 2', 'IB2'),
  ];

  /* ------------------------------- Offres ------------------------------ */
  const o = (cle, groupe, label, defaut, detail) => ({ cle, groupe, label, defaut, detail });
  const offres = [
    o('prim:lv-specialiste', 'Primaire', 'Langue vivante enseignée par un spécialiste', false, 'Sinon assurée par le professeur des écoles'),
    ...LANGUES.map(([d, n]) => o(`lv:${d}`, 'Langues vivantes 2 / B', n[0].toUpperCase() + n.slice(1), d === 'ESP' || d === 'ALL')),
    o('opt:bilangue', 'Langues vivantes 2 / B', 'Bilangue dès la 6e', false, 'LV2 2 h en 6e'),
    o('opt:lvc', 'Langues vivantes 2 / B', 'LVC au lycée', false, '3 h'),
    o('spe:HGGSP', 'Spécialités (voie générale)', 'HGGSP', true), o('spe:HLP', 'Spécialités (voie générale)', 'HLP', true),
    o('spe:LLCER', 'Spécialités (voie générale)', 'LLCER anglais', true), o('spe:LLCER-ESP', 'Spécialités (voie générale)', 'LLCER espagnol', false),
    o('spe:LLCA', 'Spécialités (voie générale)', 'LLCA latin / grec', false), o('spe:SES', 'Spécialités (voie générale)', 'SES', true),
    o('spe:MATHS', 'Spécialités (voie générale)', 'Mathématiques', true), o('spe:NSI', 'Spécialités (voie générale)', 'NSI', true),
    o('spe:PC', 'Spécialités (voie générale)', 'Physique-chimie', true), o('spe:SVT', 'Spécialités (voie générale)', 'SVT', true),
    o('spe:SI', 'Spécialités (voie générale)', 'Sciences de l\'ingénieur', false, '+2 h de physique-chimie en Tle'),
    o('spe:ARTS', 'Spécialités (voie générale)', 'Arts plastiques', false), o('spe:MUSIQUE', 'Spécialités (voie générale)', 'Musique', false),
    o('spe:EPPCS', 'Spécialités (voie générale)', 'EPPCS', false),
    o('opt:latin', 'Options collège', 'Latin (LCA)', true, '5e 1 h · 4e 2 h · 3e 3 h'), o('opt:lce', 'Options collège', 'LCE (4e-3e)', false, '2 h'),
    o('opt:chorale', 'Options collège', 'Chant choral', false, '1 h'),
    o('opt:latin-lycee', 'Options lycée', 'Latin (LCA)', true, '3 h'), o('opt:theatre', 'Options lycée', 'Théâtre', true, '3 h'),
    o('opt:arts-lycee', 'Options lycée', 'Arts plastiques', false, '3 h'), o('opt:eps-lycee', 'Options lycée', 'EPS', false, '3 h'),
    o('opt:mex', 'Options lycée', 'Maths expertes (Tle)', true, '3 h'), o('opt:mco', 'Options lycée', 'Maths complémentaires (Tle)', true, '3 h'),
    o('opt:dgemc', 'Options lycée', 'DGEMC (Tle)', false, '3 h'),
    o('opt2:MG', 'Options technologiques de 2nde', 'Management et gestion', false, '1 h 30'), o('opt2:SL', 'Options technologiques de 2nde', 'Sciences et laboratoire', false, '1 h 30'),
    o('opt2:SI', 'Options technologiques de 2nde', 'Sciences de l\'ingénieur', false, '1 h 30'), o('opt2:CIT', 'Options technologiques de 2nde', 'Création et innovation technologiques', false, '1 h 30'),
    o('opt2:BIO', 'Options technologiques de 2nde', 'Biotechnologies', false, '1 h 30'), o('opt2:SS', 'Options technologiques de 2nde', 'Santé et social', false, '1 h 30'),
    ...IB_MATIERES.map(([k, lib]) => o(`ib:${k}`, 'IB Diploma : matières', lib, ['ENGA', 'FRB', 'ECO', 'HIS', 'BIO', 'CHE', 'PHY', 'MAA', 'MAI', 'VA'].includes(k), 'HL et SL')),
    o('ib:eps', 'IB Diploma : matières', 'EPS d\'établissement', false, '2 h'),
  ];
  offres.forEach(x => {
    const nivs = niveaux.filter(n => n.cours.some(c => [].concat(c.offre || []).some(k => k === x.cle || k === '!' + x.cle))).map(n => n.id);
    x.niveaux = nivs.length ? nivs : null;
  });

  /* ---------------------------- Dispositifs ---------------------------- */
  const PRIM = ['cp', 'ce1', 'ce2', 'cm1', 'cm2'], COLL = ['6e', '5e', '4e', '3e'], LYC = ['2nde', '1g', 'tg'];
  const LANGUES_SECTION = ['ANG', 'ESP', 'ALL', 'CHI', 'ITA', 'ARA'];
  const dispositifs = [
    { id: 'si', nom: 'Section internationale', section: 'Internationale', src: 'EN',
      description: 'Élémentaire : au moins 3 h d\'enseignements spécifiques en langue de la section. Collège et 2nde : langue et littérature de la section, 4 h s\'ajoutant aux horaires normaux ; DNL (histoire-géographie, sauf sections chinoises : mathématiques) enseignée en partie dans la langue de la section. Au primaire, n\'activer que si les élèves de la section sont distincts (sinon label commun, sans heures propres).',
      niveauxPossibles: [...PRIM, ...COLL, '2nde'], niveauxDefaut: [...COLL], langueDefaut: 'ANG', languesPossibles: LANGUES_SECTION,
      dnlDefaut: ['HG'], dnlPossibles: ['HG', 'MAT', 'SVT', 'SPC'], effDefaut: 24, classesPures: true,
      composantes: [
        { id: 'lang', label: 'Langue et littérature de la section', role: 'langue', h: { primaire: 3, college: 4, lycee: 4 } },
        // DNL : au collège, horaire normal de la discipline dont la moitié en langue de la section → groupe propre aux élèves de la section
        // qui remplace le cours ordinaire ; en 2nde : HG 4 h à la place de l'horaire commun, maths et sciences +1,5 h en moyenne.
        { id: 'dnl', label: 'DNL en langue de la section', role: 'dnl', mode: 'dnl-si', h: {},
          regles: {
            HG: { college: { mode: 'substitution' }, lycee: { mode: 'substitution', h: 4 } },
            MAT: { college: { mode: 'substitution' }, lycee: { mode: 'ajout', h: 1.5 } },
            SPC: { college: { mode: 'substitution' }, lycee: { mode: 'ajout', h: 1.5 } },
            SVT: { college: { mode: 'substitution' }, lycee: { mode: 'ajout', h: 1.5 } },
          } },
      ] },
    { id: 'bfi', nom: 'Baccalauréat français international (BFI)', section: 'Internationale', src: 'EN', description: 'Connaissance du monde 2 h, approfondissement culturel et linguistique 2 h, DNL histoire-géographie en langue.',
      niveauxPossibles: ['1g', 'tg'], niveauxDefaut: ['1g', 'tg'], langueDefaut: 'ANG', languesPossibles: LANGUES_SECTION, dnlDefaut: ['HG'], dnlPossibles: ['HG', 'SPC', 'SVT'], effDefaut: 24,
      composantes: [
        { id: 'cdm', label: 'Connaissance du monde', role: 'langue', h: { lycee: 2 } },
        { id: 'acl', label: 'Approfondissement culturel et linguistique', role: 'langue', h: { lycee: 2 } },
        { id: 'dnl', label: 'DNL en langue (part en langue)', role: 'dnl', h: { lycee: 2 } },
      ] },
    { id: 'euro', nom: 'Section européenne / de langue orientale (SELO)', section: 'Européenne', src: 'local', description: 'Langue renforcée et discipline non linguistique en langue ; volumes fixés par l\'établissement.',
      niveauxPossibles: LYC, niveauxDefaut: LYC, langueDefaut: 'ANG', languesPossibles: LANGUES_SECTION, dnlDefaut: ['HG'], dnlPossibles: ['HG', 'MAT', 'SPC', 'SVT', 'SES', 'EPS'], effDefaut: 24,
      composantes: [
        { id: 'lv', label: 'Langue renforcée', role: 'langue', h: { lycee: 1 } },
        { id: 'dnl', label: 'DNL en langue', role: 'dnl', h: { lycee: 1 } },
      ] },
    { id: 'parle', nom: 'PARLE (AEFE)', section: 'Langues', src: 'local', description: 'Parcours d\'apprentissage renforcé des langues : exposition renforcée et EMILE/DNL, en co-intervention possible. Maxima AEFE : C2 2+3 h, C3 3+3 h, C4 3+4 h.',
      niveauxPossibles: [...PRIM, ...COLL], niveauxDefaut: ['5e', '4e', '3e'], langueDefaut: 'ANG', languesPossibles: LANGUES_SECTION, dnlDefaut: ['HG'], dnlPossibles: ['PE', 'HG', 'SVT', 'SPC', 'MAT', 'TEC', 'EPS', 'APL', 'MUS'],
      coInterventionDefaut: true, effDefaut: 48,
      composantes: [
        { id: 'lv', label: 'Langue renforcée', role: 'langue', h: { primaire: 2, college: 1 } },
        { id: 'emile', label: 'EMILE / DNL en langue', role: 'dnl', h: { primaire: 1, college: 1 } },
      ] },
    { id: 'renfort', nom: 'Langue renforcée pour toutes les classes', section: 'Langues', src: 'local', type: 'tc', description: 'Heures de langue ajoutées à toutes les classes des niveaux choisis (ex. programme australien étendu, anglais renforcé de la filière classique).',
      niveauxPossibles: ['ps', 'ms', 'gs', ...PRIM, ...COLL], niveauxDefaut: [...PRIM], langueDefaut: 'ANG', languesPossibles: LANGUES_SECTION,
      composantes: [{ id: 'lv', label: 'Heures de langue', role: 'langue', h: { primaire: 3, college: 1 }, gr: 0 }] },
    { id: 'hote', nom: 'Langue du pays hôte', section: 'Langues', src: 'local', type: 'tc', description: 'Enseignement hors grille recommandé par l\'AEFE de la maternelle à la terminale ; volume fixé localement.',
      niveauxPossibles: ['ps', 'ms', 'gs', ...PRIM, ...COLL, ...LYC], niveauxDefaut: [...PRIM, ...COLL],
      composantes: [{ id: 'lh', label: 'Langue du pays hôte', parts: { LVH: 1 }, h: { primaire: 2, college: 2, lycee: 1 }, gr: 0 }] },
    { id: 'binat', nom: 'Section binationale (Abibac, Bachibac, Esabac)', section: 'Internationale', src: 'EN', description: 'Langue et littérature (4 à 6 h) et histoire-géographie en langue (3 à 4 h, à la place de l\'HG ordinaire).',
      niveauxPossibles: LYC, niveauxDefaut: LYC, langueDefaut: 'ESP', languesPossibles: ['ALL', 'ESP', 'ITA'], dnlDefaut: ['HG'], dnlPossibles: ['HG'], effDefaut: 24,
      composantes: [
        { id: 'll', label: 'Langue et littérature', role: 'langue', h: { lycee: 4 } },
        { id: 'hg', label: 'Histoire-géographie en langue', role: 'dnl', h: { lycee: 4 } },
      ] },
    { id: 'sss', nom: 'Section sportive scolaire', section: 'Sport', src: 'EN', description: 'Au moins 3 h d\'entraînement par élève, en plus de l\'EPS.',
      niveauxPossibles: [...COLL, ...LYC], niveauxDefaut: ['4e', '3e'], effDefaut: 24,
      composantes: [{ id: 'ent', label: 'Entraînement', parts: { EPS: 1 }, h: { college: 3, lycee: 3 } }] },
    { id: 'flsco', nom: 'FLSco / FLE', section: 'Langues', src: 'local', description: 'Français langue de scolarisation pour les élèves allophones.',
      niveauxPossibles: [...PRIM, ...COLL, ...LYC], niveauxDefaut: [...COLL], effDefaut: 12,
      composantes: [{ id: 'fls', label: 'Français langue de scolarisation', parts: { LET: 1 }, h: { primaire: 2, college: 4, lycee: 2 } }] },
  ];

  /* ----------------------------- Profils ----------------------------- */
  const tousNiveaux = v => Object.fromEntries(niveaux.map(n => [n.id, v]));
  const mermoz = {
    id: 'mermoz', nom: 'Lycée Jean Mermoz — Dakar', sousTitre: 'Structure R2025 issue du classeur Besoins-2025-2026',
    config: {
      etablissement: { nom: 'Lycée Jean Mermoz', ville: 'Dakar', enveloppe: null, devise: '€', valeurImp: 1250 },
      niveaux: { ...tousNiveaux(false), cp: true, ce1: true, ce2: true, cm1: true, cm2: true, '6e': true, '5e': true, '4e': true, '3e': true, '2nde': true, '1g': true, tg: true, '1t': true, tt: true },
      offre: { 'lv:ESP': true, 'lv:ALL': true, 'opt:lce': true, 'opt:chorale': true },
      dispositifs: {
        si: { actif: true, niveaux: [...PRIM, ...COLL, '2nde'], langue: 'ANG', dnl: ['HG'], effDefaut: 48, eff: { cp: 24, ce1: 24, ce2: 24, cm1: 24, cm2: 24 } },
        bfi: { actif: true, niveaux: ['1g', 'tg'], langue: 'ANG', dnl: ['HG'], effDefaut: 48 },
        euro: { actif: true, niveaux: LYC, langue: 'ANG', dnl: ['HG'], eff: { '2nde': 43, '1g': 23, tg: 34 } },
        parle: { actif: true, niveaux: ['5e', '4e', '3e'], langue: 'ANG', dnl: ['HG'], coIntervention: false, heures: { lv: { college: 2 }, emile: { college: 0 } } },
        sss: { actif: true, niveaux: ['5e', '2nde'], eff: { '5e': 26, '2nde': 6 } },
      },
      personnalises: [
        { id: 'ap2', nom: 'Accompagnement personnalisé', actif: true, niveaux: ['2nde'], calcul: 'division', h: 1, parts: { LET: 0.5, MAT: 0.5 }, gr: 0 },
        { id: 'ap1', nom: 'Accompagnement personnalisé', actif: true, niveaux: ['1g'], calcul: 'division', h: 2, parts: { MAT: 0.25, SPC: 0.25, SES: 0.25, HG: 0.125, ANG: 0.125 }, gr: 0 },
        { id: 'apt', nom: 'Accompagnement personnalisé', actif: true, niveaux: ['tg'], calcul: 'division', h: 1.5, parts: { MAT: 0.2, SPC: 0.2, SES: 0.3, ANG: 0.1, HG: 0.1, SVT: 0.1 }, gr: 0 },
      ],
      missions: [
        { id: 'as', nom: 'Association sportive (forfait UNSS)', categorie: 'AS', actif: true, parts: { EPS: 1 }, base: 'forfait', unites: 9, h: 3, compensation: 'heures' },
        { id: 'coord', nom: 'Coordinations de discipline', categorie: 'Coordination', actif: true, parts: null, base: 'forfait', unites: 14, h: 1, compensation: 'prime', imp: 1 },
      ],
    },
    reglages: { plafondClasse: { primaire: 28, college: 28, lycee: 35, cp: 24, ce1: 26, ce2: 26 } },
    structure: {
      cp: { div: 5, eff: 118 }, ce1: { div: 6, eff: 150 }, ce2: { div: 6, eff: 150 }, cm1: { div: 6, eff: 162 }, cm2: { div: 6, eff: 162 },
      '6e': { div: 11, eff: 262 },
      '5e': { div: 10, eff: 268, cours: { 'lv2-ESP': { eff: 250 }, 'lv2-ALL': { eff: 18 }, lat: { eff: 40 }, cho: { eff: 30 }, 'parle.lv': { groupesFixes: 4 } } },
      '4e': { div: 10, eff: 272, cours: { 'lv2-ESP': { eff: 254 }, 'lv2-ALL': { eff: 18 }, lat: { eff: 25 }, lce: { eff: 26 }, 'parle.lv': { groupesFixes: 4 } } },
      '3e': { div: 9, eff: 246, cours: { 'lv2-ESP': { eff: 228 }, 'lv2-ALL': { eff: 18 }, lat: { eff: 22 }, lce: { eff: 42 }, 'parle.lv': { groupesFixes: 4 } } },
      '2nde': { div: 8, eff: 252, cours: { 'lv2-ESP': { eff: 236 }, 'lv2-ALL': { eff: 16 }, fr: { gr: 1 }, ma: { gr: 1 }, hg: { gr: 1 }, emc: { gr: 0.5 }, pc: { gr: 1.5 }, svt: { gr: 1.5 }, snt: { gr: 1 }, lat: { eff: 15 }, the: { eff: 20 } } },
      '1g': { div: 6, eff: 190, cours: { 'lv2-ESP': { eff: 176 }, 'lv2-ALL': { eff: 14 }, fr: { gr: 1 }, emc: { gr: 0.5 }, es: { gr: 1 }, mspe: { eff: 43 },
        's-hggsp': { eff: 49 }, 's-hlp': { eff: 18 }, 's-llcer': { eff: 59 }, 's-ses': { eff: 90 }, 's-ma': { eff: 147 }, 's-nsi': { eff: 57 }, 's-pc': { eff: 93 }, 's-svt': { eff: 57 }, lat: { eff: 12 }, the: { eff: 20 } } },
      tg: { div: 7, eff: 216, cours: { 'lv2-ESP': { eff: 202 }, 'lv2-ALL': { eff: 14 }, emc: { gr: 0.5 }, es: { gr: 1 },
        's-hggsp': { eff: 46 }, 's-hlp': { eff: 21 }, 's-llcer': { eff: 43 }, 's-ses': { eff: 79 }, 's-ma': { eff: 113 }, 's-nsi': { eff: 13 }, 's-pc': { eff: 76 }, 's-svt': { eff: 41 },
        mex: { eff: 31 }, mco: { eff: 47 }, lat: { eff: 10 }, the: { eff: 15 } } },
      '1t': { div: 1, eff: 30, cours: { 'lv2-ESP': { eff: 30 } } }, tt: { div: 2, eff: 48, cours: { 'lv2-ESP': { eff: 48 } } },
    },
    ressources: { ANG: { apport: 327, postes: 20 }, MAT: { apport: 291, postes: 17 }, LET: { apport: 286.5, postes: 17 }, HG: { apport: 257, postes: 15 }, EPS: { apport: 199, postes: 11 },
      SPC: { apport: 183, postes: 11 }, ESP: { apport: 162, postes: 10 }, SVT: { apport: 154.5, postes: 10 }, TEC: { apport: 90, postes: 6 }, ECO: { apport: 58, postes: 5 },
      APL: { apport: 39, postes: 3 }, MUS: { apport: 39, postes: 3 }, SES: { apport: 45, postes: 3 }, PHI: { apport: 36, postes: 2 }, ALL: { apport: 15, postes: 1 }, PE: { apport: 0, postes: 29 } },
  };

  /* Statuts des enseignants : obligation réglementaire de service à temps plein et possibilité d'HSA */
  const STATUTS = [
    { id: 'certifie', nom: 'Résident certifié', ors: 18, categorie: 'detache' },
    { id: 'agrege', nom: 'Résident agrégé', ors: 15, categorie: 'detache' },
    { id: 'eps', nom: 'Résident EPS', ors: 20, categorie: 'detache' },
    { id: 'expat', nom: 'Expatrié', ors: 18, categorie: 'detache' },
    { id: 'tnr', nom: 'Titulaire non résident (TNR)', ors: 18, categorie: 'local' },
    { id: 'contractuel', nom: 'Contractuel local', ors: 18, categorie: 'local' },
    { id: 'vacataire', nom: 'Vacataire', ors: 18, categorie: 'local' },
    { id: 'pe', nom: 'Professeur des écoles', ors: 24, categorie: 'pe' },
  ];
  /* Enseignants du second degré de Sydney, anonymisés, d'après la feuille « Teachers Costs » (rentrée 2026-2027) :
     [statut, quotité, { discipline: heures de la matière }] — la quotité rapporte le service contractuel à l'ORS du statut */
  const ENS_LCS = [
    ['agrege', 1, { PHI: 15 }], ['contractuel', 1, { LET: 22.5 }], ['tnr', 1, { LET: 21 }], ['certifie', 1, { LET: 19 }], ['certifie', 1, { LET: 19.5 }],
    ['tnr', 1, { LET: 22 }], ['contractuel', 1, { LET: 22 }], ['tnr', 1, { LET: 10.5, HG: 11.5 }], ['tnr', 1, { LET: 22 }],
    ['certifie', 1, { MAT: 18.9 }], ['certifie', 1, { MAT: 22.6 }], ['tnr', 1, { MAT: 23.25 }], ['tnr', 1, { MAT: 18, TEC: 6 }], ['tnr', 17 / 22, { MAT: 17 }],
    ['contractuel', 20 / 22, { MAT: 18 }], ['tnr', 1, { MAT: 13, SVT: 9 }], ['tnr', 1, { MAT: 22.5 }],
    ['tnr', 1, { SPC: 22.5 }], ['tnr', 1, { SPC: 22.75 }], ['contractuel', 1, { TEC: 23.5 }], ['contractuel', 11.5 / 22, { SPC: 4.5, SVT: 4.5 }],
    ['agrege', 1, { SVT: 18 }], ['tnr', 21.5 / 22, { SVT: 16.5 }],
    ['tnr', 1, { HG: 22 }], ['contractuel', 1, { HG: 6.5, ANG: 9 }], ['contractuel', 1, { HG: 15, ANG: 6.5 }], ['certifie', 1, { HG: 19 }], ['agrege', 1, { HG: 4.5 }], ['tnr', 1, { HG: 22 }],
    ['contractuel', 1, { SES: 22 }], ['contractuel', 14 / 22, { SES: 12 }],
    ['certifie', 1, { ANG: 18.4 }], ['contractuel', 1, { ANG: 22 }], ['contractuel', 1, { ANG: 13 }], ['contractuel', 1, { ANG: 21 }], ['contractuel', 15 / 22, { ANG: 12.5 }],
    ['contractuel', 1, { ANG: 22 }], ['contractuel', 1, { ANG: 22 }], ['contractuel', 1, { ANG: 16 }], ['contractuel', 1, { ANG: 15.4, PHI: 6.6 }],
    ['contractuel', 1, { ESP: 22.5 }], ['contractuel', 1, { ESP: 22.5 }], ['contractuel', 14 / 22, { ALL: 12.5 }], ['contractuel', 19.5 / 22, { CHI: 17.5 }],
    ['eps', 17 / 20, { EPS: 18 }], ['eps', 1, { EPS: 20 }], ['tnr', 1, { EPS: 22 }], ['tnr', 1, { EPS: 22 }], ['tnr', 1, { EPS: 22 }],
    ['contractuel', 18 / 22, { MUS: 19 }], ['contractuel', 21 / 22, { APL: 22 }], ['contractuel', 9 / 22, { SPC: 9 }], ['contractuel', 9 / 22, { SPC: 9 }], ['contractuel', 13 / 22, { ANG: 6.5, HG: 8.5 }],
  ];
  const nomsDisc = { LET: 'Lettres', PHI: 'Philosophie', MAT: 'Maths', TEC: 'Techno', SPC: 'Phys.-chimie', SVT: 'SVT', HG: 'Hist.-géo', SES: 'SES', ANG: 'Anglais', ESP: 'Espagnol', ALL: 'Allemand', CHI: 'Chinois', EPS: 'EPS', MUS: 'Musique', APL: 'Arts plast.' };
  const enseignantsLCS = (() => {
    const compte = {};
    return ENS_LCS.map(([statut, quotite, heures], i) => {
      const principale = Object.entries(heures).sort((a, b) => b[1] - a[1])[0][0];
      compte[principale] = (compte[principale] || 0) + 1;
      return { id: 'lcs' + i, nom: `${nomsDisc[principale]} ${compte[principale]}`, statut, quotite: Math.round(quotite * 1000) / 1000, decharge: 0, parts: heures };
    });
  })();

  /* Effectifs réels LCS (EDUKA, 30 septembre ; 24 août pour 2026-2027) : [général, britannique, européenne, IB] par niveau du simulateur */
  const SIM_NIV = ['PS', 'MS', 'GS', 'CP', 'CE1', 'CE2', 'CM1', 'CM2', '6e', '5e', '4e', '3e', '2nde', '1ere', 'Tle'];
  const LCS_REEL = {
    '2021-09-30': 'PS=74/0/0/0 MS=95/0/0/0 GS=100/0/0/0 CP=101/0/0/0 CE1=101/0/0/0 CE2=93/0/0/0 CM1=77/0/0/0 CM2=69/0/0/0 6e=78/0/0/0 5e=66/0/0/0 4e=49/0/0/0 3e=55/0/0/0 2nde=0/0/59/0 1ere=0/0/24/11 Tle=0/0/31/11',
    '2022-09-30': 'PS=73/0/0/0 MS=96/0/0/0 GS=94/0/0/0 CP=98/0/0/0 CE1=107/0/0/0 CE2=99/0/0/0 CM1=94/0/0/0 CM2=73/0/0/0 6e=70/0/0/0 5e=77/0/0/0 4e=63/0/0/0 3e=47/0/0/0 2nde=0/0/53/0 1ere=0/0/41/22 Tle=0/0/25/11',
    '2023-09-30': 'PS=57/0/0/0 MS=100/0/0/0 GS=99/0/0/0 CP=95/0/0/0 CE1=96/0/0/0 CE2=102/0/0/0 CM1=97/0/0/0 CM2=92/0/0/0 6e=69/0/0/0 5e=69/0/0/0 4e=67/0/0/0 3e=61/0/0/0 2nde=48/0/0/0 1ere=36/0/0/18 Tle=41/0/0/21',
    '2024-09-30': 'PS=60/0/0/0 MS=99/0/0/0 GS=118/0/0/0 CP=99/0/0/0 CE1=96/0/0/0 CE2=99/0/0/0 CM1=104/0/0/0 CM2=104/0/0/0 6e=95/0/0/0 5e=72/0/0/0 4e=73/0/0/0 3e=64/0/0/0 2nde=56/0/0/0 1ere=35/0/0/14 Tle=37/0/0/18',
    '2025-09-30': 'PS=60/0/0/0 MS=99/0/0/0 GS=104/0/0/0 CP=119/0/0/0 CE1=105/0/0/0 CE2=97/0/0/0 CM1=104/0/0/0 CM2=102/0/0/0 6e=25/78/0/0 5e=22/63/0/0 4e=14/47/0/0 3e=14/60/0/0 2nde=36/29/0/0 1ere=0/9/26/19 Tle=4/14/19/15',
    '2026-08-24': 'PS=71/0/0/0 MS=100/0/0/0 GS=100/0/0/0 CP=102/0/0/0 CE1=119/0/0/0 CE2=102/0/0/0 CM1=99/0/0/0 CM2=104/0/0/0 6e=30/74/0/0 5e=23/84/0/0 4e=22/64/0/0 3e=15/49/0/0 2nde=26/42/0/0 1ere=1/10/38/23 Tle=4/9/25/18',
  };
  const lireSim = s => Object.fromEntries(s.split(' ').map(x => { const [k, v] = x.split('='); const [g, b, e, i] = v.split('/').map(Number); return [k, { general: g, british: b, european: e, ib: i }]; }));
  const CLASSES_LCS_2026 = [
    ['MPS A', { ps: 23 }], ['MPS B', { ps: 25 }], ['MPA A', { ps: 11, ms: 13 }], ['MPA B', { ps: 6, ms: 7, gs: 12 }], ['MPA C', { ps: 6, ms: 7, gs: 13 }],
    ['MMS A', { ms: 25 }], ['MMS B', { ms: 25 }], ['MMS C', { ms: 23 }], ['MGS A', { gs: 25 }], ['MGS B', { gs: 25 }], ['MGS C', { gs: 25 }],
    ['CP A', { cp: 26 }], ['CP B', { cp: 26 }], ['CP C', { cp: 26 }], ['CP D', { cp: 24 }],
    ['CE1 A', { ce1: 24 }], ['CE1 B', { ce1: 23 }], ['CE1 C', { ce1: 24 }], ['CE1 D', { ce1: 24 }], ['CE1 E', { ce1: 24 }],
    ['CE2 A', { ce2: 25 }], ['CE2 B', { ce2: 26 }], ['CE2 C', { ce2: 26 }], ['CE2 D', { ce2: 25 }],
    ['CM1 A', { cm1: 25 }], ['CM1 B', { cm1: 25 }], ['CM1 C', { cm1: 25 }], ['CM1 D', { cm1: 24 }],
    ['CM2 A', { cm2: 26 }], ['CM2 B', { cm2: 26 }], ['CM2 C', { cm2: 26 }], ['CM2 D', { cm2: 26 }],
  ].map(([nom, niveaux], i) => ({ id: 'lcs' + i, nom, nomAuto: false, niveaux }));
  /* Scénario d'exemple : montée de cohorte avec la rétention moyenne des 3 dernières années (totaux par niveau du simulateur) */
  const LCS_COHORTE = {
    '2027-2028': [64, 120, 108, 100, 104, 119, 105, 101, 105, 103, 104, 87, 61, 70, 75],
    '2028-2029': [64, 108, 130, 108, 102, 104, 123, 107, 102, 104, 100, 105, 83, 63, 73],
    '2029-2030': [64, 108, 117, 129, 111, 102, 107, 125, 108, 101, 101, 101, 100, 86, 65],
    '2030-2031': [64, 108, 117, 117, 132, 111, 105, 109, 127, 107, 98, 102, 96, 103, 89],
    '2031-2032': [64, 108, 117, 117, 120, 133, 114, 107, 111, 126, 104, 99, 97, 99, 107],
  };
  const PARTS_2026 = { '6e': [.29, .71, 0, 0], '5e': [.215, .785, 0, 0], '4e': [.256, .744, 0, 0], '3e': [.234, .766, 0, 0], '2nde': [.382, .618, 0, 0], '1ere': [.014, .139, .528, .319], 'Tle': [.071, .161, .446, .322] };
  const scenarioCohorte = {
    id: 'exemple-cohorte', nom: 'Exemple : montée de cohorte (rétention moyenne 3 ans)', source: 'Généré à partir des effectifs réels 2023-2027', exemple: true,
    annees: Object.fromEntries(Object.entries(LCS_COHORTE).map(([a, tot]) => [a, Object.fromEntries(SIM_NIV.map((k, i) => {
      const p = PARTS_2026[k] || [1, 0, 0, 0];
      const b = Math.round(tot[i] * p[1]), e = Math.round(tot[i] * p[2]), ib = Math.round(tot[i] * p[3]);
      return [k, { general: tot[i] - b - e - ib, british: b, european: e, ib }];
    }))]))
  };

  const condorcet = {
    id: 'condorcet', nom: 'Lycée Condorcet — Sydney', sousTitre: 'Effectifs réels EDUKA du 24/08/2026 ; classes du primaire réelles',
    donnees: {
      imports: Object.entries(LCS_REEL).map(([date, s]) => ({ date, libelle: date === '2026-08-24' ? 'EDUKA — rentrée' : 'EDUKA — 30 septembre', source: 'Prospective Effectifs LCS',
        parSimulateur: lireSim(s), classes: date === '2026-08-24' ? CLASSES_LCS_2026.map(c => ({ nom: c.nom, niveaux: c.niveaux })) : null })),
      projections: [scenarioCohorte],
    },
    primaire: { mode: 'manuel', classes: CLASSES_LCS_2026 },
    enseignants: enseignantsLCS,
    config: {
      couts: { etp2d: 125000, etpPE: 110000, asem: 62000, exemple: true },
      etablissement: { nom: 'Lycée Condorcet', ville: 'Sydney', enveloppe: 855, devise: 'A$', valeurImp: 2000 },
      niveaux: { ...tousNiveaux(false), ps: true, ms: true, gs: true, cp: true, ce1: true, ce2: true, cm1: true, cm2: true, '6e': true, '5e': true, '4e': true, '3e': true, '2nde': true, '1g': true, tg: true, ib1: true, ib2: true },
      offre: { 'prim:lv-specialiste': true, 'lv:ESP': true, 'lv:ALL': true, 'lv:CHI': true, 'opt:bilangue': true, 'opt:theatre': false, 'opt:dgemc': true, 'opt:latin-lycee': true, 'ib:PSY': true },
      dispositifs: {
        renfort: { actif: true, niveaux: ['ps', 'ms', 'gs', ...PRIM], langue: 'ANG', heures: { lv: { primaire: 6.5 } } },
        si: { actif: true, niveaux: [...COLL, '2nde'], langue: 'ANG', dnl: ['MAT'], eff: { '6e': 74, '5e': 84, '4e': 64, '3e': 49, '2nde': 42 },
          // classes composées uniquement d'élèves de la section (liste élèves du 18/09/2026 : 6e A et C, 5e A et C, 4e D)
          classesPures: { '6e': 2, '5e': 2, '4e': 1, '3e': 0, '2nde': 0 } },
        bfi: { actif: true, niveaux: ['1g', 'tg'], langue: 'ANG', dnl: ['MAT'], eff: { '1g': 10, tg: 9 } },
        euro: { actif: true, niveaux: ['1g', 'tg'], langue: 'ANG', dnl: ['HG'], eff: { '1g': 38, tg: 25 } },
        flsco: { actif: true, niveaux: [...COLL, '2nde', '1g'], effDefaut: 12, heures: { fls: { college: 4, lycee: 3 } } },
        sss: { actif: true, niveaux: ['6e', '5e', '4e', '3e'], effDefaut: 12 },
      },
      personnalises: [
        { id: 'devoirs', nom: 'Devoirs faits', actif: false, niveaux: ['6e', '5e'], calcul: 'forfait', h: 1, groupes: 2, parts: { LET: 0.5, MAT: 0.5 } },
      ],
      missions: [
        { id: 'dialogue', nom: 'Heures de dialogue (à la place de l\'AP)', categorie: 'Pédagogie', actif: true, parts: null, base: 'enseignant', h: 1, compensation: 'heures' },
        { id: 'pp', nom: 'Professeur principal (heure)', categorie: 'Suivi des élèves', actif: true, parts: null, base: 'forfait', unites: 6, h: 1, compensation: 'heures' },
        { id: 'coordlm', nom: 'Coordinations de discipline', categorie: 'Coordination', actif: true, parts: null, base: 'forfait', unites: 12, h: 2, compensation: 'mixte', partHeures: 0.75, imp: 1 },
        { id: 'coordib', nom: 'Coordination IB (DP, CAS, Extended Essay)', categorie: 'Coordination', actif: true, parts: { ANG: 1 }, base: 'forfait', unites: 1, h: 14, compensation: 'heures' },
        { id: 'as', nom: 'Association sportive', categorie: 'AS', actif: true, parts: { EPS: 1 }, base: 'forfait', unites: 5.5, h: 3, compensation: 'heures' },
        { id: 'aaeh', nom: 'Projets AAEH / Passerelle CPGE', categorie: 'Projet', actif: true, parts: { MAT: 0.4, SPC: 0.4, LET: 0.2 }, base: 'forfait', unites: 1, h: 2, compensation: 'heures' },
        { id: 'prozap', nom: 'Préparation Prozap', categorie: 'Projet', actif: true, parts: null, base: 'forfait', unites: 1, h: 1, compensation: 'heures' },
        { id: 'chorale', nom: 'Chorale et robotique', categorie: 'Projet', actif: true, parts: { MUS: 0.5, TEC: 0.5 }, base: 'forfait', unites: 1, h: 2, compensation: 'heures' },
      ],
    },
    reglages: { plafondClasse: { primaire: 26, college: 28, lycee: 26, ib1: 30, ib2: 30 }, plafondGroupe: { LV: 22, SCI: 20, DED: 22, SPE: 26, OPT: 24, IB: 18 },
      ors: { defaut: 22, EPS: 22, PE: 24 }, ponderationPlafonnee: true,
      statuts: STATUTS.map(s => ['tnr', 'contractuel'].includes(s.id) ? { ...s, ors: 22 } : s),
      primaire: { multiniveau: true, maxNiveaux: 3, traverserCycles: false, plafondMulti: 26, effMin: 0, asem: { ps: 2, ms: 2, gs: 1 }, lvMode: 'decharge' } },
    structure: {
      ps: { div: 0, eff: 71 }, ms: { div: 0, eff: 100 }, gs: { div: 0, eff: 100 },
      cp: { div: 0, eff: 102 }, ce1: { div: 0, eff: 119 }, ce2: { div: 0, eff: 102 }, cm1: { div: 0, eff: 99 }, cm2: { div: 0, eff: 104 },
      '6e': { div: 4, eff: 104, cours: { 'lv2-ESP': { eff: 42 }, 'lv2-ALL': { eff: 25 }, 'lv2-CHI': { eff: 37 } } },
      '5e': { div: 4, eff: 107, cours: { 'lv2-ESP': { eff: 47 }, 'lv2-ALL': { eff: 26 }, 'lv2-CHI': { eff: 34 }, lat: { eff: 20 } } },
      '4e': { div: 4, eff: 86, cours: { 'lv2-ESP': { eff: 39 }, 'lv2-ALL': { eff: 19 }, 'lv2-CHI': { eff: 28 }, lat: { eff: 16 } } },
      '3e': { div: 3, eff: 64, cours: { 'lv2-ESP': { eff: 34 }, 'lv2-ALL': { eff: 13 }, 'lv2-CHI': { eff: 17 }, lat: { eff: 12 } } },
      '2nde': { div: 3, eff: 68, cours: { 'lv2-ESP': { eff: 35 }, 'lv2-ALL': { eff: 14 }, 'lv2-CHI': { eff: 19 }, pc: { gr: 1 }, svt: { gr: 1.5 }, snt: { gr: 1.5 } } },
      '1g': { div: 2, eff: 49, cours: { 'lv2-ESP': { eff: 24 }, 'lv2-ALL': { eff: 11 }, 'lv2-CHI': { eff: 14 }, mspe: { eff: 11 },
        's-hggsp': { eff: 17 }, 's-hlp': { eff: 9 }, 's-llcer': { eff: 15 }, 's-ses': { eff: 23 }, 's-ma': { eff: 38 }, 's-nsi': { eff: 9 }, 's-pc': { eff: 22 }, 's-svt': { eff: 14 } } },
      tg: { div: 2, eff: 38, cours: { 'lv2-ESP': { eff: 18 }, 'lv2-ALL': { eff: 9 }, 'lv2-CHI': { eff: 11 },
        's-hggsp': { eff: 11 }, 's-hlp': { eff: 6 }, 's-llcer': { eff: 9 }, 's-ses': { eff: 15 }, 's-ma': { eff: 20 }, 's-nsi': { eff: 5 }, 's-pc': { eff: 7 }, 's-svt': { eff: 3 },
        mex: { eff: 8 }, mco: { eff: 9 }, dgemc: { eff: 6 } } },
      ib1: { div: 1, eff: 23, cours: { 'ib-ENGA-hl': { eff: 9 }, 'ib-ENGA-sl': { eff: 14 }, 'ib-FRB-hl': { eff: 10 }, 'ib-FRB-sl': { eff: 13 }, 'ib-ECO-hl': { eff: 8 }, 'ib-ECO-sl': { eff: 7 }, 'ib-HIS-sl': { eff: 9 }, 'ib-PSY-sl': { eff: 6 },
        'ib-BIO-hl': { eff: 8 }, 'ib-BIO-sl': { eff: 3 }, 'ib-CHE-sl': { eff: 6 }, 'ib-PHY-sl': { eff: 6 }, 'ib-MAA-hl': { eff: 8 }, 'ib-MAI-sl': { eff: 15 }, 'ib-VA-hl': { eff: 5 }, 'ib-VA-sl': { eff: 11 } } },
      ib2: { div: 1, eff: 18, cours: { 'ib-ENGA-hl': { eff: 7 }, 'ib-ENGA-sl': { eff: 11 }, 'ib-FRB-hl': { eff: 8 }, 'ib-FRB-sl': { eff: 10 }, 'ib-ECO-hl': { eff: 6 }, 'ib-ECO-sl': { eff: 5 }, 'ib-HIS-sl': { eff: 7 }, 'ib-PSY-sl': { eff: 5 },
        'ib-BIO-hl': { eff: 6 }, 'ib-BIO-sl': { eff: 2 }, 'ib-CHE-sl': { eff: 5 }, 'ib-PHY-sl': { eff: 5 }, 'ib-MAA-hl': { eff: 6 }, 'ib-MAI-sl': { eff: 12 }, 'ib-VA-hl': { eff: 4 }, 'ib-VA-sl': { eff: 9 } } },
    },
    ressources: { LET: { apport: 145, postes: 9 }, PHI: { apport: 15, postes: 1 }, MAT: { apport: 147, postes: 9 }, SPC: { apport: 54, postes: 4 }, SVT: { apport: 54, postes: 3 },
      TEC: { apport: 22, postes: 1 }, HG: { apport: 104, postes: 8 }, SES: { apport: 25, postes: 2 }, ANG: { apport: 170, postes: 15 }, ESP: { apport: 33, postes: 2 },
      ALL: { apport: 12.5, postes: 1 }, CHI: { apport: 15.5, postes: 1 }, EPS: { apport: 92, postes: 6 }, MUS: { apport: 15, postes: 1 }, APL: { apport: 11, postes: 1 }, PE: { apport: 0, postes: 21 } },
  };

  const vierge = {
    id: 'vierge', nom: 'Établissement vierge', sousTitre: 'Collège et lycée général, sans dispositif ; à configurer',
    config: { etablissement: { nom: 'Nouvel établissement', ville: '', enveloppe: null, devise: '€', valeurImp: 1250 },
      niveaux: { ...tousNiveaux(false), '6e': true, '5e': true, '4e': true, '3e': true, '2nde': true, '1g': true, tg: true },
      offre: {}, dispositifs: {}, personnalises: [], missions: [] },
    structure: Object.fromEntries(['6e', '5e', '4e', '3e', '2nde', '1g', 'tg'].map(id => [id, { div: 3, eff: 84 }])),
  };

  return {
    disciplines: [
      { id: 'PE', nom: 'Prof. des écoles', fam: 'primaire', degre: 1 },
      { id: 'LET', nom: 'Lettres', fam: 'lettres', degre: 2 },
      { id: 'ANG', nom: 'Anglais', fam: 'langues', degre: 2 },
      { id: 'ESP', nom: 'Espagnol', fam: 'langues', degre: 2 },
      { id: 'ALL', nom: 'Allemand', fam: 'langues', degre: 2 },
      { id: 'CHI', nom: 'Chinois', fam: 'langues', degre: 2 },
      { id: 'ITA', nom: 'Italien', fam: 'langues', degre: 2 },
      { id: 'ARA', nom: 'Arabe', fam: 'langues', degre: 2 },
      { id: 'LVH', nom: 'Langue hôte', fam: 'langues', degre: 2 },
      { id: 'HG', nom: 'Hist.-géo', fam: 'humanites', degre: 2 },
      { id: 'PHI', nom: 'Philo', fam: 'humanites', degre: 2 },
      { id: 'SES', nom: 'SES', fam: 'humanites', degre: 2 },
      { id: 'ECO', nom: 'Éco-gestion', fam: 'humanites', degre: 2 },
      { id: 'MAT', nom: 'Maths', fam: 'sciences', degre: 2 },
      { id: 'SPC', nom: 'Phys.-chimie', fam: 'sciences', degre: 2 },
      { id: 'SVT', nom: 'SVT', fam: 'sciences', degre: 2 },
      { id: 'TEC', nom: 'Techno / NSI', fam: 'sciences', degre: 2 },
      { id: 'STI', nom: 'Sc. industrielles', fam: 'sciences', degre: 2 },
      { id: 'BIO', nom: 'Biotech. / SMS', fam: 'sciences', degre: 2 },
      { id: 'APL', nom: 'Arts plast.', fam: 'arts', degre: 2 },
      { id: 'MUS', nom: 'Musique', fam: 'arts', degre: 2 },
      { id: 'EPS', nom: 'EPS', fam: 'eps', degre: 2 },
    ],
    categories: { LV: 'Langues vivantes', SCI: 'Sciences expérimentales', DED: 'Dédoublements / groupes de besoins', SPE: 'Spécialités', OPT: 'Options & sections', IB: 'Cours IB' },
    libellesControles: { lv2: 'Langue vivante 2 / B', spe: 'Spécialités', ib: 'Matières IB (6 par élève)' },
    sources: [
      { cycle: 'primaire', niveau: 'Primaire', texte: 'Arrêté du 9 novembre 2015 : 24 h hebdomadaires ; cycle 2 français 10 h, maths 5 h, LV 1 h 30, EPS 3 h, arts 2 h, questionner le monde 2 h 30 ; cycle 3 français 8 h, maths 5 h, sciences 2 h, HG-EMC 2 h 30. Nouvelle grille de cycle 2 en CP à la rentrée 2026 (arrêté du 12 juin 2026). Sections internationales : au moins 3 h en langue de section.' },
      { cycle: 'college', niveau: 'Collège', texte: 'Arrêté du 19 mai 2015 modifié le 4 avril 2025 : 6e 25 h, cycle 4 26 h, français et maths en groupes en 6e-5e, marge 3 h par division.' },
      { cycle: 'lycee', niveau: '2nde GT', texte: 'Arrêté du 16 juillet 2018 modifié : 26 h 30, marge 12 h par division, options technologiques 1 h 30.' },
      { cycle: 'lycee', niveau: 'Voie générale', texte: 'Spécialités 3 × 4 h puis 2 × 6 h ; maths 1 h 30 dans l\'ES en 1ère ; marge 8 h par division.' },
      { cycle: 'lycee', niveau: 'Voie technologique', texte: 'BO n°29 du 19 juillet 2018 : tronc commun 14 h / 13 h dont 1 h d\'ETLV ; STMG, STI2D, ST2S ; marge 8 h pour 29 élèves.' },
      { cycle: 'lycee', niveau: 'BFI', texte: 'Arrêté du 6 août 2021 : connaissance du monde 2 h, approfondissement culturel et linguistique 2 h, DNL HG 4 h dont moitié en langue.' },
      { cycle: 'lycee', niveau: 'IB Diploma', texte: 'IBO : HL 240 h, SL 150 h sur deux ans, TOK 100 h ; converti en 4 h / 3 h / 1 h 30 par semaine (pratique de Condorcet Sydney).' },
      { cycle: 'tous', niveau: 'Services', texte: 'Décret 2014-940 : pondération 1,1 h en cycle terminal, hors EPS, allègement plafonné à 1 h ; 2 HSA imposables. Professeurs des écoles : 24 h + 108 h annuelles.' },
      { cycle: 'tous', niveau: 'AEFE', texte: 'Parcours Langues (2018) : PARLE, maxima C2 2+3 h, C3 3+3 h, C4 3+4 h ; langue du pays hôte hors grille.' },
    ],
    reglagesDefaut: {
      plafondClasse: { primaire: 26, college: 28, lycee: 35 },
      plafondGroupe: { LV: 24, SCI: 22, DED: 24, SPE: 32, OPT: 30, IB: 20 },
      maxBloc: 4, ponderation: true, ponderationPlafonnee: false,
      ors: { defaut: 18, EPS: 20, PE: 24 },
      ib: { HL: 4, SL: 3, TOK: 1.5 },
      margeParDivision: {},
      primaire: { multiniveau: true, maxNiveaux: 3, traverserCycles: false, plafondMulti: null, effMin: 0, asem: { ps: 1, ms: 1, gs: 1 }, lvMode: 'decharge' },
      projection: { mode: 'stabilite', tolerance: 0, seuilFermeture: 0.9 },
      hsaMax: { defaut: 2 },
      statuts: STATUTS,
      statutRecrutement: 'contractuel',
    },
    statutsDefaut: STATUTS,
    blocsStructure: [
      { id: 'maternelle', nom: 'Maternelle', niveaux: ['ps', 'ms', 'gs'] },
      { id: 'elementaire', nom: 'Élémentaire', niveaux: ['cp', 'ce1', 'ce2', 'cm1', 'cm2'] },
      { id: 'college', nom: 'Collège', niveaux: ['6e', '5e', '4e', '3e'] },
      { id: 'lyceeGT', nom: 'Lycée général', niveaux: ['2nde', '1g', 'tg'] },
      { id: 'stmg', nom: 'Série STMG', niveaux: ['1t', 'tt'] },
      { id: 'sti2d', nom: 'Série STI2D', niveaux: ['1sti', 'tsti'] },
      { id: 'st2s', nom: 'Série ST2S', niveaux: ['1st2s', 'tst2s'] },
      { id: 'ib', nom: 'IB Diploma Programme', niveaux: ['ib1', 'ib2'], note: 'Cursus séparé en anglais, hors Éducation nationale' },
    ],
    categoriesMissions: ['Coordination', 'Pédagogie', 'Suivi des élèves', 'AS', 'Projet', 'Autre'],
    /** Correspondance des niveaux du simulateur d'effectifs (feuille « Projections ») avec les niveaux de l'outil */
    simulateur: {
      niveaux: SIM_NIV,
      vers: { PS: 'ps', MS: 'ms', GS: 'gs', CP: 'cp', CE1: 'ce1', CE2: 'ce2', CM1: 'cm1', CM2: 'cm2', '6e': '6e', '5e': '5e', '4e': '4e', '3e': '3e', '2nde': '2nde', '1ere': '1g', Tle: 'tg' },
      ib: { '1ere': 'ib1', Tle: 'ib2' },
      /** section du simulateur → dispositif de l'outil, selon le cycle */
      sections: { british: { college: 'si', '2nde': 'si', '1g': 'bfi', tg: 'bfi' }, european: { lycee: 'euro' } },
    },
    niveaux, offres, dispositifs,
    presets: [condorcet, mermoz, vierge], // le premier est chargé par défaut
  };
})();
