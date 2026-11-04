/* LeSacAUrge - application
   ©2026 LESACA Julien - Tous droits reserves. */
'use strict';

(function () {
  const CFG = window.LSAU_CONFIG || {};
  const SECTIONS = window.SECTIONS;
  const EXAM = window.EXAM_SYSTEMS;
  const VITALS = window.VITALS;
  const ECG = window.ECG;
  const TODO = window.TODO_ITEMS;
  const DATA_KEY = 'lsau.data.v1';
  const SET_KEY = 'lsau.settings.v1';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const svg = (inner) => '<svg viewBox="0 0 24 24" aria-hidden="true">' + inner + '</svg>';

  const ICON = {
    copy: svg('<path d="M8 8h11v13H8z M5 16H4V3h11v1"/>'),
    check: svg('<path d="M5 12l5 5L20 7"/>'),
    clear: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
    clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    down: svg('<path d="M6 9l6 6 6-6"/>'),
    x: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
    pen: svg('<path d="M4 20h4L19 9l-4-4L4 16z"/>'),
    list: svg('<path d="M9 6h11M9 12h11M9 18h11"/><path d="M3.5 6l1 1 2-2M3.5 12l1 1 2-2M3.5 18l1 1 2-2"/>'),
    send: svg('<path d="M5 12h14M13 6l6 6-6 6"/>')
  };

  /* ================================================================== */
  /* Stockage                                                            */
  /* ================================================================== */
  function load(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { toast('Stockage local indisponible'); }
  }

  const settings = Object.assign({
    theme: 'auto', titles: true, ascii: false, markCopied: true, retentionH: 24,
    hidden: [], chips: {}, dbUrl: CFG.firebaseDatabaseUrl || '', code: '', syncOn: false,
    spell: true, syncIdent: false
  }, load(SET_KEY, {}));
  // adresse par defaut (config.js) si aucune n'a ete saisie sur cet appareil
  if (!settings.dbUrl && CFG.firebaseDatabaseUrl) settings.dbUrl = CFG.firebaseDatabaseUrl;

  const store = Object.assign({ dossiers: {}, current: null, tombstones: {} }, load(DATA_KEY, {}));
  const copiedFlags = {}; // local : { dossierId: { sectionId: texteCopie } }

  let saveTimer = null;
  function persist() { clearTimeout(saveTimer); saveTimer = setTimeout(() => save(DATA_KEY, store), 250); }
  function persistSettings() { save(SET_KEY, settings); }

  function uid() {
    const b = crypto.getRandomValues(new Uint8Array(9));
    return Array.from(b, x => x.toString(36).padStart(2, '0')).join('').slice(0, 14);
  }
  function hhmm(d) {
    d = d instanceof Date ? d : new Date(d || Date.now());
    return String(d.getHours()).padStart(2, '0') + 'h' + String(d.getMinutes()).padStart(2, '0');
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]));
  }

  // Normalise un dossier (migration des anciennes versions)
  function fix(d) {
    d.meta = d.meta || { label: '', created: Date.now() };
    d.fields = d.fields || {};
    d.vitals = d.vitals || {};
    d.t = d.t || {};
    d.evo = Array.isArray(d.evo) ? d.evo : [];
    d.todo = d.todo && typeof d.todo === 'object' ? d.todo : {};
    d.ecg = d.ecg && typeof d.ecg === 'object' ? d.ecg : {};
    if (d.fields.evolution && !d.evo.length) {
      d.evo.push({ id: uid(), t: d.meta.created || Date.now(), u: Date.now(), text: d.fields.evolution });
    }
    delete d.fields.evolution;
    return d;
  }
  Object.values(store.dossiers).forEach(fix);

  function newDossier(auto) {
    const id = uid();
    const now = Date.now();
    store.dossiers[id] = fix({
      id, meta: { label: '', name: '', sex: '', age: '', created: now, auto: !!auto },
      t: auto ? {} : { _meta: now }
    });
    store.current = id;
    persist();
    if (!auto) sync.queuePush(id, '_meta', 0);
    return store.dossiers[id];
  }
  function isEmpty(d) {
    const m = d.meta;
    return !m.label && !m.name && !m.sex && !m.age &&
      !Object.values(d.fields).some(v => v && v.trim()) &&
      !Object.values(d.vitals).some(v => v && String(v).trim()) &&
      !d.evo.some(e => !e.del) && !Object.values(d.todo).some(x => x.s);
  }
  function current() {
    let d = store.dossiers[store.current];
    if (!d) {
      const ids = sortedIds();
      if (ids.length) { store.current = ids[0]; d = store.dossiers[ids[0]]; }
      else d = newDossier(true);
    }
    return d;
  }
  function sortedIds() {
    return Object.keys(store.dossiers).sort((a, b) =>
      (store.dossiers[b].meta.created || 0) - (store.dossiers[a].meta.created || 0));
  }
  function lastActivity(d) {
    const ts = Object.values(d.t || {});
    return Math.max(d.meta.created || 0, ts.length ? Math.max.apply(null, ts) : 0);
  }
  function touch(d, field, delay) {
    if (d.meta.auto) {
      delete d.meta.auto;
      d.t._meta = Date.now();
      sync.queuePush(d.id, '_meta', 0);
    }
    d.t[field] = Date.now();
    persist();
    sync.queuePush(d.id, field, delay);
  }

  /* ================================================================== */
  /* Patient : age, couleur, nom                                         */
  /* ================================================================== */
  function ageInfo(raw) {
    const s = String(raw || '').trim().toLowerCase();
    if (!s) return { known: false, minor: false, text: '' };
    const n = parseFloat(s.replace(',', '.'));
    if (isNaN(n)) return { known: false, minor: false, text: raw };
    const sub = /(mois|sem|jour|\bj\b|\bm\b|\d\s*j$|\d\s*m$)/.test(s);
    const years = sub ? 0 : n;
    return { known: true, minor: years < 18, text: sub ? raw.trim() : n + ' ans' };
  }
  function colorOf(meta) {
    const a = ageInfo(meta.age);
    if (a.known && a.minor) return 'minor';
    if (meta.sex === 'F') return 'f';
    if (meta.sex === 'M') return 'm';
    return 'unk';
  }
  function sexLabel(s) { return s === 'F' ? 'F' : s === 'M' ? 'H' : ''; }
  function patientTitle(d) {
    const m = d.meta;
    return m.label || m.name || ('Patient de ' + hhmm(m.created));
  }

  /* ================================================================== */
  /* Texte brut                                                          */
  /* ================================================================== */
  function toPlain(s) {
    s = String(s || '').normalize('NFC')
      .replace(/\r\n?/g, '\n')
      .replace(/[‘’‚‛′´`]/g, '\'')
      .replace(/[“”„‟«»″]/g, '"')
      .replace(/[‐‑‒–—―−]/g, '-')
      .replace(/…/g, '...')
      .replace(/[       \t]/g, ' ')
      .replace(/[​-‍⁠﻿]/g, '')
      .replace(/[•‣●▪◦⁃·]/g, '-')
      .replace(/œ/g, 'oe').replace(/Œ/g, 'OE')
      .replace(/æ/g, 'ae').replace(/Æ/g, 'AE');
    if (settings.ascii) {
      s = s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/°/g, ' degres');
      s = s.replace(/[^\n\x20-\x7E]/g, '');
    } else {
      s = s.replace(/[^\n\x20-\x7EÀ-ÿ°]/g, '');
    }
    return s.split('\n').map(l => l.replace(/ {2,}/g, ' ').replace(/\s+$/, '')).join('\n')
      .replace(/\n{3,}/g, '\n\n').trim();
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) { /* repli */ }
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', '');
    ta.style.position = 'fixed'; ta.style.opacity = '0'; ta.style.top = '0';
    document.body.appendChild(ta);
    ta.select(); ta.setSelectionRange(0, text.length);
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  }

  /* ================================================================== */
  /* Hauteur automatique des zones de texte, sans saut de page           */
  /* (mesure sur un clone hors ecran : la zone n'est jamais reduite a 0,  */
  /* ce qui evitait des sauts de defilement qui fermaient le clavier).   */
  /* ================================================================== */
  const mirror = document.createElement('textarea');
  mirror.setAttribute('aria-hidden', 'true');
  mirror.tabIndex = -1;
  mirror.style.cssText = 'position:absolute;top:0;left:-9999px;visibility:hidden;height:0;min-height:0;overflow:hidden;resize:none;pointer-events:none';
  document.body.appendChild(mirror);
  const MIRROR_PROPS = ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'paddingTop',
    'paddingBottom', 'paddingLeft', 'paddingRight', 'borderTopWidth', 'borderBottomWidth', 'borderLeftWidth',
    'borderRightWidth', 'boxSizing', 'whiteSpace', 'wordBreak', 'overflowWrap', 'tabSize'];
  function autoGrow(ta) {
    if (ta === mirror || !ta.isConnected || !ta.offsetWidth) return;
    const cs = getComputedStyle(ta);
    MIRROR_PROPS.forEach(p => { mirror.style[p] = cs[p]; });
    mirror.style.height = '0px';
    mirror.style.borderStyle = 'solid';
    mirror.style.width = ta.offsetWidth + 'px';
    mirror.value = ta.value || ta.placeholder || ' ';
    const min = parseFloat(ta.dataset.min || '92');
    const borders = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
    const h = Math.max(min, mirror.scrollHeight + borders + 2);
    if (Math.abs(ta.offsetHeight - h) > 1) ta.style.height = h + 'px';
  }

  /* ================================================================== */
  /* Rendu des encarts                                                   */
  /* ================================================================== */
  const main = $('#sections');
  const els = {}; // sectionId -> { card, ta, chipsWrap, sec }

  function chipsFor(sectionId) {
    const custom = settings.chips[sectionId];
    return Array.isArray(custom) ? custom : (window.DEFAULT_CHIPS[sectionId] || []);
  }
  function chipsHtml(list, attr) {
    return list.map(c => '<button type="button" class="chip" ' + (attr || 'data-v') + '="' + escapeHtml(c) + '">' + escapeHtml(c) + '</button>').join('');
  }
  function visibleSections() { return SECTIONS.filter(s => !settings.hidden.includes(s.id)); }

  function renderSections() {
    main.innerHTML = '';
    for (const k of Object.keys(els)) delete els[k];

    // Check-list du patient (non copiee)
    const todoCard = document.createElement('section');
    todoCard.className = 'card wide todo-card';
    todoCard.id = 'card-todo';
    todoCard.innerHTML =
      '<div class="card-head"><h2>Check-list</h2>' +
      '<button type="button" class="link-btn" id="todoBoardLink">' + ICON.list + 'Tous les patients</button></div>' +
      '<p class="todo-hint">Toucher : à faire, puis fait, puis retirer.</p>' +
      '<div class="todo-grid" id="todoGrid"></div>' +
      '<div class="todo-add"><input id="todoCustom" type="text" maxlength="40" placeholder="Autre élément (ex : appeler le labo)" autocomplete="off">' +
      '<button type="button" class="btn" id="todoAddBtn">' + ICON.plus + 'Ajouter</button></div>';
    main.appendChild(todoCard);
    bindTodo(todoCard);

    let n = 0;
    for (const sec of visibleSections()) {
      n++;
      const card = document.createElement('section');
      card.className = 'card' + (['motif', 'anamnese', 'examen', 'evolution'].includes(sec.id) ? ' wide' : '');
      card.dataset.id = sec.id;
      card.id = 'card-' + sec.id;
      const chips = chipsFor(sec.id);
      const isEvo = sec.id === 'evolution';
      card.innerHTML =
        '<div class="card-head">' +
          '<h2>' + escapeHtml(sec.title) + '</h2>' +
          '<span class="badge">Copié</span>' +
          '<button class="btn copy-btn" type="button" title="Copier cet encart' + (n <= 9 ? ' (Alt+' + n + ')' : '') + '">' + ICON.copy + '<span>' + (isEvo ? 'Tout' : 'Copier') + '</span></button>' +
        '</div>' +
        (sec.id === 'examen' ? examToolsHtml() : '') +
        (sec.id === 'ecg' ? ecgToolsHtml() : '') +
        (chips.length ? '<div class="chips-wrap"><div class="chips">' + chipsHtml(chips) +
          '</div><button type="button" class="link-btn more-btn">' + ICON.down + '<span>Afficher tout</span></button></div>' : '') +
        (isEvo ? evoHtml() :
          '<textarea rows="3" placeholder="' + escapeHtml(sec.placeholder || 'Saisie ou dictée...') + '" aria-label="' + escapeHtml(sec.title) + '"></textarea>' +
          '<div class="card-foot"><span class="spacer"></span><span class="count"></span>' +
          '<button type="button" class="link-btn clear-btn">' + ICON.clear + 'Effacer</button></div>');
      main.appendChild(card);
      els[sec.id] = { card, ta: isEvo ? null : $('textarea', card), chipsWrap: $('.chips-wrap', card), sec };
      bindCard(sec, card);
    }
    applySpell();
    renderNav();
    fillFromDossier();
    requestAnimationFrame(() => { updateChipOverflow(); $$('textarea').forEach(autoGrow); });
  }

  function applySpell() {
    $$('#sections textarea, #sections input[type="text"]').forEach(el => {
      el.spellcheck = !!settings.spell;
      el.setAttribute('autocorrect', 'on');
      if (el.tagName === 'TEXTAREA') el.setAttribute('autocapitalize', 'sentences');
    });
  }

  function examToolsHtml() {
    return '<div class="exam-tools">' +
      '<button type="button" class="exam-normal" id="examAll"><span class="box">' + ICON.check + '</span>' +
      '<span>Examen clinique normal complet<small>Insère ou retire l\'examen normal de tous les appareils</small></span></button>' +
      '<div class="chips exam-chips">' +
      EXAM.map(s => '<button type="button" class="chip" data-sys="' + s.id + '" title="' + escapeHtml(s.text) + '">' + escapeHtml(s.label) + '</button>').join('') +
      '</div>' +
      '<div class="vitals">' +
      VITALS.map(v => '<div class="vital"><label for="v_' + v.id + '">' + v.label + '</label><div class="in">' +
        '<input id="v_' + v.id + '" data-v="' + v.id + '" inputmode="' + (v.mode === 'text' ? 'text' : v.mode) + '" placeholder="' + v.ph + '" autocomplete="off">' +
        '<span>' + v.unit + '</span></div></div>').join('') +
      '<button type="button" class="btn" id="vitalsInsert">' + ICON.plus + 'Insérer constantes</button>' +
      '</div></div>';
  }

  function ecgToolsHtml() {
    return '<div class="ecg-tools">' +
      '<div class="ecg-top">' +
        '<button type="button" class="btn btn-primary" id="ecgNormal">' + ICON.check + 'ECG normal</button>' +
        '<div class="vital"><label for="ecgFc">FC</label><div class="in"><input id="ecgFc" inputmode="numeric" placeholder="80" autocomplete="off"><span>bpm</span></div></div>' +
        '<div class="vital"><label for="ecgQtc">QTc</label><div class="in"><input id="ecgQtc" inputmode="numeric" placeholder="420" autocomplete="off"><span>ms</span></div></div>' +
      '</div>' +
      '<div class="ecg-group"><span class="ecg-lbl">Rythme</span><div class="chips one" data-g="rythme">' + chipsHtml(ECG.rhythms) + '</div></div>' +
      '<div class="ecg-group"><span class="ecg-lbl">Axe</span><div class="chips one" data-g="axe">' + chipsHtml(ECG.axes) + '</div></div>' +
      '<div class="ecg-group"><span class="ecg-lbl">Conduction</span><div class="chips" data-g="conduction">' + chipsHtml(ECG.conduction) + '</div></div>' +
      '<div class="ecg-group"><span class="ecg-lbl">Repolarisation</span><div class="chips" data-g="repol">' + chipsHtml(ECG.repol) + '</div></div>' +
      '<div class="ecg-group"><span class="ecg-lbl">Autres</span><div class="chips" data-g="autres">' + chipsHtml(ECG.autres) + '</div></div>' +
      '</div>';
  }

  function evoHtml() {
    return '<div class="evo-list" id="evoList"></div>' +
      '<div class="evo-new">' +
        '<textarea id="evoInput" rows="2" data-min="64" placeholder="Nouvelle entrée horodatée (saisie ou dictée)..." aria-label="Nouvelle entrée d\'évolution"></textarea>' +
        '<button type="button" class="btn btn-primary" id="evoAddBtn" title="Ajouter l\'entrée avec l\'heure actuelle">' + ICON.clock + 'Ajouter</button>' +
      '</div>' +
      '<div class="card-foot"><span class="evo-info" id="evoInfo"></span><span class="spacer"></span>' +
        '<button type="button" class="btn copy-new-btn" id="evoCopyNew">' + ICON.copy + 'Copier les nouvelles</button></div>';
  }

  function fillFromDossier() {
    const d = current();
    for (const id of Object.keys(els)) {
      const e = els[id];
      if (e.ta) {
        const v = d.fields[id] || '';
        if (e.ta.value !== v && document.activeElement !== e.ta) e.ta.value = v;
        autoGrow(e.ta);
      }
      refreshCard(id);
    }
    if (els.examen) {
      for (const v of VITALS) {
        const inp = $('#v_' + v.id);
        if (inp && document.activeElement !== inp) inp.value = d.vitals[v.id] || '';
      }
    }
    if (els.ecg) refreshEcgControls();
    if (els.evolution) renderEvo();
    renderTodo();
    renderBanner();
    renderNavState();
  }

  function refreshCard(id) {
    const e = els[id];
    if (!e) return;
    const d = current();
    if (id === 'evolution') {
      const has = d.evo.some(x => !x.del && x.text.trim());
      e.card.classList.toggle('has-text', has);
      e.card.classList.toggle('copied', settings.markCopied && has && d.evo.every(x => x.del || x.c));
      return;
    }
    const text = e.ta.value;
    e.card.classList.toggle('has-text', text.trim().length > 0);
    const cf = (copiedFlags[store.current] || {})[id];
    e.card.classList.toggle('copied', settings.markCopied && cf != null && cf === toPlain(text) && text.trim() !== '');
    const count = $('.count', e.card);
    if (count) count.textContent = text.length ? text.length + ' car.' : '';
    if (e.chipsWrap) {
      const segs = segments(text, e.sec.sep);
      $$('.chip', e.chipsWrap).forEach(c => c.classList.toggle('on', segs.has(norm(c.dataset.v))));
    }
    if (id === 'examen') refreshExam();
    renderNavState();
  }

  function norm(s) { return s.trim().replace(/[.;,]+$/, '').toLowerCase(); }
  function segments(text, sep) {
    const parts = text.split(sep.trim() === '' ? /\n/ : /[,\n]/);
    return new Set(parts.map(norm).filter(Boolean));
  }
  function updateChipOverflow() {
    $$('.chips-wrap').forEach(w => {
      const c = $('.chips', w);
      w.classList.toggle('fits', c.scrollHeight <= c.clientHeight + 2 && !w.classList.contains('open'));
    });
  }

  /* ================================================================== */
  /* Navigation entre encarts                                            */
  /* ================================================================== */
  const nav = $('#secnav');
  function renderNav() {
    const items = [{ id: 'todo', short: 'Check-list' }].concat(visibleSections());
    nav.innerHTML = items.map(s =>
      '<button type="button" class="nav-chip" data-go="' + s.id + '"><span class="ndot"></span>' + escapeHtml(s.short || s.title) + '</button>').join('');
  }
  function renderNavState() {
    const d = store.dossiers[store.current];
    if (!d) return;
    $$('.nav-chip', nav).forEach(b => {
      const id = b.dataset.go;
      let filled;
      if (id === 'todo') filled = Object.values(d.todo).some(x => x.s === 'todo');
      else if (id === 'evolution') filled = d.evo.some(x => !x.del && x.text.trim());
      else filled = !!(d.fields[id] && d.fields[id].trim());
      b.classList.toggle('filled', filled);
    });
  }
  nav.addEventListener('click', ev => {
    const b = ev.target.closest('.nav-chip'); if (!b) return;
    const card = document.getElementById('card-' + b.dataset.go);
    if (!card) return;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    navLockUntil = Date.now() + 900;
    setTimeout(() => window.dispatchEvent(new Event('scroll')), 950);
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveNav(b.dataset.go, true);
  });
  let activeNav = null;
  function setActiveNav(id, fromClick) {
    if (activeNav === id) return;
    activeNav = id;
    $$('.nav-chip', nav).forEach(b => b.classList.toggle('active', b.dataset.go === id));
    // centre la pastille active dans la barre (defilement horizontal de la barre seule)
    const btn = $('.nav-chip[data-go="' + id + '"]', nav);
    const typing = document.activeElement && /^(TEXTAREA|INPUT)$/.test(document.activeElement.tagName);
    if (btn && (!typing || fromClick)) {
      nav.scrollTo({ left: btn.offsetLeft - nav.clientWidth / 2 + btn.offsetWidth / 2, behavior: 'smooth' });
    }
  }
  let navRaf = 0, navLockUntil = 0;
  window.addEventListener('scroll', () => {
    if (navRaf || Date.now() < navLockUntil) return;
    navRaf = requestAnimationFrame(() => {
      navRaf = 0;
      const top = headH() + 24;
      let best = null;
      $$('#sections > .card').forEach(c => { if (c.getBoundingClientRect().top <= top) best = c; });
      if (!best) best = $('#sections > .card');
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        const cards = $$('#sections > .card');
        best = cards[cards.length - 1];
      }
      if (best) setActiveNav(best.id.replace('card-', ''));
    });
  }, { passive: true });

  const head = $('#stickyHead');
  function headH() { return head.offsetHeight; }
  function syncHeadVar() { document.documentElement.style.setProperty('--head-h', headH() + 'px'); }
  if (window.ResizeObserver) new ResizeObserver(syncHeadVar).observe(head);
  syncHeadVar();

  /* ================================================================== */
  /* Encarts : interactions                                              */
  /* ================================================================== */
  const pendingRemote = new Set(); // champs recus pendant la saisie, appliques a la sortie du champ

  function setField(id, value) {
    const d = current();
    d.fields[id] = value;
    touch(d, id);
    const e = els[id];
    if (e && e.ta && e.ta.value !== value) { e.ta.value = value; autoGrow(e.ta); }
    refreshCard(id);
  }

  function toggleChip(sec, value) {
    const e = els[sec.id];
    let text = e.ta.value;
    const segs = segments(text, sec.sep);
    if (segs.has(norm(value))) {
      const sepRe = sec.sep.includes('\n') ? '\\n' : '[,\\n]';
      const re = new RegExp('(^|' + sepRe + ')\\s*' + value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
        '\\s*[.;]?\\s*(?=$|' + sepRe + ')', 'i');
      text = text.replace(re, '').replace(/^[,\s]+/, '').replace(/,\s*,/g, ',').replace(/[,\s]+$/, '').replace(/\n{2,}/g, '\n');
    } else {
      const trimmed = text.replace(/\s+$/, '');
      text = trimmed ? trimmed + sec.sep + value : value;
    }
    setField(sec.id, text);
  }

  function bindCard(sec, card) {
    const e = els[sec.id];
    if (e.ta) {
      e.ta.addEventListener('input', () => {
        pendingRemote.delete(sec.id);
        autoGrow(e.ta);
        const d = current();
        d.fields[sec.id] = e.ta.value;
        touch(d, sec.id);
        refreshCard(sec.id);
      });
      e.ta.addEventListener('blur', () => {
        if (!pendingRemote.has(sec.id)) return;
        pendingRemote.delete(sec.id);
        const v = current().fields[sec.id] || '';
        if (e.ta.value !== v) { e.ta.value = v; autoGrow(e.ta); refreshCard(sec.id); }
      });
      $('.clear-btn', card).addEventListener('click', () => {
        if (!e.ta.value) return;
        const prev = e.ta.value;
        setField(sec.id, '');
        toast('Encart effacé', 'Annuler', () => setField(sec.id, prev));
      });
    }
    $('.copy-btn', card).addEventListener('click', () => copySection(sec.id));
    if (e.chipsWrap) {
      e.chipsWrap.addEventListener('click', ev => {
        const chip = ev.target.closest('.chip');
        if (chip) {
          if (sec.id === 'evolution') addEvoEntry(chip.dataset.v, true);
          else toggleChip(sec, chip.dataset.v);
          return;
        }
        const more = ev.target.closest('.more-btn');
        if (more) {
          const open = e.chipsWrap.classList.toggle('open');
          $('span', more).textContent = open ? 'Réduire' : 'Afficher tout';
          more.querySelector('svg').style.transform = open ? 'rotate(180deg)' : '';
        }
      });
    }
    if (sec.id === 'examen') bindExam(card);
    if (sec.id === 'ecg') bindEcg(card);
    if (sec.id === 'evolution') bindEvo(card);
  }

  /* ---------------- Examen clinique ---------------- */
  function examPresent(text, sys) { return text.includes(sys.text); }
  function refreshExam() {
    const e = els.examen; if (!e) return;
    const text = e.ta.value;
    let on = 0;
    $$('.exam-chips .chip', e.card).forEach(c => {
      const sys = EXAM.find(s => s.id === c.dataset.sys);
      const p = examPresent(text, sys);
      c.classList.toggle('on', p);
      if (p) on++;
    });
    const all = $('#examAll');
    all.classList.toggle('on', on === EXAM.length);
    all.classList.toggle('partial', on > 0 && on < EXAM.length);
  }
  function removeExamText(text, sys) {
    const i = text.indexOf(sys.text);
    if (i < 0) return text;
    let a = i, z = i + sys.text.length;
    if (text[z] === '\n') z++; else if (a > 0 && text[a - 1] === '\n') a--;
    return (text.slice(0, a) + text.slice(z)).replace(/^\n+|\n+$/g, '');
  }
  function insertExamText(text, sys) {
    const idx = EXAM.indexOf(sys);
    for (let i = idx - 1; i >= 0; i--) {
      const p = text.indexOf(EXAM[i].text);
      if (p >= 0) { const pos = p + EXAM[i].text.length; return text.slice(0, pos) + '\n' + sys.text + text.slice(pos); }
    }
    for (let i = idx + 1; i < EXAM.length; i++) {
      const p = text.indexOf(EXAM[i].text);
      if (p >= 0) return text.slice(0, p) + sys.text + '\n' + text.slice(p);
    }
    const t = text.replace(/\s+$/, '');
    return t ? t + '\n' + sys.text : sys.text;
  }
  function bindExam(card) {
    const e = els.examen;
    $('.exam-chips', card).addEventListener('click', ev => {
      const c = ev.target.closest('.chip'); if (!c) return;
      const sys = EXAM.find(s => s.id === c.dataset.sys);
      const t = e.ta.value;
      setField('examen', examPresent(t, sys) ? removeExamText(t, sys) : insertExamText(t, sys));
    });
    $('#examAll').addEventListener('click', () => {
      let t = e.ta.value;
      const allOn = EXAM.every(s => examPresent(t, s));
      if (allOn) EXAM.forEach(s => { t = removeExamText(t, s); });
      else EXAM.forEach(s => { if (!examPresent(t, s)) t = insertExamText(t, s); });
      setField('examen', t);
    });
    $$('.vital input', $('.vitals', card)).forEach(inp => inp.addEventListener('input', () => {
      const d = current();
      d.vitals[inp.dataset.v] = inp.value;
      touch(d, '_vitals');
      if (inp.dataset.v === 'fc' && els.ecg) $('#ecgFc').placeholder = inp.value || '80';
    }));
    $('#vitalsInsert').addEventListener('click', () => {
      const d = current();
      const parts = VITALS.filter(v => (d.vitals[v.id] || '').trim())
        .map(v => v.label + ' ' + d.vitals[v.id].trim() + (v.unit === '%' ? '%' : (v.unit.startsWith('/') ? v.unit : ' ' + v.unit)));
      if (!parts.length) { toast('Saisissez au moins une constante'); return; }
      const line = 'Constantes : ' + parts.join(', ') + '.';
      const lines = e.ta.value.split('\n').filter(l => !/^Constantes : /.test(l));
      setField('examen', [line].concat(lines.filter((l, i) => l || i > 0)).join('\n').replace(/\n+$/, ''));
      toast('Constantes insérées');
    });
  }

  /* ---------------- ECG ---------------- */
  function ecgState(d) {
    const s = d.ecg;
    return {
      rythme: s.rythme || 'RSR', axe: s.axe || 'non dévié', fc: s.fc || '', qtc: s.qtc || '',
      conduction: s.conduction || [], repol: s.repol || [], autres: s.autres || [], gen: s.gen || ''
    };
  }
  function ecgSentence(s) {
    const parts = [s.rythme + ' d\'axe ' + s.axe, 'à ' + (String(s.fc).trim() || 'xx') + ' bpm'];
    const c = s.conduction, r = s.repol;
    if (!c.length && !r.length) parts.push('sans trouble de la conduction ni de la repolarisation');
    else {
      parts.push(c.length ? c.join(', ') : 'sans trouble de la conduction');
      parts.push(r.length ? r.join(', ') : 'sans trouble de la repolarisation');
    }
    if (s.autres.length) parts.push(s.autres.join(', '));
    parts.push('QTc à ' + (String(s.qtc).trim() || 'xx') + ' ms');
    return parts.join(', ') + '.';
  }
  function refreshEcgControls() {
    const d = current();
    const s = ecgState(d);
    const fc = $('#ecgFc'), qtc = $('#ecgQtc');
    if (document.activeElement !== fc) fc.value = s.fc;
    if (document.activeElement !== qtc) qtc.value = s.qtc;
    fc.placeholder = d.vitals.fc || '80';
    $$('.ecg-tools .chips', els.ecg.card).forEach(box => {
      const g = box.dataset.g;
      $$('.chip', box).forEach(ch => {
        const v = ch.dataset.v;
        ch.classList.toggle('on', Array.isArray(s[g]) ? s[g].includes(v) : s[g] === v && !!d.ecg.gen);
      });
    });
  }
  // Applique l'etat ECG : regenere la phrase si le texte n'a pas ete modifie a la main
  function applyEcg(newState, force) {
    const d = current();
    const prevGen = d.ecg.gen || '';
    const text = els.ecg.ta.value;
    const sentence = ecgSentence(newState);
    newState.gen = sentence;
    d.ecg = newState;
    touch(d, '_ecg');
    if (force || !text.trim()) setField('ecg', sentence);
    else if (prevGen && text.includes(prevGen)) setField('ecg', text.replace(prevGen, sentence));
    else {
      toast('Texte ECG modifié à la main', 'Remplacer', () => setField('ecg', sentence));
    }
    refreshEcgControls();
  }
  function bindEcg(card) {
    $('#ecgNormal', card).addEventListener('click', () => {
      const d = current();
      const s = ecgState(d);
      const text = els.ecg.ta.value.trim();
      const st = { rythme: 'RSR', axe: 'non dévié', fc: s.fc || d.vitals.fc || '', qtc: s.qtc, conduction: [], repol: [], autres: [] };
      if (text && !(d.ecg.gen && text === d.ecg.gen) && !confirm('Remplacer le texte ECG actuel par un ECG normal ?')) return;
      applyEcg(st, true);
      if (!st.fc) $('#ecgFc').focus();
    });
    ['ecgFc', 'ecgQtc'].forEach(id => $('#' + id, card).addEventListener('input', ev => {
      const s = ecgState(current());
      s[id === 'ecgFc' ? 'fc' : 'qtc'] = ev.target.value.trim();
      applyEcg(s, false);
    }));
    $$('.ecg-tools .chips', card).forEach(box => box.addEventListener('click', ev => {
      const ch = ev.target.closest('.chip'); if (!ch) return;
      const s = ecgState(current());
      const g = box.dataset.g, v = ch.dataset.v;
      if (Array.isArray(s[g])) {
        s[g] = s[g].includes(v) ? s[g].filter(x => x !== v) : s[g].concat(v);
        // ordre stable selon la liste de reference
        const ref = ECG[g === 'repol' ? 'repol' : g];
        s[g].sort((a, b) => ref.indexOf(a) - ref.indexOf(b));
      } else s[g] = v;
      applyEcg(s, false);
    }));
  }

  /* ---------------- Evolution horodatee ---------------- */
  function evoLine(x) {
    const lines = toPlain(x.text).split('\n');
    lines[0] = hhmm(x.t) + ' : ' + lines[0];
    return lines.join('\n');
  }
  function evoText(list) { return list.filter(x => !x.del && x.text.trim()).sort((a, b) => a.t - b.t).map(evoLine).join('\n'); }

  function renderEvo() {
    const d = current();
    const list = $('#evoList');
    if (!list) return;
    const items = d.evo.filter(x => !x.del).sort((a, b) => a.t - b.t);
    const focusedId = document.activeElement && document.activeElement.closest('.evo-item') ?
      document.activeElement.closest('.evo-item').dataset.eid : null;
    // reconstruction en preservant la zone en cours d'edition
    const existing = {};
    $$('.evo-item', list).forEach(n => { existing[n.dataset.eid] = n; });
    const keep = new Set();
    items.forEach(x => {
      let node = existing[x.id];
      if (!node) {
        node = document.createElement('div');
        node.className = 'evo-item';
        node.dataset.eid = x.id;
        node.innerHTML =
          '<div class="evo-head"><input type="time" class="evo-time" aria-label="Heure">' +
          '<span class="evo-state"></span><span class="spacer"></span>' +
          '<button type="button" class="btn evo-copy">' + ICON.copy + '<span>Copier</span></button>' +
          '<button type="button" class="icon-btn evo-del" aria-label="Supprimer l\'entrée" title="Supprimer l\'entrée">' + ICON.x + '</button></div>' +
          '<textarea rows="1" data-min="48" aria-label="Entrée d\'évolution"></textarea>';
        node.querySelector('textarea').spellcheck = !!settings.spell;
      }
      list.appendChild(node); // ordre chronologique
      keep.add(x.id);
      const ta = $('textarea', node);
      if (x.id !== focusedId && ta.value !== x.text) ta.value = x.text;
      const tm = $('.evo-time', node);
      const dt = new Date(x.t);
      const tv = String(dt.getHours()).padStart(2, '0') + ':' + String(dt.getMinutes()).padStart(2, '0');
      if (document.activeElement !== tm && tm.value !== tv) tm.value = tv;
      node.classList.toggle('copied', !!x.c);
      $('.evo-state', node).textContent = x.c ? 'Copié ' + hhmm(x.c) : 'Non copié';
      autoGrow(ta);
    });
    Object.keys(existing).forEach(id => { if (!keep.has(id)) existing[id].remove(); });
    const fresh = items.filter(x => !x.c && x.text.trim()).length;
    $('#evoInfo').textContent = items.length ? (items.length + ' entrée' + (items.length > 1 ? 's' : '') + (fresh ? ', ' + fresh + ' non copiée' + (fresh > 1 ? 's' : '') : ', tout est copié')) : 'Aucune entrée';
    $('#evoCopyNew').disabled = !fresh;
    refreshCard('evolution');
    renderNavState();
  }

  function saveEvo(d) { touch(d, '_evo', 400); }
  function addEvoEntry(text, fromChip) {
    const d = current();
    text = (text || '').trim();
    if (!text) return;
    // une pastille complete la derniere entree non copiee de moins de 10 min
    const last = d.evo.filter(x => !x.del).sort((a, b) => a.t - b.t).pop();
    if (fromChip && last && !last.c && Date.now() - last.t < 10 * 60 * 1000) {
      last.text = last.text.replace(/\s+$/, '') + (last.text.trim() ? ', ' : '') + text;
      last.u = Date.now();
    } else {
      d.evo.push({ id: uid(), t: Date.now(), u: Date.now(), text });
    }
    saveEvo(d);
    renderEvo();
  }

  function bindEvo(card) {
    const input = $('#evoInput', card);
    input.addEventListener('input', () => autoGrow(input));
    $('#evoAddBtn', card).addEventListener('click', () => {
      if (!input.value.trim()) { input.focus(); return; }
      addEvoEntry(input.value, false);
      input.value = '';
      autoGrow(input);
      toast('Entrée ajoutée à ' + hhmm());
    });
    const list = $('#evoList', card);
    list.addEventListener('input', ev => {
      const node = ev.target.closest('.evo-item'); if (!node) return;
      const d = current();
      const x = d.evo.find(y => y.id === node.dataset.eid); if (!x) return;
      if (ev.target.tagName === 'TEXTAREA') {
        x.text = ev.target.value;
        autoGrow(ev.target);
        if (x.c) { x.c = 0; node.classList.remove('copied'); $('.evo-state', node).textContent = 'Modifié'; }
      } else if (ev.target.classList.contains('evo-time') && ev.target.value) {
        const [h, m] = ev.target.value.split(':').map(Number);
        const dt = new Date(x.t); dt.setHours(h, m, 0, 0); x.t = dt.getTime();
      } else return;
      x.u = Date.now();
      saveEvo(d);
      refreshCard('evolution');
    });
    list.addEventListener('click', async ev => {
      const node = ev.target.closest('.evo-item'); if (!node) return;
      const d = current();
      const x = d.evo.find(y => y.id === node.dataset.eid); if (!x) return;
      if (ev.target.closest('.evo-copy')) {
        if (!x.text.trim()) { toast('Entrée vide'); return; }
        if (!await copyText(evoLine(x))) { toast('Copie impossible'); return; }
        x.c = Date.now(); x.u = Date.now();
        saveEvo(d); renderEvo();
        toast('Entrée de ' + hhmm(x.t) + ' copiée');
      } else if (ev.target.closest('.evo-del')) {
        if (x.text.trim() && !confirm('Supprimer l\'entrée de ' + hhmm(x.t) + ' ?')) return;
        x.del = true; x.u = Date.now();
        saveEvo(d); renderEvo();
      }
    });
    $('#evoCopyNew', card).addEventListener('click', async () => {
      const d = current();
      const fresh = d.evo.filter(x => !x.del && !x.c && x.text.trim()).sort((a, b) => a.t - b.t);
      if (!fresh.length) { toast('Aucune nouvelle entrée'); return; }
      if (!await copyText(fresh.map(evoLine).join('\n'))) { toast('Copie impossible'); return; }
      const now = Date.now();
      fresh.forEach(x => { x.c = now; x.u = now; });
      saveEvo(d); renderEvo();
      toast(fresh.length + ' nouvelle' + (fresh.length > 1 ? 's entrées copiées' : ' entrée copiée'));
    });
  }

  // Fusion de listes/maps synchronisees : l'element le plus recent (u) gagne
  function mergeById(localArr, remoteArr) {
    const map = {};
    (localArr || []).forEach(x => { map[x.id] = x; });
    (remoteArr || []).forEach(x => { if (!map[x.id] || (x.u || 0) > (map[x.id].u || 0)) map[x.id] = x; });
    return Object.values(map);
  }
  function mergeMap(localMap, remoteMap) {
    const out = Object.assign({}, localMap || {});
    Object.keys(remoteMap || {}).forEach(k => {
      if (!out[k] || (remoteMap[k].u || 0) > (out[k].u || 0)) out[k] = remoteMap[k];
    });
    return out;
  }
  function sameMap(a, b) {
    a = a || {}; b = b || {};
    const ka = Object.keys(a), kb = Object.keys(b);
    return ka.length === kb.length && ka.every(k => b[k] && (a[k].u || 0) === (b[k].u || 0));
  }
  function sameArr(a, b) {
    const k = x => x.id + ':' + (x.u || 0);
    return a.map(k).sort().join('|') === (b || []).map(k).sort().join('|');
  }

  /* ---------------- Check-list ---------------- */
  function todoDefs(d) {
    const custom = Object.keys(d.todo).filter(k => k.startsWith('c_') && d.todo[k].label && !d.todo[k].gone)
      .map(k => ({ id: k, label: d.todo[k].label, short: d.todo[k].label, icon: window.TODO_CUSTOM_ICON, custom: true }));
    return TODO.concat(custom);
  }
  function renderTodo() {
    const grid = $('#todoGrid'); if (!grid) return;
    const d = current();
    grid.innerHTML = todoDefs(d).map(it => {
      const st = (d.todo[it.id] || {});
      const s = st.s || '';
      return '<div class="todo-tile ' + s + '" data-tid="' + it.id + '">' +
        '<button type="button" class="todo-main" title="' + escapeHtml(it.label) + '">' +
          svg(it.icon) + '<span class="tl"><span class="full">' + escapeHtml(it.label) + '</span><span class="abbr">' + escapeHtml(it.short) + '</span></span>' +
          '<span class="ts">' + (s === 'todo' ? 'À faire' : s === 'done' ? 'Fait' + (st.at ? ' ' + hhmm(st.at) : '') : '') + '</span>' +
          (st.n && s ? '<span class="tn">' + escapeHtml(st.n) + '</span>' : '') +
        '</button>' +
        (s ? '<button type="button" class="todo-note" title="Ajouter une précision" aria-label="Ajouter une précision">' + ICON.pen + '</button>' : '') +
        (it.custom ? '<button type="button" class="todo-rm" title="Retirer cet élément" aria-label="Retirer">' + ICON.x + '</button>' : '') +
        '</div>';
    }).join('');
    updateBadge();
    renderNavState();
  }
  function setTodo(d, id, patch) {
    d.todo[id] = Object.assign({}, d.todo[id] || {}, patch, { u: Date.now() });
    touch(d, '_todo', 300);
    renderTodo();
    if ($('#board').open) renderBoard();
  }
  function cycleTodo(d, id) {
    const s = (d.todo[id] || {}).s || '';
    const next = s === '' ? 'todo' : s === 'todo' ? 'done' : '';
    setTodo(d, id, { s: next, at: next === 'done' ? Date.now() : 0 });
  }
  function bindTodo(card) {
    $('#todoGrid', card).addEventListener('click', ev => {
      const tile = ev.target.closest('.todo-tile'); if (!tile) return;
      const d = current();
      const id = tile.dataset.tid;
      if (ev.target.closest('.todo-note')) {
        const cur = (d.todo[id] || {}).n || '';
        const n = prompt('Précision (ex : scanner à 15h, avis demandé à 14h10) :', cur);
        if (n !== null) setTodo(d, id, { n: n.trim().slice(0, 60) });
      } else if (ev.target.closest('.todo-rm')) {
        setTodo(d, id, { s: '', gone: true });
      } else cycleTodo(d, id);
    });
    const inp = $('#todoCustom', card);
    const add = () => {
      const label = inp.value.trim(); if (!label) return;
      setTodo(current(), 'c_' + uid().slice(0, 8), { label: label.slice(0, 40), s: 'todo' });
      inp.value = '';
    };
    $('#todoAddBtn', card).addEventListener('click', add);
    inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); add(); } });
    $('#todoBoardLink', card).addEventListener('click', openBoard);
  }
  function updateBadge() {
    let n = 0;
    Object.values(store.dossiers).forEach(d => { Object.values(d.todo || {}).forEach(x => { if (x.s === 'todo' && !x.gone) n++; }); });
    const b = $('#todoBadge');
    b.hidden = !n; b.textContent = n > 99 ? '99+' : String(n);
  }

  /* ---------------- Tableau des patients ---------------- */
  const board = $('#board');
  function renderBoard() {
    const ids = sortedIds();
    $('#boardList').innerHTML = ids.length ? ids.map(id => {
      const d = store.dossiers[id];
      const m = d.meta;
      const a = ageInfo(m.age);
      const defs = todoDefs(d);
      const pills = defs.filter(it => d.todo[it.id] && d.todo[it.id].s)
        .sort((x, y) => (d.todo[x.id].s === 'todo' ? 0 : 1) - (d.todo[y.id].s === 'todo' ? 0 : 1))
        .map(it => {
          const st = d.todo[it.id];
          return '<button type="button" class="bpill ' + st.s + '" data-tid="' + it.id + '" title="' + escapeHtml(it.label + (st.n ? ' : ' + st.n : '') + (st.s === 'done' ? ' (fait)' : ' (à faire)')) + '">' +
            svg(it.icon) + '<span>' + escapeHtml(it.short) + (st.n ? ' <i>' + escapeHtml(st.n) + '</i>' : '') + '</span></button>';
        }).join('');
      const pending = defs.filter(it => d.todo[it.id] && d.todo[it.id].s === 'todo').length;
      return '<div class="brow' + (id === store.current ? ' current' : '') + '" data-c="' + colorOf(m) + '" data-id="' + id + '">' +
        '<button type="button" class="brow-main">' +
          '<span class="b-loc">' + escapeHtml(m.label || '-') + '</span>' +
          '<span class="b-who"><b>' + escapeHtml(m.name || 'Patient de ' + hhmm(m.created)) + '</b>' +
          '<span>' + [sexLabel(m.sex), a.text].filter(Boolean).join(', ') + '</span></span>' +
          (pending ? '<span class="b-count">' + pending + '</span>' : '') +
        '</button>' +
        '<div class="b-pills">' + (pills || '<span class="b-empty">Aucun élément</span>') + '</div>' +
        '</div>';
    }).join('') : '<p class="hint">Aucun patient.</p>';
  }
  function openBoard() { renderBoard(); if (!board.open) board.showModal(); }
  $('#boardBtn').addEventListener('click', openBoard);
  $('#boardList').addEventListener('click', ev => {
    const row = ev.target.closest('.brow'); if (!row) return;
    const d = store.dossiers[row.dataset.id]; if (!d) return;
    const pill = ev.target.closest('.bpill');
    if (pill) { cycleTodo(d, pill.dataset.tid); if (d.id === store.current) renderTodo(); return; }
    switchTo(d.id);
    board.close();
  });
  $('#boardNewBtn').addEventListener('click', () => { board.close(); createPatient(); });

  /* ================================================================== */
  /* Bandeau patient                                                     */
  /* ================================================================== */
  const banner = $('#pbanner');
  const editor = $('#pbEditor');
  function renderBanner() {
    const d = current();
    const m = d.meta;
    banner.dataset.c = colorOf(m);
    $('#pbLoc').textContent = m.label || 'Localisation ?';
    $('#pbLoc').classList.toggle('empty', !m.label);
    $('#pbName').textContent = m.name || (m.label ? '' : 'Patient de ' + hhmm(m.created));
    const a = ageInfo(m.age);
    $('#pbSA').textContent = [m.sex === 'F' ? 'Femme' : m.sex === 'M' ? 'Homme' : '', a.text].filter(Boolean).join(', ') || 'Sexe et âge ?';
    if (!editor.hidden) fillEditor();
    document.title = (m.label || m.name ? patientTitle(d) + ' - ' : '') + 'LeSacAUrge';
  }
  function fillEditor() {
    const m = current().meta;
    const ae = document.activeElement;
    if (ae !== $('#pLoc')) $('#pLoc').value = m.label || '';
    if (ae !== $('#pName')) $('#pName').value = m.name || '';
    if (ae !== $('#pAge')) $('#pAge').value = m.age || '';
    $$('input[name="psex"]').forEach(r => { r.checked = r.value === (m.sex || ''); });
  }
  function toggleEditor(open) {
    editor.hidden = !open;
    $('#pbMain').setAttribute('aria-expanded', String(open));
    if (open) fillEditor();
    syncHeadVar();
  }
  $('#pbMain').addEventListener('click', () => toggleEditor(editor.hidden));
  $('#pbDone').addEventListener('click', () => toggleEditor(false));
  function metaInput(key, value) {
    const d = current();
    d.meta[key] = value;
    touch(d, '_meta');
    renderBanner();
    if (board.open) renderBoard();
  }
  $('#pLoc').addEventListener('input', e => metaInput('label', e.target.value));
  $('#pName').addEventListener('input', e => metaInput('name', e.target.value));
  $('#pAge').addEventListener('input', e => metaInput('age', e.target.value));
  $$('input[name="psex"]').forEach(r => r.addEventListener('change', () => metaInput('sex', r.value)));
  $('#pAge').addEventListener('keydown', e => { if (e.key === 'Enter') toggleEditor(false); });

  function switchTo(id) {
    store.current = id;
    persist();
    $$('#sections textarea').forEach(t => { if (document.activeElement === t) t.blur(); });
    fillFromDossier();
    window.scrollTo({ top: 0 });
  }
  function createPatient() {
    newDossier();
    fillFromDossier();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toggleEditor(true);
    $('#pLoc').focus();
    toast('Nouveau patient');
  }
  $('#newDossierBtn').addEventListener('click', createPatient);
  $('#deleteDossierBtn').addEventListener('click', () => {
    const d = current();
    if (!isEmpty(d) && !confirm('Supprimer "' + patientTitle(d) + '" sur tous les appareils synchronisés ?')) return;
    deleteDossier(d.id, true);
    toggleEditor(false);
    fillFromDossier();
    toast('Patient supprimé');
  });
  function deleteDossier(id, propagate) {
    delete store.dossiers[id];
    delete copiedFlags[id];
    if (propagate) {
      store.tombstones[id] = Date.now();
      sync.pushDelete(id);
    }
    if (store.current === id) store.current = sortedIds()[0] || null;
    persist();
    updateBadge();
  }

  /* ================================================================== */
  /* Copie                                                               */
  /* ================================================================== */
  function sectionText(d, id) {
    if (id === 'evolution') return evoText(d.evo);
    return toPlain(d.fields[id] || '');
  }
  async function copySection(id) {
    const e = els[id];
    const d = current();
    const text = sectionText(d, id);
    if (!text) { toast('Encart vide'); return; }
    if (id === 'ecg' && /\bxx\b/.test(text)) toast('Attention : FC ou QTc non renseigné');
    const ok = await copyText(text);
    if (!ok) { toast('Copie impossible : sélectionnez le texte manuellement'); return; }
    if (id === 'evolution') {
      const now = Date.now();
      d.evo.forEach(x => { if (!x.del && !x.c) { x.c = now; x.u = now; } });
      saveEvo(d); renderEvo();
    } else {
      copiedFlags[store.current] = copiedFlags[store.current] || {};
      copiedFlags[store.current][id] = text;
    }
    const btn = $('.copy-btn', e.card);
    const label = $('span', btn).textContent;
    btn.classList.add('done');
    btn.innerHTML = ICON.check + '<span>Copié</span>';
    setTimeout(() => { btn.classList.remove('done'); btn.innerHTML = ICON.copy + '<span>' + label + '</span>'; }, 1400);
    refreshCard(id);
    if (!(id === 'ecg' && /\bxx\b/.test(text))) toast(e.sec.title + ' copié');
  }
  async function copyAll() {
    const d = current();
    const blocks = [];
    for (const sec of visibleSections()) {
      const t = sectionText(d, sec.id);
      if (!t) continue;
      blocks.push(settings.titles ? toPlain(sec.title) + ' :\n' + t : t);
    }
    if (!blocks.length) { toast('Observation vide'); return; }
    const ok = await copyText(blocks.join('\n\n'));
    toast(ok ? 'Observation complète copiée' : 'Copie impossible');
  }

  function purgeExpired() {
    const h = Number(settings.retentionH);
    if (!h) return;
    const max = h * 3600 * 1000;
    const now = Date.now();
    let changed = false;
    for (const id of Object.keys(store.dossiers)) {
      if (now - lastActivity(store.dossiers[id]) > max) { deleteDossier(id, false); changed = true; }
    }
    for (const id of Object.keys(store.tombstones)) {
      if (now - store.tombstones[id] > 7 * 24 * 3600 * 1000) delete store.tombstones[id];
    }
    sync.purge(max);
    if (changed) { persist(); fillFromDossier(); }
  }

  /* ================================================================== */
  /* Synchronisation                                                     */
  /* ================================================================== */
  const SYNC_LABEL = { off: 'Local', connecting: 'Connexion', online: 'Synchronisé', offline: 'Hors ligne', error: 'Erreur' };
  const sync = new window.LSAUSync.SyncEngine({
    getDossiers: () => store.dossiers,
    getTombstones: () => store.tombstones,
    getValue: (d, field) => {
      if (field === '_meta') {
        const m = Object.assign({}, d.meta);
        delete m.auto;
        if (!settings.syncIdent) delete m.name;
        return m;
      }
      if (field.startsWith('_')) return d[field.slice(1)];
      return d.fields[field] == null ? '' : d.fields[field];
    },
    applyField: (id, field, value, t) => {
      if (store.tombstones[id]) return;
      let d = store.dossiers[id];
      if (!d) d = store.dossiers[id] = fix({ id, meta: { label: '', created: t }, t: {} });
      let repush = false;
      if (field === '_meta') {
        const name = d.meta.name;
        d.meta = Object.assign({ label: '', created: t }, value || {});
        if (!('name' in (value || {}))) d.meta.name = name || '';
        delete d.meta.auto;
      } else if (field === '_evo') {
        const merged = mergeById(d.evo, Array.isArray(value) ? value : []);
        repush = !sameArr(merged, value);
        d.evo = merged;
      } else if (field === '_todo') {
        const merged = mergeMap(d.todo, value && typeof value === 'object' ? value : {});
        repush = !sameMap(merged, value);
        d.todo = merged;
      } else if (field === '_vitals') d.vitals = value || {};
      else if (field === '_ecg') d.ecg = value && typeof value === 'object' ? value : {};
      else if (field === 'evolution') { /* ancienne version : ignore */ }
      else d.fields[field] = typeof value === 'string' ? value : '';
      d.t[field] = t;
      persist();
      if (repush) touch(d, field, 300);
      scheduleRemoteRefresh(id, field);
    },
    applyDelete: (id) => {
      if (!store.dossiers[id]) return;
      const wasCurrent = store.current === id;
      deleteDossier(id, false);
      store.tombstones[id] = store.tombstones[id] || Date.now();
      if (wasCurrent) { fillFromDossier(); toast('Patient supprimé depuis un autre appareil'); }
      if (board.open) renderBoard();
    },
    onInitial: () => {
      const cur = store.dossiers[store.current];
      if (cur && cur.meta.auto && isEmpty(cur) && Object.keys(store.dossiers).length > 1) {
        delete store.dossiers[cur.id];
        store.current = sortedIds()[0];
        persist();
        fillFromDossier();
      }
    },
    onStatus: (s, detail) => {
      const pill = $('#syncPill');
      pill.dataset.s = s;
      $('.label', pill).textContent = SYNC_LABEL[s] || s;
      pill.title = 'Synchronisation : ' + (SYNC_LABEL[s] || s) + (detail ? ' - ' + detail : '');
      $('#syncState').textContent = 'État : ' + (SYNC_LABEL[s] || s) + (detail ? ' - ' + detail : '');
    }
  });

  let remoteTimer = null;
  const remoteQueue = new Set();
  function scheduleRemoteRefresh(id, field) {
    remoteQueue.add(id + '|' + field);
    clearTimeout(remoteTimer);
    remoteTimer = setTimeout(() => {
      const curId = store.current;
      remoteQueue.forEach(k => {
        const [did, f] = k.split('|');
        if (did !== curId || !store.dossiers[did]) return;
        if (f === '_meta') renderBanner();
        else if (f === '_vitals' || f === '_ecg') { if (els.examen) fillVitals(); if (els.ecg) refreshEcgControls(); }
        else if (f === '_evo') renderEvo();
        else if (f === '_todo') renderTodo();
        else {
          const e = els[f];
          if (!e || !e.ta) return;
          const v = store.dossiers[did].fields[f] || '';
          if (e.ta.value === v) return;
          // Ne jamais modifier une zone en cours de saisie (ferme le clavier
          // et les suggestions d'orthographe sur mobile) : application a la sortie.
          if (document.activeElement === e.ta) { pendingRemote.add(f); return; }
          e.ta.value = v;
          autoGrow(e.ta);
          refreshCard(f);
        }
      });
      remoteQueue.clear();
      if (!store.dossiers[store.current]) fillFromDossier();
      updateBadge();
      if (board.open) renderBoard();
    }, 60);
  }
  function fillVitals() {
    const d = current();
    for (const v of VITALS) {
      const inp = $('#v_' + v.id);
      if (inp && document.activeElement !== inp) inp.value = d.vitals[v.id] || '';
    }
  }

  function startSync() {
    if (settings.syncOn && settings.dbUrl && window.LSAUSync.isValidCode(settings.code)) {
      sync.start(settings.dbUrl, settings.code);
    } else sync.stop();
  }

  /* ================================================================== */
  /* Reglages                                                            */
  /* ================================================================== */
  const dlg = $('#settings');
  function applyTheme() {
    if (settings.theme === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', settings.theme);
  }
  function pairingUrl() {
    const base = location.href.split('#')[0];
    return base + '#pair=' + encodeURIComponent(window.LSAUSync.normalizeCode(settings.code)) +
      '&db=' + encodeURIComponent(settings.dbUrl);
  }
  function renderQr() {
    const wrap = $('#qrWrap');
    if (!settings.dbUrl || !window.LSAUSync.isValidCode(settings.code) || typeof qrcode !== 'function') {
      wrap.hidden = true; return;
    }
    const qr = qrcode(0, 'M');
    qr.addData(pairingUrl());
    qr.make();
    $('#qr').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
    wrap.hidden = false;
  }
  function openSettings() {
    $('#dbUrl').value = settings.dbUrl || '';
    $('#pairCode').value = settings.code ? window.LSAUSync.formatCode(settings.code) : '';
    $('#optTitles').checked = !!settings.titles;
    $('#optAscii').checked = !!settings.ascii;
    $('#optMarkCopied').checked = !!settings.markCopied;
    $('#optSpell').checked = !!settings.spell;
    $('#optSyncIdent').checked = !!settings.syncIdent;
    $('#retention').value = String(settings.retentionH);
    $$('input[name="theme"]').forEach(r => { r.checked = r.value === settings.theme; });
    $('#sectionToggles').innerHTML = SECTIONS.map(s =>
      '<label class="check"><input type="checkbox" data-sec="' + s.id + '"' + (settings.hidden.includes(s.id) ? '' : ' checked') + '> ' + escapeHtml(s.title) + '</label>').join('');
    const cs = $('#chipSection');
    cs.innerHTML = SECTIONS.filter(s => s.id !== 'examen' && s.id !== 'ecg').map(s => '<option value="' + s.id + '">' + escapeHtml(s.title) + '</option>').join('');
    cs.value = 'atcd_med';
    $('#chipEditor').value = chipsFor(cs.value).join('\n');
    $('#appVersion').textContent = CFG.version || '';
    sync.setStatus(sync.status);
    renderQr();
    dlg.showModal();
  }
  $('#settingsBtn').addEventListener('click', openSettings);
  $('#syncPill').addEventListener('click', openSettings);
  $('#syncHelpLink').addEventListener('click', ev => { ev.preventDefault(); $('#help').showModal(); });

  $('#genCodeBtn').addEventListener('click', () => {
    if (settings.code && !confirm('Remplacer le code actuel ? Les autres appareils devront être jumelés à nouveau.')) return;
    $('#pairCode').value = window.LSAUSync.generateCode();
  });
  $('#syncOnBtn').addEventListener('click', () => {
    const url = $('#dbUrl').value.trim().replace(/\/+$/, '');
    const code = window.LSAUSync.normalizeCode($('#pairCode').value);
    if (!/^https:\/\/[^\s/]+\.(firebaseio\.com|firebasedatabase\.app)$/.test(url) && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url)) {
      toast('Adresse de base invalide'); return;
    }
    if (!window.LSAUSync.isValidCode(code)) { toast('Code de jumelage invalide (20 caractères)'); return; }
    settings.dbUrl = url; settings.code = code; settings.syncOn = true;
    persistSettings();
    startSync();
    renderQr();
    toast('Synchronisation activée');
  });
  $('#syncOffBtn').addEventListener('click', () => {
    settings.syncOn = false; persistSettings(); sync.stop(); toast('Synchronisation désactivée');
  });
  $('#wipeRemoteBtn').addEventListener('click', async () => {
    if (!sync.active) { toast('Activez d\'abord la synchronisation'); return; }
    if (!confirm('Effacer toutes les données distantes associées à ce code ?')) return;
    const ok = await sync.wipeRoom();
    toast(ok ? 'Données distantes effacées' : 'Échec de l\'effacement');
  });

  $('#optTitles').addEventListener('change', e => { settings.titles = e.target.checked; persistSettings(); });
  $('#optAscii').addEventListener('change', e => { settings.ascii = e.target.checked; persistSettings(); Object.keys(els).forEach(refreshCard); });
  $('#optMarkCopied').addEventListener('change', e => { settings.markCopied = e.target.checked; persistSettings(); Object.keys(els).forEach(refreshCard); });
  $('#optSpell').addEventListener('change', e => { settings.spell = e.target.checked; persistSettings(); applySpell(); $$('.evo-item textarea').forEach(t => { t.spellcheck = settings.spell; }); });
  $('#optSyncIdent').addEventListener('change', e => {
    settings.syncIdent = e.target.checked; persistSettings();
    if (settings.syncIdent) Object.values(store.dossiers).forEach(d => { if (d.meta.name) touch(d, '_meta', 0); });
  });
  $('#retention').addEventListener('change', e => { settings.retentionH = Number(e.target.value); persistSettings(); purgeExpired(); });
  $$('input[name="theme"]').forEach(r => r.addEventListener('change', () => { settings.theme = r.value; persistSettings(); applyTheme(); }));
  $('#sectionToggles').addEventListener('change', e => {
    const id = e.target.dataset.sec; if (!id) return;
    settings.hidden = settings.hidden.filter(x => x !== id);
    if (!e.target.checked) settings.hidden.push(id);
    persistSettings(); renderSections();
  });
  $('#chipSection').addEventListener('change', e => { $('#chipEditor').value = chipsFor(e.target.value).join('\n'); });
  $('#chipSaveBtn').addEventListener('click', () => {
    const id = $('#chipSection').value;
    settings.chips[id] = $('#chipEditor').value.split('\n').map(s => s.trim()).filter(Boolean);
    persistSettings(); renderSections(); toast('Pastilles enregistrées');
  });
  $('#chipResetBtn').addEventListener('click', () => {
    const id = $('#chipSection').value;
    delete settings.chips[id];
    $('#chipEditor').value = chipsFor(id).join('\n');
    persistSettings(); renderSections(); toast('Pastilles par défaut rétablies');
  });

  /* ================================================================== */
  /* Divers                                                              */
  /* ================================================================== */
  let toastTimer = null;
  function toast(msg, actionLabel, action) {
    const t = $('#toast');
    t.innerHTML = '';
    t.append(document.createTextNode(msg));
    if (actionLabel) {
      const b = document.createElement('button');
      b.textContent = actionLabel; b.type = 'button';
      b.className = 'toast-action';
      b.addEventListener('click', () => { action(); t.classList.remove('show'); });
      t.append(b);
      t.style.pointerEvents = 'auto';
    } else t.style.pointerEvents = 'none';
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), actionLabel ? 5000 : 1800);
  }

  $('#copyAllBtn').addEventListener('click', copyAll);
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'C' || e.key === 'c')) { e.preventDefault(); copyAll(); return; }
    if (e.altKey && !e.ctrlKey && !e.metaKey && /^Digit[1-9]$/.test(e.code)) {
      const ids = Object.keys(els);
      const id = ids[Number(e.code.slice(5)) - 1];
      if (id) { e.preventDefault(); copySection(id); }
    }
  });
  let lastW = window.innerWidth;
  window.addEventListener('resize', () => {
    // l'ouverture du clavier mobile ne change que la hauteur : on ne recalcule rien
    if (window.innerWidth === lastW) return;
    lastW = window.innerWidth;
    updateChipOverflow();
    $$('textarea').forEach(autoGrow);
  });
  window.addEventListener('online', () => { if (settings.syncOn) startSync(); });
  window.addEventListener('storage', ev => {
    if (ev.key === DATA_KEY && ev.newValue) {
      try { Object.assign(store, JSON.parse(ev.newValue)); Object.values(store.dossiers).forEach(fix); fillFromDossier(); } catch (e) {}
    }
  });

  function handlePairingHash() {
    if (!location.hash.startsWith('#pair=')) return;
    const p = new URLSearchParams(location.hash.slice(1));
    const code = window.LSAUSync.normalizeCode(p.get('pair'));
    const db = (p.get('db') || '').trim();
    history.replaceState(null, '', location.pathname + location.search);
    if (!window.LSAUSync.isValidCode(code) || !db) { toast('Lien de jumelage invalide'); return; }
    if (settings.code && settings.code !== code &&
        !confirm('Remplacer le jumelage actuel par celui de ce lien ?')) return;
    settings.code = code; settings.dbUrl = db; settings.syncOn = true;
    persistSettings();
    toast('Appareil jumelé, synchronisation activée');
  }

  // Initialisation
  applyTheme();
  if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  handlePairingHash();
  current();
  renderSections();
  purgeExpired();
  startSync();
  setInterval(purgeExpired, 10 * 60 * 1000);

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  window.LSAU = { toPlain, store, settings, ageInfo, colorOf, ecgSentence }; // pour les tests
})();
