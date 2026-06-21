/* mp_net.js — Mojiworld multiplayer client module (framework-agnostic).
 * Designed to plug into mojiworld_game.html OR the standalone mp_demo.html.
 * No DOM/canvas assumptions — it only talks to the server and exposes smoothed
 * remote-player state for whatever renderer you have.
 *
 *   LXNet.connect({ url, name })          // url e.g. ws://localhost:8787
 *   LXNet.sendState({ x, y, anim, facing, hp, level })   // call ~every frame; auto-throttled
 *   LXNet.interpolated(performance.now())  // -> [{id,name,x,y,anim,facing,hp,level}] of OTHER players
 *   LXNet.you                              // your server record after welcome
 *   LXNet.onWelcome / LXNet.onSnapshot     // optional callbacks
 */
(function (root) {
  'use strict';
  const SEND_HZ = 15;                       // outbound state rate; server ticks at 20
  const LS_TOKEN = 'lx_mp_token';

  function getToken() {
    let t = null;
    try { t = localStorage.getItem(LS_TOKEN); } catch (_) {}
    if (!t) {
      t = (root.crypto && crypto.randomUUID) ? crypto.randomUUID()
        : 'tok_' + Math.abs(Math.sin(performance.now())).toString(36).slice(2) + performance.now().toString(36);
      try { localStorage.setItem(LS_TOKEN, t); } catch (_) {}
    }
    return t;
  }

  const LXNet = {
    you: null, connected: false, latencyMs: 0,
    _ws: null, _url: null, _name: 'Player', _lastSend: 0, _retry: 0,
    _remote: new Map(),                     // id -> interpolation record (excludes self)
    _interval: 1000 / 20,
    onWelcome: null, onSnapshot: null, onStatus: null,

    connect({ url, name } = {}) {
      this._url = url || (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
      if (name) this._name = name;
      this._open();
      return this;
    },

    _open() {
      let ws;
      try { ws = new WebSocket(this._url); } catch (e) { this._scheduleReconnect(); return; }
      this._ws = ws;
      ws.onopen = () => {
        this._retry = 0; this.connected = true;
        ws.send(JSON.stringify({ t: 'hello', token: getToken(), name: this._name }));
        if (this.onStatus) this.onStatus('open');
      };
      ws.onmessage = (ev) => {
        let m; try { m = JSON.parse(ev.data); } catch { return; }
        if (m.t === 'welcome') {
          this.you = m.you; if (m.tickHz) this._interval = 1000 / m.tickHz;
          if (this.onWelcome) this.onWelcome(m.you);
        } else if (m.t === 'snap') {
          this._applySnap(m);
          if (this.onSnapshot) this.onSnapshot(m);
        }
      };
      ws.onclose = () => { this.connected = false; if (this.onStatus) this.onStatus('closed'); this._scheduleReconnect(); };
      ws.onerror = () => { try { ws.close(); } catch (_) {} };
    },

    _scheduleReconnect() {
      const delay = Math.min(8000, 500 * Math.pow(2, this._retry++));
      setTimeout(() => this._open(), delay);
    },

    _applySnap(m) {
      const now = performance.now();
      const seen = new Set();
      for (const p of m.players) {
        if (this.you && p.id === this.you.id) continue;   // never render yourself as a ghost
        seen.add(p.id);
        let r = this._remote.get(p.id);
        if (!r) r = { fromX: p.x, fromY: p.y, toX: p.x, toY: p.y, t0: now, t1: now };
        // shift target -> source, set fresh target; renderer lerps from->to over one interval
        r.fromX = this._lerpX(r, now); r.fromY = this._lerpY(r, now);
        r.toX = p.x; r.toY = p.y; r.t0 = now; r.t1 = now + this._interval;
        r.name = p.name; r.anim = p.anim; r.facing = p.facing; r.hp = p.hp; r.level = p.level; r.id = p.id;
        this._remote.set(p.id, r);
      }
      for (const id of this._remote.keys()) if (!seen.has(id)) this._remote.delete(id);
    },
    _lerpX(r, now) { const k = r.t1 > r.t0 ? Math.min(1, (now - r.t0) / (r.t1 - r.t0)) : 1; return r.fromX + (r.toX - r.fromX) * k; },
    _lerpY(r, now) { const k = r.t1 > r.t0 ? Math.min(1, (now - r.t0) / (r.t1 - r.t0)) : 1; return r.fromY + (r.toY - r.fromY) * k; },

    interpolated(now) {
      now = now || performance.now();
      const out = [];
      for (const r of this._remote.values())
        out.push({ id: r.id, name: r.name, x: this._lerpX(r, now), y: this._lerpY(r, now),
          anim: r.anim, facing: r.facing, hp: r.hp, level: r.level });
      return out;
    },

    sendState(s) {
      if (!this.connected || !this._ws || this._ws.readyState !== 1) return;
      const now = performance.now();
      if (now - this._lastSend < 1000 / SEND_HZ) return;
      this._lastSend = now;
      this._ws.send(JSON.stringify({ t: 'state', x: s.x, y: s.y, anim: s.anim || 'idle',
        facing: s.facing < 0 ? -1 : 1, hp: s.hp, level: s.level }));
    },
  };

  root.LXNet = LXNet;
})(typeof window !== 'undefined' ? window : globalThis);
