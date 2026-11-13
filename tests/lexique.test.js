// Tests du lexique medical integre et des definitions : node tests/lexique.test.js
const fs = require('fs');
global.window = {};
require('../js/lexique-medical.js');
const MED = window.LSAMM_MED;
const P = require('../js/pipeline.js');
const D = require('../js/definitions.js');
const C = P.compile({ med: MED });
let n = 0, fail = 0;
const eq = (got, exp, label) => { n++; if (got !== exp) { fail++; console.log('ÉCHEC ' + label + '\n  attendu: ' + JSON.stringify(exp) + '\n  obtenu : ' + JSON.stringify(got)); } };
const run = t => P.renderPlain(P.parse(t, C), {});
// Accents, casse, mots coupes
eq(run('dyspnee et hepato megalie'), 'Dyspnée et hépatomégalie', 'accents + mot coupé');
eq(run('paracetamol 1 gramme'), 'Paracétamol 1 g', 'DCI accentuée');
eq(run('sous doliprane et kardegic'), 'Sous Doliprane et Kardegic', 'marques');
eq(run('antecedent de bpco'), 'Antécédent de BPCO', 'sigle Wikipédia');
eq(run('anti coagulant'), 'Anticoagulant', 'préfixe soudé');
eq(run('cholé cystectomie'), 'Cholécystectomie', 'mot coupé 2');
// Ne doit PAS changer
eq(run('le patient est interne en chirurgie'), 'Le patient est interne en chirurgie', 'interne (mot valide)');
eq(run('il y a un chat et un true'), 'Il y a un chat et un true', 'mots courants non mis en capitales');
eq(run('pas de ta'), 'Pas de ta', 'sigles ambigus');
eq(run('PARACETAMOL'), 'PARACETAMOL', 'majuscules voulues');
eq(P.renderPlain(P.parse('dyspnee', P.compile({ med: MED, medFix: false })), {}), 'Dyspnee', 'option désactivée');
eq(run('compte rendu à 80 battements par minute'), 'Compte rendu à 80\u00a0bpm', 'unité bpm et « compte rendu » intacts');
eq(run('quelque fois'), 'Quelque fois', 'pas de soudure de mots courants');
// Termes verifies par l'utilisateur (tools/lexique-valide.txt)
eq(run('patient normocarde et polypneique'), 'Patient normocarde et polypnéique', 'termes validés : accents');
eq(run('sous ceftriaxone et levofloxacine'), 'Sous ceftriaxone et lévofloxacine', 'DCI validées');
eq(run('hepato spleno megalie'), 'Hépatosplénomégalie', 'terme validé : mot coupé');
eq(run('abdomen depressible'), 'Abdomen dépressible', 'dépressible');
eq(MED.terms.includes('troponine') && MED.terms.includes('normocardes'), true, 'termes et pluriels présents');
eq(run('écho doppler et un Doppler veineux'), 'Écho-doppler et un doppler veineux', 'doppler en minuscule');
eq(run('des dopplers des membres inférieurs'), 'Des doppler des membres inférieurs', 'doppler invariable');
eq(run('principe de l\'effet doppler'), 'Principe de l\'effet Doppler', 'exception : effet Doppler');
eq(run('Effet doppler'), 'Effet Doppler', 'exception en début de phrase');
eq(run('doppler veineux'), 'Doppler veineux', 'majuscule de début de phrase seulement');
eq(MED.terms.includes('doppler') && !MED.terms.includes('Doppler') && !MED.terms.includes('dopplers'), true, 'doppler invariable dans le lexique');
// Definitions locales
eq(D.local('BPCO', MED).sections[0].defs[0], 'bronchopneumopathie chronique obstructive', 'définition abréviation');
eq(D.local('Kardegic', MED).kind, 'Médicament (spécialité)', 'définition médicament');
eq(D.local('maison', MED), null, 'mot courant : pas de définition locale');
// Wiktionnaire
const w = D.parseWiktionary(fs.readFileSync(__dirname + '/fixtures/wiktionnaire-dyspnee.txt', 'utf8'));
eq(w.sections[0].pos, 'Nom', 'Wiktionnaire : nature');
eq(w.sections[0].defs[0], '(Médecine) Difficulté à respirer, essoufflement.', 'Wiktionnaire : définition');
eq(w.sections.length, 1, 'Wiktionnaire : seule la section française');
const f = D.parseWiktionary(fs.readFileSync(__dirname + '/fixtures/wiktionnaire-cephalees.txt', 'utf8'));
eq(f.lemma, 'céphalée', 'Wiktionnaire : forme fléchie -> lemme');
console.log((n - fail) + '/' + n + ' tests réussis');
process.exit(fail ? 1 : 0);
