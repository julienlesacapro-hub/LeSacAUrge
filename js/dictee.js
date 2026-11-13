/* LeSacAUrge - dictee vocale, verification, lexique medical, textes types,
   dictionnaire personnel et definitions.
   Reprend les modules de LeSacAMicroMed (lexique.js, lexique-medical.js,
   pipeline.js, speech.js, definitions.js) et les applique aux zones de texte
   de l'observation, en texte brut.
   ©2026 LESACA Julien - Tous droits reserves. */
'use strict';

(function () {
  const APP = window.LSAU;
  const LEX = window.LSAMM_LEX;
  const PIPE = window.LSAMM_PIPE;
  const SPEECH = window.LSAMMSpeech;
  const MEDDATA = window.LSAMM_MED || { terms: [], drugs: {}, abbr: {}, sources: {} };
  const CFG = window.LSAU_CONFIG || {};
  if (!APP || !LEX || !PIPE || !SPEECH) return;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const toast = APP.toast;
  const esc = APP.escapeHtml;

  /* ================================================================== */
  /* Reglages de la dictee (propres a l'appareil)                        */
  /* ================================================================== */
  const SET_KEY = 'lsau.dictee.v1';
  const KEY_KEY = 'lsau.apikey'; // cle d'API : jamais synchronisee
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const D = Object.assign({
    engine: 'auto', cloudProvider: 'mistral', cloudEndpoint: '', cloudModel: '',
    autoCap: true, medFix: true, defBubble: true, defOnline: true,
    ltUrl: CFG.languageToolUrl || 'https://api.languagetool.org/v2/check', ltPicky: false, ltConsent: false
  }, (() => { try { return JSON.parse(lsGet(SET_KEY)) || {}; } catch (e) { return {}; } })());
  const saveD = () => lsSet(SET_KEY, JSON.stringify(D));
  // Texte brut : pas d'espaces insecables ni d'apostrophe typographique
  const textOpts = () => ({ nbsp: false, autoCap: D.autoCap, typoApos: false });

  /* ================================================================== */
  /* Dictionnaire personnel et textes types (synchronises)               */
  /* ================================================================== */
  function parsePairs(text, unescapeNl) {
    return String(text || '').split('\n').map(l => {
      const i = l.indexOf('=');
      if (i < 1) return null;
      const a = l.slice(0, i).trim(), b = l.slice(i + 1).trim();
      if (!a) return null;
      return [a, unescapeNl ? b.replace(/\\n/g, '\n') : b];
    }).filter(Boolean);
  }
  const FIELD_RE = /\[(?:…|\.\.\.|\s*)\]|_{3,}/g;
  const FIELD = '[…]';
  // Champs a choix : {monsieur|madame}, {paragraphe A|paragraphe B}, {paragraphe facultatif|}
  const CHOICE_RE = /\{([^{}]*\|[^{}]*)\}/g;
  const TOKEN_RE = /\[…\]|\{[^{}]*\|[^{}]*\}/g;   // elements a completer dans un encart
  function tokens(v) {
    const out = []; let m;
    TOKEN_RE.lastIndex = 0;
    while ((m = TOKEN_RE.exec(v))) out.push({ a: m.index, b: m.index + m[0].length, choice: m[0].charAt(0) === '{', raw: m[0] });
    return out;
  }
  const choiceOpts = raw => raw.slice(1, -1).split('|');
  function tokenAtSel(v, a, b) { return tokens(v).find(t => t.a === a && t.b === b) || null; }
  const normName = x => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/œ/g, 'oe').replace(/[^a-z0-9]+/g, ' ').trim();
  const snippetList = () => parsePairs(APP.cfg().snip, true).map(([name, text]) => ({ name, text }));
  function saveSnippets(list) {
    APP.setCfg('snip', list.filter(x => x.name.trim()).map(x => x.name.trim().replace(/=/g, '-') + ' = ' +
      String(x.text).replace(/\r/g, '').replace(/\n/g, '\\n')).join('\n'));
    recompile();
  }
  // Textes types proposes au premier lancement (sans horodatage : une liste
  // plus recente venant d'un autre appareil reste prioritaire)
  (function installDefaults() {
    const c = APP.cfg();
    if (c.snip || c.t.snip) return;
    const exam = (window.EXAM_SYSTEMS || []).map(x => x.text).join('\n');
    const defs = [
      ['examen normal', exam],
      ['ECG normal', 'RSR d\'axe non dévié, à […] bpm, sans trouble de la conduction ni de la repolarisation, QTc à […] ms.'],
      ['retour à domicile', 'Retour à domicile. Consignes de surveillance et de reconsultation expliquées au patient. Consultation chez le médecin traitant sous […].']
    ];
    c.snip = defs.map(([n, t]) => n + ' = ' + t.replace(/\n/g, '\\n')).join('\n');
  })();

  let C = null;
  function recompile() {
    C = PIPE.compile({ userDict: parsePairs(APP.cfg().dict), snippets: parsePairs(APP.cfg().snip, true), nbsp: false,
      med: MEDDATA, medFix: D.medFix });
  }
  recompile();
  APP.onCfgChange(() => { recompile(); if ($('#settings').open) fillSettings(); });

  /* ================================================================== */
  /* Zone cible de la dictee                                             */
  /* ================================================================== */
  let target = null;
  const choiceMenu = $('#choiceMenu');
  let choiceTa = null;
  const caretKnown = new WeakSet();
  const isTargetable = el => el && el.tagName === 'TEXTAREA' && el.closest('#sections') && !el.closest('.vital');
  function sectionOf(ta) { const c = ta && ta.closest('.card'); return c ? c.dataset.id : ''; }
  function labelOf(ta) {
    const id = sectionOf(ta);
    let l = APP.sectionTitle(id) || 'Encart';
    if (ta.id === 'evoInput') l += ' (nouvelle entrée)';
    else if (ta.closest('.evo-item')) l += ' (entrée de ' + ($('.evo-time', ta.closest('.evo-item')) || {}).value + ')';
    return l;
  }
  function mainField(id) {
    const card = document.getElementById('card-' + id);
    if (!card) return null;
    if (id === 'evolution') return $('#evoInput', card);
    return $(':scope > textarea', card);
  }
  function resolveTarget() {
    if (target && target.isConnected) return target;
    const act = $('.nav-chip.active');
    return (act && mainField(act.dataset.go)) || mainField('anamnese') || $('#sections textarea');
  }
  function setTarget(ta) {
    if (target && target !== ta) target.classList.remove('dict-target');
    if (choiceTa && choiceTa !== ta && !choiceMenu.hidden) closeChoiceMenu();
    target = ta;
    if (ta && listening) ta.classList.add('dict-target');
    renderStatus();
  }
  document.addEventListener('focusin', e => { if (isTargetable(e.target)) { caretKnown.add(e.target); setTarget(e.target); } });
  ['click', 'keyup', 'select'].forEach(t => document.addEventListener(t, e => { if (isTargetable(e.target)) caretKnown.add(e.target); }, true));
  $('#secnav').addEventListener('click', e => {
    const b = e.target.closest('.nav-chip');
    if (!b) return;
    const ta = mainField(b.dataset.go);
    if (ta) setTarget(ta);
  });

  /* ================================================================== */
  /* Insertion du texte dicte dans une zone de texte                     */
  /* ================================================================== */
  const st = { capsNext: false, capsLock: false };
  let listMode = null, listN = 0;
  const undoStacks = new WeakMap(), redoStacks = new WeakMap();
  const stackOf = (m, ta) => { if (!m.has(ta)) m.set(ta, []); return m.get(ta); };

  function applyOps(ops, ta) {
    ta = ta || resolveTarget();
    if (!ta) return;
    const start = ta.value;
    const known = caretKnown.has(ta);
    const w = { v: start, a: known ? ta.selectionStart : start.length, b: known ? ta.selectionEnd : start.length };
    const afterCommit = [];
    let undone = false;
    const delSel = () => { if (w.b > w.a) { w.v = w.v.slice(0, w.a) + w.v.slice(w.b); w.b = w.a; } };
    const put = (ins, del) => { w.v = w.v.slice(0, w.a - (del || 0)) + ins + w.v.slice(w.a); w.a = w.a - (del || 0) + ins.length; w.b = w.a; };
    const trimBefore = () => { const n = (w.v.slice(0, w.a).match(/[ \u00a0]+$/) || [''])[0].length; if (n) put('', n); };
    const newline = (n) => {
      delSel(); trimBefore();
      const prev = w.v.slice(0, w.a);
      if (!prev.trim()) return;
      const have = (prev.match(/\n*$/) || [''])[0].length;
      if (have < n) put('\n'.repeat(n - have));
    };
    for (const op of ops) {
      switch (op.type) {
        case 'raw': delSel(); put(op.text); break;
        case 'text': case 'punct': {
          autoAdvancedAt = 0;
          delSel();
          const r = PIPE.joinPiece(w.v.slice(0, w.a), op, st, textOpts());
          put(r.ins, r.del);
          break;
        }
        case 'snippet': insertSnippet(w, op.text); break;
        case 'field':
          // apres un choix, le passage au champ suivant est deja fait : « champ suivant » dit juste apres est ignore
          if (op.dir > 0 && autoAdvancedAt && Date.now() - autoAdvancedAt < 8000) { autoAdvancedAt = 0; break; }
          autoAdvancedAt = 0;
          nextField(w, op.dir);
          break;
        case 'spell': afterCommit.push(() => { startSpell(); if (op.text) spellInput(op.text); }); break;
        case 'nl': listMode = null; newline(1); break;
        case 'par': case 'block': listMode = null; newline(2); break;
        case 'list': listMode = op.kind; listN = 0; newline(1); put(bullet()); st.capsNext = true; break;
        case 'li': if (!listMode) listMode = 'ul'; newline(1); put(bullet()); st.capsNext = true; break;
        case 'endlist': listMode = null; newline(1); break;
        case 'fmt': break; // texte brut : pas de gras / italique / souligne
        case 'caps': if (op.mode === 'next') st.capsNext = true; else st.capsLock = op.mode === 'on'; break;
        case 'edit':
          if (op.what === 'word') { delSel(); const m = w.v.slice(0, w.a).match(/[^\s\u00a0]+[\s\u00a0]*$/); if (m) put('', m[0].length); }
          else if (op.what === 'sentence') {
            delSel();
            const prev = w.v.slice(0, w.a).replace(/[\s\u00a0]+$/, '');
            const body = prev.replace(/[.!?…]+$/, '');
            const i = Math.max(body.lastIndexOf('. '), body.lastIndexOf('? '), body.lastIndexOf('! '), body.lastIndexOf('… '), body.lastIndexOf('\n'));
            const keep = i < 0 ? 0 : i + (body[i] === '\n' ? 1 : 2);
            put('', w.a - keep);
          } else if (op.what === 'undo') {
            const u = stackOf(undoStacks, ta);
            if (u.length) { stackOf(redoStacks, ta).push(w.v); w.v = u.pop(); w.a = w.b = w.v.length; undone = true; } else toast('Rien à annuler');
          } else if (op.what === 'redo') {
            const r = stackOf(redoStacks, ta);
            if (r.length) { stackOf(undoStacks, ta).push(w.v); w.v = r.pop(); w.a = w.b = w.v.length; undone = true; }
          }
          break;
        case 'action':
          if (op.name === 'copy') afterCommit.push(() => APP.copySection(sectionOf(ta)));
          else if (op.name === 'check') afterCommit.push(() => runCheck(ta));
          else if (op.name === 'stop') afterCommit.push(stopDictation);
          break;
      }
    }
    if (w.v !== start) {
      if (!undone) { const u = stackOf(undoStacks, ta); u.push(start); if (u.length > 60) u.shift(); redoStacks.set(ta, []); }
      ta.value = w.v;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      if (APP.autoGrow) APP.autoGrow(ta);
    }
    try { ta.setSelectionRange(w.a, w.b); } catch (e) {}
    caretKnown.add(ta);
    revealField(ta);
    syncChoiceMenu(ta);
    afterCommit.forEach(fn => fn());
  }
  let autoAdvancedAt = 0;
  function bullet() { return listMode === 'ol' ? (++listN) + '. ' : '- '; }
  function revealField(ta) {
    const r = ta.getBoundingClientRect();
    const dock = $('.dock');
    const bottom = dock ? dock.getBoundingClientRect().top : window.innerHeight;
    const head = $('#stickyHead').offsetHeight;
    if (r.bottom < head + 40 || r.top > bottom - 60) ta.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function insertSnippet(w, text) {
    if (w.b > w.a) { w.v = w.v.slice(0, w.a) + w.v.slice(w.b); w.b = w.a; }
    const body0 = String(text).replace(/\r/g, '').replace(FIELD_RE, FIELD).replace(/^\s+|\s+$/g, '');
    const first = body0.replace(CHOICE_RE, (m, inner) => inner.split('|')[0]).split('\n')[0];
    const r = PIPE.joinPiece(w.v.slice(0, w.a), { type: 'text', text: first.replace(/\[…\]/g, 'x') || 'x' }, st, textOpts());
    const lead = (r.ins.match(/^ +/) || [''])[0];
    let body = body0;
    if (r.ins.trim() && /^\p{Lu}/u.test(r.ins.trim()) && /^\p{Ll}/u.test(body)) body = body.charAt(0).toUpperCase() + body.slice(1);
    const at = w.a - r.del;
    w.v = w.v.slice(0, at) + lead + body + w.v.slice(w.a);
    const from = at + lead.length;
    const tk = tokens(w.v).find(t => t.a >= from && t.b <= from + body.length);
    if (tk) { w.a = tk.a; w.b = tk.b; }
    else { w.a = w.b = from + body.length; }
  }
  // « champ suivant » / « champ précédent » : selectionne le champ [...] ou le choix {a|b} suivant
  function nextField(w, dir) {
    dir = dir || 1;
    const list = tokens(w.v);
    if (!list.length) { toast('Aucun champ à compléter dans cet encart'); return false; }
    const cur = list.find(t => t.a === w.a && t.b === w.b);
    let t;
    if (dir > 0) t = list.find(x => x.a >= (cur ? cur.b : w.a)) || list[0];
    else t = list.slice().reverse().find(x => x.b <= (cur ? cur.a : w.a)) || list[list.length - 1];
    w.a = t.a; w.b = t.b;
    return true;
  }
  // Tab / Maj+Tab dans un encart contenant des champs ; chiffres et effacement sur un choix selectionne
  document.addEventListener('keydown', e => {
    const ta = e.target;
    if (!isTargetable(ta)) return;
    const tk = tokenAtSel(ta.value, ta.selectionStart, ta.selectionEnd);
    if (tk && tk.choice && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (/^[1-9]$/.test(e.key) && Number(e.key) <= choiceOpts(tk.raw).length) { e.preventDefault(); chooseOption(ta, Number(e.key) - 1); return; }
      if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); chooseOption(ta, choiceOpts(tk.raw).findIndex(o => !o.trim())); return; }
    }
    if (e.key !== 'Tab' || e.altKey || e.ctrlKey || e.metaKey || !tokens(ta.value).length) return;
    e.preventDefault();
    const w = { v: ta.value, a: ta.selectionStart, b: ta.selectionEnd };
    nextField(w, e.shiftKey ? -1 : 1);
    ta.setSelectionRange(w.a, w.b);
    syncChoiceMenu(ta);
  });
  // Toucher un champ ou un choix : il est selectionne en entier (la dictee le remplace)
  document.addEventListener('click', e => {
    const ta = e.target;
    if (!isTargetable(ta) || ta.selectionStart !== ta.selectionEnd) return;
    const c = ta.selectionStart;
    const tk = tokens(ta.value).find(t => c > t.a && c < t.b);
    if (tk) { ta.setSelectionRange(tk.a, tk.b); caretKnown.add(ta); }
    syncChoiceMenu(ta);
  });

  /* ---------------- Champs a choix : menu, voix, clavier ---------------- */

  function choiceLabel(o) {
    const t = String(o).replace(/\s+/g, ' ').replace(FIELD_RE, '…').trim();
    return t ? (t.length > 32 ? t.slice(0, 30) + '…' : t) : '(rien)';
  }
  function activeChoice() {
    const ta = choiceTa;
    if (!ta || !ta.isConnected || ta !== resolveTarget()) return null; // seulement dans l'encart cible
    const tk = tokenAtSel(ta.value, ta.selectionStart, ta.selectionEnd);
    return tk && tk.choice ? { ta, tk } : null;
  }
  function syncChoiceMenu(ta) {
    const tk = ta && tokenAtSel(ta.value, ta.selectionStart, ta.selectionEnd);
    if (!tk || !tk.choice) { if (choiceTa === ta || !activeChoice()) closeChoiceMenu(); return; }
    choiceTa = ta;
    const ul = $('#choiceList');
    ul.innerHTML = '';
    choiceOpts(tk.raw).forEach((o, i) => {
      const li = document.createElement('li');
      li.innerHTML = '<button type="button"><b></b><span></span></button>';
      $('b', li).textContent = (i + 1) + '.';
      $('span', li).textContent = o.trim() ? o.trim() : '(rien : retirer)';
      if (!o.trim()) li.classList.add('none');
      $('button', li).addEventListener('mousedown', e => e.preventDefault());
      $('button', li).addEventListener('click', () => chooseOption(ta, i));
      ul.appendChild(li);
    });
    $('#choiceWhere').textContent = labelOf(ta);
    choiceMenu.hidden = false;
  }
  function closeChoiceMenu() { choiceMenu.hidden = true; choiceTa = null; }
  $('#choiceLater').addEventListener('click', closeChoiceMenu);
  function chooseOption(ta, idx) {
    const tk = tokenAtSel(ta.value, ta.selectionStart, ta.selectionEnd);
    if (!tk || !tk.choice) { closeChoiceMenu(); return; }
    const opts = choiceOpts(tk.raw);
    // espaces retires aux bords, mais pas les retours a la ligne voulus ({\nParagraphe…|})
    let opt = idx >= 0 && idx < opts.length ? opts[idx].replace(/^[ \t\u00a0]+|[ \t\u00a0]+$/g, '').replace(FIELD_RE, FIELD) : '';
    if (!opt.trim()) opt = '';
    let v = ta.value, a = tk.a, b = tk.b;
    if (!opt) {
      // option « rien » : ni ligne vide ni double espace a la place
      const before = v.slice(0, a), after = v.slice(b);
      if ((/(^|\n)[  ]*$/.test(before)) && /^[  ]*(\n|$)/.test(after)) {
        a -= (before.match(/[  ]*$/) || [''])[0].length;
        b += (after.match(/^[  ]*\n?/) || [''])[0].length;
        if (b === v.length && a > 0 && v[a - 1] === '\n') a--;
      } else if (/[  ]$/.test(before) && /^([  ,.;:!?)]|$)/.test(after)) a--;
    }
    v = v.slice(0, a) + opt + v.slice(b);
    const u = stackOf(undoStacks, ta); u.push(ta.value);
    ta.value = v;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    if (APP.autoGrow) APP.autoGrow(ta);
    const end = a + opt.length;
    const inside = tokens(v).find(t => t.a >= a && t.b <= end);
    const next = inside || tokens(v).find(t => t.a >= end);
    if (next) { ta.setSelectionRange(next.a, next.b); autoAdvancedAt = Date.now(); }
    else ta.setSelectionRange(end, end);
    caretKnown.add(ta);
    closeChoiceMenu();
    syncChoiceMenu(ta);
  }
  const ORD = { premier: 0, premiere: 0, un: 0, une: 0, '1': 0, deuxieme: 1, second: 1, seconde: 1, deux: 1, '2': 1,
    troisieme: 2, trois: 2, '3': 2, quatrieme: 3, quatre: 3, '4': 3, cinquieme: 4, cinq: 4, '5': 4 };
  const NONE_RE = /^(rien|aucun|aucune|sans|vide|absent|absente|supprimer|supprime|supprimez|retirer|retire|retirez|enlever|enleve|enlevez|pas de .*|ne rien mettre|non|aucune option)$/;
  const ORD_RE = /^(?:(?:l |la |le )?(?:option|choix|numero|proposition)\s+)?(?:le |la )?(\w+)(?:\s+(?:option|choix|proposition))?$/;
  // indice choisi, -1 pour « retirer », null si non reconnu
  function matchChoice(text, opts) {
    const t = normName(text);
    if (!t) return null;
    const nm = opts.map(o => normName(o.replace(FIELD_RE, ' ')));
    let i = nm.findIndex(o => o && o === t);
    if (i >= 0) return i;
    if (NONE_RE.test(t)) { const e = opts.findIndex(o => !o.trim()); return e >= 0 ? e : -1; }
    const om = t.match(ORD_RE);
    if (om && ORD[om[1]] !== undefined && ORD[om[1]] < opts.length) return ORD[om[1]];
    if (t.length >= 3) { i = nm.findIndex(o => o && o.startsWith(t)); if (i >= 0) return i; }
    i = nm.findIndex(o => o && o.length >= 3 && t.startsWith(o));
    return i >= 0 ? i : null;
  }
  // l'option peut etre suivie d'autre chose : « madame Durand champ suivant douleur »
  function matchChoicePrefix(text, opts) {
    const words = String(text).trim().split(/\s+/).filter(Boolean);
    for (let k = Math.min(words.length, 8); k >= 1; k--) {
      const head = normName(words.slice(0, k).join(' '));
      const exact = opts.findIndex(o => o.trim() && normName(o.replace(FIELD_RE, ' ')) === head);
      const om = head.match(ORD_RE);
      if (exact >= 0 || NONE_RE.test(head) || (om && ORD[om[1]] !== undefined && ORD[om[1]] < opts.length)) {
        const idx = matchChoice(words.slice(0, k).join(' '), opts);
        if (idx !== null) return { idx, rest: words.slice(k).join(' ') };
      }
    }
    const cut = PIPE.firstCommandIndex(text, C);
    const head = cut >= 0 ? String(text).slice(0, cut) : String(text);
    const idx = head.trim() ? matchChoice(head, opts) : null;
    if (idx !== null) return { idx, rest: cut >= 0 ? String(text).slice(cut).trim() : '' };
    return null;
  }
  function choiceByVoice(text, ac) {
    const opts = choiceOpts(ac.tk.raw);
    const hit = matchChoicePrefix(text, opts);
    if (hit) {
      chooseOption(ac.ta, hit.idx);
      if (hit.rest) hooks.onFinal(hit.rest); // la suite va dans le champ suivant
      return;
    }
    if (splitNav(text).some(x => x.nav || x.validate)) { closeChoiceMenu(); processText(text, true); return; }
    const ops = PIPE.parse(text, C);
    if (ops.length && ops.some(o => o.type !== 'text')) { applyOps(ops, ac.ta); return; }
    toast('Choix non reconnu : dites ' + opts.map(o => '« ' + (o.trim() ? choiceLabel(o) : 'rien') + ' »').join(', ') + ', ou « option 1, 2… » ; « champ suivant » pour passer');
  }

  /* ================================================================== */
  /* Commandes propres a LeSacAUrge : navigation entre encarts           */
  /* ================================================================== */
  const NAV = [
    ['motif', ['motif de consultation', 'motif']],
    ['anamnese', ['anamnèse', 'histoire de la maladie']],
    ['atcd_chir', ['antécédents chirurgicaux', 'antécédent chirurgical']],
    ['atcd_med', ['antécédents médicaux', 'antécédent médical', 'antécédents']],
    ['traitements', ['traitements habituels', 'traitement habituel', 'traitements', 'traitement']],
    ['allergies', ['allergies', 'allergie']],
    ['examen', ['examen clinique', 'examen']],
    ['hypotheses', ['hypothèses diagnostiques', 'hypothèse diagnostique', 'hypothèses', 'hypothèse']],
    ['ecg', ['électrocardiogramme', 'ecg']],
    ['cat', ['conduite à tenir']],
    ['evolution', ['évolution']],
    ['conclusion', ['conclusion']]
  ];
  const ACC = { a: '[aàâä]', e: '[eéèêë]', i: '[iîï]', o: '[oôö]', u: '[uùûü]', c: '[cç]' };
  const loose = p => normName(p).split('').map(ch => ch === ' ' ? '[\\s-]+' : (ACC[ch] || ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('');
  const navNames = [];
  NAV.forEach(([id, says]) => says.forEach(s => navNames.push([s, id])));
  navNames.sort((a, b) => b[0].length - a[0].length);
  const NAV_TRIG = '(?:(?:encart|section)[\\s-]+(?:l[\'’]\\s*|les?[\\s-]+|la[\\s-]+)?|(?:va|vas|allez|aller|passe|passez|passer)[\\s-]+(?:[aà][\\s-]+l[\'’]\\s*|[aà][\\s-]+la[\\s-]+|[aà][\\s-]+|au[\\s-]+|aux[\\s-]+|en[\\s-]+))';
  const NAV_RE = new RegExp('(^|[^\\p{L}\\p{N}])(' + NAV_TRIG + '(' + navNames.map(n => loose(n[0])).join('|') + ')|(valide[rz]?[\\s-]+l[\'’]\\s*entr[eé]e))(?=$|[^\\p{L}\\p{N}])', 'giu');
  function navId(spoken) {
    const n = normName(spoken);
    const hit = navNames.find(x => normName(x[0]) === n);
    return hit ? hit[1] : null;
  }
  // Decoupe la transcription : [{text}|{nav:id}|{validate:true}]
  function splitNav(text) {
    const out = [];
    let last = 0, m;
    NAV_RE.lastIndex = 0;
    while ((m = NAV_RE.exec(text))) {
      const start = m.index + m[1].length;
      out.push({ text: text.slice(last, start) });
      if (m[4]) out.push({ validate: true });
      else out.push({ nav: navId(m[3]) });
      last = start + m[2].length;
    }
    out.push({ text: text.slice(last) });
    return out;
  }
  function goSection(id) {
    const ta = mainField(id);
    if (!ta) { toast('Encart masqué : ' + (APP.sectionTitle(id) || id)); return; }
    setTarget(ta);
    const card = document.getElementById('card-' + id);
    const chip = $('.nav-chip[data-go="' + id + '"]');
    if (chip) chip.click(); else if (card) card.scrollIntoView({ block: 'start', behavior: 'smooth' });
    setTarget(ta);
    st.capsNext = false; listMode = null;
  }
  function validateEntry() {
    const btn = $('#evoAddBtn');
    if (!btn) return;
    btn.click();
    setTarget($('#evoInput'));
  }

  /* ================================================================== */
  /* Dictee                                                              */
  /* ================================================================== */
  const interimEl = $('#interim');
  const micBtn = $('#micBtn');
  let engine = null, engineKind = null, listening = false, busy = 0;
  let held = '', heldTimer = null;

  function resolveEngine() {
    const e = D.engine;
    if (e === 'browser' || e === 'cloud' || e === 'keyboard') return e;
    if (SPEECH.BrowserEngine.available) return 'browser';
    if (lsGet(KEY_KEY) && SPEECH.CloudEngine.available) return 'cloud';
    return 'keyboard';
  }
  const engineLabel = k => ({ browser: 'Navigateur', cloud: 'API de transcription', keyboard: 'Clavier' }[k] || k);
  function cloudCfg() {
    const p = D.cloudProvider;
    const def = (CFG.cloud && CFG.cloud[p]) || {};
    const vocab = LEX.ACRONYMS.filter(a => a.length >= 3).slice(0, 60).concat(parsePairs(APP.cfg().dict).map(r => r[1]).slice(0, 40));
    return { provider: p, endpoint: D.cloudEndpoint || def.endpoint, model: D.cloudModel || def.model, key: lsGet(KEY_KEY) || '', vocab };
  }
  function processText(text, isFinalChunk) {
    const parts = splitNav(text);
    parts.forEach((p, i) => {
      if (p.nav) { goSection(p.nav); return; }
      if (p.validate) { validateEntry(); return; }
      let t = p.text;
      if (!t.trim()) return;
      // « épelle d u p o n t fin » : tout part en epellation, sans mise en attente de « fin »
      const direct = PIPE.parse(t, C);
      if (direct.some(o => o.type === 'spell')) { applyOps(direct); return; }
      if (isFinalChunk && i === parts.length - 1) {
        // debut d'une commande de navigation coupe par une pause (« … encart » puis « examen »)
        const nav = t.match(/(?:^|\s)((?:encart|section|(?:va|vas|allez|aller|passe|passez|passer)(?:\s+(?:[aà]|au|aux|en)(?:\s+(?:la|l['’]))?)?)\s*)$/i);
        let n = nav ? nav[1].length : PIPE.incompleteTail(t, C);
        if (n) {
          held = t.slice(t.length - n).trim();
          heldTimer = setTimeout(flushHeld, 2500);
          t = t.slice(0, t.length - n);
        }
      }
      if (t.trim()) applyChained(PIPE.parse(t, C));
    });
  }
  /* Applique les operations ; quand « champ suivant » arrive sur un choix {a|b}, les mots
     qui suivent servent a choisir (« champ suivant madame Durand »), le reste continue. */
  function applyChained(ops) {
    let rest = ops.slice();
    while (rest.length) {
      const k = rest.findIndex(o => o.type === 'field');
      if (k < 0) { applyOps(rest); return; }
      applyOps(rest.slice(0, k + 1));
      rest = rest.slice(k + 1);
      const ac = activeChoice();
      if (!ac || !rest.length) continue;
      let n = 0;
      while (n < rest.length && (rest[n].type === 'text' || rest[n].type === 'punct')) n++;
      const words = rest.slice(0, n).filter(o => o.type === 'text').map(o => o.text).join(' ');
      const hit = words ? matchChoicePrefix(words, choiceOpts(ac.tk.raw)) : null;
      if (!hit) continue;
      chooseOption(ac.ta, hit.idx);
      rest = (hit.rest ? [{ type: 'text', text: hit.rest }] : []).concat(rest.slice(n));
    }
  }
  const hooks = {
    // commandes appliquees au fil de la parole (moteur du navigateur) ; jamais pendant l'epellation
    commitPoint(t) { return spellMode ? 0 : PIPE.commitPoint(t, C, 1); },
    normalize(t) { return PIPE.normalizeTranscript(t); },
    onInterim(t) {
      if (spellMode) { showSpellBadge(t); return; }
      if (t) { interimEl.textContent = t; interimEl.hidden = false; }
      else interimEl.hidden = true;
    },
    onFinal(t) {
      if (spellMode) { spellInput(PIPE.normalizeTranscript(t)); return; }
      clearTimeout(heldTimer);
      const text = (held ? held + ' ' : '') + PIPE.normalizeTranscript(t).trim();
      held = '';
      const ac = activeChoice();
      if (ac) { choiceByVoice(text, ac); return; }
      processText(text, true);
    },
    onState(s) {
      listening = s === 'listening';
      micBtn.classList.toggle('on', listening);
      micBtn.setAttribute('aria-label', listening ? 'Arrêter la dictée' : 'Démarrer la dictée');
      const ta = resolveTarget();
      $$('.dict-target').forEach(x => x.classList.remove('dict-target'));
      if (listening && ta) ta.classList.add('dict-target');
      document.body.classList.toggle('dictating', listening);
      renderStatus();
    },
    onBusy(b) { busy += b ? 1 : -1; renderStatus(); },
    onError(m) { toast(m); renderStatus(); }
  };
  function flushHeld() {
    clearTimeout(heldTimer);
    const t = held;
    held = '';
    if (!t) return;
    const m = t.match(/^\s*ins[eèé]r(?:e|er|ez|t)?\b(?:\s+(?:le|la|les|un|une|mon|ma|mes|du|des)\b|\s+l['’])?\s*(.*)$/i);
    if (m) {
      const rest = normName(m[1]);
      const list = snippetList();
      const hits = rest ? list.filter(x => normName(x.name).startsWith(rest)) : [];
      if (hits.length === 1) { applyOps([{ type: 'snippet', text: hits[0].text }]); return; }
      if (!rest || hits.length > 1) { openSnipMenu(rest ? hits : null); toast(rest ? 'Plusieurs textes types commencent ainsi : touchez le bon' : 'Dites le nom du texte type ou touchez-le'); return; }
    }
    applyOps(PIPE.parse(t, C));
  }
  function renderStatus() {
    const ta = resolveTarget();
    const where = ta ? labelOf(ta) : '';
    const k = resolveEngine();
    const state = listening ? (busy > 0 ? 'Transcription…' : 'Écoute') : (busy > 0 ? 'Transcription…' : engineLabel(k));
    $('#dictWhere').textContent = where;
    $('#dictState').textContent = state;
  }
  function startDictation() {
    const k = resolveEngine();
    const ta = resolveTarget();
    if (ta) setTarget(ta);
    if (k === 'keyboard') {
      setKeyboard(true);
      if (ta) { ta.focus(); try { ta.setSelectionRange(ta.value.length, ta.value.length); } catch (e) {} }
      toast(SPEECH.isIOS ? 'Touchez le micro du clavier pour dicter, puis « Mise en forme »' : 'Utilisez la dictée du clavier, puis « Mise en forme »');
      return;
    }
    if (engine && engineKind !== k) { engine.stop(); engine = null; }
    if (!engine) {
      engine = k === 'cloud' ? new SPEECH.CloudEngine(hooks, cloudCfg()) : new SPEECH.BrowserEngine(hooks);
      engineKind = k;
    }
    if (k === 'cloud') engine.cfg = cloudCfg();
    st.capsNext = false; st.capsLock = false; listMode = null;
    engine.start('fr-FR');
  }
  function stopDictation() { if (engine) engine.stop(); setTimeout(flushHeld, 600); if (spellMode) endSpell(); }

  /* ---------------- Epellation d'un nom propre (MAJUSCULES) ---------------- */
  let spellMode = false, spellStarted = false, spellSoFar = '', spellTimer = null;
  const spellBtn = $('#spellBtn');
  function showSpellBadge(interim) {
    interimEl.classList.add('spell');
    interimEl.textContent = 'Épellation : ' + (spellSoFar || '…') + (interim ? '  ' + interim : '') + '  -  dites « fin »';
    interimEl.hidden = false;
  }
  function armSpellTimer() { clearTimeout(spellTimer); spellTimer = setTimeout(() => { if (spellMode) endSpell(); }, 8000); }
  function startSpell() {
    if (!spellMode) { spellMode = true; spellStarted = false; spellSoFar = ''; }
    clearTimeout(heldTimer); held = '';
    spellBtn.classList.add('on'); spellBtn.setAttribute('aria-pressed', 'true');
    showSpellBadge('');
    armSpellTimer();
  }
  function spellInput(t) {
    // ce qui suit « fin » reprend la dictee normale (« … fin virgule en 2019 »)
    const cut = String(t).match(/^(.*?(?:^|[\s,.;])(?:fin|termin[ée]e?|stop|fini|c['’]est tout))(?=$|[\s,.;!?])(.*)$/i);
    const rest = cut ? cut[2] : '';
    if (cut) t = cut[1];
    const r = PIPE.spell(t);
    if (r.end && rest.trim()) { setTimeout(() => processText(rest, true), 0); }
    if (r.text) {
      if (!spellStarted) { applyOps([{ type: 'text', text: r.text, verbatim: true }]); spellStarted = true; }
      else applyOps([{ type: 'raw', text: r.text }]);
      spellSoFar += r.text;
    }
    if (r.end) endSpell(); else { showSpellBadge(''); armSpellTimer(); }
  }
  function endSpell() {
    clearTimeout(spellTimer);
    const done = spellSoFar;
    spellMode = false; spellStarted = false; spellSoFar = '';
    spellBtn.classList.remove('on'); spellBtn.setAttribute('aria-pressed', 'false');
    interimEl.classList.remove('spell'); interimEl.hidden = true;
    if (done) toast('Nom écrit : ' + done);
  }
  spellBtn.addEventListener('mousedown', e => e.preventDefault());
  spellBtn.addEventListener('click', () => {
    if (spellMode) { endSpell(); return; }
    startSpell();
    if (!listening && resolveEngine() !== 'keyboard') startDictation();
  });

  /* ---------------- Clavier virtuel (telephone, tablette) : a la demande ---------------- */
  const touchUI = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
  const kbBtn = $('#kbBtn');
  let kbShown = !touchUI || resolveEngine() === 'keyboard', kbHinted = false;
  const kbTargets = () => $$('#sections textarea');
  function applyKb(el) { if (!touchUI) return; if (kbShown) el.removeAttribute('inputmode'); else el.setAttribute('inputmode', 'none'); }
  function setKeyboard(show) {
    if (!touchUI) return;
    kbShown = !!show;
    kbTargets().forEach(applyKb);
    kbBtn.classList.toggle('on', kbShown); kbBtn.setAttribute('aria-pressed', String(kbShown));
    const ta = document.activeElement;
    if (isTargetable(ta)) { // le changement ne prend effet qu'a la prochaine prise de focus
      const a = ta.selectionStart, b = ta.selectionEnd;
      ta.blur(); ta.focus({ preventScroll: true }); try { ta.setSelectionRange(a, b); } catch (e) {}
    }
  }
  if (touchUI) {
    document.body.classList.add('touch');
    new MutationObserver(() => kbTargets().forEach(applyKb)).observe($('#sections'), { childList: true, subtree: true });
    setKeyboard(kbShown);
    kbBtn.addEventListener('mousedown', e => e.preventDefault());
    kbBtn.addEventListener('click', () => {
      setKeyboard(!kbShown);
      if (kbShown) { const ta = resolveTarget(); if (ta && document.activeElement !== ta) ta.focus(); }
    });
    document.addEventListener('focusin', e => {
      if (!kbShown && !kbHinted && isTargetable(e.target)) { kbHinted = true; toast('Clavier masqué pendant la dictée : touchez ⌨ pour l\'afficher'); }
    });
  }
  micBtn.addEventListener('mousedown', e => e.preventDefault());
  micBtn.addEventListener('click', () => { if (listening) stopDictation(); else startDictation(); });
  document.addEventListener('keydown', e => {
    if (e.altKey && !e.ctrlKey && !e.metaKey && (e.code === 'KeyD')) { e.preventDefault(); micBtn.click(); }
  });
  $('#dictInfo').addEventListener('click', () => { renderHelp(); $('#cmdHelp').showModal(); });

  /* ---------------- Mise en forme (texte saisi au clavier) ---------------- */
  function tidyField(ta) {
    ta = ta || resolveTarget();
    if (!ta || !ta.value.trim()) { toast('Encart vide'); return; }
    const before = ta.value;
    const out = before.split('\n').map(line => {
      if (!line.trim()) return line;
      const ops = PIPE.parse(line, C).filter(o => /^(text|punct|nl|par|caps|snippet)$/.test(o.type));
      let r = PIPE.renderPlain(ops, textOpts(), '');
      r = PIPE.tidy(r, Object.assign(textOpts(), { autoCap: false }));
      return r.replace(/^\n+|\n+$/g, '');
    }).join('\n');
    if (out === before) { toast('Aucune modification nécessaire'); return; }
    const u = stackOf(undoStacks, ta); u.push(before);
    ta.value = out;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    if (APP.autoGrow) APP.autoGrow(ta);
    toast(labelOf(ta) + ' mis en forme', 'Annuler', () => { ta.value = before; ta.dispatchEvent(new Event('input', { bubbles: true })); if (APP.autoGrow) APP.autoGrow(ta); });
  }
  $('#tidyBtn').addEventListener('mousedown', e => e.preventDefault());
  $('#tidyBtn').addEventListener('click', () => tidyField());

  /* ---------------- Glisser l'observation complete ---------------- */
  const dragAll = $('#dragAllBtn');
  dragAll.addEventListener('dragstart', ev => {
    const text = APP.allText();
    if (!text) { ev.preventDefault(); toast('Observation vide'); return; }
    APP.startDrag(ev, text);
  });
  dragAll.addEventListener('click', () => toast('Maintenez et faites glisser l\'observation complète vers le logiciel'));

  /* ================================================================== */
  /* Verification (LanguageTool)                                         */
  /* ================================================================== */
  const MED = new Set(LEX.MEDICAL_WORDS.map(w => w.toLowerCase())
    .concat(MEDDATA.terms || [], Object.keys(MEDDATA.drugs || {}).map(w => w.toLowerCase()), Object.keys(MEDDATA.abbr || {}).map(w => w.toLowerCase()))
    .concat(LEX.ACRONYMS.map(a => a.toLowerCase())));
  let issues = [], checkTa = null;
  const ignored = () => new Set(parsePairs(APP.cfg().dict).map(r => r[1].toLowerCase()));
  async function runCheck(ta) {
    ta = ta || resolveTarget();
    checkTa = ta;
    const text = ta ? ta.value : '';
    if (!text.trim()) { toast('Encart vide : rien à vérifier'); return; }
    if (!D.ltUrl) { toast('Indiquez un serveur LanguageTool dans les réglages'); return; }
    if (!D.ltConsent && /languagetool\.org/.test(D.ltUrl)) {
      if (!confirm('Le texte de l\'encart va être envoyé au service en ligne LanguageTool (LanguageTool GmbH, Allemagne) pour vérification.\nNe vérifiez pas de texte contenant l\'identité d\'un patient.\n\nContinuer ?')) return;
      D.ltConsent = true; saveD();
    }
    toast('Vérification…');
    let res;
    try {
      const body = new URLSearchParams({ text, language: 'fr', motherTongue: 'fr' });
      if (D.ltPicky) body.set('level', 'picky');
      const r = await fetch(D.ltUrl, { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' } });
      if (r.status === 429) throw new Error('Trop de vérifications : patientez une minute.');
      if (!r.ok) throw new Error('Serveur de vérification indisponible (HTTP ' + r.status + ').');
      res = await r.json();
    } catch (e) {
      toast(e.message && !/fetch/i.test(e.message) ? e.message : 'Vérification impossible (hors ligne ?)');
      return;
    }
    const ign = ignored();
    issues = (res.matches || []).map(m => ({
      offset: m.offset, length: m.length, message: m.message,
      reps: (m.replacements || []).slice(0, 4).map(x => x.value),
      type: (m.rule && m.rule.issueType) || '', cat: (m.rule && m.rule.category && m.rule.category.name) || '',
      word: text.substr(m.offset, m.length), ctx: m.context
    })).filter(m => {
      // texte brut : pas d'espaces insecables, les remarques typographiques sur les espaces sont inutiles
      if (m.type === 'whitespace' || /espace insécable|espace fine/i.test(m.message)) return false;
      if (m.type === 'misspelling' && (MED.has(m.word.toLowerCase()) || ign.has(m.word.toLowerCase()))) return false;
      if (/^\[?…\]?$/.test(m.word)) return false;
      return true;
    });
    $('#checkWhere').textContent = labelOf(ta);
    renderIssues();
    if (!$('#checker').open) $('#checker').showModal();
  }
  function issueLabel(m) {
    if (m.type === 'misspelling') return 'Orthographe';
    if (m.type === 'grammar') return 'Grammaire';
    if (m.type === 'typographical') return 'Typographie';
    if (m.type === 'style' || m.type === 'locale-violation') return 'Style';
    return m.cat || 'Remarque';
  }
  function renderIssues() {
    const ul = $('#issues');
    $('#checkSummary').textContent = issues.length ? issues.length + ' remarque' + (issues.length > 1 ? 's' : '') : 'Aucune faute détectée.';
    $('#fixAllBtn').hidden = !issues.some(m => m.reps.length);
    ul.innerHTML = '';
    issues.forEach((m, idx) => {
      const li = document.createElement('li');
      const ctx = m.ctx ? esc(m.ctx.text.slice(0, m.ctx.offset)) + '<mark>' + esc(m.ctx.text.substr(m.ctx.offset, m.ctx.length)) + '</mark>' + esc(m.ctx.text.slice(m.ctx.offset + m.ctx.length)) : esc(m.word);
      li.innerHTML = '<div class="iss-head"><span class="tag t-' + esc(m.type || 'x') + '">' + esc(issueLabel(m)) + '</span><span>' + esc(m.message) + '</span></div>' +
        '<div class="iss-ctx">' + ctx + '</div><div class="iss-act"></div>';
      const act = $('.iss-act', li);
      m.reps.forEach(rp => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'btn btn-primary small'; b.textContent = rp || '(supprimer)';
        b.addEventListener('click', () => applyIssue(idx, rp));
        act.appendChild(b);
      });
      const ig = document.createElement('button');
      ig.type = 'button'; ig.className = 'btn small';
      ig.textContent = m.type === 'misspelling' ? 'Ajouter au dictionnaire' : 'Ignorer';
      ig.addEventListener('click', () => {
        if (m.type === 'misspelling') addToDict(m.word, m.word);
        issues.splice(idx, 1); renderIssues();
      });
      act.appendChild(ig);
      const show = document.createElement('button');
      show.type = 'button'; show.className = 'btn small'; show.textContent = 'Voir';
      show.addEventListener('click', () => {
        $('#checker').close();
        if (!checkTa) return;
        checkTa.focus({ preventScroll: true });
        checkTa.setSelectionRange(m.offset, m.offset + m.length);
        checkTa.scrollIntoView({ block: 'center', behavior: 'smooth' });
      });
      act.appendChild(show);
      ul.appendChild(li);
    });
  }
  function replaceAt(m, rep) {
    const ta = checkTa;
    if (!ta || ta.value.substr(m.offset, m.length) !== m.word) return false;
    ta.value = ta.value.slice(0, m.offset) + rep + ta.value.slice(m.offset + m.length);
    const delta = rep.length - m.length;
    issues.forEach(x => { if (x !== m && x.offset > m.offset) x.offset += delta; });
    return true;
  }
  function commitCheck() {
    if (!checkTa) return;
    checkTa.dispatchEvent(new Event('input', { bubbles: true }));
    if (APP.autoGrow) APP.autoGrow(checkTa);
  }
  function applyIssue(idx, rep) {
    const m = issues[idx];
    if (checkTa) stackOf(undoStacks, checkTa).push(checkTa.value);
    if (!replaceAt(m, rep)) toast('Passage modifié entre-temps : corrigez-le à la main');
    issues.splice(idx, 1);
    commitCheck();
    renderIssues();
  }
  $('#fixAllBtn').addEventListener('click', () => {
    if (checkTa) stackOf(undoStacks, checkTa).push(checkTa.value);
    const list = issues.filter(m => m.reps.length).sort((a, b) => b.offset - a.offset);
    let n = 0;
    list.forEach(m => { if (replaceAt(m, m.reps[0])) n++; });
    issues = issues.filter(m => !m.reps.length);
    commitCheck(); renderIssues();
    toast(n + ' correction' + (n > 1 ? 's' : '') + ' appliquée' + (n > 1 ? 's' : ''));
  });
  $('#checkBtn').addEventListener('mousedown', e => e.preventDefault());
  $('#checkBtn').addEventListener('click', () => runCheck());
  // Bouton « Vérifier » de chaque encart
  $('#sections').addEventListener('click', e => {
    const b = e.target.closest('.check-btn');
    if (!b) return;
    const ta = $(':scope > textarea', b.closest('.card'));
    if (ta) { setTarget(ta); runCheck(ta); }
  });

  /* ================================================================== */
  /* Dictionnaire personnel                                              */
  /* ================================================================== */
  function addToDict(said, written) {
    const rows = parsePairs(APP.cfg().dict);
    if (rows.some(r => r[0].toLowerCase() === said.toLowerCase())) { toast('« ' + said + ' » est déjà dans le dictionnaire'); return; }
    APP.setCfg('dict', (APP.cfg().dict.replace(/\s+$/, '') + '\n' + said + ' = ' + written).replace(/^\n/, ''));
    recompile();
    toast('« ' + written + ' » ajouté au dictionnaire personnel');
  }

  /* ================================================================== */
  /* Textes types : menu et gestionnaire                                 */
  /* ================================================================== */
  const snipMenu = $('#snipMenu');
  function openSnipMenu(only) {
    const list = only || snippetList();
    const ul = $('#snipMenuList');
    ul.innerHTML = '';
    if (!list.length) ul.innerHTML = '<li class="hint" style="padding:10px">Aucun texte type. Touchez « Gérer » pour en créer.</li>';
    list.forEach(x => {
      const li = document.createElement('li');
      li.innerHTML = '<button type="button" role="menuitem"><b></b><span></span></button>';
      $('b', li).textContent = x.name;
      $('span', li).textContent = snippetPreview(x.text).replace(/\n+/g, ' · ').slice(0, 90);
      $('button', li).addEventListener('mousedown', e => e.preventDefault());
      $('button', li).addEventListener('click', () => { closeSnipMenu(); applyOps([{ type: 'snippet', text: x.text }]); });
      ul.appendChild(li);
    });
    $('#snipWhere').textContent = 'Insertion dans : ' + (resolveTarget() ? labelOf(resolveTarget()) : '-');
    snipMenu.hidden = false;
  }
  function closeSnipMenu() { snipMenu.hidden = true; }
  function snippetPreview(text) {
    return String(text).replace(CHOICE_RE, (m, inner) => '‹' + inner.split('|').map(o => o.trim() ? o.replace(/\s+/g, ' ').trim().slice(0, 18) : '∅').join(' / ') + '›');
  }
  $('#snipBtn').addEventListener('mousedown', e => e.preventDefault());
  $('#snipBtn').addEventListener('click', e => { e.stopPropagation(); snipMenu.hidden ? openSnipMenu() : closeSnipMenu(); });
  document.addEventListener('click', e => { if (!snipMenu.hidden && !snipMenu.contains(e.target) && !e.target.closest('#snipBtn')) closeSnipMenu(); });
  $('#snipManageBtn').addEventListener('click', () => { closeSnipMenu(); openSnipMgr(); });
  $('#snipFromSelBtn').addEventListener('mousedown', e => e.preventDefault());
  $('#snipFromSelBtn').addEventListener('click', () => {
    closeSnipMenu();
    const ta = resolveTarget();
    const text = ta && caretKnown.has(ta) ? ta.value.slice(ta.selectionStart, ta.selectionEnd) : '';
    if (!text.trim()) { toast('Sélectionnez d\'abord le texte à enregistrer dans un encart'); return; }
    openSnipMgr({ name: '', text: text.trim() });
  });

  let mgrIdx = -1, mgrList = [], mgrTimer = null;
  function openSnipMgr(prefill) {
    mgrList = snippetList();
    if (prefill) { mgrList.push(prefill); mgrIdx = mgrList.length - 1; }
    else if (mgrIdx < 0 || mgrIdx >= mgrList.length) mgrIdx = mgrList.length ? 0 : -1;
    renderSnipMgr();
    if (!$('#snipMgr').open) $('#snipMgr').showModal();
    if (prefill) setTimeout(() => $('#snipName').focus(), 50);
  }
  function renderSnipMgr() {
    const ul = $('#snipMgrList');
    ul.innerHTML = '';
    mgrList.forEach((x, i) => {
      const li = document.createElement('li');
      li.innerHTML = '<button type="button"></button>';
      li.className = i === mgrIdx ? 'cur' : '';
      $('button', li).textContent = x.name || '(sans nom)';
      $('button', li).addEventListener('click', () => { mgrIdx = i; renderSnipMgr(); });
      ul.appendChild(li);
    });
    const cur = mgrList[mgrIdx];
    $('#snipEdit').hidden = !cur;
    if (cur) {
      if (document.activeElement !== $('#snipName')) $('#snipName').value = cur.name;
      if (document.activeElement !== $('#snipText')) $('#snipText').value = cur.text;
      const nf = (cur.text.replace(CHOICE_RE, '').match(FIELD_RE) || []).length, nc = (cur.text.match(CHOICE_RE) || []).length;
      $('#snipSay').textContent = cur.name ? 'Pour l\'insérer, dites : « insère ' + cur.name + ' »' + (nf ? ' - ' + nf + ' champ(s) à compléter' : '') + (nc ? ' - ' + nc + ' choix' : '') : '';
    }
  }
  function mgrChanged() {
    const cur = mgrList[mgrIdx];
    if (!cur) return;
    cur.name = $('#snipName').value.replace(/=/g, '-');
    cur.text = $('#snipText').value;
    renderSnipMgr();
    clearTimeout(mgrTimer);
    mgrTimer = setTimeout(() => {
      mgrTimer = null;
      const names = mgrList.filter(x => x.name.trim()).map(x => normName(x.name));
      if (new Set(names).size !== names.length) { toast('Deux textes types ont le même nom'); return; }
      saveSnippets(mgrList);
    }, 400);
  }
  $('#snipName').addEventListener('input', mgrChanged);
  $('#snipText').addEventListener('input', mgrChanged);
  $('#snipNewBtn').addEventListener('click', () => { mgrList.push({ name: '', text: '' }); mgrIdx = mgrList.length - 1; renderSnipMgr(); $('#snipName').focus(); });
  $('#snipDelBtn').addEventListener('click', () => {
    const cur = mgrList[mgrIdx];
    if (!cur || !confirm('Supprimer le texte type « ' + (cur.name || 'sans nom') + ' » ?')) return;
    mgrList.splice(mgrIdx, 1);
    mgrIdx = Math.min(mgrIdx, mgrList.length - 1);
    saveSnippets(mgrList); renderSnipMgr();
  });
  function wrapInSnippet(make) {
    const ta = $('#snipText');
    const a = ta.selectionStart, b = ta.selectionEnd;
    const [ins, selFrom, selTo] = make(ta.value.slice(a, b));
    ta.value = ta.value.slice(0, a) + ins + ta.value.slice(b);
    ta.focus(); ta.selectionStart = a + selFrom; ta.selectionEnd = a + selTo;
    mgrChanged();
  }
  $('#snipChoiceBtn').addEventListener('click', () => wrapInSnippet(sel => {
    const first = sel || 'monsieur';
    return ['{' + first + '|' + (sel ? 'autre option' : 'madame') + '}', 1, 1 + first.length];
  }));
  $('#snipOptBtn').addEventListener('click', () => wrapInSnippet(sel => {
    const body = sel || 'Paragraphe facultatif.';
    return ['{' + body + '|}', 1, 1 + body.length];
  }));
  $('#snipFieldBtn').addEventListener('click', () => {
    const ta = $('#snipText');
    const a = ta.selectionStart, b = ta.selectionEnd;
    ta.value = ta.value.slice(0, a) + FIELD + ta.value.slice(b);
    ta.focus(); ta.selectionStart = ta.selectionEnd = a + FIELD.length;
    mgrChanged();
  });
  $('#snipInsertBtn').addEventListener('click', () => {
    const cur = mgrList[mgrIdx];
    if (!cur || !cur.text.trim()) return;
    clearTimeout(mgrTimer); mgrTimer = null; saveSnippets(mgrList);
    $('#snipMgr').close();
    applyOps([{ type: 'snippet', text: cur.text }]);
  });
  $('#snipMgr').addEventListener('close', () => { if (mgrTimer) { clearTimeout(mgrTimer); mgrTimer = null; saveSnippets(mgrList); } });

  /* ================================================================== */
  /* Definitions (lexique medical integre, puis Wiktionnaire / Wikipedia) */
  /* ================================================================== */
  const bubble = $('#defBubble');
  let bubbleTimer = null, bubbleReq = 0, bubbleWord = '';
  function hideBubble() { bubble.hidden = true; bubbleWord = ''; bubbleReq++; }
  function renderBubble(res, word) {
    $('#defTitle').textContent = (res && res.title) || word;
    let kind = res ? res.kind : '';
    if (res && res.medical && !/médic|Abrév/i.test(kind)) kind = /^(Mot|Terme médical.*)$/.test(kind) ? 'Terme médical' : 'Terme médical · ' + kind;
    $('#defKind').textContent = kind || '';
    const body = $('#defBody');
    body.innerHTML = '';
    if (!res) { body.innerHTML = '<p class="hint">Recherche…</p>'; $('#defFoot').innerHTML = ''; return; }
    if (res.note) { const p = document.createElement('p'); p.className = 'hint'; p.textContent = res.note; body.appendChild(p); }
    (res.sections || []).forEach(sec => {
      if (sec.pos) { const h = document.createElement('div'); h.className = 'def-pos'; h.textContent = sec.pos; body.appendChild(h); }
      const ol = document.createElement(sec.defs.length > 1 ? 'ol' : 'div');
      sec.defs.forEach(d => { const li = document.createElement(sec.defs.length > 1 ? 'li' : 'p'); li.textContent = d; ol.appendChild(li); });
      body.appendChild(ol);
    });
    if (!(res.sections || []).length) {
      const p = document.createElement('p'); p.className = 'hint';
      p.textContent = res.error || (res.offline ? (D.defOnline ? 'Pas de définition intégrée ; recherche en ligne indisponible.' : 'Pas de définition intégrée. Activez la recherche en ligne dans les réglages.') : 'Aucune définition trouvée.');
      body.appendChild(p);
    }
    const foot = $('#defFoot');
    foot.innerHTML = '';
    if (res.src) {
      const a = document.createElement(res.url ? 'a' : 'span');
      a.textContent = 'Source : ' + res.src;
      if (res.url) { a.href = res.url; a.target = '_blank'; a.rel = 'noopener'; }
      foot.appendChild(a);
    }
  }
  async function showDefinition(word) {
    word = String(word || '').trim().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    if (!word || word.length > 40 || word.split(/\s+/).length > 3 || !/\p{L}/u.test(word)) return;
    if (word === bubbleWord && !bubble.hidden) return;
    bubbleWord = word;
    const req = ++bubbleReq;
    renderBubble(null, word);
    bubble.hidden = false;
    const res = await window.LSAMMDef.lookup(word, { med: MEDDATA, online: D.defOnline && navigator.onLine !== false });
    if (req !== bubbleReq) return;
    renderBubble(res, word);
  }
  function wordAt(ta) {
    const a = ta.selectionStart, b = ta.selectionEnd;
    if (b > a) return ta.value.slice(a, b);
    const left = (ta.value.slice(0, a).match(/[\p{L}\p{N}'’-]*$/u) || [''])[0];
    const right = (ta.value.slice(a).match(/^[\p{L}\p{N}'’-]*/u) || [''])[0];
    return left + right;
  }
  function onSelection() {
    clearTimeout(bubbleTimer);
    if (!D.defBubble || listening) return;
    bubbleTimer = setTimeout(() => {
      const ta = document.activeElement;
      if (!isTargetable(ta)) return;
      const sel = ta.value.slice(ta.selectionStart, ta.selectionEnd).trim();
      if (!sel || sel === FIELD) return;
      if (sel.split(/\s+/).length <= 3 && sel.length <= 40) showDefinition(sel);
    }, 450);
  }
  document.addEventListener('selectionchange', onSelection);
  document.addEventListener('select', onSelection, true);
  $('#defBtn').addEventListener('mousedown', e => e.preventDefault());
  $('#defBtn').addEventListener('click', () => {
    const ta = resolveTarget();
    const w = ta && caretKnown.has(ta) ? wordAt(ta) : '';
    if (!w.trim()) { toast('Placez le curseur sur un mot ou sélectionnez-le'); return; }
    bubbleWord = '';
    showDefinition(w);
  });
  $('#defClose').addEventListener('click', hideBubble);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { hideBubble(); closeSnipMenu(); } });
  document.addEventListener('input', e => { if (isTargetable(e.target) && !bubble.hidden) hideBubble(); });

  /* ================================================================== */
  /* Aide : commandes vocales                                            */
  /* ================================================================== */
  function renderHelp() {
    const groups = {};
    LEX.COMMANDS.forEach(c => {
      if (/gras|italique|soulign|titre/i.test(c.label)) return; // texte brut : sans objet
      const label = c.id === 'copy' ? 'Copier l\'encart' : c.label;
      (groups[c.group] = groups[c.group] || []).push(Object.assign({}, c, { label }));
    });
    const navRows = '<tr><td><b>« encart anamnèse »</b><span class="alt">« aller à l\'examen », « passe aux antécédents »</span></td><td>Dicter dans un autre encart (motif, anamnèse, antécédents médicaux / chirurgicaux, traitements, allergies, examen, hypothèses, ECG, conduite à tenir, évolution, conclusion)</td></tr>' +
      '<tr><td><b>« valide l\'entrée »</b></td><td>Évolution : ajoute l\'entrée dictée avec l\'heure</td></tr>' +
      '<tr><td><b>« insère examen normal »</b><span class="alt">« insère » + nom d\'un texte type</span></td><td>Insère un texte type ; « champ suivant » / « champ précédent » (ou Tab, Maj+Tab) passe d\'un champ […] ou d\'un choix {a|b} à l\'autre</td></tr>' +
      '<tr><td><b>« madame »</b><span class="alt">« option 2 », « deuxième », « rien »</span></td><td>Sur un choix {monsieur|madame} sélectionné : choisit l\'option (ou touchez-la, ou tapez 1, 2…), puis passe au champ suivant ; la suite de la phrase y est dictée</td></tr>' +
      '<tr><td><b>« épeler »</b><span class="alt">ou bouton ABC</span></td><td>Épeler un nom propre : « M A R T I N », « emme a erre… », « double vé », « tiret », « e accent grave » ; écrit en MAJUSCULES ; « fin » (ou 8 s de silence) pour terminer</td></tr>';
    $('#cmdTable').innerHTML = '<h3>LeSacAUrge</h3><table class="cmds"><tbody>' + navRows + '</tbody></table>' +
      Object.keys(groups).map(g =>
        '<h3>' + esc(g) + '</h3><table class="cmds"><tbody>' + groups[g].map(c =>
          '<tr><td><b>« ' + esc(c.say[0]) + ' »</b>' + (c.say.length > 1 ? '<span class="alt">' + c.say.slice(1, 5).map(x => '« ' + esc(x) + ' »').join(', ') + (c.say.length > 5 ? '…' : '') + '</span>' : '') +
          '</td><td>' + esc(c.label) + '</td></tr>').join('') + '</tbody></table>').join('');
  }
  $('#cmdHelpBtn').addEventListener('click', () => { renderHelp(); $('#cmdHelp').showModal(); });

  /* ================================================================== */
  /* Reglages                                                            */
  /* ================================================================== */
  function engineInfo() {
    const k = resolveEngine();
    const parts = ['Moteur utilisé : ' + engineLabel(k) + '.'];
    if (!SPEECH.hasWebSpeech) parts.push('Ce navigateur ne propose pas la reconnaissance vocale (Firefox par exemple) : utilisez Chrome, Edge ou Safari, une API de transcription, ou la dictée du clavier.');
    else if (SPEECH.isIOS && SPEECH.isStandalone()) parts.push('Sur iPhone/iPad, la reconnaissance du navigateur n\'est pas disponible dans l\'application installée sur l\'écran d\'accueil : utilisez la dictée du clavier (micro du clavier iOS) puis « Mise en forme », une API de transcription, ou ouvrez l\'application dans Safari.');
    if (k === 'browser') parts.push('Chrome et Edge envoient l\'audio aux serveurs de Google / Microsoft pour la reconnaissance ; Safari utilise le service d\'Apple.');
    return parts.join(' ');
  }
  function fillSettings() {
    $('#dEngine').value = D.engine;
    $('#dEngineInfo').textContent = engineInfo();
    $('#dCloudProvider').value = D.cloudProvider;
    const def = (CFG.cloud && CFG.cloud[D.cloudProvider]) || {};
    $('#dCloudEndpoint').value = D.cloudEndpoint || def.endpoint || '';
    $('#dCloudModel').value = D.cloudModel || def.model || '';
    $('#dCloudKey').value = lsGet(KEY_KEY) || '';
    $('#dCloudCfg').hidden = !(D.engine === 'cloud' || (D.engine === 'auto' && lsGet(KEY_KEY)));
    $('#dCap').checked = D.autoCap;
    if (document.activeElement !== $('#dictEditor')) $('#dictEditor').value = APP.cfg().dict;
    $('#dMedFix').checked = D.medFix;
    $('#dDefBubble').checked = D.defBubble;
    $('#dDefOnline').checked = D.defOnline;
    const list = snippetList();
    $('#snipSummary').textContent = list.length + ' texte' + (list.length > 1 ? 's' : '') + ' type' + (list.length > 1 ? 's' : '') + (list.length ? ' : ' + list.map(x => '« ' + x.name + ' »').join(', ') : '');
    $('#medStats').textContent = (MEDDATA.terms || []).length ? MEDDATA.terms.length.toLocaleString('fr-FR') + ' termes, ' +
      Object.keys(MEDDATA.abbr || {}).length.toLocaleString('fr-FR') + ' abréviations, ' + Object.keys(MEDDATA.drugs || {}).length.toLocaleString('fr-FR') +
      ' noms de médicaments. Sources : ' + Object.values(MEDDATA.sources || {}).join(' ; ') + '.' : '';
    $('#dLtUrl').value = D.ltUrl;
    $('#dLtPicky').checked = D.ltPicky;
  }
  $('#settingsBtn').addEventListener('click', fillSettings);
  $('#syncPill').addEventListener('click', fillSettings);
  $('#dEngine').addEventListener('change', e => { D.engine = e.target.value; saveD(); if (engine) { engine.stop(); engine = null; } fillSettings(); renderStatus(); });
  $('#dCloudProvider').addEventListener('change', e => { D.cloudProvider = e.target.value; D.cloudEndpoint = ''; D.cloudModel = ''; saveD(); fillSettings(); });
  $('#dCloudEndpoint').addEventListener('change', e => { D.cloudEndpoint = e.target.value.trim(); saveD(); });
  $('#dCloudModel').addEventListener('change', e => { D.cloudModel = e.target.value.trim(); saveD(); });
  $('#dCloudKey').addEventListener('change', e => { lsSet(KEY_KEY, e.target.value.trim()); renderStatus(); $('#dEngineInfo').textContent = engineInfo(); });
  $('#dCap').addEventListener('change', e => { D.autoCap = e.target.checked; saveD(); });
  $('#dMedFix').addEventListener('change', e => { D.medFix = e.target.checked; saveD(); recompile(); });
  $('#dDefBubble').addEventListener('change', e => { D.defBubble = e.target.checked; saveD(); if (!e.target.checked) hideBubble(); });
  $('#dDefOnline').addEventListener('change', e => { D.defOnline = e.target.checked; saveD(); });
  $('#dLtUrl').addEventListener('change', e => { D.ltUrl = e.target.value.trim(); D.ltConsent = false; saveD(); });
  $('#dLtPicky').addEventListener('change', e => { D.ltPicky = e.target.checked; saveD(); });
  let dictTimer = null;
  const saveDict = () => { clearTimeout(dictTimer); APP.setCfg('dict', $('#dictEditor').value); recompile(); };
  $('#dictEditor').addEventListener('input', () => { clearTimeout(dictTimer); dictTimer = setTimeout(saveDict, 600); });
  $('#dictEditor').addEventListener('change', saveDict);
  $('#saveDictBtn').addEventListener('click', () => { saveDict(); toast('Dictionnaire enregistré'); });
  $('#settings').addEventListener('close', () => { if (dictTimer) saveDict(); });
  $('#openSnipMgrBtn').addEventListener('click', () => openSnipMgr());

  renderStatus();
  // Interface de test
  window.LSAU_DICTEE = { hooks, chooseOption, matchChoicePrefix, spellState: () => ({ spellMode, spellSoFar }), setKeyboard, dictate: (t) => { hooks.onFinal(t); }, flush: flushHeld, applyOps, setTarget, resolveTarget, tidyField, runCheck, splitNav, addToDict, snippetList };
})();
