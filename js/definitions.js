/* LeSacAMicroMed - definitions des mots (bulle flottante)
   Ordre de recherche :
   1. abreviations medicales (Wikipedia, « Liste d'abreviations en medecine », integree) ;
   2. specialites pharmaceutiques (BDPM, ANSM, integree) ;
   3. en ligne, si autorise : Wiktionnaire (definitions du francais), puis Wikipedia (resume).
   Les reponses en ligne sont gardees en cache sur l'appareil.
   ©2026 LESACA Julien - Tous droits reserves. */
'use strict';

(function (root) {
  const CACHE_KEY = 'lsamm:defs';
  const strip = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '');

  /* ---------------- Analyse du wikicode du Wiktionnaire ---------------- */
  const POS = {
    nom: 'Nom', adjectif: 'Adjectif', verbe: 'Verbe', adverbe: 'Adverbe', 'nom propre': 'Nom propre',
    sigle: 'Sigle', abréviation: 'Abréviation', acronyme: 'Acronyme', symbole: 'Symbole', locution: 'Locution',
    'locution nominale': 'Locution nominale', préfixe: 'Préfixe', suffixe: 'Suffixe', interjection: 'Interjection',
    préposition: 'Préposition', 'adjectif numéral': 'Adjectif numéral', pronom: 'Pronom'
  };
  function cleanTemplates(t) {
    let prev;
    do {
      prev = t;
      t = t.replace(/\{\{([^{}]*)\}\}/g, (m, inner) => {
        const parts = inner.split('|').map(x => x.trim());
        const name = parts[0].toLowerCase();
        const pos = parts.slice(1).filter(p => !/^[a-z]+=/i.test(p));
        if (name === 'lien' || name === 'l' || name === 'lien web') return pos[0] || '';
        if (name === 'w' || name === 'wp') return pos[pos.length - 1] || pos[0] || '';
        if (name === 'e' || name === 'exp') return pos[0] || 'e';
        if (name === 'siècle' || name === 'siècle2') return (pos[0] || '') + 'e siècle';
        if (name === 'term' || name === 'term_lien' || name === 'info lex' || name === 'lexique') {
          const v = pos.filter(p => p !== 'fr');
          return v.length ? '(' + v.map(x => x.charAt(0).toUpperCase() + x.slice(1)).join(', ') + ') ' : '';
        }
        if (/^[a-zàâçéèêëîïôûùüœ -]+$/i.test(name) && pos.every(p => p === 'fr' || p === 'nocat')) {
          // modeles de domaine : {{médecine|fr}} -> (Médecine)
          if (/^(fr|f|m|mf|p|s|n|pron|réf|ébauche-déf|ébauche|ébauche-exe|non-standard|cf|ex|référence nécessaire)$/.test(name)) return '';
          return '(' + name.charAt(0).toUpperCase() + name.slice(1) + ') ';
        }
        return '';
      });
    } while (t !== prev);
    return t;
  }
  function cleanWikitext(line) {
    let t = line.replace(/<ref[^>]*\/>/g, '').replace(/<ref[\s\S]*?<\/ref>/g, '');
    t = cleanTemplates(t);
    t = t.replace(/\[\[(?:Fichier|File|Image|Catégorie|Category):[^\]]*\]\]/gi, '');
    t = t.replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, '$2').replace(/\[\[([^\]]*)\]\]/g, '$1');
    t = t.replace(/\[https?:\/\/\S+\s([^\]]*)\]/g, '$1');
    t = t.replace(/'''?/g, '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ');
    t = t.replace(/\(\s*\)/g, '').replace(/\)\s*\(/g, ', ').replace(/\s+/g, ' ').replace(/\s+([,.;:])/g, '$1').trim();
    return t;
  }
  /* Renvoie { sections: [{ pos, defs: [...] }], lemma } pour la partie « francais » */
  function parseWiktionary(wikitext) {
    const txt = String(wikitext || '');
    const start = txt.search(/^==\s*\{\{langue\|fr\}\}\s*==/m);
    if (start < 0) return null;
    const rest = txt.slice(start + 5);
    const end = rest.search(/^==\s*\{\{langue\|/m);
    const fr = end < 0 ? rest : rest.slice(0, end);
    const sections = [];
    let cur = null, lemma = null;
    for (const line of fr.split('\n')) {
      const h = line.match(/^===+\s*\{\{S\|([^|}]+)(\|[^}]*)?\}\}\s*===+/);
      if (h) {
        const name = h[1].trim().toLowerCase();
        const flex = /flexion/.test(h[2] || '');
        cur = POS[name] || /^(nom|adjectif|verbe|adverbe|sigle|abréviation|acronyme|locution)/.test(name)
          ? { pos: (POS[name] || name.charAt(0).toUpperCase() + name.slice(1)) + (flex ? ' (forme fléchie)' : ''), defs: [] }
          : null;
        if (cur) sections.push(cur);
        continue;
      }
      if (!cur || !/^#(?![*:#])/.test(line)) continue;
      const raw = line.replace(/^#\s*/, '');
      const lm = raw.match(/(?:Pluriel|Féminin(?: pluriel| singulier)?|Masculin(?: pluriel)?|Participe passé(?: masculin| féminin)?(?: singulier| pluriel)?)\s+(?:de|d['’])[^[]*\[\[([^\]|#]+)/i);
      if (lm && !lemma) lemma = lm[1].trim();
      const d = cleanWikitext(raw);
      if (d) cur.defs.push(d);
    }
    const kept = sections.filter(s => s.defs.length);
    return kept.length ? { sections: kept, lemma } : null;
  }

  /* ---------------- Cache local ---------------- */
  let cache = null;
  function loadCache() {
    if (cache) return cache;
    try { cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') || {}; } catch (e) { cache = {}; }
    return cache;
  }
  function saveCache(k, v) {
    const c = loadCache();
    c[k] = Object.assign({ t: Date.now() }, v);
    const keys = Object.keys(c);
    if (keys.length > 400) keys.sort((a, b) => c[a].t - c[b].t).slice(0, keys.length - 400).forEach(x => delete c[x]);
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch (e) {}
  }

  /* ---------------- Recherche ---------------- */
  async function fetchJson(url) {
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), 8000) : 0;
    try {
      const r = await fetch(url, { signal: ctl ? ctl.signal : undefined, headers: { Accept: 'application/json' } });
      if (!r.ok) return { status: r.status };
      return { status: r.status, json: await r.json() };
    } finally { clearTimeout(timer); }
  }
  async function wiktionary(word, depth) {
    const url = 'https://fr.wiktionary.org/w/api.php?action=parse&format=json&formatversion=2&prop=wikitext&redirects=1&origin=*&page=' + encodeURIComponent(word);
    const r = await fetchJson(url);
    const wt = r.json && r.json.parse && r.json.parse.wikitext;
    const p = parseWiktionary(typeof wt === 'string' ? wt : (wt && wt['*']) || '');
    if (!p) return null;
    const onlyFlex = p.sections.every(s => /forme fléchie/.test(s.pos));
    if (onlyFlex && p.lemma && !depth && p.lemma !== word) {
      const l = await wiktionary(p.lemma, 1);
      if (l) { l.note = '« ' + word + ' » : forme de « ' + p.lemma + ' »'; return l; }
    }
    return {
      title: (r.json.parse.title || word), kind: 'Wiktionnaire',
      sections: p.sections.slice(0, 3).map(s => ({ pos: s.pos, defs: s.defs.slice(0, 4) })),
      src: 'Wiktionnaire (CC BY-SA)', url: 'https://fr.wiktionary.org/wiki/' + encodeURIComponent(r.json.parse.title || word)
    };
  }
  async function wikipedia(word) {
    const r = await fetchJson('https://fr.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(word.replace(/ /g, '_')));
    const j = r.json;
    if (!j || !j.extract || j.type === 'disambiguation') return null;
    return {
      title: j.title || word, kind: 'Wikipédia', sections: [{ pos: '', defs: [j.extract] }],
      src: 'Wikipédia (CC BY-SA)', url: (j.content_urls && j.content_urls.desktop && j.content_urls.desktop.page) || ('https://fr.wikipedia.org/wiki/' + encodeURIComponent(word))
    };
  }

  /* Recherche locale immediate (sans reseau) */
  function local(word, MED) {
    if (!MED) return null;
    const w = String(word).trim();
    const up = w.toUpperCase();
    const abbrKey = MED.abbr[w] ? w : MED.abbr[up] ? up : Object.keys(MED.abbr).find(k => k.toUpperCase() === up && k.length === w.length);
    if (abbrKey && (w.length <= 7) && (w === up || /[A-Z]/.test(w.slice(1)) || !MED.terms.includes(w.toLowerCase()))) {
      const meanings = MED.abbr[abbrKey].split(/\s*;\s*(?![^()]*\))/).filter(Boolean);
      return { title: abbrKey, kind: 'Abréviation médicale', sections: [{ pos: '', defs: meanings }],
        src: 'Wikipédia, « Liste d\'abréviations en médecine » (CC BY-SA)', url: 'https://fr.wikipedia.org/wiki/Liste_d%27abr%C3%A9viations_en_m%C3%A9decine' };
    }
    const brand = w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    if (MED.drugs[brand]) {
      const [forms, routes, holder] = MED.drugs[brand];
      return { title: brand, kind: 'Médicament (spécialité)', sections: [{ pos: '', defs: [
        'Spécialité pharmaceutique commercialisée en France.',
        'Forme(s) : ' + forms + '.', 'Voie(s) : ' + routes + '.', 'Titulaire : ' + holder + '.'] }],
        src: 'Base de données publique des médicaments, ANSM (données du 22/08/2024)', url: 'https://base-donnees-publique.medicaments.gouv.fr/' };
    }
    return null;
  }
  function isMedical(word, MED) {
    if (!MED) return false;
    const w = String(word).trim();
    return MED.terms.includes(w.toLowerCase()) || MED.terms.includes(strip(w.toLowerCase()));
  }

  async function lookup(word, opts) {
    opts = opts || {};
    const MED = opts.med;
    const w = String(word || '').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    if (!w) return null;
    const loc = local(w, MED);
    if (loc) return loc;
    const k = w.toLowerCase();
    const c = loadCache()[k];
    if (c && c.res) return Object.assign({}, c.res, { medical: isMedical(w, MED) });
    if (!opts.online) return { title: w, kind: isMedical(w, MED) ? 'Terme médical (lexique intégré)' : 'Mot', sections: [], offline: true, medical: isMedical(w, MED) };
    let res = null;
    try {
      res = await wiktionary(w.length > 1 && w === w.toUpperCase() ? w : k);
      if (!res && w !== k) res = await wiktionary(w);
      if (!res) res = await wikipedia(w);
    } catch (e) {
      return { title: w, kind: 'Mot', sections: [], error: 'Recherche impossible (hors ligne ?)', medical: isMedical(w, MED) };
    }
    if (res) saveCache(k, { res });
    return res ? Object.assign(res, { medical: isMedical(w, MED) }) : { title: w, kind: 'Mot', sections: [], notFound: true, medical: isMedical(w, MED) };
  }

  const api = { lookup, local, parseWiktionary, cleanWikitext };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LSAMMDef = api;
})(typeof window !== 'undefined' ? window : globalThis);
