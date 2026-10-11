/* ---------- Home Assistant, par la coque de S&A-HOME (postMessage) — partagé par toutes les pages ----------
   page → coque : { type: 'request_states' } · { type: 'history_request', id, start, end, entities, period, types }
                  · { type: 'service_call', id, domain, service, entity_id, data }                  (S&A-HOME : ha.appel)
   coque → page : { type: 'states', states, user, dark } · { type: 'history_result', id, success, data }
                  · { type: 'service_result', id, success, error }
   Une entité absente, « unavailable » ou « unknown » vaut null : rien n'est jamais inventé. */
const HA = {
  enCoque: window.parent !== window,
  connecte: false,
  sombre: null,
  etats: {},
  t: null,                                                    // valeurs d'exemple : l'heure figée de l'aperçu
  id: 1, attentes: {},
  e(id) { return id ? this.etats[id] || null : null; },
  etat(id) { const s = this.e(id); return s && s.state !== 'unavailable' && s.state !== 'unknown' ? s.state : null; },
  nb(id) { const v = parseFloat(this.etat(id)); return Number.isFinite(v) ? v : null; },
  attr(id, a) { const s = this.e(id); return s && s.attributes && s.attributes[a] != null ? s.attributes[a] : null; },
  premiere(liste) { return [].concat(liste).find(id => id && this.etats[id]) || null; },
  maintenant() { return this.t ?? Date.now(); },
  /* âge d'une donnée, en minutes (S&A-HOME : ha.age) : l'horodatage de l'état (capteur timestamp), à défaut son last_changed ;
     null si l'entité est absente ou indisponible */
  age(id) {
    const s = this.e(id);
    if (!s || this.etat(id) == null) return null;
    const t = Date.parse(s.state), t2 = Number.isFinite(t) ? t : Date.parse(s.last_changed);
    return Number.isFinite(t2) ? Math.max(0, (this.maintenant() - t2) / 60000) : null;
  },
  ecouter(recu) {
    window.addEventListener('message', ev => {
      const m = ev.data;
      if (!m || !m.type || ev.source !== window.parent) return;
      if (m.type === 'states') {
        this.etats = m.states || {};
        this.sombre = typeof m.dark === 'boolean' ? m.dark : null;
        const premier = !this.connecte;
        this.connecte = true;
        recu(premier);
      } else if ((m.type === 'history_result' || m.type === 'service_result') && this.attentes[m.id]) {
        const r = this.attentes[m.id]; delete this.attentes[m.id];
        if (m.success) r.ok(m.data); else r.ko(m.error);
      }
    });
    window.parent.postMessage({ type: 'request_states' }, '*');
  },
  historique(q) {
    if (!this.enCoque) return Promise.reject(new Error('hors de Home Assistant'));
    const id = this.id++;
    return new Promise((ok, ko) => {
      this.attentes[id] = { ok, ko };
      window.parent.postMessage({ type: 'history_request', id, ...q }, '*');
      setTimeout(() => { if (this.attentes[id]) { delete this.attentes[id]; ko(new Error('sans réponse')); } }, 20000);
    });
  },
  /* une commande, exactement comme S&A-HOME (ha.appel) : service_call, puis service_result ; sans réponse après 15 s, elle est
     tenue pour faite. Résout { ok: true } ou { ok: false, erreur } (jamais rejetée). Hors de Home Assistant : rien n'est envoyé. */
  appel(domaine, service, entite, donnees) {
    if (!this.enCoque) return Promise.resolve({ ok: true, envoye: false });
    const id = this.id++;
    return new Promise(fin => {
      this.attentes[id] = { ok: () => fin({ ok: true, envoye: true }), ko: erreur => fin({ ok: false, envoye: true, erreur }) };
      window.parent.postMessage({ type: 'service_call', id, domain: domaine, service, entity_id: entite, data: donnees || {} }, '*');
      setTimeout(() => { if (this.attentes[id]) { delete this.attentes[id]; fin({ ok: true, envoye: true }); } }, 15000);
    });
  }
};

/* ---------- Statistiques de Home Assistant (comme S&A-HOME : debutDe, parCle) ---------- */
const debutDe = p => (typeof p.start === 'number' ? p.start : Date.parse(p.start));
const parCle = (res, id, cle, champ) => {
  const o = {};
  ((res && res[id]) || []).forEach(p => { const v = Number(p[champ || 'change']), k = cle(debutDe(p)); if (Number.isFinite(v) && k != null) o[k] = (o[k] || 0) + v; });
  return o;
};
