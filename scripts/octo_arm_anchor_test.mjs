// Live test: OCTOBABY'S ARMS STAY BOLTED TO HER wherever the player stands.
//
// The arms (octoLeg*) are not bosses, so they fell into the monster loop's cheap "far" tier whenever the
// camera was ~880 px off - gravity + platform collision, then `continue` past their own anchor. An anchored
// arm hangs with its box below the floor's top, so the first gravity step took it through the ground and
// out of the 560 px world, for good: from down there it is always "far". The player enters the grotto at
// x 260, so the Poison arm fell in every fight, and walking to either edge dropped the arm on the other
// side. A fallen arm cannot be reached or cut, so the body keeps shedding damage for it (x0.55 per living
// arm) and the exposed window the whole fight is built around never opens.
//
// Drives the real grotto from its real entry point and checks every arm is in its slot - centre
// head.h * 0.32 under the head's, inside the formation's reach - after 5 s at the entrance, at each edge,
// and back under the head. Positions only; no hit is faked.
//   node scripts/octo_arm_anchor_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import net from 'node:net';
import { spawn } from 'node:child_process';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const free = (p) => new Promise((r) => { const s = net.createServer(); s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2]; for (let p = 18731; p <= 18999 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore', env: { ...process.env, MOJI_GAME_FILE: process.env.MOJI_GAME_FILE || '' } });
await new Promise((r) => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof updateMonsters === 'function', null, { timeout: 120000 });
await page.waitForLoadState('load', { timeout: 120000 }).catch(() => {});
const R = await page.evaluate(async () => {
  const raf = () => new Promise((res) => requestAnimationFrame(res));
  try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  const c = document.querySelector('.cls-card'); if (c && !player.cls) { try { c.click(); } catch (e) {} }
  player._storyBeatsSeen = new Proxy({}, { get: () => true });
  player.level = 60; player._god = true;
  loadMap('octopusGrotto');
  const now = () => game.time | 0;
  const steps = async (n) => { const s0 = now(); let g = 0; while (now() - s0 < n && g++ < 20000) { await raf(); game.paused = false; player.hp = player.maxHp; } };
  await steps(20);
  const head = game.monsters.find((m) => m.type === 'octobaby');
  if (!head) return { noHead: true };
  const legs = (head._legRefs || []).slice();
  const G = game.mapData.platforms.filter((p) => p.type === 'ground');
  const out = { legCount: legs.length, entryX: Math.round(player.x), worldH: game.mapData.worldHeight, stances: [] };
  // In its slot: centre y exactly head.h * 0.32 under the head's centre (+-24 px), and no farther out
  // sideways than the anchor formula can put it (0.65 * head.w + 180, +-24 px of sway).
  const slot = (l) => {
    const hx = head.x + head.w / 2, hy = head.y + head.h / 2, lx = l.x + l.w / 2, ly = l.y + l.h / 2;
    const dy = ly - (hy + head.h * 0.32), dx = Math.abs(lx - hx);
    return { t: l.type.replace('octoLeg', ''), dy: Math.round(dy), dx: Math.round(dx),
      ok: Math.abs(dy) <= 24 && dx <= head.w * 0.65 + 180 + 24 && l.currentHp > 0 && game.monsters.includes(l) };
  };
  const stance = async (tag, x) => {
    if (x != null) { player.x = x; player.y = G[0].y - player.h - 2; player.vx = 0; player.vy = 0; }
    await steps(300);
    const s = legs.map(slot);
    out.stances.push({ tag, px: Math.round(player.x), camX: Math.round(game.camera.x), ok: s.every((q) => q.ok), arms: s });
  };
  await stance('5 s at the entrance', null);
  await stance('5 s at the far-left edge', 30);
  await stance('5 s at the far-right edge', game.mapData.worldWidth - 60);
  await stance('5 s back under the head', head.x + head.w / 2 - player.w / 2);
  return out;
});
await b.close(); srv.kill();
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
ok('Octobaby and her four arms are in the grotto', !R.noHead && R.legCount === 4, { legs: R.legCount });
for (const s of (R.stances || [])) {
  ok(`every arm is in its slot after ${s.tag}`, s.ok,
    { player: s.px, camera: s.camX, off: s.arms.filter((a) => !a.ok).map((a) => `${a.t} dy ${a.dy} dx ${a.dx}`) });
}
ok('no page errors', errs.length === 0, errs.slice(0, 3));
for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter((q) => q.pass).length}/${results.length} checks passed`);
process.exit(results.every((q) => q.pass) ? 0 : 1);
