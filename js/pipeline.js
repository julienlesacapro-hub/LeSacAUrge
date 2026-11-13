/* LeSacAMicroMed - traitement du texte dicte
   1. parse()      : decoupe la transcription en texte et commandes vocales -> operations
   2. correct()    : corrections lexicales (sigles, unites, eponymes, prefixes...)
   3. joinPiece()  : insertion typographique francaise (espaces, insecables, majuscules)
   4. tidy()       : passe typographique sur un texte deja ecrit (mode clavier)
   Fonctions pures, sans acces au DOM : testees sous Node (tests/pipeline.test.js).
   ©2026 LESACA Julien - Tous droits reserves. */
'use strict';

(function (root) {
  const LEX = (typeof module === 'object' && module.exports) ? require('./lexique.js') : root.LSAMM_LEX;

  const L = '\\p{L}\\p{N}';
  const PRE = '(^|[^' + L + '])';          // frontiere gauche (sans lookbehind : compatibilite iOS < 16.4)
  const POST = '(?=$|[^' + L + '])';       // frontiere droite
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const phraseRe = p => esc(p.toLowerCase()).replace(/'/g, "['’]\\s*").replace(/[ -]+/g, '[\\s-]+');
  const stripAcc = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '');
  const norm = s => stripAcc(String(s).toLowerCase()).replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/’/g, "'")
    .replace(/[-\s ]+/g, ' ').replace(/[.,;:!?]+$/, '').trim();
  const ACC = { a: '[aàâä]', e: '[eéèêë]', i: '[iîï]', o: '[oôö]', u: '[uùûü]', c: '[cç]', y: '[yÿ]' };
  // expression insensible aux accents (et a œ/oe) pour les noms de textes types
  const looseRe = p => norm(p).split('').map(ch => {
    if (ch === "'") return "['’]\\s*";
    if (ch === ' ') return '[\\s-]+';
    if (ACC[ch]) return ACC[ch];
    return esc(ch);
  }).join('').replace(/\[oôö\]\[eéèêë\]/g, '(?:oe|œ)');
  const INSERT_RE = '(?:ins[eèé]r(?:e|er|ez|t)?)';

  const DET_BEFORE_POINT = new Set(['le', 'un', 'au', 'du', 'ce', 'cet', 'mon', 'ton', 'son', 'notre', 'votre', 'leur',
    'chaque', 'quel', 'quelque', 'bon', 'mauvais', 'premier', 'dernier', 'second', 'seul', 'tel', 'même', 'en', 'à',
    'de', 'sur', 'faire', 'fait', 'mis', 'mise', 'mettre', 'gros', 'petit', 'nouveau', 'autre', 'troisième']);
  const AFTER_POINT_TEXT = new Set(['de', 'd', 'du', 'des', 'à', 'au', 'aux', 'culminant', 'mort', 'faible', 'faibles',
    'fort', 'forts', 'noir', 'chaud', 'froid', 'précis', 'commun', 'communs', 'sur', 'par', 'virgule', 'virgules']);
  const DET_BEFORE_DEUX = new Set(['les', 'ces', 'des', 'aux', 'ses', 'mes', 'sur', 'nos', 'vos', 'leurs']);

  const GUARDS = {
    point(before, after) {
      const pw = lastWord(before), nw = firstWord(after);
      if (/^\d+$/.test(nw)) return true;
      return !DET_BEFORE_POINT.has(pw) && !AFTER_POINT_TEXT.has(nw);
    },
    deuxPoints(before, after) {
      const pw = lastWord(before), nw = firstWord(after);
      return !DET_BEFORE_DEUX.has(pw) && !AFTER_POINT_TEXT.has(nw);
    }
  };
  function lastWord(s) { const m = s.toLowerCase().match(/([\p{L}\p{N}]+)['’]?\s*$/u); return m ? m[1] : ''; }
  function firstWord(s) { const m = s.toLowerCase().match(/^\s*([\p{L}\p{N}]+)/u); return m ? m[1] : ''; }

  const CMD_OPS = {
    p_dot: [{ type: 'punct', ch: '.' }],
    p_dot_nl: [{ type: 'punct', ch: '.' }, { type: 'nl' }],
    p_dot_par: [{ type: 'punct', ch: '.' }, { type: 'par' }],
    p_semi: [{ type: 'punct', ch: ';' }],
    p_q: [{ type: 'punct', ch: '?' }],
    p_excl: [{ type: 'punct', ch: '!' }],
    p_ellipsis: [{ type: 'punct', ch: '…' }],
    p_comma: [{ type: 'punct', ch: ',' }],
    p_colon: [{ type: 'punct', ch: ':' }],
    p_lpar: [{ type: 'punct', ch: '(' }],
    p_rpar: [{ type: 'punct', ch: ')' }],
    p_lquote: [{ type: 'punct', ch: '«' }],
    p_rquote: [{ type: 'punct', ch: '»' }],
    p_hyphen: [{ type: 'punct', ch: '-' }],
    p_dash: [{ type: 'punct', ch: '–' }],
    p_slash: [{ type: 'punct', ch: '/' }],
    p_apos: [{ type: 'punct', ch: "'" }],
    nl: [{ type: 'nl' }],
    par: [{ type: 'par' }],
    h_on: [{ type: 'block', tag: 'h2' }],
    h_off: [{ type: 'block', tag: 'p' }],
    ul: [{ type: 'list', kind: 'ul' }],
    ol: [{ type: 'list', kind: 'ol' }],
    li: [{ type: 'li' }],
    list_off: [{ type: 'endlist' }],
    b_on: [{ type: 'fmt', fmt: 'b', on: true }],
    b_off: [{ type: 'fmt', fmt: 'b', on: false }],
    i_on: [{ type: 'fmt', fmt: 'i', on: true }],
    i_off: [{ type: 'fmt', fmt: 'i', on: false }],
    u_on: [{ type: 'fmt', fmt: 'u', on: true }],
    u_off: [{ type: 'fmt', fmt: 'u', on: false }],
    cap_next: [{ type: 'caps', mode: 'next' }],
    caps_on: [{ type: 'caps', mode: 'on' }],
    caps_off: [{ type: 'caps', mode: 'off' }],
    del_word: [{ type: 'edit', what: 'word' }],
    del_sentence: [{ type: 'edit', what: 'sentence' }],
    undo: [{ type: 'edit', what: 'undo' }],
    redo: [{ type: 'edit', what: 'redo' }],
    spell_on: [{ type: 'spell' }],
    field_next: [{ type: 'field', dir: 1 }],
    field_prev: [{ type: 'field', dir: -1 }],
    copy: [{ type: 'action', name: 'copy' }],
    check: [{ type: 'action', name: 'check' }],
    stop: [{ type: 'action', name: 'stop' }]
  };

  /* Prepare les expressions regulieres.
     userDict : [[dit, ecrit], ...]   snippets : [[nom, texte], ...] */
  function compile(opts) {
    opts = opts || {};
    const userDict = (opts.userDict || []).filter(r => r && r[0] && r[1] != null);
    const snippets = (opts.snippets || []).filter(r => r && r[0] && r[1]);

    // Commandes : formulation la plus longue d'abord
    const phrases = [];
    for (const c of LEX.COMMANDS) for (const p of c.say) phrases.push({ p, id: c.id, guard: c.guard });
    phrases.sort((a, b) => b.p.length - a.p.length);
    const byPhrase = new Map();
    const alts = phrases.map((x, i) => { byPhrase.set('c' + i, x); return '(?<c' + i + '>' + looseRe(x.p) + ')'; });
    // Textes types : « insère / insérer / insérez [le|la|l'|un|une|mon|ma|mes] <nom> »,
    // nom reconnu sans tenir compte des accents ni de la casse ; nom le plus long d'abord
    snippets.map((s, i) => [s, i]).sort((a, b) => a[0][0].length - b[0][0].length).forEach(([s, i]) => {
      alts.unshift('(?<s' + i + '>' + INSERT_RE + '[\\s-]+(?:(?:le|la|les|un|une|mon|ma|mes|du|des)\\s+|l[\'’]\\s*)?' + looseRe(s[0]) + ')');
    });
    const cmdRe = new RegExp(PRE + '(' + alts.join('|') + ')' + POST, 'giu');

    // Debuts de commandes (pour reconnaitre une commande coupee par une pause)
    const starts = phrases.map(x => norm(x.p));
    const complete = new Set(phrases.map(x => norm(x.p)));

    // Sigles
    const fromLower = LEX.ACRONYMS.filter((a, i, arr) => arr.indexOf(a) === i)
      .filter(a => !LEX.NO_LOWER.includes(a.toUpperCase()) && (a.replace(/[^A-Za-z0-9]/g, '').length >= 3 || LEX.SAFE_2.includes(a)));
    const acroMap = new Map(fromLower.map(a => [a.toLowerCase(), a]));
    const acroRe = new RegExp(PRE + '(' + fromLower.map(a => esc(a.toLowerCase())).sort((a, b) => b.length - a.length).join('|') + ')' + POST, 'giu');
    const spelled = fromLower.filter(a => /^[A-Za-z]{3,5}$/.test(a));
    const spelledRe = new RegExp(PRE + '(' + spelled.map(a => a.toLowerCase().split('').join('[\\s.]+')).join('|') + ')\\.?' + POST, 'giu');

    const lexicon = LEX.LEXICON.map(([pat, rep]) => [new RegExp(PRE + '(' + pat + ')' + POST, 'giu'), rep]);
    const unitAlt = LEX.UNITS.map(u => '(' + u[0] + ')').join('|');
    const unitRe = new RegExp('(\\d+(?:[.,]\\d+)?)[\\s\\u00a0]*(?:' + unitAlt + ')' + POST, 'giu');
    const user = userDict.map(([said, written]) => [new RegExp(PRE + '(' + phraseRe(said) + ')' + POST, 'giu'), String(written)]);

    // Lexique medical integre (js/lexique-medical.js) : accents / casse, mots coupes
    const med = opts.med || null;
    let medFix = null, medJoin = null;
    if (med && opts.medFix !== false) {
      medFix = med.fix || {};
      medJoin = new Map();
      for (const t of med.join || []) medJoin.set(key(t), t);
    }
    return { cmdRe, byPhrase, snippets, acroRe, acroMap, spelledRe, lexicon, unitRe, user, starts, complete, medFix, medJoin, nbsp: opts.nbsp !== false };
  }

  /* Fin de transcription qui ressemble au debut inacheve d'une commande
     (« insère », « insère courrier », « fin du », « ouvrez la »...) : renvoie le
     nombre de caracteres a retenir en attendant la suite de la dictee, sinon 0. */
  function incompleteTail(text, C) {
    const words = String(text).replace(/[\s ]+$/, '').split(/[\s ]+/);
    for (let k = Math.min(6, words.length); k >= 1; k--) {
      const tailWords = words.slice(-k);
      const tail = norm(tailWords.join(' '));
      if (!tail) continue;
      if (/^(insere|inserer|inserez|insert)$/.test(norm(tailWords[0]))) {
        const rest = norm(tailWords.slice(1).join(' ')).replace(/^(le|la|les|un|une|mon|ma|mes|du|des)( |$)|^l'\s*/, '').trim();
        const names = C.snippets.map(s => norm(s[0]));
        if (rest ? names.some(n => n.startsWith(rest + ' ')) : names.length > 0) return lenOfLastWords(text, k);
        continue;
      }
      if (C.complete.has(tail)) return 0; // commande deja complete (« point »...)
      if (C.starts.some(s => s.length > tail.length && s.startsWith(tail + ' '))) return lenOfLastWords(text, k);
    }
    return 0;
  }
  function lenOfLastWords(text, k) {
    const t = String(text).replace(/[\s ]+$/, '');
    const m = t.match(new RegExp('(?:\\S+[\\s\\u00a0]+){' + (k - 1) + '}\\S+$'));
    return m ? String(text).length - (t.length - m[0].length) : 0;
  }

  /* Corrections lexicales d'un segment de texte (sans commande). */
  function correct(text, C) {
    const NB = C.nbsp ? ' ' : ' ';
    let s = ' ' + String(text).replace(/\s+/g, ' ').trim() + ' ';
    s = s.replace(/(\d)\s*virgule\s*(\d)/giu, '$1,$2');
    for (const [re, rep] of C.lexicon) {
      s = s.replace(re, (...a) => {
        const pre = a[1], body = a[2];
        if (typeof rep === 'function') return pre + rep(body);
        const groups = a.slice(3, -2);
        return pre + rep.replace(/\$(\d)/g, (_, n) => groups[n - 1] == null ? '' : groups[n - 1]);
      });
    }
    s = s.replace(C.spelledRe, (m, pre, body) => pre + body.replace(/[\s.]+/g, '').toUpperCase());
    s = s.replace(C.acroRe, (m, pre, body) => pre + (C.acroMap.get(body.toLowerCase()) || body));
    // Unites apres un nombre
    s = s.replace(C.unitRe, (m, num, ...rest) => {
      const idx = rest.findIndex((g, i) => i < LEX.UNITS.length && g);
      return idx < 0 ? m : num + NB + LEX.UNITS[idx][1];
    });
    // 13 sur 8 -> 13/8 ; 8 heures 30 -> 8 h 30
    s = s.replace(/(\d+)\s+sur\s+(\d+)/giu, '$1/$2');
    s = s.replace(/(\d{1,2})\s*heures?\s*(\d{1,2})(?!\d)/giu, '$1' + NB + 'h' + NB + '$2');
    s = s.replace(/(\d{1,2})\s*heures?(?=$|[^\p{L}\p{N}])/giu, '$1' + NB + 'h');
    if (C.medFix) s = medCorrect(s, C);
    // Dictionnaire personnel en dernier : il prime sur tout le reste
    for (const [re, rep] of C.user) s = s.replace(re, (m, pre) => pre + rep);
    return s.replace(/\s+$/, '').replace(/^ /, '');
  }

  /* Les moteurs de reconnaissance (Apple notamment) transforment parfois eux-memes
     « à la ligne » et « nouveau paragraphe » en vrais sauts de ligne : on les reconvertit
     en commandes avant de normaliser les espaces. */
  function normalizeTranscript(t) {
    return String(t || '').replace(/\r/g, '')
      .replace(/[ \t\u00a0]*\n[ \t\u00a0]*\n\s*/g, ' nouveau paragraphe ')
      .replace(/[ \t\u00a0]*\n[ \t\u00a0]*/g, ' à la ligne ')
      .replace(/[\u2028\u2029]/g, ' nouveau paragraphe ');
  }
  const LAYOUT = new Set(['nl', 'par', 'block', 'list', 'li', 'endlist', 'field']);

  /* Transcription -> liste d'operations */
  function parse(transcript, C) {
    const src = normalizeTranscript(transcript).replace(/\s+/g, ' ').trim()
      .replace(/(\d)\s*virgule\s*(\d)/giu, '$1,$2');   // 38 virgule 5 -> 38,5
    const ops = [];
    let last = 0, buf = '';
    const flushText = (t) => {
      let txt = t.trim();
      // ponctuation ajoutee par le moteur juste apres une commande de mise en page (« À la ligne. Examen »)
      const prevOp = ops[ops.length - 1];
      if (prevOp && LAYOUT.has(prevOp.type)) txt = txt.replace(/^[.,;:!?…]+\s*/, '');
      if (txt) ops.push({ type: 'text', text: correct(txt, C) });
    };
    C.cmdRe.lastIndex = 0;
    let m;
    while ((m = C.cmdRe.exec(src))) {
      const pre = m[1] || '';
      const start = m.index + pre.length;
      const end = start + m[2].length;
      const g = m.groups || {};
      const key = Object.keys(g).find(k => g[k] !== undefined);
      if (!key) continue;
      if (key[0] === 's') {
        buf += src.slice(last, start);
        flushText(buf); buf = '';
        ops.push({ type: 'snippet', text: C.snippets[Number(key.slice(1))][1] });
        last = end;
        continue;
      }
      const info = C.byPhrase.get(key);
      const before = buf + src.slice(last, start);
      if (info.guard && !GUARDS[info.guard](before, src.slice(end))) {
        C.cmdRe.lastIndex = Math.max(start + 1, m.index + 1);
        continue; // reste du texte
      }
      flushText(before); buf = '';
      if (info.id === 'spell_on') { ops.push({ type: 'spell', text: src.slice(end).trim() }); return ops; }
      for (const op of CMD_OPS[info.id]) ops.push(Object.assign({}, op));
      last = end;
      C.cmdRe.lastIndex = end;
    }
    flushText(buf + src.slice(last));
    return ops;
  }

  const ABBR_END = /(?:^|[\s(])(?:al|cf|env|ex|vs|resp|cad|c\.-à-d|p|pp|vol|fig|réf)\.\s*$/i;
  function needsCap(prev) {
    prev = prev.replace(/[(«"\u00a0 ]+$/, m => /[(«"]/.test(m) ? '' : m);
    if (/^[\s ]*$/.test(prev) || /\n[\s ]*$/.test(prev)) return true;
    if (/[.!?…][»)"\s ]*$/.test(prev)) return !ABBR_END.test(prev);
    return false;
  }
  /* Corrections par le lexique medical :
     1. mots coupes par la reconnaissance (« hépato mégalie » -> hépatomégalie) ;
     2. accents et majuscules (« dyspnee » -> dyspnée, « doliprane » -> Doliprane, « bpco » -> BPCO). */
  const key = s => stripAcc(String(s).toLowerCase()).replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/[-'’\s]/g, '');
  function keepCase(orig, canon) {
    if (/^\p{Lu}/u.test(orig) && /^\p{Ll}/u.test(canon)) return canon.charAt(0).toUpperCase() + canon.slice(1);
    return canon;
  }
  function medCorrect(s, C) {
    const WORD = /\p{L}+/gu;
    // 1. mots coupes : 3 puis 2 mots consecutifs separes par une espace ou un tiret
    if (C.medJoin && C.medJoin.size) {
      const toks = [];
      let m;
      WORD.lastIndex = 0;
      while ((m = WORD.exec(s))) toks.push({ w: m[0], i: m.index, e: m.index + m[0].length });
      const out = [];
      let last = 0;
      for (let i = 0; i < toks.length; i++) {
        let done = false;
        for (let n = 3; n >= 2 && !done; n--) {
          if (i + n > toks.length) continue;
          const seg = toks.slice(i, i + n);
          if (!seg.every((t, j) => j === 0 || /^[ -]$/.test(s.slice(seg[j - 1].e, t.i)))) continue;
          const term = C.medJoin.get(key(seg.map(t => t.w).join('')));
          if (!term) continue;
          const orig = s.slice(seg[0].i, seg[n - 1].e);
          if (orig === term) continue;
          out.push(s.slice(last, seg[0].i), keepCase(orig, term));
          last = seg[n - 1].e;
          i += n - 1;
          done = true;
        }
      }
      out.push(s.slice(last));
      s = out.join('');
    }
    // 2. accents et casse, mot par mot
    return s.replace(WORD, w => {
      if (w.length < 2) return w;
      const canon = C.medFix[stripAcc(w.toLowerCase())];
      if (!canon || canon === w) return w;
      const allCaps = w.length > 1 && w === w.toUpperCase();
      if (allCaps && /^\p{Ll}/u.test(canon)) return w;      // MAJUSCULES voulues
      const r = keepCase(w, canon);
      return r;
    });
  }
  function capFirst(s) { return s.replace(/^([^\p{L}]*)(\p{L})/u, (m, a, b) => a + b.toUpperCase()); }

  /* Insertion d'un morceau a la suite de « prev » (texte du bloc avant le curseur).
     Renvoie { del: nb de caracteres a effacer avant le curseur, ins: texte a inserer }.
     st : etat de saisie { capsNext, capsLock } (modifie). */
  function joinPiece(prev, piece, st, opts) {
    opts = opts || {};
    st = st || {};
    const NB = opts.nbsp === false ? ' ' : ' ';
    const trailing = (prev.match(/[  ]*$/) || [''])[0].length;
    const blank = /^[\s ]*$/.test(prev) || /\n[  ]*$/.test(prev);
    const sp = (blank || /[\s («/'’\-–]$/.test(prev)) ? '' : ' ';

    if (piece.type === 'punct') {
      const ch = piece.ch;
      switch (ch) {
        case '.':
          if (/[.…!?,;:]$/.test(prev.replace(/[  ]+$/, ''))) return { del: trailing, ins: '' };
          return { del: trailing, ins: '.' };
        case ',':
          if (/,$/.test(prev.replace(/[ \u00a0]+$/, ''))) return { del: trailing, ins: '' };
          return { del: trailing, ins: ',' };
        case ')': case '…':
          return { del: trailing, ins: ch };
        case ';': case ':': case '?': case '!':
          return { del: trailing, ins: (blank ? '' : NB) + ch };
        case '»':
          return { del: trailing, ins: NB + '»' };
        case '(':
          return { del: 0, ins: sp + '(' };
        case '«':
          return { del: 0, ins: sp + '«' + NB };
        case '-': case '/':
          return { del: trailing, ins: ch };
        case "'":
          return { del: trailing, ins: opts.typoApos ? '’' : "'" };
        case '–':
          return blank ? { del: trailing, ins: '- ' } : { del: 0, ins: sp + '– ' };
        default:
          return { del: 0, ins: ch };
      }
    }

    // Texte
    let s = String(piece.text || '').replace(/^\s+|\s+$/g, '');
    if (!s) return { del: 0, ins: '' };
    // ponctuation en tete (fournie par certains moteurs de reconnaissance)
    const lead = s.match(/^[,.;:!?)…»]/);
    if (lead) {
      const r1 = joinPiece(prev, { type: 'punct', ch: lead[0] }, st, opts);
      const prev2 = prev.slice(0, prev.length - r1.del) + r1.ins;
      const r2 = joinPiece(prev2, { type: 'text', text: s.slice(1) }, st, opts);
      return { del: r1.del, ins: r1.ins + r2.ins };
    }
    if (st.capsLock) s = s.toUpperCase();
    else if (st.capsNext || (!piece.verbatim && opts.autoCap !== false && needsCap(prev))) s = capFirst(s);
    st.capsNext = false;
    if (opts.typoApos) s = s.replace(/'/g, '’');
    return { del: 0, ins: sp + s };
  }

  /* Rendu texte brut d'une suite d'operations (tests, mode clavier). */
  function renderPlain(ops, opts, start) {
    let out = start || '';
    const st = {};
    for (const op of ops) {
      if (op.type === 'text' || op.type === 'punct' || op.type === 'snippet') {
        const lines = op.type === 'snippet' ? String(op.text).split('\n') : null;
        if (lines) {
          lines.forEach((ln, i) => {
            if (i) out = out.replace(/[  ]+$/, '') + '\n';
            const r = joinPiece(out, { type: 'text', text: ln, verbatim: i > 0 }, st, opts);
            out = out.slice(0, out.length - r.del) + r.ins;
          });
          continue;
        }
        const r = joinPiece(out, op, st, opts);
        out = out.slice(0, out.length - r.del) + r.ins;
      } else if (op.type === 'nl') out = out.replace(/[  ]+$/, '') + '\n';
      else if (op.type === 'par' || op.type === 'block' || op.type === 'list' || op.type === 'endlist') out = out.replace(/[  ]+$/, '') + '\n\n';
      else if (op.type === 'li') out = out.replace(/[  ]+$/, '') + '\n';
      else if (op.type === 'caps') {
        if (op.mode === 'next') st.capsNext = true;
        else st.capsLock = op.mode === 'on';
      }
    }
    return out;
  }

  /* Passe typographique sur un texte existant (sans commandes). */
  function tidy(text, opts) {
    opts = opts || {};
    const NB = opts.nbsp === false ? ' ' : ' ';
    let s = String(text);
    s = s.replace(/\.{3}/g, '…');
    s = s.replace(/[   ]*([;!?])/g, NB + '$1').replace(new RegExp('^' + NB + '([;!?])', 'gm'), '$1');
    s = s.replace(/([^\d\s ])[   ]*:(?=\s|$)/g, '$1' + NB + ':');
    s = s.replace(/«[   ]*/g, '«' + NB).replace(/[   ]*»/g, NB + '»');
    s = s.replace(/[  ]+([,.)…])/g, '$1');
    s = s.replace(/,(?=[\p{L}])/gu, ', ');
    s = s.replace(/([.!?…])[  ]*(?=\p{L})/gu, '$1 ');
    s = s.replace(/ {2,}/g, ' ');
    if (opts.autoCap !== false) {
      s = s.replace(/(^|[.!?…][  ]+|\n[  ]*)(\p{Ll})/gu, (m, a, b, off) => {
        if (a && /^\./.test(a) && ABBR_END.test(s.slice(0, off + 1))) return m;
        return a + b.toUpperCase();
      });
    }
    return s;
  }

  /* Epellation : « emme a erre té i enne » / « M A R T I N » -> « MARTIN ».
     Renvoie { text, end } ; end = l'utilisateur a dit « fin » (ou « terminé »). */
  const LETTERS = {
    a: 'A', ah: 'A', be: 'B', bee: 'B', ce: 'C', se: 'C', ses: 'C', "c'est": 'C', sait: 'C', de: 'D', des: 'D',
    e: 'E', eu: 'E', euh: 'E', effe: 'F', ef: 'F', ge: 'G', "j'ai": 'G', hache: 'H', ache: 'H', ach: 'H', i: 'I', hi: 'I',
    ji: 'J', gi: 'J', ka: 'K', ca: 'K', kah: 'K', elle: 'L', el: 'L', aile: 'L', emme: 'M', em: 'M', aime: 'M',
    enne: 'N', en: 'N', haine: 'N', o: 'O', oh: 'O', eau: 'O', au: 'O', haut: 'O', pe: 'P', pet: 'P', paix: 'P',
    qu: 'Q', cu: 'Q', ku: 'Q', erre: 'R', air: 'R', aire: 'R', er: 'R', esse: 'S', es: 'S', te: 'T', the: 'T', tes: 'T',
    u: 'U', hu: 'U', ve: 'V', vee: 'V', ixe: 'X', ix: 'X', igrec: 'Y', zede: 'Z', zed: 'Z', zedd: 'Z'
  };
  const PAIRS = { 'double ve': 'W', 'double v': 'W', 'i grec': 'Y', 'trait d\'union': '-' };
  const ACCENTS = {
    aigu: { E: 'É' }, grave: { E: 'È', A: 'À', U: 'Ù' }, circonflexe: { E: 'Ê', A: 'Â', I: 'Î', O: 'Ô', U: 'Û' },
    trema: { E: 'Ë', I: 'Ï', U: 'Ü' }, cedille: { C: 'Ç' }
  };
  const SPELL_END = /^(fin|termine|terminee|stop|fini)$/;
  function spell(text) {
    const toks = String(text || '').replace(/[’]/g, "'").split(/[\s,.;:!?«»"()]+/).filter(Boolean);
    let out = '', end = false;
    for (let i = 0; i < toks.length; i++) {
      const raw = toks[i];
      const k = norm(raw);
      const k2 = i + 1 < toks.length ? k + ' ' + norm(toks[i + 1]) : '';
      if (SPELL_END.test(k) || (k === 'fin' && /^(d|de)/.test(norm(toks[i + 1] || '')))) { end = true; break; }
      if (k === 'c\'est' && norm(toks[i + 1] || '') === 'tout') { end = true; break; }
      if (PAIRS[k2]) { out += PAIRS[k2]; i++; continue; }
      if (k === 'accent' || ACCENTS[k]) {           // « e accent aigu » -> É
        const kind = k === 'accent' ? norm(toks[++i] || '') : k;
        const map = ACCENTS[kind];
        if (map && out && map[out.slice(-1)]) out = out.slice(0, -1) + map[out.slice(-1)];
        continue;
      }
      if (k === 'tiret') { out += '-'; continue; }
      if (k === 'espace') { out += ' '; continue; }
      if (k === 'apostrophe') { out += "'"; continue; }
      if (k === 'majuscule' || k === 'lettre' || k === 'et' || k === 'puis') continue;
      if (/^\p{L}$/u.test(raw) || /^\d$/.test(raw)) { out += raw.toUpperCase(); continue; }
      if (LETTERS[k]) { out += LETTERS[k]; continue; }
      // lettres deja regroupees par la reconnaissance (« martin », « Jean-Pierre ») : gardees, en majuscules
      out += raw.toUpperCase();
    }
    return { text: out.replace(/^-+|-+$/g, '').replace(/ {2,}/g, ' '), end };
  }

  /* Validation anticipee : nombre de mots de « text » qui peuvent etre appliques tout de
     suite, c'est-a-dire jusqu'a la fin de la derniere commande « forte » (mise en page,
     champ, texte type, point final...) suivie d'au moins minAfter mots deja reconnus.
     Les commandes legeres (virgule...) n'en declenchent pas : « 38 virgule 5 » doit
     rester entier pour devenir 38,5. */
  const STRONG = new Set(['p_dot', 'p_dot_nl', 'p_dot_par', 'p_q', 'p_excl', 'p_ellipsis', 'nl', 'par', 'h_on', 'h_off',
    'ul', 'ol', 'li', 'list_off', 'field_next', 'field_prev']);
  function commitPoint(text, C, minAfter) {
    const src = String(text || '').replace(/\s+/g, ' ').trim();
    if (!src) return 0;
    minAfter = minAfter == null ? 2 : minAfter;
    let best = 0, m;
    C.cmdRe.lastIndex = 0;
    while ((m = C.cmdRe.exec(src))) {
      const pre = m[1] || '';
      const start = m.index + pre.length;
      const end = start + m[2].length;
      const g = m.groups || {};
      const key = Object.keys(g).find(k => g[k] !== undefined);
      if (!key) continue;
      const info = key[0] === 's' ? { id: 'snippet' } : C.byPhrase.get(key);
      if (info.guard && !GUARDS[info.guard](src.slice(0, start), src.slice(end))) { C.cmdRe.lastIndex = start + 1; continue; }
      C.cmdRe.lastIndex = end;
      if (info.id === 'spell_on') break;                     // l'epellation se traite d'un bloc
      if (!STRONG.has(info.id) && info.id !== 'snippet') continue;
      const after = src.slice(end).trim().split(' ').filter(Boolean).length;
      if (after >= minAfter) best = end;
    }
    return best ? src.slice(0, best).split(' ').filter(Boolean).length : 0;
  }

  /* Position (caracteres) de la premiere commande de « text », -1 s'il n'y en a pas */
  function firstCommandIndex(text, C) {
    const src = String(text || '');
    let m;
    C.cmdRe.lastIndex = 0;
    while ((m = C.cmdRe.exec(src))) {
      const pre = m[1] || '';
      const start = m.index + pre.length;
      const end = start + m[2].length;
      const g = m.groups || {};
      const key = Object.keys(g).find(k => g[k] !== undefined);
      if (!key) continue;
      const info = key[0] === 's' ? {} : C.byPhrase.get(key);
      if (info.guard && !GUARDS[info.guard](src.slice(0, start), src.slice(end))) { C.cmdRe.lastIndex = start + 1; continue; }
      return start;
    }
    return -1;
  }

  const api = { firstCommandIndex, commitPoint, spell, compile, parse, correct, joinPiece, renderPlain, tidy, needsCap, incompleteTail, normalizeTranscript };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LSAMM_PIPE = api;
})(typeof window !== 'undefined' ? window : globalThis);
