// Gravitos: a safe zone the player can always find, in every form.
// ============================================================================
// Per user (with a video of a form-3 death): "work on gravitos safe zones, as you can see for form 3 there are
// no safe zones, ensure that there are safe zones in all forms to avoid OHKO".
//
// WHAT THE VIDEO SHOWS. Form 3, boss at 49%: "COLLAPSE RAIN INCOMING", the rain starts, and the player is
// COLLAPSED by the second box ~3.5 s later without a rift ever appearing on screen. Forced in the harness
// (scripts/_grav_rain_probe.mjs), the form-3 rain DOES spawn its box 106 px from the player, on screen, and it
// draws (gold rift + shield). So the zones exist in every form; the player could not see this one. Four
// reasons a zone can be invisible or unreachable, all fixed here:
//
//  1. A BOX UNDER THE HUD. Probed with elementFromPoint at 1630x944: the minimap panel covers screen x 736-944
//     of 960 along the floor, the hotkey hint 821-944 along the top of the floor band. The rain rolled its box
//     anywhere across the visible floor (v0.30.784), so one box in five landed behind the minimap - drawn, and
//     hidden. A box is now rolled only where the floor is actually visible: the HUD-covered spans of the band
//     are measured at spawn (elementFromPoint along the band, once per box) and cut out of the window.
//
//  2. FORM 3 RAN THE RAIN AT 2.1x. The 4 s gap between boxes was measured in patternTimer, which forms 2/3
//     scale (1.56x / 2.12x, measured), so form 3's boxes came 1.9 s apart while each lived 1.4 s of REAL time:
//     no beat to read the next one. The gap is real time now, 4 s in every form, as v0.26.308 intended.
//
//  3. NOTHING POINTED AT THE BOX. A 102x60 rift on a 960 px floor, under the collapse veil, behind the boss's
//     lasers and bursts, with a 1.4 s life. Every live safe zone now carries a BEACON drawn in a late pass
//     after the art post-FX, so nothing in the scene can wash it out: a pillar of light rising from the rect
//     (exactly the column the zone protects - LX_SZ_JUMP_SLACK), a ring that expands from the rect on spawn,
//     a timer ring that shrinks as the resolve nears, and a chevron at the screen edge pointing at any zone
//     that is off screen. The ground marker itself is unchanged and still paints nothing past the rect.
//
//  4. NO ART, NO ZONE. If the rift art had not decoded, the fallback was a pale wash at 0.30 alpha under a
//     0.22-0.68 veil - the zone effectively vanished. The rift and shield art now warm with the rest of the
//     boss's art at spawn, and the fallback is a bright gold rim + fill that reads on its own.
//
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (/v0\.30\.(x|\d+) sz-all/.test(s)) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const sub = (label, anchor, after, expect) => {
  const c = s.split(anchor).length - 1;
  if (c !== (expect || 1)) { console.error(`ABORT ${label}: anchor matched ${c}, expected ${expect || 1}`); process.exit(1); }
  s = s.split(anchor).join(after);
};

// ---- 1. the rain's clock is real time -------------------------------------------------------------
sub('rain tick',
  '      if (m._rainIdx < RAIN_COUNT && m.patternTimer >= m._rainIdx * TICK_MS) {',
  J('      // v0.30.796 sz-all — REAL TIME between boxes. patternTimer runs 1.30x / 1.56x / 2.12x by form (measured,',
    '      // see the singularity note above), so form 3 dropped its boxes 1.9 s apart while each lived 1.4 s of',
    '      // real time - the next box was already down before the last had resolved. The 4 s gap v0.26.308',
    '      // authored is now 4 s on the wall clock in every form.',
    "      const _rainNow = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();",
    '      if (m._rainNextAt == null) m._rainNextAt = _rainNow;',
    '      if (m._rainIdx < RAIN_COUNT && _rainNow >= m._rainNextAt) {',
    '        m._rainNextAt = _rainNow + TICK_MS;'));
