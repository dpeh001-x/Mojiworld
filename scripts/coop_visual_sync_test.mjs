// Co-op visual-state sync test (v0.29.367). Round-trips the fields that make
// a guest's screen match the host's: attack animation (aa, ms-remaining so no
// clock sync is needed), patternState (boss poses + Gravitos star-form),
// _phaseSprite (boss forms, one-way), _dreamPhase (burrow/lie fade) and phase.
// Also pins that the fade actually dims the blit -- the flag was write-only
// for six versions -- and that idle mobs pay zero extra payload.
//   node scripts/coop_visual_sync_test.mjs
// Env: PW_EXE / PW_CHANNEL (default msedge), PORT (default 8921)
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || 8921;
const server = spawn(process.execPath, [join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch(process.env.PW_EXE
  ? { executablePath: process.env.PW_EXE, headless: true }
  : { channel: process.env.PW_CHANNEL || 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(8000);

const o = await page.evaluate(() => {
  const r = {};
  const arena = Object.entries(MAPS)
    .filter(([id, mp]) => !mp.isVoid && !mp.isTown && (mp.platforms || []).some(p => p.w > 900))
    .sort((x, y) => y[1].worldWidth - x[1].worldWidth)[0];
  loadMap(arena[0]);
  const ww = game.mapData.worldWidth;
  const gy = (game.mapData.platforms || []).filter(p => p.w > 900).sort((x, y) => x.y - y.y)[0].y;
  const MAP = game.currentMap;

  // ---- HOST side: capture what the tick actually sends -------------------
  const sent = [];
  net.isHost = true; net.myId = 1; net.hostId = 1; net.connected = true;
  net.ws = { readyState: 1, send: (s) => { try { sent.push(JSON.parse(s)); } catch (e) {} } };
  game.monsters.length = 0;
  const gm = spawnMonster(ww * 0.5, gy - 200, 'gravitos', true);
  gm._phaseSprite = 'gravitos3';
  gm.patternState = 'collapseRain';
  gm.phase = 3;
  gm._dreamPhase = true;
  gm.atkAnimUntil = performance.now() + 700;
  net._coopMonAt = 0;                        // force the throttle open
  _coopTickMonsters();
  const monMsg = sent.find(s => s.t === 'mon');
  const ent = monMsg && (monMsg.list || []).find(e => e.u === gm.uid);
  r.hostEmits = ent ? { aa: ent.aa, ps: ent.ps, sp: ent.sp, dp: ent.dp, p: ent.p } : null;
  r.hostOk = !!(ent && ent.aa > 500 && ent.aa <= 2000 && ent.ps === 'collapseRain' &&
                ent.sp === 'gravitos3' && ent.dp === 1 && ent.p === 3);
  // idle mob stays lean: no visual fields at all
  const slime = spawnMonster(ww * 0.5 + 100, gy - 60, 'slime', false);
  slime.patternState = 'idle';
  net._coopMonAt = 0; sent.length = 0;
  _coopTickMonsters();
  const monMsg2 = sent.find(s => s.t === 'mon');
  const lean = monMsg2 && (monMsg2.list || []).find(e => e.u === slime.uid);
  r.leanOk = !!(lean && lean.aa === undefined && lean.ps === undefined && lean.sp === undefined
                && lean.dp === undefined && lean.p === undefined);

  // ---- GUEST side: apply a frame carrying the same state ------------------
  game.monsters.length = 0;
  net.isHost = false; net.hostId = 7; net.myId = 2;
  net.peers = { 7: { id: 7, name: 'H', map: MAP, x: 0, y: 0, _last: performance.now() } };
  const t0 = performance.now();
  _mpHandle({ t: 'mon', id: 7, map: MAP, list: [{
    u: 990001, t: 'gravitos', x: Math.round(ww * 0.5), y: gy - 200, vx: 0, vy: 0,
    f: -1, h: 900000, m: 21000000, b: 1,
    aa: 700, ps: 'collapseRain', sp: 'gravitos3', dp: 1, p: 3,
  }] });
  const mir = game.monsters.find(m => m.uid === 990001);
  r.mirror = mir ? { ps: mir.patternState, sp: mir._phaseSprite, dp: !!mir._dreamPhase,
                     p: mir.phase, aaRemain: Math.round((mir.atkAnimUntil || 0) - t0) } : null;
  r.guestOk = !!(mir && mir.patternState === 'collapseRain' && mir._phaseSprite === 'gravitos3' &&
                 mir._dreamPhase === true && mir.phase === 3 &&
                 mir.atkAnimUntil > t0 + 500 && mir.atkAnimUntil < t0 + 2500);

  // state ENDS when the host stops reporting it: next frame without ps/dp
  _mpHandle({ t: 'mon', id: 7, map: MAP, list: [{
    u: 990001, t: 'gravitos', x: Math.round(ww * 0.5), y: gy - 200, vx: 0, vy: 0,
    f: -1, h: 900000, m: 21000000, b: 1, sp: 'gravitos3',
  }] });
  r.clearOk = !!(mir && mir.patternState === 'idle' && mir._dreamPhase === false &&
                 mir._phaseSprite === 'gravitos3');   // form NOT reverted

  // ---- RENDERER: the dream fade actually dims now --------------------------
  // Wrap _drawBossSprite (gravitos goes through the boss path) to sample the
  // alpha in effect during the mirror's blit.
  let sampled = null;
  const realDraw = window._drawBossSprite;
  window._drawBossSprite = function (...a) { sampled = ctx.globalAlpha; return realDraw.apply(this, a); };
  mir._dreamPhase = true;
  ctx.globalAlpha = 1;
  try { drawMonster(mir); r.drawThrew = null; } catch (e) { r.drawThrew = String(e).slice(0, 140); }
  r.dimmedAlpha = sampled;
  const afterDim = ctx.globalAlpha;
  mir._dreamPhase = false; sampled = null;
  try { drawMonster(mir); } catch (e) {}
  r.normalAlpha = sampled;
  window._drawBossSprite = realDraw;
  r.dimOk = sampled !== null && r.dimmedAlpha !== null &&
            r.dimmedAlpha < 0.5 && r.normalAlpha > 0.9 && afterDim > 0.9;

  // leave clean
  net.connected = false; net.ws = null; net.hostId = null; net.peers = {}; net.myId = null; net.isHost = false;
  game.monsters.length = 0;
  return r;
});

const results = [];
const ok = (n, c, e) => results.push({ n, pass: !!c, e });
ok('host tick emits attack/pattern/form/fade/phase', o.hostOk, JSON.stringify(o.hostEmits));
ok('idle mob frames stay lean (no visual fields)', o.leanOk);
ok('guest mirror rebuilds the full visual state', o.guestOk, JSON.stringify(o.mirror));
ok('state clears when host stops reporting; form never reverts', o.clearOk);
ok('dream fade actually dims the blit (was write-only)', o.dimOk, `dimmed=${o.dimmedAlpha} normal=${o.normalAlpha}${o.drawThrew ? ' threw ' + o.drawThrew : ''}`);
for (const t of results) console.log(`${t.pass ? 'PASS' : 'FAIL'}  ${t.n}${t.e ? '  (' + t.e + ')' : ''}`);
const failed = results.filter(t => !t.pass);
console.log(`\n${results.length - failed.length}/${results.length} pass`);
console.log('pageerrors:', errs.length, errs.slice(0, 3));
await browser.close(); server.kill();
process.exit(failed.length || errs.length ? 1 : 0);
