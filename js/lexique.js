/* LeSacAMicroMed - lexique : commandes vocales et vocabulaire medical/scientifique
   Toutes les listes sont modifiables ici ; le dictionnaire personnel (reglages)
   s'ajoute a ces listes et prime sur elles.
   ©2026 LESACA Julien - Tous droits reserves. */
'use strict';

(function (root) {
  /* ------------------------------------------------------------------
     COMMANDES VOCALES
     id      : identifiant interne
     group   : rubrique affichee dans l'aide
     say     : formulations reconnues (la premiere est celle affichee)
     guard   : (facultatif) nom d'un garde-fou contextuel (voir pipeline.js)
     ------------------------------------------------------------------ */
  const COMMANDS = [
    // Ponctuation
    { id: 'p_dot_nl', group: 'Ponctuation', label: '. puis à la ligne', say: ['point à la ligne', 'point retour à la ligne'] },
    { id: 'p_dot_par', group: 'Ponctuation', label: '. puis nouveau paragraphe', say: ['point nouveau paragraphe', 'point paragraphe'] },
    { id: 'p_semi', group: 'Ponctuation', label: ';', say: ['point-virgule', 'point virgule'] },
    { id: 'p_q', group: 'Ponctuation', label: '?', say: ["point d'interrogation"] },
    { id: 'p_excl', group: 'Ponctuation', label: '!', say: ["point d'exclamation"] },
    { id: 'p_ellipsis', group: 'Ponctuation', label: '…', say: ['points de suspension'] },
    { id: 'p_dot', group: 'Ponctuation', label: '.', say: ['point final', 'point'], guard: 'point' },
    { id: 'p_comma', group: 'Ponctuation', label: ',', say: ['virgule'] },
    { id: 'p_colon', group: 'Ponctuation', label: ':', say: ['deux-points', 'deux points'], guard: 'deuxPoints' },
    { id: 'p_lpar', group: 'Ponctuation', label: '(', say: ['ouvrez la parenthèse', 'ouvrir la parenthèse', 'ouvre la parenthèse', 'ouvrir parenthèse', 'ouvre parenthèse', 'parenthèse ouvrante'] },
    { id: 'p_rpar', group: 'Ponctuation', label: ')', say: ['fermez la parenthèse', 'fermer la parenthèse', 'ferme la parenthèse', 'fermer parenthèse', 'ferme parenthèse', 'parenthèse fermante'] },
    { id: 'p_lquote', group: 'Ponctuation', label: '« ', say: ['ouvrez les guillemets', 'ouvrir les guillemets', 'ouvre les guillemets', 'ouvrez guillemets', 'ouvrir guillemets'] },
    { id: 'p_rquote', group: 'Ponctuation', label: ' »', say: ['fermez les guillemets', 'fermer les guillemets', 'ferme les guillemets', 'fermez guillemets', 'fermer guillemets'] },
    { id: 'p_hyphen', group: 'Ponctuation', label: '- (trait d\'union, sans espace)', say: ["trait d'union"] },
    { id: 'p_dash', group: 'Ponctuation', label: '– (tiret)', say: ['tiret'] },
    { id: 'p_slash', group: 'Ponctuation', label: '/', say: ['barre oblique', 'slash'] },
    { id: 'p_apos', group: 'Ponctuation', label: '’ (apostrophe)', say: ['apostrophe'] },

    // Mise en page
    { id: 'nl', group: 'Mise en page', label: 'Retour à la ligne', say: ['à la ligne', 'retour à la ligne', 'nouvelle ligne'] },
    { id: 'par', group: 'Mise en page', label: 'Nouveau paragraphe', say: ['nouveau paragraphe', 'paragraphe suivant', 'saut de paragraphe'] },
    { id: 'h_on', group: 'Mise en page', label: 'Début de titre', say: ['nouveau titre', 'début de titre', 'début titre'] },
    { id: 'h_off', group: 'Mise en page', label: 'Fin de titre (retour au texte)', say: ['fin du titre', 'fin de titre', 'fin titre'] },
    { id: 'ul', group: 'Mise en page', label: 'Liste à puces', say: ['liste à puces', 'début de liste', 'début liste'] },
    { id: 'ol', group: 'Mise en page', label: 'Liste numérotée', say: ['liste numérotée'] },
    { id: 'li', group: 'Mise en page', label: 'Élément suivant de la liste', say: ['puce suivante', 'élément suivant', 'numéro suivant'] },
    { id: 'list_off', group: 'Mise en page', label: 'Fin de liste', say: ['fin de la liste', 'fin de liste', 'fin liste'] },

    // Mise en forme
    { id: 'b_on', group: 'Mise en forme', label: 'Gras : début', say: ['début du gras', 'début gras', 'mettre en gras', 'mets en gras', 'en gras'] },
    { id: 'b_off', group: 'Mise en forme', label: 'Gras : fin', say: ['fin du gras', 'fin de gras', 'fin gras'] },
    { id: 'i_on', group: 'Mise en forme', label: 'Italique : début', say: ["début de l'italique", 'début italique', 'mettre en italique', 'mets en italique', 'en italique'] },
    { id: 'i_off', group: 'Mise en forme', label: 'Italique : fin', say: ["fin de l'italique", "fin d'italique", 'fin italique'] },
    { id: 'u_on', group: 'Mise en forme', label: 'Souligné : début', say: ['début du souligné', 'début souligné', 'mettre en souligné', 'souligner'] },
    { id: 'u_off', group: 'Mise en forme', label: 'Souligné : fin', say: ['fin du souligné', 'fin de souligné', 'fin souligné'] },
    { id: 'cap_next', group: 'Mise en forme', label: 'Majuscule au mot suivant', say: ['majuscule'] },
    { id: 'caps_on', group: 'Mise en forme', label: 'Tout en majuscules : début', say: ['tout en majuscules', 'début majuscules', 'début des majuscules'] },
    { id: 'caps_off', group: 'Mise en forme', label: 'Tout en majuscules : fin', say: ['fin des majuscules', 'fin majuscules'] },

    // Correction
    { id: 'del_word', group: 'Correction', label: 'Effacer le dernier mot', say: ['efface le dernier mot', 'effacer le dernier mot', 'supprime le dernier mot', 'supprimer le dernier mot'] },
    { id: 'del_sentence', group: 'Correction', label: 'Effacer la dernière phrase', say: ['efface la dernière phrase', 'effacer la dernière phrase', 'supprime la dernière phrase', 'supprimer la dernière phrase'] },
    { id: 'undo', group: 'Correction', label: 'Annuler la dernière action', say: ['annule la dernière action', 'annuler la dernière action', 'annule ça'] },
    { id: 'redo', group: 'Correction', label: 'Rétablir', say: ['rétablis', 'rétablir la dernière action'] },

    // Textes types
    { id: 'field_next', group: 'Textes types', label: 'Aller au champ à compléter suivant', say: ['champ suivant', 'prochain champ', 'champ d\'après'] },

    // Actions
    { id: 'copy', group: 'Actions', label: 'Copier le texte enrichi', say: ['copie le texte', 'copier le texte', 'copie tout', 'copier tout'] },
    { id: 'check', group: 'Actions', label: 'Vérifier orthographe et grammaire', say: ['vérifie le texte', 'vérifier le texte', "vérifie l'orthographe", "vérifier l'orthographe"] },
    { id: 'stop', group: 'Actions', label: 'Arrêter la dictée', say: ['arrête la dictée', 'arrêter la dictée', 'fin de la dictée', 'fin de dictée', 'stop dictée'] }
    // + « insère <nom> » / « insérer <nom> » : texte type (réglages > Textes types)
  ];

  /* ------------------------------------------------------------------
     SIGLES ET ACRONYMES : ecrits en capitales (ou casse indiquee).
     Ceux de 3 lettres ou plus sont aussi reconnus epeles (« i r m » -> IRM).
     ------------------------------------------------------------------ */
  const ACRONYMS = [
    // Examens
    'ECG', 'EEG', 'EMG', 'ETT', 'ETO', 'IRM', 'TDM', 'TEP', 'ASP', 'FOGD', 'CPRE', 'EFR', 'ENMG', 'PL', 'ECBU', 'ECBC',
    'RT-PCR', 'PCR', 'NFS', 'CRP', 'PCT', 'VS', 'INR', 'TCA', 'TP', 'BNP', 'ASAT', 'ALAT', 'GGT', 'PAL', 'LDH', 'CPK',
    'TSH', 'LDL', 'HDL', 'DFG', 'MDRD', 'CKD-EPI', 'HLA', 'ADN', 'ARN', 'PSA', 'ACE', 'AFP', 'BHCG', 'IGF', 'ANCA', 'AAN',
    // Pathologies et syndromes
    'HTA', 'HTAP', 'BPCO', 'AVC', 'AIT', 'IDM', 'SCA', 'IVG', 'ICA', 'ICC', 'IRA', 'IRC', 'MRC', 'EP', 'TVP', 'MTEV', 'FA',
    'ACFA', 'BAV', 'BBD', 'BBG', 'TV', 'FV', 'ACR', 'RCP', 'SDRA', 'SAOS', 'RGO', 'MICI', 'HTIC', 'SEP', 'SLA', 'LED', 'PR',
    'PPR', 'DT1', 'DT2', 'DID', 'DNID', 'IST', 'VIH', 'SIDA', 'VHA', 'VHB', 'VHC', 'CMV', 'EBV', 'HSV', 'VZV', 'HPV', 'VRS',
    'SARM', 'BLSE', 'EPC', 'BMR', 'BHRe', 'TC', 'AEG', 'OMI', 'OAP', 'TSA', 'TDAH', 'TOC',
    // Soins, scores, organisation
    'IOT', 'VNI', 'VAC', 'PVC', 'PICC', 'PAC', 'CCI', 'KTC', 'SAD', 'SNG', 'IV', 'IVD', 'IVSE', 'IM', 'SC', 'PO', 'AINS',
    'IEC', 'ARA2', 'AVK', 'AOD', 'HBPM', 'HNF', 'IPP', 'ISRS', 'ATB', 'CTC', 'EVA', 'EN', 'GCS', 'NIHSS', 'ASA', 'IMC',
    'SAU', 'SMUR', 'SAMU', 'UHCD', 'USIC', 'USC', 'HDJ', 'EHPAD', 'SSR', 'HAD', 'IDE', 'AS', 'MT', 'CHU', 'CH', 'RAD',
    'CAT', 'ATCD', 'TTT', 'BU', 'FC', 'FR', 'PA', 'PAS', 'PAD', 'PAM', 'TA', 'SpO2', 'SaO2', 'PaO2', 'PaCO2', 'FiO2',
    'EtCO2', 'HbA1c', 'IgA', 'IgE', 'IgG', 'IgM', 'NT-proBNP', 'pH', 'T3', 'T4', 'ST', 'QRS', 'QTc'
  ];
  /* Sigles qui sont aussi des mots courants : jamais convertis depuis les minuscules
     (« pas », « ira », « ta », « en », « as », « bu »...). Dictez-les epeles ou ajoutez
     une regle au dictionnaire personnel. Les sigles de 2 lettres ne sont convertis
     depuis les minuscules que s'ils figurent dans SAFE_2. */
  const NO_LOWER = ['PAS', 'IRA', 'TOC', 'PAL', 'LED', 'SAD', 'TA', 'EN', 'AS', 'BU', 'SAS'];
  const SAFE_2 = ['FC', 'PL', 'TP', 'SC', 'IV', 'IM', 'PO', 'TV', 'FV', 'MT', 'TC', 'EP', 'PR', 'VS', 'CH', 'FA', 'FR', 'PA', 'ST', 'MT'];

  /* ------------------------------------------------------------------
     CORRECTIONS LEXICALES : [forme dictee (expression reguliere, insensible
     a la casse, mots entiers), forme ecrite]. Appliquees dans l'ordre.
     ------------------------------------------------------------------ */
  const LEXICON = [
    // Notations composees
    ['nt[ -]?pro[ -]?bnp', 'NT-proBNP'],
    ['sars[ -]?cov[ -]?2|sars[ -]?cov[ -]?deux', 'SARS-CoV-2'],
    ['covid[ -]?19|covid[ -]?dix-neuf', 'COVID-19'],
    ['h[ ]?b[ ]?a[ ]?1[ ]?c|hb a un c|hémoglobine a1c', 'HbA1c'],
    ['sp[ ]?o2|sp[ ]?o 2|sp[ ]?o deux|sp02', 'SpO2'],
    ['sa[ ]?o2|sao 2', 'SaO2'],
    ['pa[ ]?o2|pao 2', 'PaO2'],
    ['pa[ ]?co2|paco 2', 'PaCO2'],
    ['fi[ ]?o2|fio 2', 'FiO2'],
    ['et[ ]?co2', 'EtCO2'],
    ['d[ -]dimères?', 'D-dimères'],
    ['qt[ ]?c|qt corrigé', 'QTc'],
    ['st plus', 'ST+'],
    ['st moins', 'ST−'],
    ['ara 2|ara ii|ara deux', 'ARA2'],
    ['dt 2|dt deux', 'DT2'],
    ['dt 1|dt un', 'DT1'],
    ['rt[ -]pcr', 'RT-PCR'],
    ['ckd[ -]epi', 'CKD-EPI'],
    ['beta[ -]?hcg|bêta[ -]?hcg', 'β-hCG'],
    ['j ?(\\d+)', 'J$1'],
    ['et al(?!\\.)', 'et al.'],

    // Eponymes (majuscule)
    ['guillain[ -]barré', 'Guillain-Barré'],
    ['creutzfeldt[ -]jakob', 'Creutzfeldt-Jakob'],
    ['wolff[ -]parkinson[ -]white', 'Wolff-Parkinson-White'],
    ['glasgow', 'Glasgow'], ['lasègue', 'Lasègue'], ['babinski', 'Babinski'], ['murphy', 'Murphy'],
    ['mac ?burney|mc ?burney', 'McBurney'], ['blumberg', 'Blumberg'], ['romberg', 'Romberg'],
    ['parkinson', 'Parkinson'], ['alzheimer', 'Alzheimer'], ['crohn', 'Crohn'], ['basedow', 'Basedow'],
    ['hashimoto', 'Hashimoto'], ['cushing', 'Cushing'], ['addison', 'Addison'], ['horton', 'Horton'],
    ['kawasaki', 'Kawasaki'], ['apgar', 'Apgar'], ['silverman', 'Silverman'], ['bishop', 'Bishop'],
    ['wells', 'Wells'], ['sokolow', 'Sokolow'], ['brugada', 'Brugada'], ['kernig', 'Kernig'],
    ['brudzinski', 'Brudzinski'], ['hoffmann', 'Hoffmann'], ['tinel', 'Tinel'], ['phalen', 'Phalen'],
    ['giordano', 'Giordano'], ['virchow', 'Virchow'], ['korsakoff', 'Korsakoff'], ['wernicke', 'Wernicke'],
    ['broca', 'Broca'], ['raynaud', 'Raynaud'], ['sjögren|sjogren', 'Sjögren'], ['biermer', 'Biermer'],
    ['hodgkin', 'Hodgkin'], ['kaposi', 'Kaposi'], ['lyme', 'Lyme'], ['quincke', 'Quincke'],
    ['douglas', 'Douglas'], ['fallot', 'Fallot'], ['marfan', 'Marfan'],

    // Prefixes soudes (usage medical et rectifications orthographiques de 1990)
    ['post[ -]opératoires?', m => m.replace(/post[ -]/i, 'post')],
    ['pré[ -]opératoires?', m => m.replace(/pré[ -]/i, 'pré')],
    ['per[ -]opératoires?', m => m.replace(/per[ -]/i, 'per')],
    ['intra[ -](veineu(?:x|se|ses)|musculaires?|dermiques?|osseu(?:x|se|ses)|thécales?|crâniens?|crânienne?s?|hospitaliers?|hospitalières?|utérins?|utérines?|articulaires?)', m => m.replace(/intra[ -]/i, 'intra')],
    ['anti[ -](coagulants?|coagulation|agrégants?|agrégation|biotiques?|biothérapie|hypertenseurs?|diabétiques?|épileptiques?|dépresseurs?|psychotiques?|pyrétiques?|émétiques?|vitamine k|histaminiques?|arythmiques?|fongiques?|viraux|viral|virale|spasmodiques?|tussifs?|vertigineux)', m => m.replace(/anti[ -]/i, 'anti')],
    ['anti[ -]inflammatoires?', m => m.replace(/anti[ -]/i, 'anti-')],
    ['b[eê]ta[ -]bloquants?', m => m.replace(/b[eê]ta[ -]/i, 'bêta')],
    ['b[eê]ta[ -]lactamines?', m => m.replace(/b[eê]ta[ -]/i, 'bêta-')],
    ['b[eê]ta[ -]2[ -]mimétiques?|b[eê]ta[ -]deux[ -]mimétiques?', m => 'bêta-2-mimétique' + (/s$/i.test(m) ? 's' : '')],
    ['sus[ -]décalages?', m => m.replace(/sus[ -]/i, 'sus-')],
    ['sous[ -]décalages?', m => m.replace(/sous[ -]/i, 'sous-')],
    ['sous[ -]cutané(e?s?)', 'sous-cutané$1'],
    ['auto[ -]immun(e?s?)', 'auto-immun$1'],
    ['électro[ -]cardiogrammes?', m => m.replace(/électro[ -]/i, 'électro')],
    ['électro[ -]encéphalogrammes?', m => m.replace(/électro[ -]/i, 'électro')],
    ['hyper[ -]tension', 'hypertension'],
    ['hypo[ -]tension', 'hypotension'],
    ['hyper[ -]glycémies?', m => m.replace(/hyper[ -]/i, 'hyper')],
    ['hypo[ -]glycémies?', m => m.replace(/hypo[ -]/i, 'hypo')],
    ['rachi[ -]anesthésies?', m => m.replace(/rachi[ -]/i, 'rachi')],
    ['broncho[ -]pneumopathies?', m => m.replace(/broncho[ -]/i, 'broncho')],
    ['angio[ -]scanners?', m => m.replace(/angio[ -]/i, 'angio')],
    ['angio[ -]irm', 'angio-IRM'],
    // doppler : nom commun invariable, en minuscule ; seule exception, l'effet Doppler
    // (verifie par l'utilisateur sur le Dictionnaire de l'Academie nationale de medecine)
    ['écho[ -]dopplers?', 'écho-doppler'],
    ['effet[ ]+dopplers?|dopplers?', m => /^effet/i.test(m) ? m.replace(/dopplers?$/i, 'Doppler') : 'doppler'],
  ];

  /* Unites apres un nombre (« 5 milligrammes » -> « 5 mg ») */
  const UNITS = [
    ['milligrammes? par kilos? par jour|milligrammes? par kilogrammes? par jour', 'mg/kg/j'],
    ['milligrammes? par kilos?|milligrammes? par kilogrammes?', 'mg/kg'],
    ['milligrammes? par litre', 'mg/L'],
    ['milligrammes? par jour', 'mg/j'],
    ['milligrammes?', 'mg'],
    ['microgrammes? par kilos? par minute|microgrammes? par kilogrammes? par minute', 'µg/kg/min'],
    ['microgrammes? par litre', 'µg/L'],
    ['microgrammes?|gammas?', 'µg'],
    ['grammes? par litre', 'g/L'],
    ['grammes? par décilitre', 'g/dL'],
    ['grammes? par jour', 'g/j'],
    ['grammes?', 'g'],
    ['kilogrammes?|kilos?', 'kg'],
    ['millilitres? par heure', 'mL/h'],
    ['millilitres? par minute', 'mL/min'],
    ['millilitres? par kilos?', 'mL/kg'],
    ['millilitres?', 'mL'],
    ['litres? par minute', 'L/min'],
    ['litres?', 'L'],
    ['millimoles? par litre', 'mmol/L'],
    ['micromoles? par litre', 'µmol/L'],
    ['milliéquivalents? par litre', 'mEq/L'],
    ['millimètres? de mercure', 'mmHg'],
    ['centimètres? d\'eau', 'cmH2O'],
    ['millimètres?', 'mm'],
    ['centimètres?', 'cm'],
    ['battements? par minute', 'bpm'],
    ['cycles? par minute', 'cycles/min'],
    ['degrés? celsius|degrés?', '°C'],
    ['pour ?cent|pourcents?', '%'],
    ['unités internationales|u ?i', 'UI'],
    ['millisecondes?', 'ms'],
    ['mégabecquerels?', 'MBq'],
    ['milligrays?', 'mGy'],
    ['grays?', 'Gy']
  ];

  /* Mots medicaux a ne jamais signaler comme fautes (verificateur en ligne) */
  const MEDICAL_WORDS = [
    'dépressible', 'apyrétique', 'eupnéique', 'normocarde', 'normotendu', 'normotendue', 'tachycarde', 'bradycarde',
    'polypnéique', 'subfébrile', 'fébricule', 'asthénie', 'anorexie', 'amaigrissement', 'dyspnée', 'orthopnée',
    'hémoptysie', 'hématémèse', 'méléna', 'rectorragie', 'hématurie', 'dysurie', 'pollakiurie', 'oligurie', 'anurie',
    'céphalées', 'photophobie', 'phonophobie', 'acouphènes', 'vertiges', 'paresthésies', 'hypoesthésie', 'dysarthrie',
    'aphasie', 'hémiparésie', 'hémiplégie', 'paraparésie', 'tétraparésie', 'ataxie', 'nystagmus', 'mydriase', 'myosis',
    'anisocorie', 'ptosis', 'diplopie', 'paracétamol', 'amoxicilline', 'ceftriaxone', 'céfotaxime', 'gentamicine',
    'vancomycine', 'métronidazole', 'enoxaparine', 'énoxaparine', 'tinzaparine', 'apixaban', 'rivaroxaban', 'dabigatran',
    'fluindione', 'warfarine', 'furosémide', 'bisoprolol', 'aténolol', 'ramipril', 'périndopril', 'amlodipine',
    'metformine', 'insuline', 'atorvastatine', 'rosuvastatine', 'oméprazole', 'ésoméprazole', 'pantoprazole',
    'tramadol', 'morphine', 'oxycodone', 'kétoprofène', 'ibuprofène', 'prednisolone', 'prednisone', 'méthylprednisolone',
    'hydrocortisone', 'salbutamol', 'ipratropium', 'lévothyroxine', 'allopurinol', 'colchicine', 'amiodarone', 'digoxine',
    'noradrénaline', 'adrénaline', 'dobutamine', 'midazolam', 'propofol', 'kétamine', 'sufentanil', 'rocuronium',
    'céfazoline', 'pipéracilline', 'tazobactam', 'méropénème', 'ciprofloxacine', 'lévofloxacine', 'clindamycine',
    'cotrimoxazole', 'azithromycine', 'clarithromycine', 'doxycycline', 'fosfomycine', 'nitrofurantoïne',
    'thrombopénie', 'leucocytose', 'hyperleucocytose', 'lymphopénie', 'neutropénie', 'hyponatrémie', 'hypernatrémie',
    'hypokaliémie', 'hyperkaliémie', 'hypocalcémie', 'hypercalcémie', 'créatininémie', 'natrémie', 'kaliémie',
    'glycémie', 'troponine', 'lipasémie', 'bilirubinémie', 'cholestase', 'cytolyse', 'procalcitonine', 'ferritine',
    'échographie', 'scanner', 'radiographie', 'coronarographie', 'angioplastie', 'thrombolyse', 'thrombectomie',
    'cholécystectomie', 'appendicectomie', 'cœlioscopie', 'laparotomie', 'sigmoïdite', 'diverticulite', 'pyélonéphrite',
    'prostatite', 'cholécystite', 'angiocholite', 'pancréatite', 'péritonite', 'endocardite', 'péricardite', 'myocardite',
    'pneumopathie', 'pleurésie', 'pneumothorax', 'atélectasie', 'bronchiolite', 'exacerbation', 'décompensation',
    'déshydratation', 'rhabdomyolyse', 'polytraumatisé', 'hémodynamique', 'hémodynamiquement', 'normocapnie',
    'hypercapnie', 'hypoxémie', 'désaturation', 'sinusal', 'sinusale', 'repolarisation', 'auscultation', 'souffle',
    'crépitants', 'sibilants', 'ronchis', 'murmure', 'vésiculaire', 'mollets', 'œdèmes', 'turgescence', 'jugulaire',
    'reflux', 'hépatojugulaire', 'défense', 'contracture', 'péristaltisme', 'bilatéral', 'bilatérale', 'controlatéral',
    'homolatéral', 'paravertébral', 'rétrosternal', 'rétrosternale', 'épigastrique', 'épigastralgies', 'hypochondre',
    'fosse', 'iliaque', 'lombalgie', 'lombosciatique', 'cruralgie', 'cervicalgie', 'gonalgie', 'coxalgie', 'arthralgies',
    'myalgies', 'érythème', 'purpura', 'pétéchies', 'ecchymose', 'hématome', 'plaie', 'suture', 'parage', 'antalgique',
    'antalgiques', 'posologie', 'posologies', 'mg', 'µg', 'mL', 'mmHg', 'bpm', 'mmol', 'µmol', 'UI', 'kg', 'cmH2O'
  ];

  const api = { COMMANDS, ACRONYMS, NO_LOWER, SAFE_2, LEXICON, UNITS, MEDICAL_WORDS };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LSAMM_LEX = api;
})(typeof window !== 'undefined' ? window : globalThis);