sub('rain end',
  '      if (m.patternTimer > RAIN_COUNT * TICK_MS + 1400) {',
  J('      // v0.30.796 sz-all — and the pattern ends when the last box has resolved, not on the scaled timer.',
    "      const _rainDone = m._rainIdx >= RAIN_COUNT && !game.hazards.some((h) => h && h.type === 'gravitos_singularity' && h.life > 0);",
    '      if (_rainDone || m.patternTimer > 60000) {',
    '        m._rainNextAt = null;'));
sub('rain reset',
  "            m._rainIdx = 0;" + EOL + "            m._rainSafe = null;",
  "            m._rainIdx = 0;" + EOL + "            m._rainSafe = null;" + EOL + "            m._rainNextAt = null;   // v0.30.796 sz-all — the real-time clock starts with the pattern");

// ---- 2. the box is rolled only where the floor is visible -----------------------------------------
sub('rain window',
  "        let _lo = Math.max(40 + safeW / 2, _camL + 16 + safeW / 2, _pcx - _reach);" + EOL +
  "        let _hi = Math.min(ww - 40 - safeW / 2, _camL + W - 16 - safeW / 2, _pcx + _reach);" + EOL +
  "        if (_hi < _lo) { _lo = _hi = Math.max(40 + safeW / 2, Math.min(ww - 40 - safeW / 2, _pcx)); }",
  J("        let _lo = Math.max(40 + safeW / 2, _camL + 16 + safeW / 2, _pcx - _reach);",
    "        let _hi = Math.min(ww - 40 - safeW / 2, _camL + W - 16 - safeW / 2, _pcx + _reach);",
    "        // v0.30.796 sz-all — NOT UNDER THE HUD. Measured at 1630x944: the minimap panel sits over screen x 736-944 of",
    "        // the floor and the hotkey hint over 821-944 of the floor band's top, so a box rolled in the right fifth of",
    "        // the screen was drawn behind a panel - the invisible shelter in the report. The band's covered spans are",
    "        // read off the live DOM once per box and the roll is kept clear of them.",
    "        { const _cov = _lxSzHudCoveredSpans(groundY - safeH, groundY); for (const _sp of _cov) { const _a = _camL + _sp[0] - safeW / 2, _b = _camL + _sp[1] + safeW / 2; if (_b <= _lo || _a >= _hi) continue; if (_pcx < (_a + _b) / 2) _hi = Math.min(_hi, _a); else _lo = Math.max(_lo, _b); } }",
    "        if (_hi < _lo) {   // v0.30.796 sz-all — no visible floor within reach: the nearest visible spot if it is near enough, else the player's own feet (the panels over them fade while the box lives)",
    "          const _cands = [_hi, _lo].filter((v) => v >= 40 + safeW / 2 && v <= ww - 40 - safeW / 2 && v >= _camL + 16 + safeW / 2 && v <= _camL + W - 16 - safeW / 2).sort((p, q) => Math.abs(p - _pcx) - Math.abs(q - _pcx));",
    "          if (_cands.length && Math.abs(_cands[0] - _pcx) <= _reach * 1.15) _lo = _hi = _cands[0];",
    "          else _lo = _hi = Math.max(40 + safeW / 2, Math.min(ww - 40 - safeW / 2, _pcx));",
    "        }"));

// ---- 3. beacons, in a late pass ---------------------------------------------------------------------
sub('late pass',
  '  drawArtPostFX();',
  J('  drawArtPostFX();',
    "  if (typeof _lxSafeZoneBeacons === 'function') _lxSafeZoneBeacons();   // v0.30.796 sz-all — the OHKO's answer is the last thing painted in the world"));
