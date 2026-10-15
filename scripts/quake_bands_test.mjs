// EVERY QUAKE BOSS'S WARNING LIES ON WHAT IT HITS (per user: "do the same for krook and the other quake bosses" - Mooma's surface band,
// v0.30.1773). Each boss in its own arena, its windup held half way:
//   [own]   its own band (tg_smash_<type>), never the shared molten crack
//   [on]    every piece lies on a surface (its crack on the edge) and inside that surface's ends
//   [reach] exactly the surfaces its slam reaches: Krook's earthquake / Gloopaloo's quake every surface in view; Krook's jump slam the ground
//           under him to the waves' reach; the Smith's toll his own floor within 640; Capricorn's hoofquake within 294 of her; Legosaurus's
//           stomp the floor his mob_quake reaches - and every such surface carries it
//   [jump]  jump arrows drawn (tg_jump_<type>), none over the boss's own body
//   node scripts/quake_bands_test.mjs      PORT / MOJI_SERVE_ROOT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = process.env.MOJI_SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 15393);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x).slice(0, 400) + ']' : '')); };
const CASES = [
  { id: 'krook earthquake', map: 'krookThrone', type: 'kingKrook', rule: 'any', hold: "m.patternState = 'earthquake'; m.patternTimer = 600; m._kFired = false; m._kAnnounced = true;" },
  { id: 'krook jump slam', map: 'krookThrone', type: 'kingKrook', rule: 'jump', hold: "m.patternState = 'jumpSlam'; m._kJumped = true; m._kFired = false; m._kJumpMs = 500;" },
  { id: 'Gloopaloo quake', map: 'slimeCave', type: 'king', rule: 'any', hold: "m.patternState = 'quake'; m.patternTimer = 780; m._quakeFired = false; m._quakeAnnounced = true;" },
  { id: 'Smith toll', map: 'sundered_forge', type: 'sundered_smith', rule: 'level', hold: "m._smithTollTellAt = performance.now() - 350; m._smithTollAt = (game.time | 0) + 9999;" },
  { id: 'Capricorn hoofquake', map: 'zod_capricorn', type: 'zodiac_capricorn', rule: 'reach', hold: "m._capQuakeFiring = true; m._capQuakeT = 400; m._capQuakeAt = (game.time | 0) + 9999;" },
  { id: 'Legosaurus stomp', map: 'blockland_apex', type: 'legosaurus', rule: 'hazard', hold: "const q = game.hazards.find((h) => h && h.type === 'mob_quake' && h._owner === m); if (q) q.life = 45; else m._legosaurusQuakeAt = 0;" },
];
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT }); await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, channel: EXE ? undefined : 'msedge', headless: true, args: ['--mute-audio', '--no-sandbox'] });
const errs = [];
try {
  for (const C of CASES) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('pageerror', (e) => errs.push(C.id + ': ' + String(e.message).slice(0, 120)));
    await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
    await page.goto(`http://localhost:${PORT}/mojiworld_game.html?lxhold=0`, { waitUntil: 'load', timeout: 180000 });
    await page.waitForFunction(() => typeof loadMap === 'function' && typeof _lxAttackZones === 'function', null, { timeout: 180000 });
    await page.waitForTimeout(3500);
    const R = await page.evaluate(async (C) => {
      const sleep = (ms) => new Promise((z) => setTimeout(z, ms));
      for (const i of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(i); if (el) el.style.display = 'none'; }
      try { _lxBootGateDone = true; } catch (e) {} window._prologueActive = false;
      applyClass('warrior'); player.level = 70; player._tutorialSeen = true; player._gravitosCineSeen = true;
      player._storyBeatsSeen = {}; for (const k of Object.keys(STORY_BEATS || {})) player._storyBeatsSeen[k] = true;
      loadMap(C.map, 300); await sleep(3500); try { _lxCineHold(0); } catch (e) {} game.paused = false;
      let m = game.monsters.find((x) => x && x.type === C.type);
      if (!m) { spawnMonster(player.x + 300, player.y - 60, C.type, true, false); m = game.monsters.find((x) => x && x.type === C.type); }
      if (!m) return { err: 'no ' + C.type + ' on ' + game.currentMap };
      player._god = true; player.invulnerable = 1e9;
      const key = 'tg_smash_' + C.type, jk = 'tg_jump_' + C.type;
      for (let i = 0; i < 100 && !(LX_FX[key] && _lxFxReady(LX_FX[key]) && LX_FX[jk] && _lxFxReady(LX_FX[jk])); i++) await sleep(100);
      const f = new Function('m', C.hold), t0 = performance.now();
      while (performance.now() - t0 < 1400) { try { f(m); } catch (e) {} m.currentHp = m.maxHp; player.x = m.x + m.w + 240; player.vx = 0; await sleep(8); }
      try { f(m); } catch (e) {} game.paused = true;   // hold once more, then freeze: a sleep between the hold and the pause let the AI move on
      const Z = _lxAttackZones().filter((z) => z.kind === 'smash');
      const camX = game.camera.x, camY = game.camera.y || 0, cx = m.x + m.w / 2, feet = m.y + m.h;
      const img = LX_FX[key], B = (typeof LX_QUAKE_BAND !== 'undefined') ? LX_QUAKE_BAND[C.type] : null;
      const sink = (img && B) ? B.cut * (B.seg || 400) / (img.naturalWidth || img.width || 1) : 0;
      const plats = (game.mapData.platforms || []).filter((p) => p && p.w > 0 && !(p.x > camX + W + 40 || p.x + p.w < camX - 40 || p.y < camY - 60 || p.y > camY + H + 60));
      let x0 = -Infinity, x1 = Infinity, yLo = -Infinity, yHi = Infinity;
      if (C.rule === 'reach') { x0 = cx - 294; x1 = cx + 294; }
      if (C.rule === 'level') { x0 = cx - 640; x1 = cx + 640; yLo = feet - 8; yHi = feet + 8; }
      if (C.rule === 'jump') { let gy = null; for (const p of game.mapData.platforms || []) if (p && p.type === 'ground' && cx >= p.x && cx <= p.x + p.w && (gy == null || p.y < gy)) gy = p.y;
        const S = LX_KROOK_SLAM, reach = S.speed * S.life; x0 = m.x + m.w * 0.25 - S.w - reach; x1 = m.x + m.w * 0.75 + S.w + reach; yLo = gy - 8; yHi = gy + 8; }
      if (C.rule === 'hazard') { const q = game.hazards.find((h) => h && h.type === 'mob_quake' && h._owner === m); if (!q) return { err: 'no stomp hazard' }; x0 = q.cx - q.w / 2; x1 = q.cx + q.w / 2; yLo = q.y; yHi = q.y + (q.h || 50) + 30; }
      const want = plats.filter((p) => p.y >= yLo && p.y <= yHi && Math.min(p.x + p.w, x1) - Math.max(p.x, x0) >= 8);
      const onP = (z) => plats.find((p) => Math.abs(z.y + z.h - sink - p.y) <= 1 && z.x >= p.x - 0.5 && z.x + z.w <= p.x + p.w + 0.5);
      const on = Z.map(onP);
      const inRule = Z.every((z, i) => on[i] && on[i].y >= yLo && on[i].y <= yHi && z.x >= x0 - 0.5 && z.x + z.w <= x1 + 0.5);
      const covered = want.every((p) => Z.some((z, i) => on[i] === p));
      const arrow = LX_FX[jk], calls = []; const orig = ctx.drawImage;
      ctx.drawImage = function (...a) { if (a[0] === arrow) calls.push(a.length === 9 ? a[5] + a[7] / 2 : a[1] + a[3] / 2); return orig.apply(this, a); };
      try { _drawAttackZones(); } finally { ctx.drawImage = orig; }
      const onBody = calls.filter((x) => x > m.x - camX - 40 && x < m.x + m.w - camX + 40).length;
      return { n: Z.length, tg: [...new Set(Z.map((z) => z.tg))], onAll: Z.length > 0 && on.every(Boolean), inRule, covered, want: want.length, arrows: calls.length, onBody, prog: Z.length ? +Z[0].prog.toFixed(2) : null };
    }, C);
    ok(`[own] ${C.id}: its own band (tg_smash_${C.type})`, !R.err && R.n > 0 && R.tg.join() === 'tg_smash_' + C.type, R);
    ok(`[on] ${C.id}: every piece lies on a surface, inside its ends`, !R.err && R.onAll, { n: R.n });
    ok(`[reach] ${C.id}: only the surfaces it reaches, and every one of them (${C.rule})`, !R.err && R.inRule && R.covered && R.want > 0, { want: R.want, inRule: R.inRule, covered: R.covered });
    ok(`[jump] ${C.id}: jump arrows drawn, none over its body`, !R.err && R.arrows >= 1 && R.onBody === 0, { arrows: R.arrows, onBody: R.onBody });
    await page.close();
  }
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
