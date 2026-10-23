// Gravitos's two collapses get their own looks: Collapse Rain is blue-white falling meteors, the Singularity a devastating black hole,
// and each has its own countdown (per user: "For collapse rain could you make a unique sprite for it using ludo.ai it needs to be similar
// but differentiated from singularity", "it has to be extremely powerful looking", then "for singularity can make it look way more
// devastating and the counter should be much more well designed and distinct for singularity").
// ============================================================================
// What the player saw: since v0.30.1874 Collapse Rain only drops you to 1 HP / 1 MP while the Singularity kills, but both were built on
// one hazard and drew the same thing - the same dark violet veil, the same rings closing on him, the same gold shelter orb and the same
// "3-2-1" counter - so the two read as one attack and nothing said which rules applied.
// What changes (VISUALS ONLY - every rect, life, timer, damage rule and resolver is untouched; the two new flags are read by draw code
// and by nothing else):
//  (1) each rain box carries _rainArt, Gravitos's own Singularity carries _singArt (set where each is pushed; the Sovereign's, Aetherion's
//      and the Gate's collapses carry neither and keep the old look). Both ride the co-op hazard mirror, so a guest sees the same;
//  (2) COLLAPSE RAIN: a navy night under a violet sky; an aurora-edged tear across the top with faint light shafts falling from it;
//      comets with white-hot cores, flowing cyan-violet tails and sparkle trails in three depths (far and small, mid, now and then a
//      huge one in front), the landing ones bursting in crystal shards with a shock ring and a bloom - never on a shelter; the shelter
//      is a crystal portal on the floor under one clear beam of light with sparkles rising in it, its mark a crystal shield; each box
//      lands with a shake and three crystal bursts;
//  (3) THE SINGULARITY: the arena's oculus becomes a black hole that swells as the count runs - an accretion disc, a lensing ring turning
//      round it, a debris spiral, shockwaves pulsing out, streaks of light pulled in - and it resolves in a collapse flash. Its shelter
//      keeps the gold orb, ring and beam (the brightest, warmest thing on a darker field);
//  (4) THE COUNTERS: the Singularity's is an ornate violet-gold clock face (Roman numerals) with a gold arc draining each second, serif
//      gold digits and the title SINGULARITY over "REACH THE LIGHT"; the rain's is a slim crystal halo with a down arrow, an ice arc with a
//      sparkle at its head, clean ice-white digits, the title COLLAPSE RAIN with hairline flourishes, over "REACH THE LIGHT OR DROP TO 1 HP". Both sit on a dark
//      well so the digits read over anything; the rain's field only dims (no pattern over it). Timing (the last 3 s), the heartbeat and the caption text are unchanged.
// Art: 13 ludo.ai sprites in Sprites/fx/grav_rain_* and grav_sing_* (the assets half ships them). Asked for when Gravitos spawns; until
// one decodes, that layer falls back to the old drawing. Cost: cached sprites and baked canvases (a dozen drawImage calls a frame), one
// stroked path, no filters, no shadowBlur.
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('function _lxGovCounter(')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); if (/[^\x09\x0a\x0d\x20-\x7e]/.test(b.split(a).join(''))) die(what + ': non-ASCII in the insert'); s = s.replace(a, () => b); };
const T = 'v0.30.1876 gravitos-ohko-visuals';
const ART = ['grav_rain_meteor', 'grav_rain_rift', 'grav_rain_impact', 'grav_rain_shelter', 'grav_rain_aurora', 'grav_rain_dial', 'grav_rain_icon',
  'grav_sing_core', 'grav_sing_lens', 'grav_sing_wave', 'grav_sing_dial', 'grav_sing_debris', 'grav_sing_burst'];

// 1. the art table (LX_FX, Sprites/fx)
{ const a = "    safezone_shield:           'safezone_shield.webp',";
  const i = s.indexOf(a); if (i < 0 || s.indexOf(a, i + 1) >= 0) die('LX_FX shield row');
  const e = s.indexOf('\n', i) + 1;
  const rows = ART.map((k) => '    ' + k + ': ' + ' '.repeat(Math.max(1, 24 - k.length)) + "'" + k + ".webp',   // " + T + ' (ludo.ai)').join(EOL) + EOL;
  s = s.slice(0, e) + rows + s.slice(e); }
// 2. asked for when Gravitos spawns (his lazy-art row)
once("'safezone_ring', 'gravitos1_voidrift', 'gravitos1_riftring'], fx:",
  "'safezone_ring', 'gravitos1_voidrift', 'gravitos1_riftring', " + ART.map((k) => "'" + k + "'").join(', ') + ' /* ' + T + ' */], fx:', 'lazy-art row');
// 3. co-op: the flags ride the hazard mirror
once("_COOP_HZ_XF.push('_rainDrain');", J("_COOP_HZ_XF.push('_rainDrain');",
  "_COOP_HZ_XF.push('_rainArt', '_singArt');   // " + T + ' - a guest draws the same look'), 'coop xf');
// 4. the flags, where each collapse is pushed
once(`          _rainDrain: true, _sourceLabel: "Gravitos' Collapse Rain",`, J(
  '          _rainArt: true,   // ' + T + ' - the rain draws its own look (meteors, crystal shelter, its own counter); read by draw code only',
  `          _rainDrain: true, _sourceLabel: "Gravitos' Collapse Rain",`), 'rain flag');
once('          life: 330, maxLife: 330,         // 5.5 s @ 60 fps', J('          life: 330, maxLife: 330,         // 5.5 s @ 60 fps',
  '          _singArt: true,                  // ' + T + ' - his own Singularity draws the black hole and its own counter; read by draw code only'), 'sing flag');
// 5. the world pass: the field, the rings, the shelter art
once(J("      const veilA = 0.22 + prog * 0.46;", "      ctx.fillStyle = 'rgba(20, 4, 30, ' + veilA + ')';", '      ctx.fillRect(0, _camY, W, H);'), J(
  "      const veilA = 0.22 + prog * 0.46;",
  '      const _gov = !!(h._rainArt || h._singArt) && typeof _lxGovBack === \'function\';   // ' + T + ' - Gravitos\'s own collapses paint their own field',
  '      if (_gov) _lxGovBack(h, prog, _camX, _camY);',
  "      ctx.fillStyle = 'rgba(20, 4, 30, ' + veilA + ')';",
  '      if (!_gov) ctx.fillRect(0, _camY, W, H);'), 'veil');