sub('helpers',
  'function _lxSafeZoneOffPad(rect, ww) {',
  J('// v0.30.796 sz-all — which screen-x spans of a floor band (world y0..y1) are covered by HUD panels. Read off the',
    '// DOM with elementsFromPoint (the whole stack, so a transparent full-screen layer - a veil, the touch deck -',
    '// hides nothing) at two heights of the band, in 16 px steps, and cached for 3 s: the HUD does not move',
    '// between the boxes of one rain. Returns [[x0, x1], ...] in screen px. A visible element that is not the',
    '// game canvas, not one of its ancestors and not full-screen sized counts as cover; the cache also keeps',
    '// the covering elements themselves, for _lxSzHudYield.',
    'let _lxSzHudCache = null;',
    'function _lxSzHudCoveredSpans(y0, y1) {',
    '  const now = Date.now();',
    '  if (_lxSzHudCache && now - _lxSzHudCache.at < 3000 && _lxSzHudCache.y0 === y0 && _lxSzHudCache.y1 === y1 && _lxSzHudCache.W === W && _lxSzHudCache.H === H) return _lxSzHudCache.spans;',
    '  const out = [], els = [];',
    '  try {',
    "    const cv = document.getElementById('game'); const efp = document.elementsFromPoint ? 'elementsFromPoint' : (document.elementFromPoint ? 'elementFromPoint' : null);",
    '    if (!cv || !efp) return out;',
    '    const R = cv.getBoundingClientRect(); if (!(R.width > 0 && R.height > 0)) return out;',
    '    const k = R.width / W, camY = (game.camera && game.camera.y) || 0;',
    '    const ys = [R.top + (y0 + 6 - camY) * k, R.top + ((y0 + y1) / 2 - camY) * k, R.top + (y1 - 4 - camY) * k];',   // top, middle and foot of the band: the hotkey hint sits over the top of the floor band, the minimap over its foot
    '    const seen = new Map();   // element -> covers? (style reads once per element)',
    '    const covers = (el) => {',
    '      if (!el || el === cv || cv.contains(el) || el.contains(cv)) return false;',
    '      if (seen.has(el)) return seen.get(el);',
    '      let c = false;',
    '      const r = el.getBoundingClientRect();',
    '      if (r.width > 0 && r.height > 0 && !(r.width > R.width * 0.9 && r.height > R.height * 0.9)) {',
    "        const cs = getComputedStyle(el); c = cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.05;",
    '      }',
    '      seen.set(el, c); if (c) els.push(el); return c;',
    '    };',
    '    let cur = null;',
    '    for (let x = 8; x < W; x += 16) {',
    '      let covered = false;',
    '      for (const y of ys) {',
    '        const st = document[efp](R.left + x * k, y); const arr = Array.isArray(st) ? st : [st];',
    '        for (const el of arr) if (covers(el)) covered = true;   // every covering element in the stack, so the whole panel yields, not just its label',
    '      }',
    '      if (covered) { if (cur && x - cur[1] <= 16) cur[1] = x; else { cur = [x, x]; out.push(cur); } }',
    '    }',
    '    for (const sp of out) { sp[0] = Math.max(0, sp[0] - 8); sp[1] = Math.min(W, sp[1] + 8); }',
    '  } catch (e) {}',
    '  _lxSzHudCache = { at: now, y0, y1, W, H, spans: out, els };',
    '  return out;',
    '}',
    '// v0.30.796 sz-all — THE HUD YIELDS. While a safe zone is alive, every panel over its band fades to 0.12 so a',
    '// box that had to land under one (the player standing there, no visible floor in reach) still shows; the',
    '// inline styles are restored the frame after the last zone resolves.',
    'let _lxSzYielded = null;',
    'function _lxSzHudYield(z) {',
    '  try {',
    '    if (z) {',
    '      if (_lxSzYielded) return;',
    '      _lxSzHudCoveredSpans(z.y, z.y + z.h);',
    '      const els = (_lxSzHudCache && _lxSzHudCache.els) || [];',
    "      _lxSzYielded = els.map((el) => { const o = el.style.opacity, t = el.style.transition; el.style.transition = 'opacity .15s'; el.style.opacity = '0.12'; return [el, o, t]; });",
    '    } else if (_lxSzYielded) {',
    '      for (const r of _lxSzYielded) { r[0].style.opacity = r[1]; r[0].style.transition = r[2]; }',
    '      _lxSzYielded = null;',
    '    }',
    '  } catch (e) {}',
    '}',
    '// v0.30.796 sz-all — THE BEACON. Drawn in screen space after the art post-FX, for every live safe zone: a',
    "// pillar of light over the rect (exactly the column LX_SZ_JUMP_SLACK protects, so every lit pixel is a",
    "// safe pixel), a ring expanding from the rect on spawn, a timer ring closing on the rect as the resolve",
    "// nears, and a chevron at the screen edge for a zone that is off screen. The ground marker is untouched.",
    'const _LX_SZ_BEACON_H = 150;   // = LX_SZ_JUMP_SLACK: the protected column',
    'function _lxSafeZoneBeacons() {',
    '  try {',
    "    if (typeof game === 'undefined' || !game || !game.hazards) return;",
    "    let _live = null; for (const h of game.hazards) if (h && h.type === 'gravitos_singularity' && h.life > 0 && h.safeZones && h.safeZones.length) { _live = h; break; }",
    '    _lxSzHudYield(_live ? _live.safeZones[0] : null);',
    '    if (!_live) return;',
    '    const camX = (game.camera && game.camera.x) || 0, camY = (game.camera && game.camera.y) || 0;',
    '    const t = game.time;',
    '    for (const h of game.hazards) {',
    "      if (!h || h.type !== 'gravitos_singularity' || !(h.life > 0) || !h.safeZones) continue;",
    '      const age = (h.maxLife | 0) - (h.life | 0), frac = h.life / Math.max(1, h.maxLife);',
    '      for (const z of h.safeZones) {',
    '        const sx = z.x - camX, sy = z.y - camY, cx = sx + z.w / 2;',
    '        const onScreen = sx + z.w > 0 && sx < W;',
    '        ctx.save();',
    '        if (onScreen) {',
    "          // the pillar: brightest at the rect, fading up the protected column; breathes with the zone",
    '          const ph = _LX_SZ_BEACON_H, breath = 0.82 + 0.18 * Math.sin(t * 0.18);',
    '          const g = ctx.createLinearGradient(0, sy, 0, sy - ph);',
    "          g.addColorStop(0, 'rgba(255,214,110,' + (0.55 * breath).toFixed(3) + ')'); g.addColorStop(0.45, 'rgba(255,196,80,' + (0.22 * breath).toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,180,60,0)');",
    "          ctx.globalCompositeOperation = 'lighter';",
    '          ctx.fillStyle = g; ctx.fillRect(Math.round(sx), Math.round(sy - ph), Math.round(z.w), ph);',
    "          // a hot core line down the pillar's middle so it reads at a glance even over the boss",
    "          ctx.globalAlpha = 0.35 * breath; ctx.fillStyle = '#fff3c4'; ctx.fillRect(Math.round(cx - 2), Math.round(sy - ph * 0.9), 4, Math.round(ph * 0.9));",
    "          ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;",
    "          // the spawn ring: expands from the rect over the first 24 frames",
    '          if (age < 24) {',
    '            const k = age / 24, rr = 30 + 190 * (1 - Math.pow(1 - k, 2));',
    "            ctx.globalAlpha = (1 - k) * 0.85; ctx.strokeStyle = '#ffe089'; ctx.lineWidth = 3 + 6 * (1 - k);",
    '            ctx.beginPath(); ctx.ellipse(cx, sy + z.h / 2, rr, rr * 0.42, 0, 0, Math.PI * 2); ctx.stroke();',
    '          }',
    "          // the timer ring: closes onto the rect as the resolve nears; the last second turns white",
    '          { const rr = z.w * 0.5 + 24 * frac + 6; const late = h.life <= 60;',
    "            ctx.globalAlpha = 0.55 + 0.35 * (1 - frac); ctx.strokeStyle = late ? '#ffffff' : '#ffd36b'; ctx.lineWidth = late ? 3 : 2;",
    '            ctx.beginPath(); ctx.ellipse(cx, sy + z.h / 2, rr, rr * 0.42, 0, 0, Math.PI * 2); ctx.stroke(); }',
    '        } else {',
    "          // off screen: a chevron at the edge, at the zone's height, pointing the way",
    '          const left = sx + z.w / 2 < 0, ex = left ? 14 : W - 14, ey = Math.max(24, Math.min(H - 24, sy + z.h / 2));',
    '          const pulse = 0.7 + 0.3 * Math.sin(t * 0.3);',
    "          ctx.globalAlpha = pulse; ctx.fillStyle = '#ffd36b'; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineWidth = 3; ctx.lineJoin = 'round';",
    '          ctx.beginPath(); ctx.moveTo(ex + (left ? 26 : -26), ey - 18); ctx.lineTo(ex, ey); ctx.lineTo(ex + (left ? 26 : -26), ey + 18); ctx.lineTo(ex + (left ? 14 : -14), ey); ctx.closePath(); ctx.stroke(); ctx.fill();',
    "          const _d = Math.round(Math.abs((left ? -sx - z.w : sx - W)) );",
    "          ctx.font = 'bold 12px system-ui, sans-serif'; ctx.textAlign = left ? 'left' : 'right'; ctx.textBaseline = 'middle'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.fillStyle = '#fff3c4';",
    "          ctx.strokeText('SAFE ' + _d + 'px', ex + (left ? 32 : -32), ey); ctx.fillText('SAFE ' + _d + 'px', ex + (left ? 32 : -32), ey);",
    '        }',
    '        ctx.restore();',
    '      }',
    '    }',
    '  } catch (e) {}',
    '}',
    'function _lxSafeZoneOffPad(rect, ww) {'));

