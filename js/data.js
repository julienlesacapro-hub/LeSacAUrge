/* LeSacAUrge - donnees de reference
   ©2026 LESACA Julien - Tous droits reserves. */
'use strict';

// Ordre et libelles des encarts. "sep" = separateur insere par les pastilles.
window.SECTIONS = [
  { id: 'motif',       title: 'Motif de consultation',   short: 'Motif',      sep: ', ',  optional: true,
    placeholder: 'Ex : douleur thoracique depuis 2 h' },
  { id: 'anamnese',    title: 'Anamnèse',                short: 'Anamnèse',   sep: ' ',
    placeholder: 'Histoire de la maladie, chronologie, symptômes associés...' },
  { id: 'atcd_med',    title: 'Antécédents médicaux',    short: 'ATCD méd.',  sep: ', ' },
  { id: 'atcd_chir',   title: 'Antécédents chirurgicaux', short: 'ATCD chir.', sep: ', ' },
  { id: 'traitements', title: 'Traitements habituels',   short: 'Traitements', sep: '\n' },
  { id: 'allergies',   title: 'Allergies',               short: 'Allergies',  sep: ', ' },
  { id: 'examen',      title: 'Examen clinique',         short: 'Examen',     sep: '\n' },
  { id: 'hypotheses',  title: 'Hypothèses diagnostiques', short: 'Hypothèses', sep: '\n' },
  { id: 'ecg',         title: 'ECG',                     short: 'ECG',        sep: '\n' },
  { id: 'cat',         title: 'Conduite à tenir',        short: 'CAT',        sep: '\n' },
  { id: 'evolution',   title: 'Évolution',               short: 'Évolution',  sep: '\n' },
  { id: 'conclusion',  title: 'Conclusion',              short: 'Conclusion', sep: '\n' }
];

