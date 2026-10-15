// EVERY BOSS CHARGE WEARS ITS OWN LANE (per user: "redesign all four" - after King Krook's and Legosaurus's lanes, the four bosses whose
// hourglass lunge still ran under the shared red chevrons). Each charging boss is spawned on a sturdy hero (a big HP bar, so the old
// "only when devastating" gate would have hidden the lane), its charge is put into its brace, and the drawn lane must be its own nine-frame
// art: the Master Conductor, the Arbiter, the Woman Who Turned Back and the Sovereign of the Spire (hourglass lunge), Legosaurus and
// Taur (brace-dash), King Krook (the Royal March). Every lane file is served (no 404).
//   node scripts/charge_lanes_test.mjs [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.argv[2] || process.env.PORT || 9823);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : '  ' + JSON.stringify(x).slice(0, 400))); };
const CASES = {   // type -> [how the brace is forced, the lane key it must draw]
  pqConductor:    ["m._hgCharging = true; m._hgPhase = 'brace'; m._hgT = 500; m._hgDir = 1;", 'tg_dash_pqConductor'],
  towerArbiter:   ["m._hgCharging = true; m._hgPhase = 'brace'; m._hgT = 500; m._hgDir = 1;", 'tg_dash_towerArbiter'],
  miraFallen:     ["m._hgCharging = true; m._hgPhase = 'brace'; m._hgT = 500; m._hgDir = 1;", 'tg_dash_miraFallen'],
  towerSovereign: ["m._hgCharging = true; m._hgPhase = 'brace'; m._hgT = 500; m._hgDir = 1;", 'tg_dash_towerSovereign'],
  legosaurus:     ["m._braceDashing = true; m._bdPhase = 'brace'; m._bdT = 300; m._bdDir = 1; m._bdCrush = false;", 'tg_dash_legosaurus'],
  zodiac_taurus:  ["m._braceDashing = true; m._bdPhase = 'brace'; m._bdT = 300; m._bdDir = 1;", 'tg_dash_zodiac_taurus'],
  kingKrook:      ["m.patternState = 'shellSpin'; m.patternTimer = 300; m._kAnnounced = true; m._shellDir = 0; m._kChargeDir = 1;", 'tg_dash_kingKrook'],
};
try {
  const page = await browser.newPage();
  const errs = [], miss = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  page.on('response', (r) => { if (r.status() >= 400 && /\/Sprites\/fx\/(anim\/)?tg_dash_/.test(r.url())) miss.push(r.url().replace(/^.*Sprites\//, '')); });
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof spawnMonster === 'function' && typeof _lxAttackZones === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(4000);
  const R = await page.evaluate(async (CASES) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const out = {};
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { loadMap('forest', 300); } catch (e) {} await sleep(800);
    player.level = 99; window.getMaxHp = () => 500000; player.maxHp = player.hp = 500000;   // sturdy: no charge here is "devastating"
    game.paused = true;
    for (const [type, [setup, want]] of Object.entries(CASES)) {
      game.monsters.length = 0;
      const def = monsterTypes[type]; if (!def) { out[type] = { err: 'no type' }; continue; }
      try { spawnMonster(player.x + 300, player.y + player.h - (def.h || 100), type, true); } catch (e) { out[type] = { err: String(e.message).slice(0, 80) }; continue; }
      const m = game.monsters.filter((x) => x && x.type === type).pop(); if (!m) { out[type] = { err: 'no spawn' }; continue; }
      new Function('m', setup)(m);
      const z = (_lxAttackZones() || []).find((q) => q && q.kind === 'dash');
      const fr = (typeof _fxAnimFrames === 'function') ? _fxAnimFrames(want) : null;
      const still = LX_FX[want]; if (still && typeof _lxFxReady === 'function') _lxFxReady(still);
      let t0 = performance.now(); while (performance.now() - t0 < 8000 && !((still && still.complete && still.naturalWidth > 0) && fr && fr.every((f) => f && (f.tagName === 'CANVAS' || (f.complete && f.naturalWidth > 0))))) await sleep(100);
      out[type] = { tg: z ? z.tg : null, want, registered: !!still, animKey: _FX_ANIM_KEYS.has(want), frames: fr ? fr.length : 0,
        stillOk: !!(still && still.complete && still.naturalWidth > 0), framesOk: !!(fr && fr.length === 9 && fr.every((f) => f && (f.tagName === 'CANVAS' || (f.complete && f.naturalWidth > 0)))) };
    }
    return out;
  }, CASES);
  for (const [type, r] of Object.entries(R)) ok(`${type}: its charge lane is its own art (${r.want}), nine frames, all served - and it shows on a sturdy hero`, !r.err && r.tg === r.want && r.registered && r.animKey && r.frames === 9 && r.stillOk && r.framesOk, r);
  ok('no lane file 404s', miss.length === 0, miss);
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
