// THE ROGUE'S CRESCENT SPARK SWEEPS THE WAY YOU SWING (v0.30.1447). hit_rogue_3 is the one class hit spark with a direction;
// the game drew it the same way whichever side the blow came from. Per user its art is mirrored to face right, and a blow
// that lands from the monster's right mirrors it back.
//   1. the art faces right: in every visible frame the crescent's magenta core sits right of centre;
//   2. in game, a Rogue skill that lands with this spark: from the monster's left it is drawn as is, from its right mirrored;
//   3. CONTROL: a round-burst spark (the Rogue's first design) is never mirrored.
//   node scripts/rogue_crescent_facing_test.mjs [port]      (MOJI_SERVE_ROOT overrides the served tree)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs'); const sharp = require('sharp');
const PORT = Number(process.argv[2] || process.env.PORT || 10265); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  ' + JSON.stringify(note) : '')); };
// ---- 1. the art: centroid of the magenta core, as a fraction of the width
const cx = [];
for (let i = 0; i < 9; i++) {
  const { data, info } = await sharp(path.join(SERVE_ROOT, 'Sprites/fx/anim', `hit_rogue_3_${i}.webp`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let sx = 0, n = 0;
  for (let p = 0, k = 0; p < data.length; p += 4, k++) if (data[p + 3] > 128 && data[p] > 150 && data[p + 2] > 150 && data[p + 1] < 140) { sx += k % info.width; n++; }
  cx.push(n ? +(sx / n / info.width).toFixed(3) : null);
}
const vis = cx.filter((v) => v != null);   // the last frame is faded past the magenta test
ok('the crescent faces right in every visible frame (its magenta core right of centre)', vis.length >= 7 && vis.every((v) => v > 0.5), cx);
// ---- 2 + 3. in game
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof hitMonster === 'function' && typeof _lxHitVariant === 'function', null, { timeout: 180000 }); await page.waitForTimeout(5000);
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const out = { ver: GAME_VERSION };
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {} try { _cineScoreStop(1, false); } catch (e) {}
    try { loadMap('forest', 300); } catch (e) {} await sleep(600); player._god = true; player.invulnerable = 1e9;
    player.cls = 'rogue';
    const rogue = Object.keys(SKILLS).filter((id) => SKILLS[id] && SKILLS[id].cls === 'rogue');
    const crescent = rogue.find((id) => _lxHitVariant(id) === 2), round = rogue.find((id) => _lxHitVariant(id) === 0);
    out.skills = { crescent, round };
    game.paused = true; game.monsters.length = 0; const floor = player.y + player.h;
    const got = spawnMonster(player.x + 300, floor - monsterTypes.slime.h, 'slime', false); const m = (got && got.type) ? got : game.monsters.filter((x) => x && x.type === 'slime').pop();
    if (!m) return Object.assign(out, { err: 'no slime' });
    m.currentHp = m.maxHp = 1e12; m.evasion = 0;
    const seen = []; const oB = window.spawnSpriteBurst;
    window.spawnSpriteBurst = function (x, y, key, opts) { if (/^hit_rogue/.test(String(key))) seen.push({ key, flipX: !!(opts && opts.flipX) }); return oB.apply(this, arguments); };
    const hit = (skill, side) => {
      player.x = side === 'left' ? m.x - 60 : m.x + m.w + 32; player.y = floor - player.h;
      const n0 = seen.length; game._lastClassHitFxFrame = -99; player._lxSureHit = true;
      try { hitMonster(m, 50, false, skill); } finally { player._lxSureHit = false; }
      return seen.slice(n0);
    };
    try {
      out.fromLeft = hit(crescent, 'left'); out.fromRight = hit(crescent, 'right'); out.roundFromRight = hit(round, 'right');
    } finally { window.spawnSpriteBurst = oB; }
    return out;
  });
  console.log('build ' + r.ver + '  skills ' + JSON.stringify(r.skills));
  if (r.err) ok('harness: ' + r.err, false);
  else {
    const one = (a, k) => (a || []).find((b) => b.key === k);
    ok('a blow from the monster\'s LEFT draws the crescent as it is (facing right)', !!one(r.fromLeft, 'hit_rogue_3') && one(r.fromLeft, 'hit_rogue_3').flipX === false, r.fromLeft);
    ok('a blow from the monster\'s RIGHT draws it mirrored (facing left, the way the blow travels)', !!one(r.fromRight, 'hit_rogue_3') && one(r.fromRight, 'hit_rogue_3').flipX === true, r.fromRight);
    ok('CONTROL: a round-burst spark is never mirrored', !!one(r.roundFromRight, 'hit_rogue') && one(r.roundFromRight, 'hit_rogue').flipX === false, r.roundFromRight);
  }
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { ok('HARNESS ERROR', false, String(e && e.stack || e).slice(0, 300)); }
finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