// Pastilles preremplies (modifiables dans les reglages).
window.DEFAULT_CHIPS = {
  atcd_med: [
    'Pas d\'antécédent médical notable',
    'HTA', 'Diabète de type 2', 'Diabète de type 1 insulinodépendant', 'Dyslipidémie',
    'Obésité', 'Tabagisme actif', 'Tabagisme sevré', 'Éthylisme chronique',
    'Cardiopathie ischémique', 'Insuffisance cardiaque', 'Fibrillation atriale',
    'Valvulopathie', 'AVC', 'AIT', 'Artériopathie oblitérante des membres inférieurs',
    'Maladie thromboembolique veineuse', 'BPCO', 'Asthme', 'SAOS appareillé',
    'Insuffisance rénale chronique', 'Hypothyroïdie', 'Hyperthyroïdie',
    'Cirrhose', 'Néoplasie', 'Épilepsie', 'Troubles neurocognitifs',
    'Maladie de Parkinson', 'Syndrome dépressif', 'Trouble anxieux', 'Psychose',
    'VIH', 'Drépanocytose', 'Grossesse en cours'
  ],
  atcd_chir: [
    'Pas d\'antécédent chirurgical',
    'Appendicectomie', 'Cholécystectomie', 'Cure de hernie inguinale', 'Cure de hernie ombilicale',
    'Césarienne', 'Hystérectomie', 'Amygdalectomie', 'Thyroïdectomie',
    'Chirurgie bariatrique', 'Colectomie', 'Prostatectomie', 'Néphrectomie',
    'Angioplastie coronaire avec stent', 'Pontage aorto-coronarien', 'Remplacement valvulaire',
    'Pose de pacemaker', 'Prothèse totale de hanche', 'Prothèse totale de genou',
    'Ostéosynthèse', 'Chirurgie du rachis', 'Chirurgie de la cataracte'
  ],
  traitements: [
    'Aucun traitement au long cours',
    'Aspirine', 'Clopidogrel', 'Ticagrélor', 'Apixaban', 'Rivaroxaban', 'Dabigatran',
    'Fluindione', 'Warfarine', 'HBPM',
    'Bisoprolol', 'Amlodipine', 'Ramipril', 'Périndopril', 'Irbésartan', 'Valsartan',
    'Furosémide', 'Hydrochlorothiazide', 'Spironolactone', 'Amiodarone',
    'Atorvastatine', 'Rosuvastatine',
    'Metformine', 'Gliclazide', 'Sitagliptine', 'Dapagliflozine', 'Empagliflozine',
    'Sémaglutide', 'Insuline lente', 'Insuline rapide',
    'Lévothyroxine', 'Oméprazole', 'Ésoméprazole',
    'Paracétamol', 'Tramadol', 'Prednisone',
    'Salbutamol', 'Corticoïde inhalé', 'Tiotropium',
    'Sertraline', 'Escitalopram', 'Venlafaxine', 'Alprazolam', 'Oxazépam', 'Zopiclone',
    'Lévétiracétam', 'Valproate', 'Lévodopa', 'Donépézil',
    'Contraception oestroprogestative', 'Tamsulosine', 'Allopurinol'
  ],
  allergies: [
    'Aucune allergie connue',
    'Pénicillines', 'Céphalosporines', 'Sulfamides', 'Macrolides', 'Quinolones',
    'AINS', 'Aspirine', 'Morphiniques', 'Codéine', 'Paracétamol',
    'Produits de contraste iodés', 'Latex', 'Chlorhexidine', 'Povidone iodée',
    'Arachide', 'Fruits à coque', 'Crustacés', 'Venin d\'hyménoptères'
  ],
  hypotheses: [
    'Syndrome coronarien aigu', 'Embolie pulmonaire', 'Dissection aortique',
    'Péricardite', 'Pneumopathie', 'Exacerbation de BPCO', 'Crise d\'asthme',
    'Insuffisance cardiaque aiguë', 'AVC', 'Malaise vagal', 'Syncope',
    'Appendicite', 'Cholécystite', 'Colique néphrétique', 'Pyélonéphrite',
    'Occlusion intestinale', 'Pancréatite', 'Gastro-entérite',
    'Douleur pariétale', 'Lombalgie commune', 'Entorse', 'Fracture',
    'Sepsis', 'Crise d\'angoisse'
  ],
  cat: [
    'Bilan biologique', 'Gaz du sang', 'ECG', 'Troponine', 'D-dimères', 'Lactates',
    'Hémocultures', 'ECBU', 'BU', 'Radiographie thoracique', 'Radiographie',
    'Échographie', 'Scanner', 'Angioscanner thoracique', 'IRM',
    'Antalgiques', 'Antiémétiques', 'Remplissage vasculaire', 'Oxygénothérapie',
    'Aérosols', 'Antibiothérapie', 'Anticoagulation', 'Avis spécialisé',
    'Surveillance clinique', 'Réévaluation après résultats'
  ],
  evolution: [
    'Évolution favorable', 'Amélioration de la douleur', 'Patient asymptomatique',
    'Constantes stables', 'Bilan sans anomalie', 'Réévaluation clinique rassurante',
    'Aggravation clinique'
  ],
  conclusion: [
    'Retour à domicile', 'Hospitalisation', 'Hospitalisation en UHCD',
    'Transfert', 'Consignes de surveillance données', 'Consignes de reconsultation expliquées',
    'Consultation médecin traitant sous 48 à 72 h', 'Arrêt de travail',
    'Ordonnance remise', 'Courrier remis', 'Sortie contre avis médical'
  ]
};

// Examen clinique normal par appareil.
// Note : "ethnique en air" (texte dicte d'origine) corrige en "eupneique en air ambiant",
// "bruit sur ajoute" corrige en "bruit surajoute".
window.EXAM_SYSTEMS = [
  { id: 'neuro', label: 'Neurologique',
    text: 'GCS 15, absence d\'altération des fonctions supérieures.' },
  { id: 'hemo', label: 'Hémodynamique',
    text: 'Bonnes constantes hémodynamiques, bonne hématose.' },
  { id: 'pulm', label: 'Pulmonaire',
    text: 'MV bilatéral et symétrique, sans bruit surajouté, eupnéique en air ambiant, absence de signe de lutte.' },
  { id: 'cardio', label: 'Cardiovasculaire',
    text: 'Bruits du cœur réguliers sans souffle cardiaque ni carotidien, PP+/+, absence de signe d\'insuffisance cardiaque droite ou gauche, mollets souples et indolores. Absence de douleur thoracique.' },
  { id: 'abdo', label: 'Abdominal',
    text: 'Abdomen souple, dépressible et indolore, absence de masse palpable, absence de trouble du transit, absence de SFU, absence de défense ou de contracture.' },
  { id: 'adp', label: 'Ganglionnaire',
    text: 'ADP : aucune palpable.' },
  { id: 'cutane', label: 'Cutané',
    text: 'Aspect cutané intègre.' }
];

