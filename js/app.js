/* LeSacAUrge - application
   ©2026 LESACA Julien - Tous droits reserves. */
'use strict';

(function () {
  const CFG = window.LSAU_CONFIG || {};
  const SECTIONS = window.SECTIONS;
  const EXAM = window.EXAM_SYSTEMS;
  const VITALS = window.VITALS;
  const DATA_KEY = 'lsau.data.v1';
  const SET_KEY = 'lsau.settings.v1';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  const ICON = {
    copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 8h11v13H8z M5 16H4V3h11v1"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>',
    clear: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
    clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>'
  };

  /* ------------------------------------------------------------------ */
  /* Stockage                                                            */
  /* ------------------------------------------------------------------ */
  function load(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { toast('Stockage local indisponible'); }
  }

  const settings = Object.assign({
    theme: 'auto', titles: true, ascii: false, markCopied: true, retentionH: 24,
    hidden: [], chips: {}, dbUrl: CFG.firebaseDatabaseUrl || '', code: '', syncOn: false
  }, load(SET_KEY, {}));

  const store = Object.assign({ dossiers: {}, current: null, tombstones: {} }, load(DATA_KEY, {}));
  const copiedFlags = {}; // local, non synchronise : { dossierId: { sectionId: texteCopie } }

  let saveTimer = null;
  function persist() { clearTimeout(saveTimer); saveTimer = setTimeout(() => save(DATA_KEY, store), 250); }
  function persistSettings() { save(SET_KEY, settings); }

  function uid() {
    const b = crypto.getRandomValues(new Uint8Array(9));
    return Array.from(b, x => x.toString(36).padStart(2, '0')).join('').slice(0, 14);
  }
  function hhmm(d) {
    d = d || new Date();
    return String(d.getHours()).padStart(2, '0') + 'h' + String(d.getMinutes()).padStart(2, '0');
  }

  function newDossier(auto) {
    const id = uid();
    const now = Date.now();
    store.dossiers[id] = {
      id, meta: { label: '', created: now, auto: !!auto },
      fields: {}, vitals: {}, t: auto ? {} : { _meta: now }
    };
    store.current = id;
    persist();
    if (!auto) sync.queuePush(id, '_meta', 0);
    return store.dossiers[id];
  }
  function dossierName(d) {
    const time = hhmm(new Date(d.meta.created || Date.now()));
    return d.meta.label ? d.meta.label + ' (' + time + ')' : 'Dossier de ' + time;
  }
  function isEmpty(d) {
    return !d.meta.label && !Object.values(d.fields).some(v => v && v.trim()) &&
      !Object.values(d.vitals || {}).some(v => v && String(v).trim());
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

  function touch(d, field) {
    d.t = d.t || {};
    if (d.meta.auto) {
      delete d.meta.auto;
      d.t._meta = Date.now();
      sync.queuePush(d.id, '_meta', 0);
    }
    d.t[field] = Date.now();
    persist();
    sync.queuePush(d.id, field);
  }

  /* ------------------------------------------------------------------ */
  /* Texte brut                                                          */
  /* ------------------------------------------------------------------ */
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

  /* ------------------------------------------------------------------ */
  /* Rendu                                                               */
  /* ------------------------------------------------------------------ */
  const main = $('#sections');
  const els = {}; // sectionId -> { card, ta, chipsWrap }

  function chipsFor(sectionId) {
    const custom = settings.chips[sectionId];
    return Array.isArray(custom) ? custom : (window.DEFAULT_CHIPS[sectionId] || []);
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]));
  }

  function renderSections() {
    main.innerHTML = '';
    for (const k of Object.keys(els)) delete els[k];
    let n = 0;
    for (const sec of SECTIONS) {
      if (settings.hidden.includes(sec.id)) continue;
      n++;
      const card = document.createElement('section');
      card.className = 'card' + (['motif', 'anamnese', 'examen'].includes(sec.id) ? ' wide' : '');
      card.dataset.id = sec.id;
      const chips = chipsFor(sec.id);
      card.innerHTML =
        '<div class="card-head">' +
          '<h2>' + escapeHtml(sec.title) + '</h2>' +
          '<span class="badge">Copié</span>' +
          '<button class="btn copy-btn" type="button" title="Copier cet encart' + (n <= 9 ? ' (Alt+' + n + ')' : '') + '">' + ICON.copy + '<span>Copier</span></button>' +
        '</div>' +
        (sec.id === 'examen' ? examToolsHtml() : '') +
        (chips.length ? '<div class="chips-wrap"><div class="chips">' +
          chips.map(c => '<button type="button" class="chip" data-v="' + escapeHtml(c) + '">' + escapeHtml(c) + '</button>').join('') +
          '</div><button type="button" class="link-btn more-btn">' + ICON.down + '<span>Afficher tout</span></button></div>' : '') +
        '<textarea rows="3" spellcheck="true" autocapitalize="sentences" placeholder="' + escapeHtml(sec.placeholder || 'Saisie ou dictée...') + '" aria-label="' + escapeHtml(sec.title) + '"></textarea>' +
        '<div class="card-foot">' +
          (sec.id === 'evolution' ? '<button type="button" class="link-btn stamp-btn">' + ICON.clock + 'Horodater</button>' : '') +
          '<span class="spacer"></span><span class="count"></span>' +
          '<button type="button" class="link-btn clear-btn">' + ICON.clear + 'Effacer</button>' +
        '</div>';
      main.appendChild(card);
      els[sec.id] = { card, ta: $('textarea', card), chipsWrap: $('.chips-wrap', card), sec };
      bindCard(sec, card);
    }
    fillFromDossier();
    requestAnimationFrame(updateChipOverflow);
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

  function autoGrow(ta) {
    ta.style.height = 'auto';
    ta.style.height = Math.max(92, ta.scrollHeight + 2) + 'px';
  }

  function fillFromDossier() {
    const d = current();
    for (const id of Object.keys(els)) {
      const e = els[id];
      const v = d.fields[id] || '';
      if (e.ta.value !== v) e.ta.value = v;
      autoGrow(e.ta);
      refreshCard(id);
    }
    if (els.examen) {
      for (const v of VITALS) {
        const inp = $('#v_' + v.id);
        if (inp && document.activeElement !== inp) inp.value = (d.vitals && d.vitals[v.id]) || '';
      }
    }
    renderDossierBar();
  }

  function refreshCard(id) {
    const e = els[id];
    if (!e) return;
    const text = e.ta.value;
    e.card.classList.toggle('has-text', text.trim().length > 0);
    const cf = (copiedFlags[store.current] || {})[id];
    e.card.classList.toggle('copied', settings.markCopied && cf != null && cf === toPlain(text) && text.trim() !== '');
    const count = $('.count', e.card);
    count.textContent = text.length ? text.length + ' car.' : '';
    if (e.chipsWrap) {
      const segs = segments(text, e.sec.sep);
      $$('.chip', e.chipsWrap).forEach(c => c.classList.toggle('on', segs.has(norm(c.dataset.v))));
    }
    if (id === 'examen') refreshExam();
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

  /* ------------------------------------------------------------------ */
  /* Interactions                                                        */
  /* ------------------------------------------------------------------ */
  function setField(id, value) {
    const d = current();
    d.fields[id] = value;
    touch(d, id);
    const e = els[id];
    if (e && e.ta.value !== value) { e.ta.value = value; autoGrow(e.ta); }
    refreshCard(id);
  }

  function toggleChip(sec, value) {
    const e = els[sec.id];
    let text = e.ta.value;
    const segs = segments(text, sec.sep);
    if (segs.has(norm(value))) {
      // retrait de la pastille
      const re = new RegExp('(^|' + (sec.sep.includes('\n') ? '\\n' : '[,\\n]') + ')\\s*' +
        value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*[.;]?\\s*(?=$|' + (sec.sep.includes('\n') ? '\\n' : '[,\\n]') + ')', 'i');
      text = text.replace(re, '').replace(/^[,\s]+/, '').replace(/,\s*,/g, ',').replace(/[,\s]+$/, '').replace(/\n{2,}/g, '\n');
    } else {
      const trimmed = text.replace(/\s+$/, '');
      text = trimmed ? trimmed + (sec.sep === ', ' && /[\n]$/.test(text) ? '' : sec.sep) + value : value;
    }
    setField(sec.id, text);
  }

  function bindCard(sec, card) {
    const e = els[sec.id];
    e.ta.addEventListener('input', () => {
      autoGrow(e.ta);
      const d = current();
      d.fields[sec.id] = e.ta.value;
      touch(d, sec.id);
      refreshCard(sec.id);
    });
    $('.copy-btn', card).addEventListener('click', () => copySection(sec.id));
    $('.clear-btn', card).addEventListener('click', () => {
      if (!e.ta.value) return;
      const prev = e.ta.value;
      setField(sec.id, '');
      toast('Encart effacé', 'Annuler', () => setField(sec.id, prev));
    });
    if (e.chipsWrap) {
      e.chipsWrap.addEventListener('click', ev => {
        const chip = ev.target.closest('.chip');
        if (chip) { toggleChip(sec, chip.dataset.v); return; }
        const more = ev.target.closest('.more-btn');
        if (more) {
          const open = e.chipsWrap.classList.toggle('open');
          $('span', more).textContent = open ? 'Réduire' : 'Afficher tout';
          more.querySelector('svg').style.transform = open ? 'rotate(180deg)' : '';
        }
      });
    }
    const stamp = $('.stamp-btn', card);
    if (stamp) stamp.addEventListener('click', () => {
      const t = e.ta.value.replace(/\s+$/, '');
      setField(sec.id, (t ? t + '\n' : '') + hhmm() + ' : ');
      e.ta.focus();
      e.ta.setSelectionRange(e.ta.value.length, e.ta.value.length);
    });
    if (sec.id === 'examen') bindExam(card);
  }

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
    // insere dans l'ordre des appareils, apres le dernier appareil precedent present
    const idx = EXAM.indexOf(sys);
    let pos = -1;
    for (let i = idx - 1; i >= 0; i--) {
      const p = text.indexOf(EXAM[i].text);
      if (p >= 0) { pos = p + EXAM[i].text.length; break; }
    }
    if (pos < 0) {
      for (let i = idx + 1; i < EXAM.length; i++) {
        const p = text.indexOf(EXAM[i].text);
        if (p >= 0) { return text.slice(0, p) + sys.text + '\n' + text.slice(p); }
      }
      const t = text.replace(/\s+$/, '');
      return t ? t + '\n' + sys.text : sys.text;
    }
    return text.slice(0, pos) + '\n' + sys.text + text.slice(pos);
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
    $$('.vital input', card).forEach(inp => inp.addEventListener('input', () => {
      const d = current();
      d.vitals = d.vitals || {};
      d.vitals[inp.dataset.v] = inp.value;
      touch(d, '_vitals');
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

  async function copySection(id) {
    const e = els[id];
    const text = toPlain(e.ta.value);
    if (!text) { toast('Encart vide'); return; }
    const ok = await copyText(text);
    if (!ok) { toast('Copie impossible : sélectionnez le texte manuellement'); return; }
    copiedFlags[store.current] = copiedFlags[store.current] || {};
    copiedFlags[store.current][id] = text;
    const btn = $('.copy-btn', e.card);
    btn.classList.add('done');
    btn.innerHTML = ICON.check + '<span>Copié</span>';
    setTimeout(() => { btn.classList.remove('done'); btn.innerHTML = ICON.copy + '<span>Copier</span>'; }, 1400);
    refreshCard(id);
    toast(e.sec.title + ' copié');
  }

  async function copyAll() {
    const d = current();
    const blocks = [];
    for (const sec of SECTIONS) {
      if (settings.hidden.includes(sec.id)) continue;
      const t = toPlain(d.fields[sec.id] || '');
      if (!t) continue;
      blocks.push(settings.titles ? toPlain(sec.title) + ' :\n' + t : t);
    }
    if (!blocks.length) { toast('Observation vide'); return; }
    const ok = await copyText(blocks.join('\n\n'));
    toast(ok ? 'Observation complète copiée' : 'Copie impossible');
  }

  /* ------------------------------------------------------------------ */
  /* Dossiers                                                            */
  /* ------------------------------------------------------------------ */
  const sel = $('#dossierSelect');
  const labelInput = $('#dossierLabel');
  function renderDossierBar() {
    const ids = sortedIds();
    sel.innerHTML = ids.map(id => {
      const d = store.dossiers[id];
      return '<option value="' + id + '">' + escapeHtml(dossierName(d)) + '</option>';
    }).join('');
    sel.value = store.current;
    if (document.activeElement !== labelInput) labelInput.value = current().meta.label || '';
  }
  sel.addEventListener('change', () => { store.current = sel.value; persist(); fillFromDossier(); window.scrollTo({ top: 0 }); });
  labelInput.addEventListener('input', () => {
    const d = current();
    d.meta.label = labelInput.value;
    touch(d, '_meta');
    const opt = sel.querySelector('option[value="' + d.id + '"]');
    if (opt) opt.textContent = dossierName(d);
  });
  $('#newDossierBtn').addEventListener('click', () => {
    newDossier();
    fillFromDossier();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast('Nouveau dossier créé');
    labelInput.focus(); labelInput.select();
  });
  $('#deleteDossierBtn').addEventListener('click', () => {
    const d = current();
    if (!isEmpty(d) && !confirm('Supprimer "' + dossierName(d) + '" sur tous les appareils synchronisés ?')) return;
    deleteDossier(d.id, true);
    fillFromDossier();
    toast('Dossier supprimé');
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

  /* ------------------------------------------------------------------ */
  /* Synchronisation                                                     */
  /* ------------------------------------------------------------------ */
  const SYNC_LABEL = { off: 'Local', connecting: 'Connexion', online: 'Synchronisé', offline: 'Hors ligne', error: 'Erreur' };
  const sync = new window.LSAUSync.SyncEngine({
    getDossiers: () => store.dossiers,
    getTombstones: () => store.tombstones,
    applyField: (id, field, value, t) => {
      if (store.tombstones[id]) return;
      let d = store.dossiers[id];
      if (!d) {
        d = store.dossiers[id] = { id, meta: { label: '', created: t }, fields: {}, vitals: {}, t: {} };
      }
      if (field === '_meta') { d.meta = Object.assign({ label: '', created: t }, value || {}); delete d.meta.auto; }
      else if (field === '_vitals') d.vitals = value || {};
      else d.fields[field] = typeof value === 'string' ? value : '';
      d.t[field] = t;
      persist();
      scheduleRemoteRefresh(id, field);
    },
    applyDelete: (id) => {
      if (!store.dossiers[id]) return;
      const wasCurrent = store.current === id;
      deleteDossier(id, false);
      store.tombstones[id] = store.tombstones[id] || Date.now();
      if (wasCurrent) { fillFromDossier(); toast('Dossier supprimé depuis un autre appareil'); }
      else renderDossierBar();
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
  const remotePending = new Set();
  function scheduleRemoteRefresh(id, field) {
    remotePending.add(id + '|' + field);
    clearTimeout(remoteTimer);
    remoteTimer = setTimeout(() => {
      const curId = store.current;
      let barDirty = false;
      remotePending.forEach(k => {
        const [did, f] = k.split('|');
        if (f === '_meta') barDirty = true;
        if (did !== curId) { barDirty = true; return; }
        if (f === '_vitals') { fillFromDossier(); return; }
        const e = els[f];
        if (!e) return;
        const v = store.dossiers[did].fields[f] || '';
        if (e.ta.value !== v) {
          const focused = document.activeElement === e.ta;
          const pos = focused ? e.ta.selectionStart : 0;
          e.ta.value = v;
          if (focused) e.ta.setSelectionRange(Math.min(pos, v.length), Math.min(pos, v.length));
          autoGrow(e.ta);
        }
        refreshCard(f);
      });
      remotePending.clear();
      if (!store.dossiers[store.current]) fillFromDossier();
      else if (barDirty) renderDossierBar();
    }, 60);
  }

  function startSync() {
    if (settings.syncOn && settings.dbUrl && window.LSAUSync.isValidCode(settings.code)) {
      sync.start(settings.dbUrl, settings.code);
    } else sync.stop();
  }

  /* ------------------------------------------------------------------ */
  /* Reglages                                                            */
  /* ------------------------------------------------------------------ */
  const dlg = $('#settings');
  function applyTheme() {
    if (settings.theme === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', settings.theme);
    const dark = settings.theme === 'dark' ||
      (settings.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    $('meta[name="theme-color"]').setAttribute('content', dark ? '#0f3666' : '#174a87');
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
    $('#retention').value = String(settings.retentionH);
    $$('input[name="theme"]').forEach(r => { r.checked = r.value === settings.theme; });
    $('#sectionToggles').innerHTML = SECTIONS.map(s =>
      '<label class="check"><input type="checkbox" data-sec="' + s.id + '"' + (settings.hidden.includes(s.id) ? '' : ' checked') + '> ' + escapeHtml(s.title) + '</label>').join('');
    const cs = $('#chipSection');
    cs.innerHTML = SECTIONS.filter(s => s.id !== 'examen').map(s => '<option value="' + s.id + '">' + escapeHtml(s.title) + '</option>').join('');
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

  /* ------------------------------------------------------------------ */
  /* Divers                                                              */
  /* ------------------------------------------------------------------ */
  let toastTimer = null;
  function toast(msg, actionLabel, action) {
    const t = $('#toast');
    t.innerHTML = '';
    t.append(document.createTextNode(msg));
    if (actionLabel) {
      const b = document.createElement('button');
      b.textContent = actionLabel; b.type = 'button';
      b.style.cssText = 'margin-left:12px;background:none;border:0;color:#9cc6ff;font-weight:700;cursor:pointer;pointer-events:auto';
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
  window.addEventListener('resize', updateChipOverflow);
  window.addEventListener('online', () => { if (settings.syncOn) startSync(); });
  window.addEventListener('storage', ev => {
    // autre onglet du meme navigateur
    if (ev.key === DATA_KEY && ev.newValue) {
      try { Object.assign(store, JSON.parse(ev.newValue)); fillFromDossier(); } catch (e) {}
    }
  });

  // Jumelage par lien / QR code : #pair=CODE&db=URL
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

  window.LSAU = { toPlain, store, settings }; // pour les tests
})();
