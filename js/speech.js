/* LeSacAMicroMed - moteurs de reconnaissance vocale
   - BrowserEngine : Web Speech API du navigateur (Chrome, Edge, Safari).
   - CloudEngine   : enregistrement local decoupe aux pauses, puis transcription par
                     une API (Mistral Voxtral ou API compatible OpenAI), cle fournie
                     par l'utilisateur.
   ©2026 LESACA Julien - Tous droits reserves. */
'use strict';

(function () {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const isAndroid = /Android/i.test(navigator.userAgent);
  const isStandalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  /* ---------------- Navigateur (Web Speech API) ---------------- */
  class BrowserEngine {
    static get available() { return !!SR && !(isIOS && isStandalone()); }
    constructor(h) { this.h = h; this.wanted = false; this.rec = null; }
    start(lang) {
      if (!SR) { this.h.onError('Reconnaissance vocale non disponible dans ce navigateur.'); return; }
      this.wanted = true;
      this.lang = lang || 'fr-FR';
      this._open();
    }
    _open() {
      const rec = new SR();
      this.rec = rec;
      rec.lang = this.lang;
      // Android : le mode continu renvoie des resultats en double -> phrases successives
      rec.continuous = !isAndroid;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      rec.onstart = () => this.h.onState('listening');
      rec.onresult = (ev) => {
        let interim = '';
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const r = ev.results[i];
          if (r.isFinal) this.h.onFinal(r[0].transcript);
          else interim += r[0].transcript;
        }
        this.h.onInterim(interim);
      };
      rec.onerror = (ev) => {
        if (ev.error === 'no-speech' || ev.error === 'aborted') return;
        if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
          this.wanted = false;
          this.h.onError('Accès au micro refusé. Autorisez le micro pour ce site' +
            (isIOS ? ' et vérifiez que Siri / Dictée est activé (Réglages iOS).' : '.'));
        } else if (ev.error === 'network') {
          this.h.onError('Reconnaissance vocale indisponible hors connexion avec ce navigateur.');
        } else if (ev.error === 'language-not-supported') {
          this.wanted = false;
          this.h.onError('Le français n\'est pas pris en charge par ce moteur.');
        } else this.h.onError('Erreur de reconnaissance : ' + ev.error);
      };
      rec.onend = () => {
        this.h.onInterim('');
        if (this.wanted && this.rec === rec) setTimeout(() => { if (this.wanted && this.rec === rec) { try { this._open(); } catch (e) { this.stop(); } } }, 200);
        else this.h.onState('idle');
      };
      try { rec.start(); } catch (e) { /* deja demarre */ }
    }
    stop() {
      this.wanted = false;
      const r = this.rec;
      this.rec = null;
      if (r) { try { r.stop(); } catch (e) {} }
      this.h.onInterim('');
      this.h.onState('idle');
    }
  }

  /* ---------------- API de transcription (Voxtral / compatible OpenAI) ---------------- */
  class CloudEngine {
    static get available() { return !!(navigator.mediaDevices && window.MediaRecorder); }
    constructor(h, cfg) { this.h = h; this.cfg = cfg; this.queue = Promise.resolve(); this.active = false; }

    async start() {
      if (!this.cfg.key) { this.h.onError('Clé d\'API manquante (Réglages > Dictée).'); return; }
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      } catch (e) {
        this.h.onError('Accès au micro refusé.'); return;
      }
      this.active = true;
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ac = new AC();
      const src = this.ac.createMediaStreamSource(this.stream);
      this.an = this.ac.createAnalyser();
      this.an.fftSize = 1024;
      src.connect(this.an);
      this.buf = new Float32Array(this.an.fftSize);
      this.noise = 0.01;
      this._newSegment();
      this.timer = setInterval(() => this._tick(), 100);
      this.h.onState('listening');
    }

    _mime() {
      const c = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
      return c.find(m => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) || '';
    }

    _newSegment() {
      const mime = this._mime();
      const rec = new MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined);
      const chunks = [];
      const seg = { rec, chunks, start: Date.now(), speech: false, lastVoice: 0 };
      rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = () => {
        if (!seg.speech || !chunks.length) return;
        const blob = new Blob(chunks, { type: rec.mimeType || mime || 'audio/webm' });
        this._enqueue(blob);
      };
      rec.start();
      this.seg = seg;
    }

    _tick() {
      if (!this.active) return;
      this.an.getFloatTimeDomainData(this.buf);
      let sum = 0;
      for (let i = 0; i < this.buf.length; i++) sum += this.buf[i] * this.buf[i];
      const rms = Math.sqrt(sum / this.buf.length);
      const thr = Math.max(0.012, this.noise * 3);
      const now = Date.now();
      const s = this.seg;
      if (rms > thr) { s.speech = true; s.lastVoice = now; this.h.onInterim('…'); }
      else this.noise = this.noise * 0.95 + rms * 0.05;
      const dur = now - s.start;
      // decoupe a chaque pause de 1,2 s (ou toutes les 25 s) pour un affichage au fil de l'eau
      if ((s.speech && now - s.lastVoice > 1200 && dur > 1500) || dur > 25000) {
        s.rec.stop();
        this._newSegment();
      }
    }

    _enqueue(blob) {
      this.h.onBusy(true);
      const p = this._transcribe(blob);
      this.queue = this.queue.then(() => p.then(t => { if (t) this.h.onFinal(t); }, e => this.h.onError(e.message)))
        .finally(() => this.h.onBusy(false));
    }

    async _transcribe(blob) {
      const c = this.cfg;
      const ext = /mp4/.test(blob.type) ? 'm4a' : /ogg/.test(blob.type) ? 'ogg' : 'webm';
      const send = async (withBias) => {
        const fd = new FormData();
        fd.append('file', blob, 'dictee.' + ext);
        fd.append('model', c.model);
        fd.append('language', 'fr');
        if (withBias && c.vocab && c.vocab.length) {
          if (c.provider === 'mistral') c.vocab.slice(0, 100).forEach(v => fd.append('context_bias', v));
          else fd.append('prompt', 'Compte rendu médical en français. Vocabulaire : ' + c.vocab.slice(0, 80).join(', ') + '.');
        }
        return fetch(c.endpoint, { method: 'POST', headers: { Authorization: 'Bearer ' + c.key }, body: fd });
      };
      let res;
      try {
        res = await send(true);
        if (res.status === 400 || res.status === 422) res = await send(false); // biais refuse -> sans biais
      } catch (e) {
        throw new Error('Transcription impossible (réseau ou adresse de l\'API).');
      }
      if (res.status === 401 || res.status === 403) throw new Error('Clé d\'API refusée.');
      if (!res.ok) throw new Error('Transcription impossible (HTTP ' + res.status + ').');
      const j = await res.json();
      return (j.text || '').trim();
    }

    stop() {
      if (!this.active) { this.h.onState('idle'); return; }
      this.active = false;
      clearInterval(this.timer);
      try { if (this.seg && this.seg.rec.state !== 'inactive') this.seg.rec.stop(); } catch (e) {}
      setTimeout(() => {
        if (this.stream) this.stream.getTracks().forEach(t => t.stop());
        if (this.ac) this.ac.close().catch(() => {});
      }, 300);
      this.h.onInterim('');
      this.h.onState('idle');
    }
  }

  window.LSAMMSpeech = { BrowserEngine, CloudEngine, isIOS, isStandalone, hasWebSpeech: !!SR };
})();
