// THE TOMBKEEPER'S ONE-FRAME SIZE POP
// ============================================================================
// Per user: "tombkeeper seems to have a single frame where by the sprite grows big for that 1 frame".
//
// _drawMonsterSprite scales the mob by its per-STATE animation calibration and picks that state from
// m._frameIsAttack. But the flag is written by _monsterStateFrame, which used to be called ~96 lines
// BELOW the calib block that reads it — so each draw was scaled by the state of the PREVIOUS draw.
// At each boundary of a swing the scale and the frame therefore disagreed for exactly one frame, and
// the Tombkeeper's calib is idle/walk s=1.56 against attack s=2.05: the frame his swing ends on was
// drawn with the attack scale over an idle pose, 2.05/1.56 = 1.31x. One visibly bigger frame.
//
// Measured as an OUTCOME, not as a call order: the calib block applies ctx.scale(s, s) with that
// state's value, so the uniform scale applied during a draw IS the state the renderer sized by.
// Compare it against m._frameIsAttack after the draw, which is the state of the frame it drew. Any
// disagreement is a frame rendered at the wrong size — the bug itself, however it is caused.
// Run: node scripts/tombkeeper_size_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 9753);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'Tomb');
await page.evaluate(() => { const m = document.getElementById('class-select-modal'); for (const el of m.querySelectorAll('button,div,li')) { if (el.children.length > 3) continue; if (getComputedStyle(el).display === 'none') continue; if (/^\s*warrior\s*$/i.test((el.textContent || '').trim())) { el.click(); return; } } });
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);
await page.evaluate(() => { player.level = 40; loadMap('forest', 300); });
await page.waitForTimeout(4500);

const R = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const sb = document.getElementById('story-beat-overlay'); if (sb) { sb.classList.remove('on'); sb.style.display = 'none'; }
  try { _lxCineHold(0); } catch (e) {}
  game.paused = false; player._god = true;
  game.monsters.length = 0;
  player.x = 700; player.y = 300;
  const out = {};
  out.calib = { idle: _lxAnimCalib('tombKeeper', 'idle').s, walk: _lxAnimCalib('tombKeeper', 'walk').s, attack: _lxAnimCalib('tombKeeper', 'attack').s };
  out.ratio = +(out.calib.attack / out.calib.idle).toFixed(3);

  const m = spawnMonster(player.x + 70, player.y - 10, 'tombKeeper', false);   // close: he swings on his own
  if (!m) return { err: 'no tombKeeper spawned' };
  const set = _monsterFramesFor('tombKeeper');
  for (let i = 0; i < 80 && !(set.attack && set.attack[0] && set.attack[0].complete); i++) await sleep(100);

  const S_ATK = out.calib.attack, S_IDLE = out.calib.idle;
  let draws = 0, stale = 0, sawAttack = 0, sawIdleWalk = 0, unknown = 0;
  let capturing = false, appliedS = null;
  const oScale = CanvasRenderingContext2D.prototype.scale;
  CanvasRenderingContext2D.prototype.scale = function (x, y) {
    if (capturing && x === y && (Math.abs(x - S_ATK) < 1e-6 || Math.abs(x - S_IDLE) < 1e-6)) appliedS = x;
    return oScale.apply(this, arguments);
  };
  const oDraw = _drawMonsterSprite;
  _drawMonsterSprite = function (mm, sx, sy) {
    if (mm !== m) return oDraw.apply(this, arguments);
    capturing = true; appliedS = null;
    const r = oDraw.apply(this, arguments);
    capturing = false;
    const drewAttack = !!mm._frameIsAttack;
    draws++;
    if (drewAttack) sawAttack++; else sawIdleWalk++;
    if (appliedS == null) unknown++;
    else if ((Math.abs(appliedS - S_ATK) < 1e-6) !== drewAttack) stale++;
    return r;
  };
  // keep both alive and adjacent so he keeps swinging: every swing has two boundaries
  const pin = setInterval(() => { try { m.currentHp = m.maxHp; player.hp = getMaxHp(); player.x = m.x - 70; } catch (e) {} }, 50);
  await sleep(14000);
  clearInterval(pin);
  _drawMonsterSprite = oDraw; CanvasRenderingContext2D.prototype.scale = oScale;
  Object.assign(out, { draws, stale, sawAttack, sawIdleWalk, unknown });
  return out;
});
await browser.close(); server.kill();
if (R.err) { console.log(R.err); process.exit(1); }

console.log(`calib scales: idle ${R.calib.idle}  walk ${R.calib.walk}  attack ${R.calib.attack}`);
console.log(`a draw scaled by the wrong state is drawn x${R.ratio} (or x${(1 / R.ratio).toFixed(3)}) of its true size\n`);
console.log(`${R.draws} draws of the Tombkeeper: ${R.sawAttack} attack-frame, ${R.sawIdleWalk} idle/walk-frame, ${R.unknown} with no calib scale applied`);
console.log(`${R.stale} were scaled by the OTHER state (${((R.stale / Math.max(1, R.draws)) * 100).toFixed(2)}%)`);

const checks = [
  ['the Tombkeeper was drawn enough times to judge', R.draws >= 200, R.draws + ' draws'],
  ['he actually swung during the run', R.sawAttack >= 10, R.sawAttack + ' attack-frame draws'],
  ['and he was also seen not swinging', R.sawIdleWalk >= 10, R.sawIdleWalk + ' idle/walk draws'],
  ['the calib scale was observed on essentially every draw', R.unknown <= R.draws * 0.02, R.unknown + ' unjudged'],
  // the bug itself
  ['no frame is scaled by a state other than the one it is drawing', R.stale === 0, R.stale + ' frames drawn at the wrong size'],
  ['no page errors', errs.length === 0, errs.slice(0, 2).join(' | ')],
];
let fail = 0; for (const [n, ok, x] of checks) { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '   [' + x + ']' : ''}`); }
console.log(fail ? `\n${fail}/${checks.length} FAILED` : `\nall ${checks.length} passed`);
process.exit(fail ? 1 : 0);