once('      const rings = 3;', '      const rings = h._rainArt ? 0 : 3;   // ' + T + ' - the rain falls from the sky; it does not close on him', 'rings');
once('      if (!_szImg && _lxFxReady(LX_FX.gravitos_singularity_zone)) _szImg = LX_FX.gravitos_singularity_zone;', J(
  '      if (!_szImg && _lxFxReady(LX_FX.gravitos_singularity_zone)) _szImg = LX_FX.gravitos_singularity_zone;',
  "      if (h._rainArt && typeof _lxGovImg === 'function') { const _rz = _lxGovImg('grav_rain_shelter'); if (_rz) _szImg = _rz; }   // " + T + ' - the rain\'s crystal orb'), 'zone art');
once("        if (typeof _lxSzHalo === 'function') { _lxSzHalo(z, h, _camX); _lxSzBeam(z, _camX); }", J(
  "        if (h._rainArt && typeof _lxGovRainZone === 'function') _lxGovRainZone(z, h, _camX);   // " + T + ' - crystal ring + ice beam',
  "        else if (typeof _lxSzHalo === 'function') { _lxSzHalo(z, h, _camX); _lxSzBeam(z, _camX); }"), 'halo');
once("        const _shield = (typeof LX_FX !== 'undefined') ? LX_FX.safezone_shield : null;",
  "        const _shield = (typeof LX_FX !== 'undefined') ? ((h._rainArt && typeof _lxGovImg === 'function' && _lxGovImg('grav_rain_icon')) || LX_FX.safezone_shield) : null;   // " + T + ' - the rain\'s crystal shield', 'shield');
// 6. the counter + the helpers (screen pass)
const body = GOV_FN.toString(); const b0 = body.indexOf('{') + 1, b1 = body.lastIndexOf('}');
const block = body.slice(b0, b1).replace(/^\r?\n/, '').replace(/\r?\n\s*$/, '').split(/\r?\n/).map((l) => l.replace(/^ {2}/, '')).join(EOL) + EOL;
once(J('function _lxOhkoFinalDraw() {', '  try {', '    const h = _lxOhkoFinalLive(); if (!h) { game._ohkoFinalN = 0; return; }'),
  block + J('function _lxOhkoFinalDraw() {', '  try {', '    const h = _lxOhkoFinalLive(); if (!h) { game._ohkoFinalN = 0; return; }',
  "    if ((h._rainArt || h._singArt) && typeof _lxGovCounter === 'function' && _lxGovCounter(h)) return;   // " + T + ' - each collapse has its own counter'), 'counter');

const grew = s.length - n0;
if (grew < 28000 || grew > 42000) die('size moved ' + grew);
const marks = [...s.matchAll(/v0\.30\.(?:x|\d+) gravitos-ohko-visuals/g)].length;   // the ship chain retags x to the real version, here and in this file
if (marks !== 34) die('markers ' + marks);
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 5000000) die('tmp small');
{
  let done = false, lastErr = null;
  for (let a = 1; a <= 8 && !done; a++) {
    try { renameSync(F + '.tmp', F); done = true; }
    catch (e) { lastErr = e; if (e.code !== 'EPERM' && e.code !== 'EBUSY') throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500 * a); }
  }
  if (!done) die('rename kept failing: ' + lastErr.code);
}
console.log('applied: gravitos-ohko-visuals (+' + grew + ' chars, ' + marks + ' marks)');

