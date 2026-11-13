// Tests du traitement du texte : node tests/pipeline.test.js
const assert = require('assert');
const P = require('../js/pipeline.js');
const C = P.compile({ userDict: [['doliprane', 'Doliprane']], snippets: [['examen normal', 'Examen cardio-pulmonaire normal.\nAbdomen souple.']] });
const NB = ' ';
const run = (t, start) => P.renderPlain(P.parse(t, C), {}, start).replace(/ /g, '~');
let n = 0, fail = 0;
function eq(input, expected, start) {
  n++;
  const got = run(input, start);
  if (got !== expected) { fail++; console.log('ÉCHEC\n  dit    : ' + input + '\n  attendu: ' + JSON.stringify(expected) + '\n  obtenu : ' + JSON.stringify(got)); }
}
eq('patient de 65 ans virgule hypertendu point', 'Patient de 65 ans, hypertendu.');
eq('pas d\'allergie connue point à la ligne traitement habituel deux points ramipril 5 milligrammes par jour', 'Pas d\'allergie connue.\nTraitement habituel~: ramipril 5~mg/j');
eq('température 38 virgule 5 degrés point', 'Température 38,5~°C.');
eq('tension 13 sur 8 virgule fréquence cardiaque 110 battements par minute virgule spo2 à 94 pour cent', 'Tension 13/8, fréquence cardiaque 110~bpm, SpO2 à 94~%');
eq('douleur thoracique avec un point de côté droit point', 'Douleur thoracique avec un point de côté droit.');
eq('on fait le point sur la situation point', 'On fait le point sur la situation.');
eq('ecg colon sus décalage st plus en territoire inférieur', 'ECG colon sus-décalage ST+ en territoire inférieur');
eq('demande d\'i r m cérébrale et de tdm thoracique', 'Demande d\'IRM cérébrale et de TDM thoracique');
eq('il ne présente pas de signe de gravité point il ira mieux demain point', 'Il ne présente pas de signe de gravité. Il ira mieux demain.');
eq('ouvrez la parenthèse avis cardiologique fermez la parenthèse point', '(Avis cardiologique).');
eq('conclusion deux points syndrome coronarien point d\'interrogation', 'Conclusion~: syndrome coronarien~?');
eq('il dit ouvrez les guillemets j\'ai mal fermez les guillemets point', 'Il dit «~j\'ai mal~».');
eq('post opératoire et anti coagulant et anti inflammatoire et bêta bloquant', 'Postopératoire et anticoagulant et anti-inflammatoire et bêtabloquant');
eq('surveillance à j 3 point', 'Surveillance à J3.');
eq('prise de doliprane 1 gramme', 'Prise de Doliprane 1~g');
eq('insère examen normal', 'Examen cardio-pulmonaire normal.\nAbdomen souple.');
eq('signe de murphy négatif et lasègue positif', 'Signe de Murphy négatif et Lasègue positif');
eq('les deux points de suture tiennent', 'Les deux points de suture tiennent');
eq('nouveau paragraphe examen clinique', 'Bilan.\n\nExamen clinique', 'Bilan.');
eq('virgule à revoir', 'Bilan, à revoir', 'Bilan');
eq('selon martin et al point', 'Selon martin et al.');
eq('rendez vous à 8 heures 30', 'Rendez vous à 8~h~30');
eq('majuscule martin est vu', 'Bilan. Martin est vu', 'Bilan.');
eq('vu par le docteur majuscule martin', 'Patient vu par le docteur Martin', 'Patient ');
eq('glycémie à 1 virgule 2 gramme par litre et hba1c à 7 pour cent', 'Glycémie à 1,2~g/L et HbA1c à 7~%');
eq('nt pro bnp à 450 et d dimères négatifs', 'NT-proBNP à 450 et D-dimères négatifs');
eq('EVA à 6 sur 10', 'EVA à 6/10');
eq('point final', 'Bilan.', 'Bilan');
// « à la ligne » / « nouveau paragraphe » : mots, sans accent, sauts de ligne du moteur, ponctuation du moteur
eq('patient vu à la ligne examen normal', 'Patient vu\nExamen normal');
eq('patient vu a la ligne examen normal', 'Patient vu\nExamen normal');
eq('patient vu\nexamen normal', 'Patient vu\nExamen normal');
eq('Patient vu. À la ligne. Examen normal.', 'Patient vu.\nExamen normal.');
eq('patient vu\n\nexamen normal', 'Patient vu\n\nExamen normal');
eq('Patient vu. Nouveau paragraphe. Examen normal.', 'Patient vu.\n\nExamen normal.');
n++; if (P.normalizeTranscript('\n').trim() !== 'à la ligne') { fail++; console.log('ÉCHEC saut de ligne seul'); }
// Formules de courrier (règles intégrées)
eq('chers confrères chers concert', 'Cher confrère, chère consœur,');
eq('chers confrère virgule cher concerts à la ligne merci', 'Cher confrère, chère consœur,\nMerci');
eq('cher consœur', 'Chère consœur');
eq('mes chers confrères', 'Mes chers confrères');
eq('le cher concert de Mozart', 'Le cher concert de Mozart');
// « champ suivant » et ses homophones (champs, chant, chants), ponctuation du moteur
{
  const fieldOps = (t) => JSON.stringify(P.parse(t, C).map(o => o.type === 'field' ? 'F' + o.dir : o.type === 'text' ? o.text : o.type));
  for (const [t, exp] of [['champ suivant', '["F1"]'], ['Champ suivant.', '["F1"]'], ['champs suivants', '["F1"]'], ['Chant suivant', '["F1"]'],
    ['chants suivant', '["F1"]'], ['passe au champ suivant', '["F1"]'], ['prochain champ', '["F1"]'], ['champ précédent', '["F-1"]'],
    ['Martin champ suivant douleur', '["Martin","F1","douleur"]'], ['Champ suivant. Douleur thoracique.', '["F1","Douleur thoracique."]']]) {
    n++;
    const got = fieldOps(t);
    if (got !== exp) { fail++; console.log('ÉCHEC champ « ' + t + ' » : ' + got + ' au lieu de ' + exp); }
  }
}
// Epellation (nom propre en majuscules)
for (const [t, exp, end] of [['M A R T I N', 'MARTIN', false], ['emme a erre té i enne', 'MARTIN', false], ['d u p o n t tiret l a j o i e fin', 'DUPONT-LAJOIE', true],
  ['l e f e accent grave v r e', 'LEFÈVRE', false], ['f r a n c cédille o i s', 'FRANÇOIS', false], ['double vé a t t', 'WATT', false], ['i grec v e s', 'YVES', false],
  ['D, U, P, O, N, T.', 'DUPONT', false], ['martin', 'MARTIN', false], ['terminé', '', true]]) {
  n++;
  const r = P.spell(t);
  if (r.text !== exp || r.end !== end) { fail++; console.log('ÉCHEC épellation « ' + t + ' » : ' + JSON.stringify(r)); }
}
n++; if (JSON.stringify(P.parse('patient monsieur épelle d u p o n t fin', C)) !== JSON.stringify([{ type: 'text', text: 'patient monsieur' }, { type: 'spell', text: 'd u p o n t fin' }])) { fail++; console.log('ÉCHEC commande épeler'); }
// Validation anticipee : commandes fortes suivies d'au moins un mot
for (const [t, exp] of [['alpha champ suivant bravo', 3], ['alpha champ suivant', 0], ['alpha champ suivant bravo champ suivant charlie', 6],
  ['38 virgule 5 degrés', 0], ['patient vu point il va', 3], ['patient à la ligne examen', 4], ['épelle d u p o n t', 0], ['un point de côté', 0]]) {
  n++; const got = P.commitPoint(t, C, 1);
  if (got !== exp) { fail++; console.log('ÉCHEC commitPoint « ' + t + ' » : ' + got + ' au lieu de ' + exp); }
}
n++; if (P.firstCommandIndex('madame Durand champ suivant douleur', C) !== 14) { fail++; console.log('ÉCHEC firstCommandIndex : ' + P.firstCommandIndex('madame Durand champ suivant douleur', C)); }
// Typographie sur texte existant
const t = P.tidy('Bonjour ,il va bien:oui ? « test » ... fin.ok', {}).replace(/ /g, '~');
n++; if (t !== 'Bonjour, il va bien:oui~? «~test~»… Fin. Ok') { fail++; console.log('ÉCHEC tidy : ' + JSON.stringify(t)); }
const t2 = P.tidy('Cf. martin et al. ont montré', {});
n++; if (t2 !== 'Cf. martin et al. ont montré') { fail++; console.log('ÉCHEC tidy abréviation : ' + JSON.stringify(t2)); }
// Textes types : variantes, accents, texte inséré tel quel
const C2 = P.compile({ snippets: [['courrier médical', "Cher confrère, chère consœur,\n\nMerci de recevoir\npour\nIl ne présente pas d'antécédent notable.\n\nBien confraternellement,"], ['courrier', 'Court.']] });
const LETTRE = "Cher confrère, chère consœur,\n\nMerci de recevoir\npour\nIl ne présente pas d'antécédent notable.\n\nBien confraternellement,";
for (const said of ['insère courrier médical', 'Insère courrier médical.', 'insère le courrier médical', 'insérer courrier medical', 'insert courrier médical', 'insérez un courrier médical']) {
  n++;
  const got = P.renderPlain(P.parse(said, C2), {});
  if (got !== LETTRE) { fail++; console.log('ÉCHEC texte type « ' + said + ' » : ' + JSON.stringify(got)); }
}
n++; if (P.renderPlain(P.parse('insère courrier', C2), {}) !== 'Court.') { fail++; console.log('ÉCHEC texte type court'); }
// Commande coupée par une pause : la fin inachevée est retenue
const tail = (t) => t.slice(t.length - P.incompleteTail(t, C2));
for (const [t, exp] of [['insère', 'insère'], ['patient vu ce jour insère', 'insère'], ['insère courrier', ''], ['insère le', 'insère le'],
  ['bilan fin du', 'fin du'], ['ouvrez la', 'ouvrez la'], ['bilan normal point', ''], ['bilan normal', ''], ['insère courrier médical', '']]) {
  n++;
  // « insère courrier » est complet (texte type « courrier ») mais peut aussi être le début de « courrier médical »
  const got = tail(t);
  const ok = t === 'insère courrier' ? (got === '' || got === 'insère courrier') : got === exp;
  if (!ok) { fail++; console.log('ÉCHEC attente « ' + t + ' » : ' + JSON.stringify(got)); }
}
console.log((n - fail) + '/' + n + ' tests réussis');
process.exit(fail ? 1 : 0);