// Constantes (generent une ligne texte).
window.VITALS = [
  { id: 'ta',   label: 'TA',    unit: 'mmHg', ph: '120/80', mode: 'text' },
  { id: 'fc',   label: 'FC',    unit: 'bpm',  ph: '80', mode: 'numeric' },
  { id: 'spo2', label: 'SpO2',  unit: '%',    ph: '98', mode: 'numeric' },
  { id: 'fr',   label: 'FR',    unit: '/min', ph: '16', mode: 'numeric' },
  { id: 'temp', label: 'Temp',  unit: 'C',    ph: '37,0', mode: 'decimal' },
  { id: 'eva',  label: 'EVA',   unit: '/10',  ph: '0', mode: 'numeric' },
  { id: 'gly',  label: 'Glyc',  unit: 'g/L',  ph: '1,00', mode: 'decimal' }
];

// ECG : phrase normale generee a partir de ces choix.
window.ECG = {
  rhythms: ['RSR', 'Tachycardie sinusale', 'Bradycardie sinusale', 'FA', 'Flutter atrial',
            'Tachycardie jonctionnelle', 'Rythme électroentraîné'],
  axes: ['non dévié', 'gauche', 'droit'],
  conduction: ['BAV 1', 'BAV 2 Mobitz 1', 'BAV 2 Mobitz 2', 'BAV 3', 'BBD complet', 'BBD incomplet',
               'BBG complet', 'HBAG', 'HBPG', 'Préexcitation'],
  repol: ['Sus-décalage du segment ST', 'Sous-décalage du segment ST', 'Ondes T négatives',
          'Ondes T amples et pointues', 'Troubles de repolarisation aspécifiques'],
  autres: ['ESV', 'ESA', 'Onde Q de nécrose', 'HVG', 'Microvoltage', 'Aspect S1Q3']
};

// Check-list : elements a faire / a verifier.
// icon = chemins SVG (grille 24 x 24, trait).
window.TODO_ITEMS = [
  { id: 'reeval', label: 'Réévaluation clinique', short: 'Réév.',
    icon: '<path d="M5 3v5a4 4 0 0 0 8 0V3"/><path d="M9 12v2a5 5 0 0 0 10 0v-3"/><circle cx="19" cy="9" r="2"/>' },
  { id: 'bio', label: 'Biologie en attente', short: 'Bio',
    icon: '<path d="M8 3h8"/><path d="M9.5 3v14.5a2.5 2.5 0 0 0 5 0V3"/><path d="M9.5 12h5"/>' },
  { id: 'imagerie', label: 'Imagerie', short: 'Imagerie',
    icon: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 7v10M9 9h6M8.5 12h7M9 15h6"/>' },
  { id: 'ecg', label: 'ECG', short: 'ECG',
    icon: '<path d="M2 12h4l2-5 4 10 2-5h8"/>' },
  { id: 'ttt', label: 'Traitement', short: 'TTT',
    icon: '<path d="M10.5 20.5a4.95 4.95 0 0 1-7-7l6-6a4.95 4.95 0 0 1 7 7z"/><path d="M8.5 8.5l7 7"/>' },
  { id: 'scope', label: 'Surveillance / scope', short: 'Scope',
    icon: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M6 11h3l1.5-3 3 6 1.5-3H18M9 20h6M12 16v4"/>' },
  { id: 'cardio', label: 'Avis cardiologique', short: 'Cardio',
    icon: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>' },
  { id: 'chir', label: 'Avis chirurgical', short: 'Chir',
    icon: '<path d="M3 21l8.5-8.5"/><path d="M11.5 12.5l2.5 2.5L21 5a2.1 2.1 0 0 0-3-3z"/>' },
  { id: 'neuro', label: 'Avis neurologique', short: 'Neuro',
    icon: '<path d="M9 21v-3H7a2 2 0 0 1-2-2v-3l-2-1 2-3a7 7 0 0 1 14 2c0 3-1.5 4.5-3 5.5V21"/>' },
  { id: 'avis', label: 'Autre avis spécialisé', short: 'Avis',
    icon: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>' },
  { id: 'lit', label: 'Recherche de lit', short: 'Lit',
    icon: '<path d="M3 18V6M3 14h18v4M21 14v-3a3 3 0 0 0-3-3h-7v6"/><circle cx="7" cy="10.5" r="2"/>' },
  { id: 'famille', label: 'Appel famille / médecin traitant', short: 'Appel',
    icon: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>' },
  { id: 'papiers', label: 'Documents de sortie', short: 'Papiers',
    icon: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>' }
];
window.TODO_CUSTOM_ICON = '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="7.5" r="1.5"/>';
