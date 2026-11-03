/* LeSacAUrge - synchronisation chiffree de bout en bout
   Backend : Firebase Realtime Database via son API REST (aucun SDK).
   Le serveur ne recoit que du texte chiffre (AES-GCM 256). La cle est derivee
   du code de jumelage, qui ne quitte jamais les appareils.
   ©2026 LESACA Julien - Tous droits reserves. */
'use strict';

(function () {
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const SALT = enc.encode('LeSacAUrge|e2e|v1');
  const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans I, O, 0, 1

  function b64(buf) {
    const bytes = new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }
  function unb64(str) {
    const s = atob(str);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }

  function generateCode() {
    // 20 caracteres sur un alphabet de 32 = 100 bits d'entropie
    const rnd = crypto.getRandomValues(new Uint8Array(20));
    let c = '';
    for (let i = 0; i < 20; i++) c += CODE_ALPHABET[rnd[i] % 32];
    return formatCode(c);
  }
  function normalizeCode(code) {
    return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  }
  function formatCode(code) {
    return normalizeCode(code).replace(/(.{4})(?=.)/g, '$1-');
  }
  function isValidCode(code) {
    const n = normalizeCode(code);
    return n.length === 20 && [...n].every(ch => CODE_ALPHABET.includes(ch));
  }

  async function deriveKeys(code) {
    const n = normalizeCode(code);
    const hash = await crypto.subtle.digest('SHA-256', enc.encode('room|' + n));
    const room = [...new Uint8Array(hash)].slice(0, 16)
      .map(b => b.toString(16).padStart(2, '0')).join('');
    const base = await crypto.subtle.importKey('raw', enc.encode(n), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: SALT, iterations: 150000, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    return { room, key };
  }

  async function encryptValue(key, value) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(value)));
    return { iv: b64(iv), ct: b64(ct) };
  }
  async function decryptValue(key, node) {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(node.iv) }, key, unb64(node.ct));
    return JSON.parse(dec.decode(pt));
  }

  /* -------- Moteur de synchronisation --------
     Arborescence distante : rooms/<room>/d/<dossierId>/<champ> = { t, iv, ct }
                             rooms/<room>/x/<dossierId>        = horodatage de suppression
     Strategie : "dernier ecrit gagne" par champ (horodatage t). */
  class SyncEngine {
    constructor(hooks) {
      this.hooks = hooks; // { getDossiers, applyField, applyDelete, onStatus }
      this.es = null;
      this.mirror = {};
      this.key = null;
      this.base = null;
      this.timers = new Map();
      this.status = 'off';
    }

    setStatus(s, detail) {
      this.status = s;
      this.hooks.onStatus && this.hooks.onStatus(s, detail || '');
    }

    async start(dbUrl, code) {
      this.stop();
      if (!dbUrl || !isValidCode(code)) { this.setStatus('off'); return; }
      this.setStatus('connecting');
      try {
        const { room, key } = await deriveKeys(code);
        this.key = key;
        this.base = dbUrl.replace(/\/+$/, '') + '/rooms/' + room;
      } catch (e) {
        this.setStatus('error', 'Chiffrement indisponible (HTTPS requis).');
        return;
      }
      this.mirror = {};
      const es = new EventSource(this.base + '.json');
      this.es = es;
      const onData = (ev) => {
        let msg;
        try { msg = JSON.parse(ev.data); } catch (e) { return; }
        if (!msg || typeof msg.path !== 'string') return;
        this.applyEvent(ev.type, msg.path, msg.data);
      };
      es.addEventListener('put', onData);
      es.addEventListener('patch', onData);
      es.addEventListener('cancel', () => {
        this.setStatus('error', 'Accès refusé par la base (vérifier les règles).');
        this.stop(true);
      });
      es.addEventListener('auth_revoked', () => this.setStatus('error', 'Autorisation révoquée.'));
      es.onerror = () => {
        if (this.es === es) this.setStatus(navigator.onLine ? 'connecting' : 'offline');
      };
    }

    stop(keepStatus) {
      if (this.es) { this.es.close(); this.es = null; }
      this.timers.forEach(t => clearTimeout(t));
      this.timers.clear();
      if (!keepStatus) this.setStatus('off');
    }

    get active() { return !!this.es; }

    // Applique un evenement put/patch au miroir local de la base distante
    applyEvent(type, path, data) {
      const parts = path.split('/').filter(Boolean);
      if (type === 'put') {
        if (parts.length === 0) this.mirror = data || {};
        else setPath(this.mirror, parts, data);
      } else if (type === 'patch') {
        for (const k of Object.keys(data || {})) {
          setPath(this.mirror, parts.concat(k.split('/').filter(Boolean)), data[k]);
        }
      }
      const initial = type === 'put' && parts.length === 0;
      if (initial) this.setStatus('online');
      this.reconcile(initial).then(() => { if (initial && this.hooks.onInitial) this.hooks.onInitial(); });
    }

    async reconcile(pushLocal) {
      if (!this.key) return;
      const remoteD = this.mirror.d || {};
      const remoteX = this.mirror.x || {};
      // Suppressions distantes
      for (const id of Object.keys(remoteX)) this.hooks.applyDelete(id, remoteX[id]);
      const tomb = this.hooks.getTombstones();
      const local = this.hooks.getDossiers();
      // Champs distants plus recents -> local
      for (const id of Object.keys(remoteD)) {
        if (remoteX[id]) continue;
        if (tomb[id]) { this.pushDelete(id, tomb[id]); continue; }
        const fields = remoteD[id] || {};
        const loc = local[id];
        for (const f of Object.keys(fields)) {
          const node = fields[f];
          if (!node || typeof node.t !== 'number') continue;
          const lt = loc && loc.t ? (loc.t[f] || 0) : 0;
          if (node.t > lt) {
            try {
              const v = await decryptValue(this.key, node);
              this.hooks.applyField(id, f, v, node.t);
            } catch (e) {
              this.setStatus('error', 'Données illisibles : code de jumelage différent ?');
            }
          }
        }
      }
      // Champs locaux plus recents -> distant (apres (re)connexion)
      if (pushLocal) {
        for (const id of Object.keys(tomb)) if (!remoteX[id]) this.pushDelete(id, tomb[id]);
        const now = this.hooks.getDossiers();
        for (const id of Object.keys(now)) {
          const d = now[id];
          for (const f of Object.keys(d.t || {})) {
            const rt = remoteD[id] && remoteD[id][f] ? remoteD[id][f].t : 0;
            if ((d.t[f] || 0) > rt) this.queuePush(id, f, 0);
          }
        }
      }
    }

    queuePush(id, field, delay) {
      if (!this.base) return;
      const k = id + '/' + field;
      clearTimeout(this.timers.get(k));
      this.timers.set(k, setTimeout(() => { this.timers.delete(k); this.push(id, field); }, delay == null ? 700 : delay));
    }

    async push(id, field) {
      const d = this.hooks.getDossiers()[id];
      if (!d || !this.base) return;
      const value = field === '_meta' ? d.meta : (field === '_vitals' ? d.vitals : d.fields[field]);
      const t = (d.t && d.t[field]) || Date.now();
      try {
        const node = await encryptValue(this.key, value == null ? '' : value);
        node.t = t;
        const res = await fetch(this.base + '/d/' + encodeURIComponent(id) + '/' + encodeURIComponent(field) + '.json',
          { method: 'PUT', body: JSON.stringify(node), headers: { 'Content-Type': 'application/json' } });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        setPath(this.mirror, ['d', id, field], node);
      } catch (e) {
        this.setStatus(navigator.onLine ? 'error' : 'offline',
          navigator.onLine ? 'Envoi impossible (' + e.message + ').' : '');
      }
    }

    async pushDelete(id, when) {
      if (!this.base) return;
      const t = when || Date.now();
      try {
        await fetch(this.base + '/x/' + encodeURIComponent(id) + '.json', { method: 'PUT', body: JSON.stringify(t) });
        await fetch(this.base + '/d/' + encodeURIComponent(id) + '.json', { method: 'DELETE' });
      } catch (e) { /* sera repris a la reconnexion via la purge */ }
    }

    // Purge distante des dossiers expires et des marqueurs de suppression anciens
    async purge(maxAgeMs) {
      if (!this.base || !maxAgeMs) return;
      const now = Date.now();
      const remoteD = this.mirror.d || {};
      for (const id of Object.keys(remoteD)) {
        const ts = Object.values(remoteD[id] || {}).map(n => (n && n.t) || 0);
        const last = ts.length ? Math.max.apply(null, ts) : 0;
        if (now - last > maxAgeMs) {
          try { await fetch(this.base + '/d/' + encodeURIComponent(id) + '.json', { method: 'DELETE' }); } catch (e) {}
        }
      }
      const remoteX = this.mirror.x || {};
      for (const id of Object.keys(remoteX)) {
        if (now - remoteX[id] > 7 * 24 * 3600 * 1000) {
          try { await fetch(this.base + '/x/' + encodeURIComponent(id) + '.json', { method: 'DELETE' }); } catch (e) {}
        }
      }
    }

    // Supprime toutes les donnees de la salle
    async wipeRoom() {
      if (!this.base) return false;
      try {
        const r = await fetch(this.base + '.json', { method: 'DELETE' });
        return r.ok;
      } catch (e) { return false; }
    }
  }

  function setPath(obj, parts, value) {
    let o = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      if (o[parts[i]] == null || typeof o[parts[i]] !== 'object') o[parts[i]] = {};
      o = o[parts[i]];
    }
    const last = parts[parts.length - 1];
    if (value === null) delete o[last]; else o[last] = value;
  }

  window.LSAUSync = { SyncEngine, generateCode, formatCode, normalizeCode, isValidCode };
})();