function GOV_FN() {   // the helper block, inserted (body only) before _lxOhkoFinalDraw
  // v0.30.1876 gravitos-ohko-visuals - GRAVITOS'S TWO COLLAPSES, EACH WITH ITS OWN LOOK (per user: "For collapse rain could you make a unique
  // sprite for it using ludo.ai it needs to be similar but differentiated from singularity", "it has to be extremely powerful looking",
  // "for singularity can make it look way more devastating and the counter should be much more well designed and distinct for singularity").
  // h._rainArt (each Collapse Rain box) and h._singArt (his own Singularity) pick the art; the hazard, its rects, life and resolve are the
  // Singularity's own and untouched. Art: Sprites/fx/grav_rain_* and grav_sing_* (ludo.ai). Until a sprite decodes its layer is skipped and
  // the field still darkens, so a cold load is never blank. Cheap by design: cached sprites, canvases baked once, one stroked path, no
  // filters, no shadowBlur. drawHazards convention: X is NOT translated (subtract camera.x), Y is (world y, the veil at camY).
  const _LX_GOV = { bakes: Object.create(null) };
  const LX_GOV_FLOOR = 480;   // v0.30.1876 gravitos-ohko-visuals - the arena floor (the rain's own groundY)
  const LX_GOV_MET = { hx: 0.22, hy: 0.78, ang: 2.365 };   // v0.30.1876 gravitos-ohko-visuals - the meteor art: its head (fraction of w / h) and the way it flies (rad)
  const LX_GOV_SING_C = { field: 'rgba(18,2,28,', glow: 'rgba(160,80,255,', main: '#ffd27a', hi: '#fff4d6', ink: 'rgba(26,6,40,0.92)', cap: '#ffd36b', rim: [0.38, 0.6] };
  function _lxGovImg(k) { const im = (typeof LX_FX !== 'undefined' && LX_FX) ? LX_FX[k] : null; return (im && _lxFxReady(im)) ? im : null; }
  function _lxGovRnd(a) { const x = Math.sin(a * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }
  function _lxGovBake(key, w, h, paint) {
    let cv = _LX_GOV.bakes[key]; if (cv) return cv;
    cv = document.createElement('canvas'); cv.width = w; cv.height = h; paint(cv.getContext('2d'), w, h); _LX_GOV.bakes[key] = cv; return cv;
  }
  function _lxGovLowFx() { return !!(typeof LX_PERF !== 'undefined' && LX_PERF && LX_PERF.veryLowFx); }
  // v0.30.1876 gravitos-ohko-visuals - the landing: a shake and bursts that outlive the hazard. Once per hazard, on every client from its own
  // copy (origin 'hz' is never mirrored, so a guest does not get the host's as well).
  function _lxGovBoom(h, camX, camY) {
    if (h._govBoom) return; h._govBoom = 1;
    const o0 = game._fxOrigin; game._fxOrigin = 'hz';
    try {
      if (h._rainArt) {
        if (typeof addShake === 'function') addShake(10);
        const zs = h.safeZones || [], seed = (h.maxLife | 0) + Math.round(zs.length ? zs[0].x : 0);
        for (let i = 0; i < 3; i++) {
          let x = camX + W * (0.17 + 0.33 * i + 0.1 * (_lxGovRnd(seed + i) - 0.5));
          for (const z of zs) { const zc = z.x + z.w / 2, gap = z.w / 2 + 120; if (Math.abs(x - zc) < gap) x = zc + (x < zc ? -gap : gap); }
          spawnSpriteBurst(x, LX_GOV_FLOOR - 64, 'grav_rain_impact', { size: 150, life: 30, keepAspect: true });
        }
      } else {
        if (typeof addShake === 'function') addShake(16);
        spawnSpriteBurst(camX + W * _LX_GF_DISC.fx, camY + H * _LX_GF_DISC.fy, 'grav_sing_burst', { size: 560, life: 42, keepAspect: true });
      }
    } catch (e) {} finally { game._fxOrigin = o0; }
  }
  // v0.30.1876 gravitos-ohko-visuals - the rain's light, baked once (additive): a soft bloom, a four-point sparkle, a shock ring, a light
  // shaft, the sky gradient. Every glow below is one of these blitted, never a filter or a shadow.
  function _lxGovGlow() { return _lxGovBake('glow', 64, 64, (c) => { const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.22, 'rgba(200,246,255,0.8)'); g.addColorStop(0.55, 'rgba(90,190,255,0.28)'); g.addColorStop(1, 'rgba(70,120,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); }); }
  function _lxGovSpark() {
    return _lxGovBake('spark', 32, 32, (c) => {
      const g = c.createRadialGradient(16, 16, 0, 16, 16, 9); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(120,220,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 32, 32);
      c.fillStyle = 'rgba(235,252,255,0.95)'; c.beginPath(); c.moveTo(16, 1); c.lineTo(18, 14); c.lineTo(31, 16); c.lineTo(18, 18); c.lineTo(16, 31); c.lineTo(14, 18); c.lineTo(1, 16); c.lineTo(14, 14); c.closePath(); c.fill();
    });
  }
  function _lxGovRing() { return _lxGovBake('ring', 128, 128, (c) => { const g = c.createRadialGradient(64, 64, 40, 64, 64, 63); g.addColorStop(0, 'rgba(120,220,255,0)'); g.addColorStop(0.62, 'rgba(160,236,255,0.25)'); g.addColorStop(0.8, 'rgba(240,252,255,0.95)'); g.addColorStop(0.9, 'rgba(150,170,255,0.35)'); g.addColorStop(1, 'rgba(120,140,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 128, 128); }); }
  function _lxGovShaft() {
    return _lxGovBake('shaft', 32, 128, (c) => {
      const g = c.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, 'rgba(210,240,255,0.9)'); g.addColorStop(0.5, 'rgba(140,170,255,0.3)'); g.addColorStop(1, 'rgba(120,140,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 32, 128);
      c.globalCompositeOperation = 'destination-in'; const m = c.createLinearGradient(0, 0, 32, 0); m.addColorStop(0, 'rgba(0,0,0,0)'); m.addColorStop(0.5, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = m; c.fillRect(0, 0, 32, 128);
    });
  }
  function _lxGovSky() { return _lxGovBake('sky', 8, 128, (c) => { const g = c.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, 'rgba(34,18,78,1)'); g.addColorStop(0.4, 'rgba(10,18,52,1)'); g.addColorStop(1, 'rgba(4,12,32,1)'); c.fillStyle = g; c.fillRect(0, 0, 8, 128); }); }
  // one meteor at its fall fraction e (0..1): sparkles left along its path, the comet, its core bloom
  function _lxGovMeteor(met, x0, y0, x1, y1, e, sh, a, trail) {
    const ee = e * e, x = x0 + (x1 - x0) * ee, y = y0 + (y1 - y0) * ee;
    if (trail) {
      const sp = _lxGovSpark();
      for (let j = 1; j <= trail; j++) { const ej = Math.max(0, e - j * 0.07), q = ej * ej, s = sh * (0.14 - j * 0.025); if (s <= 2) break; ctx.globalAlpha = a * (0.85 - j * 0.22); ctx.drawImage(sp, x0 + (x1 - x0) * q - s / 2 + Math.sin(j * 2.3 + e * 9) * sh * 0.04, y0 + (y1 - y0) * q - s / 2, s, s); }
    }
    const sw = sh * (met.naturalWidth || 1) / (met.naturalHeight || 1);
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(y1 - y0, x1 - x0) - LX_GOV_MET.ang);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = a; ctx.drawImage(met, -sw * LX_GOV_MET.hx, -sh * LX_GOV_MET.hy, sw, sh);
    ctx.restore();
    const gs = sh * 0.42; ctx.globalAlpha = a * 0.9; ctx.drawImage(_lxGovGlow(), x - gs / 2, y - gs / 2, gs, gs);   // the white-hot core
  }
  // v0.30.1876 gravitos-ohko-visuals - THE RAIN'S FIELD: a navy night with a violet sky, an aurora rift torn across the top with light falling
  // from it in slanted shafts (faint, and they fade out well above the floor, so the only column of light that reaches the ground is a
  // shelter's), and meteors in three depths - far and small ones dying out before the floor, mid ones bursting on it, now and then a huge
  // one in the foreground. Each burst is the crystal art, a shock ring and a bloom. All of it is a pure function of the box's age (no
  // particles, no state) and nothing lands on a shelter.
  function _lxGovRainBack(h, prog, camX, camY) {
    const t = game.time | 0, age = Math.max(0, (h.maxLife | 0) - (h.life | 0)), zs = h.safeZones || [], still = !!game._reduceMotion, low = _lxGovLowFx();
    const fin = Math.min(1, age / 10), gy = LX_GOV_FLOOR, seed = (h.maxLife | 0) * 7 + Math.round(zs.length ? zs[0].x : 0);
    ctx.save();
    ctx.globalAlpha = 0.3 + 0.24 * prog; ctx.drawImage(_lxGovSky(), 0, camY, W, H);
    ctx.globalCompositeOperation = 'lighter';
    const au = _lxGovImg('grav_rain_aurora');
    if (au) { const aw = W * 1.12, ah = aw * (au.naturalHeight || 1) / (au.naturalWidth || 1) * 0.62; ctx.globalAlpha = (0.55 + (still ? 0 : 0.1 * Math.sin(t * 0.04))) * fin; ctx.drawImage(au, (W - aw) / 2, camY + 64 - ah * 0.5, aw, ah); }   // the aurora curtain behind the tear
    const rift = _lxGovImg('grav_rain_rift');
    if (rift) {
      const rw = W * 0.9, rh = rw * (rift.naturalHeight || 1) / (rift.naturalWidth || 1) * 0.55, rx = (W - rw) / 2, ry = camY + 84 - rh / 2;
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.62 * fin; ctx.drawImage(rift, rx, ry, rw, rh);   // the tear itself, not blown out
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (0.12 + (still ? 0 : 0.1 * Math.sin(t * 0.09))) * fin; ctx.drawImage(rift, rx, ry, rw, rh);   // and its breathing glow
    }
    if (!low) {
      const sh = _lxGovShaft();
      for (let i = 0; i < 3; i++) {
        const sx = W * (0.22 + 0.28 * i) + (still ? 0 : Math.sin(t * 0.02 + i * 2) * 14), sw = 90 + 40 * (i % 2);
        ctx.save(); ctx.translate(sx, camY + 80); ctx.transform(1, 0, -0.22, 1, 0, 0);
        ctx.globalAlpha = (0.12 + (still ? 0 : 0.05 * Math.sin(t * 0.05 + i * 1.7))) * fin; ctx.drawImage(sh, -sw / 2, 0, sw, (gy - camY) * 0.62);
        ctx.restore();
      }
    }
    const met = _lxGovImg('grav_rain_meteor'), imp = _lxGovImg('grav_rain_impact');
    if (met) {
      const top = camY + 70;
      // depth layers: [count, scale, alpha, fall frames, lands, trail sparkles]
      const L = low ? [[2, 0.42, 0.5, 30, 0, 0], [2, 0.85, 1, 22, 1, 0]] : [[4, 0.42, 0.5, 30, 0, 0], [3, 0.85, 1, 22, 1, 3], [1, 1.6, 1, 18, 1, 3]];
      for (let li = 0; li < L.length; li++) {
        const [n, sc, al, FALL, lands, tr] = L[li], HOLD = lands ? 14 : 0, PER = FALL + HOLD + (li === 2 ? 30 : 0);
        for (let i = 0; i < n; i++) {
          const k0 = seed + li * 101 + i * 7.1, a0 = age + Math.floor(_lxGovRnd(k0) * PER) - i * 5 - (li === 2 ? 20 : 0); if (a0 < 0) continue;
          const cyc = Math.floor(a0 / PER), q = a0 % PER, big = sc * (0.8 + 0.4 * _lxGovRnd(k0 + cyc * 3.1));
          let lx = W * (0.06 + 0.88 * _lxGovRnd(k0 + 3.3 + cyc * 17.7));
          if (lands) for (const z of zs) { const zc = z.x - camX + z.w / 2, gap = z.w / 2 + 110 * big + 20; if (Math.abs(lx - zc) < gap) lx = zc + (lx < zc ? -gap : gap); }
          const ly = lands ? gy : gy - 150 - 60 * _lxGovRnd(k0 + 9), dx = 120 * big;
          if (q < FALL) {
            const e = (q + 1) / FALL, fade = lands ? 1 : Math.min(1, (1 - e) * 4);
            _lxGovMeteor(met, lx - dx, top, lx, ly, e, 190 * big, al * fade * Math.min(1, 0.3 + e * 2), tr);
          } else if (q < FALL + HOLD) {
            const k = (q - FALL) / HOLD, iw = 190 * big * (0.75 + 0.45 * k);
            const rg = iw * (0.4 + 1.1 * k); ctx.globalAlpha = Math.pow(1 - k, 1.5) * 0.9; ctx.drawImage(_lxGovRing(), lx - rg / 2, gy - rg * 0.18, rg, rg * 0.36);   // the shock ring, flat on the floor
            const bl = iw * 0.9; ctx.globalAlpha = (1 - k) * (1 - k) * 0.85; ctx.drawImage(_lxGovGlow(), lx - bl / 2, gy - bl * 0.55, bl, bl * 0.8);   // the bloom
            if (imp) { const ih = iw * (imp.naturalHeight || 1) / (imp.naturalWidth || 1); ctx.globalAlpha = 1 - k * k; ctx.drawImage(imp, lx - iw / 2, gy - ih * 0.84, iw, ih); }
          }
        }
      }
    }
    ctx.restore();
    if ((h.life | 0) <= 3) _lxGovBoom(h, camX, camY);
  }
  // v0.30.1876 gravitos-ohko-visuals - THE RAIN'S SHELTER, drawn where the gold ring and beam were (_lxSzHalo / _lxSzBeam) and on the same
  // rules: the beam rises up the protected column clipped to the rect's width and a glow breathes inside the footprint - every lit pixel is
  // a safe pixel. One clear beam (a soft halo, a bright core, a white thread, sparkles rising); the crystal portal is drawn next by the caller.
  function _lxGovRainZone(z, h, camX) {
    try {
      const t = game.time | 0, still = !!game._reduceMotion, flare = game._ohkoFinalN > 0, age = (h.maxLife | 0) - (h.life | 0);
      const sx = z.x - camX, cx = sx + z.w / 2, top = z.y - _LX_SZ_BEACON_H, base = z.y + z.h * 0.5, span = base - top;
      const br = (0.85 + 0.15 * Math.sin(t * 0.16)) * (flare ? 1.35 : 1) * Math.min(1, 0.4 + age / 16);
      ctx.save();
      ctx.beginPath(); ctx.rect(Math.round(sx), Math.round(top), Math.round(z.w), Math.ceil(span) + 1); ctx.clip();
      ctx.globalCompositeOperation = 'lighter';
      const beam = _lxGovBake('rz_beam', 32, 128, (c) => {
        const g = c.createLinearGradient(0, 128, 0, 0); g.addColorStop(0, 'rgba(235,253,255,1)'); g.addColorStop(0.4, 'rgba(150,230,255,0.55)'); g.addColorStop(1, 'rgba(110,200,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 32, 128);
        c.globalCompositeOperation = 'destination-in'; const m = c.createLinearGradient(0, 0, 32, 0); m.addColorStop(0, 'rgba(0,0,0,0)'); m.addColorStop(0.5, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = m; c.fillRect(0, 0, 32, 128);
      });
      ctx.globalAlpha = Math.min(1, 0.7 * br); ctx.drawImage(beam, sx, top, z.w, span);                 // the soft halo, the zone's full width
      ctx.globalAlpha = Math.min(1, 1.0 * br); ctx.drawImage(beam, cx - z.w * 0.2, top, z.w * 0.4, span); ctx.drawImage(beam, cx - z.w * 0.12, top, z.w * 0.24, span);   // the bright core
      ctx.globalAlpha = Math.min(1, 0.7 * br); ctx.drawImage(beam, cx - 2, top + span * 0.08, 4, span * 0.92);   // the thread
      if (!still) {
        const sp = _lxGovSpark();
        for (let i = 0; i < 5; i++) { const qq = ((t * (0.9 + (i % 3) * 0.3) + i * 41) % span), yy = base - qq, xx = cx + Math.sin(t * 0.05 + i * 1.9) * z.w * 0.3, s = 6 + (i % 3) * 3; ctx.globalAlpha = 0.85 * Math.sin(Math.PI * qq / span); ctx.drawImage(sp, xx - s / 2, yy - s / 2, s, s); }
      }
      ctx.restore();
      ctx.save();
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, 0.55 * br);
      ctx.drawImage(_lxGovBake('rz_glow', 128, 64, (c) => { const g = c.createRadialGradient(64, 36, 2, 64, 36, 62); g.addColorStop(0, 'rgba(235,253,255,0.9)'); g.addColorStop(0.5, 'rgba(120,220,255,0.4)'); g.addColorStop(1, 'rgba(90,150,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 128, 64); }), sx, z.y, z.w, z.h);
      ctx.restore();
    } catch (e) {}
  }
  // v0.30.1876 gravitos-ohko-visuals - THE SINGULARITY'S FIELD: deeper violet, and the arena's oculus (_LX_GF_DISC) becomes a black hole that
  // swells as the count runs - a debris spiral turning round it, shockwaves pulsing out, streaks of light falling in, the accretion disc,
  // and a lensing ring turning the other way. Drawn high over the arena, so the boss and the shelters stay in plain view.
  function _lxGovSingBack(h, prog, camX, camY) {
    const t = game.time | 0, age = Math.max(0, (h.maxLife | 0) - (h.life | 0)), still = !!game._reduceMotion, low = _lxGovLowFx();
    ctx.fillStyle = 'rgba(14,2,26,' + (0.26 + prog * 0.48).toFixed(3) + ')';
    ctx.fillRect(0, camY, W, H);
    const cx = W * _LX_GF_DISC.fx, cy = camY + H * _LX_GF_DISC.fy, grow = Math.min(1, age / 36);
    const R = (95 + 105 * prog) * (0.45 + 0.55 * grow), spin = still ? 0 : t * 0.018;
    const core = _lxGovImg('grav_sing_core'), lens = _lxGovImg('grav_sing_lens'), wave = _lxGovImg('grav_sing_wave'), deb = _lxGovImg('grav_sing_debris');
    ctx.save();
    if (deb && !low) { const d = R * 4.4; ctx.save(); ctx.translate(cx, cy); ctx.rotate(spin * 2.4); ctx.globalAlpha = 0.65 * grow; ctx.drawImage(deb, -d / 2, -d / 2, d, d); ctx.restore(); }
    if (wave && !still) { ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 2; i++) { const p = ((t + i * 30) % 60) / 60, d = R * (2.2 + 4.2 * p); ctx.globalAlpha = 0.6 * (1 - p) * grow; ctx.drawImage(wave, cx - d / 2, cy - d / 2, d, d); } ctx.globalCompositeOperation = 'source-over'; }
    if (!still && !low) {
      ctx.beginPath();
      for (let i = 0; i < 14; i++) { const ph = (t * 0.012 + i * 0.137) % 1, rr = R * (1.2 + 3.6 * (1 - ph)), a = i * 2.39996 + ph * 1.6, r2 = rr * 0.8, a2 = a + 0.24; ctx.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.6); ctx.lineTo(cx + Math.cos(a2) * r2, cy + Math.sin(a2) * r2 * 0.6); }
      ctx.strokeStyle = 'rgba(255,214,140,' + (0.55 * grow).toFixed(3) + ')'; ctx.lineWidth = 2; ctx.stroke();
    }
    if (core) { const dw = R * 3.4 * (1 + 0.03 * Math.sin(t * 0.2)), dh = dw * (core.naturalHeight || 1) / (core.naturalWidth || 1); ctx.globalAlpha = Math.min(1, 0.3 + grow); ctx.drawImage(core, cx - dw / 2, cy - dh / 2, dw, dh); }
    if (lens) { const d = R * 2.6; ctx.save(); ctx.translate(cx, cy); ctx.rotate(-spin * 1.6); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (0.5 + 0.25 * Math.sin(t * 0.17)) * grow; ctx.drawImage(lens, -d / 2, -d / 2, d, d); ctx.restore(); }
    ctx.restore();
    if ((h.life | 0) <= 3) _lxGovBoom(h, camX, camY);
  }
  function _lxGovBack(h, prog, camX, camY) {
    try { if (h._rainArt) _lxGovRainBack(h, prog, camX, camY); else _lxGovSingBack(h, prog, camX, camY); } catch (e) {}
  }
  // v0.30.1876 gravitos-ohko-visuals - the counters' parts, each baked once: the digits (the Singularity's in gold serif with a violet aura, the
  // rain's in clean ice-white type with a cyan edge and a violet halo) and the titles with their flourishes.
  function _lxGovDigit(n, rain) {
    return _lxGovBake('d' + n + (rain ? 'r' : 's'), 320, 320, (c) => {
      const tx = String(n); c.translate(160, 170); c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
      if (rain) {
        c.font = '800 236px Inter, "Segoe UI", Arial, sans-serif';
        c.globalAlpha = 0.3; c.lineWidth = 26; c.strokeStyle = '#8f7bff'; c.strokeText(tx, 0, 0);
        c.globalAlpha = 0.55; c.lineWidth = 13; c.strokeStyle = '#58d8ff'; c.strokeText(tx, 0, 0); c.globalAlpha = 1;
        c.lineWidth = 6; c.strokeStyle = 'rgba(6,14,40,0.95)'; c.strokeText(tx, 0, 0);
        const g = c.createLinearGradient(0, -110, 0, 110); g.addColorStop(0, '#ffffff'); g.addColorStop(0.55, '#e2f8ff'); g.addColorStop(1, '#93dcff');
        c.fillStyle = g; c.fillText(tx, 0, 0);
        return;
      }
      c.font = 'bold 250px Georgia, "Times New Roman", serif';
      c.globalAlpha = 0.55; c.lineWidth = 30; c.strokeStyle = '#8a4dff'; c.strokeText(tx, 0, 0); c.globalAlpha = 1;
      c.lineWidth = 16; c.strokeStyle = '#ffcf6a'; c.strokeText(tx, 0, 0);
      c.lineWidth = 8; c.strokeStyle = 'rgba(26,6,40,0.95)'; c.strokeText(tx, 0, 0);
      const g = c.createLinearGradient(0, -110, 0, 110); g.addColorStop(0, '#fffaf0'); g.addColorStop(0.5, '#ffe3a0'); g.addColorStop(1, '#ffab3d');
      c.fillStyle = g; c.fillText(tx, 0, 0);
    });
  }
  function _lxGovTitle(rain) {
    return _lxGovBake('t' + (rain ? 'r' : 's'), 840, 100, (c) => {
      const tx = rain ? 'COLLAPSE RAIN' : 'SINGULARITY';
      c.translate(420, 52); c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
      c.font = rain ? '800 46px Inter, "Segoe UI", Arial, sans-serif' : 'bold 60px Georgia, "Times New Roman", serif';
      if ('letterSpacing' in c) c.letterSpacing = rain ? '14px' : '16px';
      const hw = Math.min(330, c.measureText(tx).width / 2);
      if (rain) {   // ice-white, a navy edge; a hairline each side ending in a sparkle
        c.lineWidth = 8; c.strokeStyle = 'rgba(6,14,40,0.95)'; c.strokeText(tx, 0, 0);
        const g = c.createLinearGradient(0, -24, 0, 24); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#a8ecff'); c.fillStyle = g; c.fillText(tx, 0, 0);
        for (const sd of [-1, 1]) {
          const x0 = sd * (hw + 8), x1 = sd * (hw + 86), lg = c.createLinearGradient(x0, 0, x1, 0); lg.addColorStop(0, 'rgba(168,236,255,0.9)'); lg.addColorStop(1, 'rgba(143,123,255,0.2)');
          c.fillStyle = lg; c.fillRect(Math.min(x0, x1), -1.5, Math.abs(x1 - x0), 3);
          const x = sd * (hw + 96); c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(x, -10); c.lineTo(x + 3, -3); c.lineTo(x + 10, 0); c.lineTo(x + 3, 3); c.lineTo(x, 10); c.lineTo(x - 3, 3); c.lineTo(x - 10, 0); c.lineTo(x - 3, -3); c.closePath(); c.fill();
        }
        return;
      }
      c.lineWidth = 12; c.strokeStyle = 'rgba(26,6,40,0.95)'; c.strokeText(tx, 0, 0);
      c.lineWidth = 5; c.strokeStyle = '#8a4dff'; c.strokeText(tx, 0, 0);
      const g = c.createLinearGradient(0, -30, 0, 30); g.addColorStop(0, '#fff6d8'); g.addColorStop(1, '#ffb94a'); c.fillStyle = g; c.fillText(tx, 0, 0);
      for (const sd of [-1, 1]) {   // a gold rule ending in a violet diamond
        c.fillStyle = 'rgba(26,6,40,0.95)'; c.fillRect(sd > 0 ? hw + 14 : -hw - 106, -3, 92, 6); c.fillStyle = '#ffcf6a'; c.fillRect(sd > 0 ? hw + 16 : -hw - 104, -1.5, 88, 3);
        const x = sd * (hw + 112); c.fillStyle = '#ffcf6a'; c.beginPath(); c.moveTo(x, -11); c.lineTo(x + 9, 0); c.lineTo(x, 11); c.lineTo(x - 9, 0); c.closePath(); c.fill();
        c.fillStyle = '#9a5cff'; c.beginPath(); c.moveTo(x, -6); c.lineTo(x + 5, 0); c.lineTo(x, 6); c.lineTo(x - 5, 0); c.closePath(); c.fill();
      }
    });
  }
  // v0.30.1876 gravitos-ohko-visuals - THE RAIN'S COUNTER: quieter and cleaner than the Singularity's clock. The field outside the shelters
  // dims (no pattern over it), a slim crystal halo holds the digit, an ice arc with a sparkle at its head drains each second, a thin ice
  // ring pulses out on each tick, COLLAPSE RAIN and the instruction sit under it. Its landing is a short cold flash (the box lives 1.4 s).
  function _lxGovRainCounter(h, L, n, k, u, kick, fm, camX, camY) {
    const t = game.time | 0;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, H);
    for (const z of (h.safeZones || [])) { const zx = z.x - camX + z.w / 2, zy = z.y - camY + z.h / 2; ctx.moveTo(zx + z.w / 2, zy); ctx.ellipse(zx, zy, z.w / 2, z.h / 2, 0, 0, Math.PI * 2); ctx.rect(z.x - camX, z.y - camY - _LX_SZ_BEACON_H, z.w, _LX_SZ_BEACON_H); }   // the shelter and its beam stay undimmed
    ctx.clip('evenodd');
    ctx.fillStyle = 'rgba(6,10,30,' + (0.14 + 0.14 * u + 0.06 * kick * fm).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, 0.4 + 0.2 * u + 0.3 * kick * fm);
    ctx.drawImage(_lxGovBake('rimr', 300, 300, (c) => { const g = c.createRadialGradient(150, 150, 80, 150, 150, 150); g.addColorStop(0, 'rgba(110,170,255,0)'); g.addColorStop(0.7, 'rgba(110,170,255,0)'); g.addColorStop(0.9, 'rgba(120,150,255,0.13)'); g.addColorStop(1, 'rgba(140,130,255,0.24)'); c.fillStyle = g; c.fillRect(0, 0, 300, 300); }), 0, 0, W, H);
    ctx.restore();
    const cx = W / 2, cy = Math.round(H * 0.33), R = Math.min(W, H) * 0.2, fd = R * 2.2;
    ctx.save();
    { const wd = fd * 1.08; ctx.globalAlpha = 0.72; ctx.drawImage(_lxGovBake('well', 128, 128, (c) => { const g = c.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(4,2,12,0.88)'); g.addColorStop(0.62, 'rgba(4,2,12,0.6)'); g.addColorStop(1, 'rgba(4,2,12,0)'); c.fillStyle = g; c.fillRect(0, 0, 128, 128); }), cx - wd / 2, cy - wd / 2, wd, wd); }
    ctx.globalCompositeOperation = 'lighter';
    if (k < 0.5) { const e = k / 0.5, rr = fd * 0.48 + e * Math.max(W, H) * 0.6; ctx.globalAlpha = (1 - e) * 0.5 * Math.max(0.35, fm); ctx.strokeStyle = '#cfefff'; ctx.lineWidth = 2 + 5 * (1 - e); ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke(); }
    const fr = _lxGovImg('grav_rain_dial');
    if (fr) {
      ctx.globalCompositeOperation = 'source-over';
      const d = fd * (1 + 0.04 * kick); ctx.globalAlpha = 0.95; ctx.drawImage(fr, cx - d / 2, cy - d / 2, d, d);
      if (kick > 0.05) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.45 * kick * fm; ctx.drawImage(fr, cx - d / 2, cy - d / 2, d, d); }
    }
    { const Ra = fd * 0.36, a0 = -Math.PI / 2, a1 = a0 + Math.PI * 2 * (1 - k);
      ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      ctx.globalAlpha = 0.22; ctx.strokeStyle = '#9fdcff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, Ra, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 0.3; ctx.strokeStyle = '#6fc8ff'; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(cx, cy, Ra, a0, a1); ctx.stroke();
      ctx.globalAlpha = 0.95; ctx.strokeStyle = n <= 1 ? '#ffffff' : '#e8fbff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, Ra, a0, a1); ctx.stroke();
      const hx = cx + Math.cos(a1) * Ra, hy = cy + Math.sin(a1) * Ra; ctx.globalAlpha = 0.9; ctx.drawImage(_lxGovGlow(), hx - 14, hy - 14, 28, 28); ctx.drawImage(_lxGovSpark(), hx - 10, hy - 10, 20, 20); }
    ctx.globalCompositeOperation = 'source-over';
    const sc = (1 + 0.28 * Math.exp(-k * 9) + 0.04 * k) * (Math.min(W, H) * 0.3);
    ctx.globalAlpha = Math.min(1, 0.85 + 0.15 * kick);
    ctx.drawImage(_lxGovDigit(n, true), Math.round(cx - sc / 2), Math.round(cy - sc / 2), Math.round(sc), Math.round(sc));
    const ti = _lxGovTitle(true), tw = Math.min(W * 0.86, ti.width * 0.42), th = tw * ti.height / ti.width, ty = Math.round(cy + fd / 2 + 4);
    ctx.globalAlpha = 0.95; ctx.drawImage(ti, Math.round(cx - tw / 2), ty, Math.round(tw), Math.round(th));
    ctx.font = '800 15px Inter, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '5px';
    const ly = Math.round(Math.min(H - 14, ty + th + 8)), lbl = h._rainDrain ? 'REACH THE LIGHT OR DROP TO 1 HP' : 'REACH THE LIGHT';
    ctx.globalAlpha = 0.85 + 0.15 * Math.sin(L * 0.21);
    ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(6,14,40,0.92)'; ctx.strokeText(lbl, cx, ly);
    ctx.fillStyle = '#e6f9ff'; ctx.fillText(lbl, cx, ly);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.restore();
    if (L <= 14) {
      const q = L / 14;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = (1 - q) * 0.26 * Math.max(0.35, fm);
      ctx.drawImage(_lxGovBake('fall', 8, 128, (c) => { const g = c.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, 'rgba(220,248,255,1)'); g.addColorStop(1, 'rgba(140,170,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 8, 128); }), 0, 0, W, H * (1 - q * 0.7));
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.18 * (1 - q) * (1 - q) * fm; ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    return true;
  }
  // v0.30.1876 gravitos-ohko-visuals - THE COUNTERS. Same clock as _lxOhkoFinalDraw (the last 3 s, from h.life; the heartbeat ticks are
  // untouched) and the same caption text; everything else is each collapse's own. The Singularity's: the field outside the shelters darkens,
  // a dark well sits behind the dial so the digits read over the black hole, the clock face turns slowly, a gold arc with a bright head
  // drains each second, the digit punches in on each second, the title and the instruction sit under the dial, and in the last half-second
  // rings close on the hole as it flares. The rain's is _lxGovRainCounter.
  function _lxGovCounter(h) {
    const rain = !!h._rainArt, C = LX_GOV_SING_C;
    const L = Math.max(1, h.life | 0), n = Math.max(1, Math.ceil(L / 60)), t = game.time | 0, still = !!game._reduceMotion;
    const top = Math.min(n * 60, (h.maxLife | 0) || n * 60);
    const k = Math.min(1, Math.max(0, (top - L) / 60)), u = Math.min(1, Math.max(0, 1 - L / 180)), kick = Math.exp(-k * 7);
    const fm = Math.min(1, ((game._flashMul != null) ? game._flashMul : 1) * (still ? 0.4 : 1));
    const camX = (game.camera && game.camera.x) || 0, camY = (game.camera && game.camera.y) || 0;
    game._ohkoFinalN = n;
    if (rain) return _lxGovRainCounter(h, L, n, k, u, kick, fm, camX, camY);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, H);
    for (const z of (h.safeZones || [])) { const zx = z.x - camX + z.w / 2, zy = z.y - camY + z.h / 2; ctx.moveTo(zx + z.w / 2, zy); ctx.ellipse(zx, zy, z.w / 2, z.h / 2, 0, 0, Math.PI * 2); }
    ctx.clip('evenodd');
    ctx.fillStyle = C.field + (0.16 + 0.16 * u + 0.08 * kick * fm).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, 0.45 + 0.25 * u + 0.35 * kick * fm);
    ctx.drawImage(_lxGovBake('rims', 300, 300, (c) => { const g = c.createRadialGradient(150, 150, 70, 150, 150, 150); g.addColorStop(0, C.glow + '0)'); g.addColorStop(0.62, C.glow + '0)'); g.addColorStop(0.88, C.glow + C.rim[0] + ')'); g.addColorStop(1, C.glow + C.rim[1] + ')'); c.fillStyle = g; c.fillRect(0, 0, 300, 300); }), 0, 0, W, H);
    ctx.restore();
    const cx = W / 2, cy = Math.round(H * 0.33), R = Math.min(W, H) * 0.2, fd = R * 2.5;
    ctx.save();
    { const wd = fd * 1.05; ctx.globalAlpha = 0.8; ctx.drawImage(_lxGovBake('well', 128, 128, (c) => { const g = c.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(4,2,12,0.88)'); g.addColorStop(0.62, 'rgba(4,2,12,0.6)'); g.addColorStop(1, 'rgba(4,2,12,0)'); c.fillStyle = g; c.fillRect(0, 0, 128, 128); }), cx - wd / 2, cy - wd / 2, wd, wd); }
    if (k < 0.5) { const e = k / 0.5, rr = fd * 0.5 + e * Math.max(W, H) * 0.7; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (1 - e) * 0.6 * Math.max(0.35, fm); ctx.strokeStyle = C.main; ctx.lineWidth = 3 + 12 * (1 - e); ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke(); ctx.globalCompositeOperation = 'source-over'; }
    const fr = _lxGovImg('grav_sing_dial');
    if (fr) {
      const d = fd * (1 + 0.05 * kick); ctx.save(); ctx.translate(cx, cy); if (!still) ctx.rotate(t * 0.003);
      ctx.globalAlpha = 0.96; ctx.drawImage(fr, -d / 2, -d / 2, d, d);
      if (kick > 0.05) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5 * kick * fm; ctx.drawImage(fr, -d / 2, -d / 2, d, d); }
      ctx.restore();
    }
    { const Ra = fd * 0.255, a0 = -Math.PI / 2, a1 = a0 + Math.PI * 2 * (1 - k);
      ctx.lineCap = 'round'; ctx.globalAlpha = 0.28; ctx.strokeStyle = C.main; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, cy, Ra, 0, Math.PI * 2); ctx.stroke();
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.95; ctx.strokeStyle = n <= 1 ? '#ffffff' : C.main; ctx.beginPath(); ctx.arc(cx, cy, Ra, a0, a1); ctx.stroke();
      ctx.fillStyle = C.hi; ctx.beginPath(); ctx.arc(cx + Math.cos(a1) * Ra, cy + Math.sin(a1) * Ra, 6, 0, Math.PI * 2); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
    const sc = (1 + 0.32 * Math.exp(-k * 9) + 0.04 * k) * (Math.min(W, H) * 0.27);
    ctx.globalAlpha = Math.min(1, 0.8 + 0.2 * kick);
    ctx.drawImage(_lxGovDigit(n, false), Math.round(cx - sc / 2), Math.round(cy - sc / 2), Math.round(sc), Math.round(sc));
    const ti = _lxGovTitle(false), tw = Math.min(W * 0.86, ti.width * 0.42), th = tw * ti.height / ti.width, ty = Math.round(cy + fd / 2 + 2);   // the title under the dial (the boss bar owns the top)
    ctx.globalAlpha = 0.92 + 0.08 * kick; ctx.drawImage(ti, Math.round(cx - tw / 2), ty, Math.round(tw), Math.round(th));
    ctx.font = '800 15px Inter, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '5px';
    const ly = Math.round(Math.min(H - 14, ty + th + 10)), lbl = h._rainDrain ? 'REACH THE LIGHT OR DROP TO 1 HP' : 'REACH THE LIGHT';
    ctx.globalAlpha = 0.8 + 0.2 * Math.sin(L * 0.21);
    ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.strokeStyle = C.ink; ctx.strokeText(lbl, cx, ly);
    ctx.fillStyle = C.cap; ctx.fillText(lbl, cx, ly);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.restore();
    if (L <= 30) {
      const q = L / 30;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const ox = W * _LX_GF_DISC.fx, oy = H * _LX_GF_DISC.fy, diag = Math.hypot(W, H), bu = _lxGovImg('grav_sing_burst');
      for (let i = 0; i < 3; i++) { const r = Math.max(4, q * diag * (0.9 - i * 0.22)); ctx.globalAlpha = (1 - q) * (0.75 - i * 0.18) * Math.max(0.35, fm); ctx.strokeStyle = i === 0 ? '#ffffff' : (i === 1 ? '#ffd27a' : '#b07cff'); ctx.lineWidth = 3 + 10 * (1 - q); ctx.beginPath(); ctx.arc(ox, oy, r, 0, Math.PI * 2); ctx.stroke(); }
      if (bu) { const dw = Math.min(W, H) * (0.3 + 1.1 * (1 - q)), dh = dw * (bu.naturalHeight || 1) / (bu.naturalWidth || 1); ctx.globalAlpha = (1 - q) * 0.9 * Math.max(0.4, fm); ctx.drawImage(bu, ox - dw / 2, oy - dh / 2, dw, dh); }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.42 * (1 - q) * (1 - q) * fm; ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    return true;
  }
}
