/* LeSacAUrge - donnees de reference
   ©2026 LESACA Julien - Tous droits reserves. */
'use strict';

// Ordre et libelles des encarts. "sep" = separateur insere par les pastilles.
window.SECTIONS = [
  { id: 'motif',       title: 'Motif de consultation',   sep: ', ',  optional: true,
    placeholder: 'Ex : douleur thoracique depuis 2 h' },
  { id: 'anamnese',    title: 'Anamnèse',                sep: ' ',
    placeholder: 'Histoire de la maladie, chronologie, symptômes associés...' },
  { id: 'atcd_med',    title: 'Antécédents médicaux',    sep: ', ' },
  { id: 'atcd_chir',   title: 'Antécédents chirurgicaux', sep: ', ' },
  { id: 'traitements', title: 'Traitements habituels',   sep: '\n' },
  { id: 'allergies',   title: 'Allergies',               sep: ', ' },
  { id: 'examen',      title: 'Examen clinique',         sep: '\n' },
  { id: 'hypotheses',  title: 'Hypothèses diagnostiques', sep: '\n' },
  { id: 'cat',         title: 'Conduite à tenir',        sep: '\n' },
  { id: 'evolution',   title: 'Évolution',               sep: '\n' },
  { id: 'conclusion',  title: 'Conclusion',              sep: '\n' }
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