// ---- 4. no art, still a zone; and the art warms with the boss -----------------------------------------
sub('fallback',
  J('        if (!_szReady) {',
    '          const _za = 0.30 + Math.sin(tt * 1.3) * 0.07;',
    "          ctx.fillStyle = 'rgba(200,232,255,' + _za.toFixed(3) + ')';",
    '          ctx.fillRect(_zx, z.y, z.w, z.h);',
    '        }'),
  J('        if (!_szReady) {',
    '          // v0.30.796 sz-all — a zone with no art is still a zone the player can see: a gold rim and a warm',
    '          // fill, inside the rect as everything here must be (the old pale wash vanished under the veil).',
    '          const _za = 0.55 + Math.sin(tt * 1.3) * 0.12;',
    "          ctx.fillStyle = 'rgba(255,190,70,' + (_za * 0.55).toFixed(3) + ')';",
    '          ctx.fillRect(_zx, z.y, z.w, z.h);',
    "          ctx.fillStyle = 'rgba(255,224,140,' + _za.toFixed(3) + ')';   // the rim: four bands inside the rect (no strokeRect - nothing may paint past the rect)",
    '          ctx.fillRect(_zx, z.y, z.w, 3); ctx.fillRect(_zx, z.y + z.h - 3, z.w, 3); ctx.fillRect(_zx, z.y, 3, z.h); ctx.fillRect(_zx + z.w - 3, z.y, 3, z.h);',
    '        }'));
sub('warm art',
  "  gravitos: { img: ['gravitos_blackhole', 'gravitos_laserring', 'gravitos_soulring', 'gravitos_slamzone', 'gravitos_slamring'] },",
  "  gravitos: { img: ['gravitos_blackhole', 'gravitos_laserring', 'gravitos_soulring', 'gravitos_slamzone', 'gravitos_slamring', 'gravitos_singularity_zone', 'safezone_shield'], fx: ['gravitos_singularity_zone'] },   // v0.30.796 sz-all — the rift and its shield never arrive cold");

const grew = s.length - n0;
if (grew < 4000 || grew > 12000) { console.error(`ABORT: content moved ${grew}`); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp suspiciously small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: sz-all — real-time rain, HUD-aware placement, beacons, bright fallback, warmed art (+${grew}, EOL ${EOL === '\r\n' ? 'CRLF' : 'LF'})`);
