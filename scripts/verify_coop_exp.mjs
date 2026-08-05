// Verify v0.28.7: (1) killing with an ally nearby gives x2 EXP (was x1.5),
// (2) an ally's kill grants a share, x2 when near the kill, x1 when far.
import { chromium } from 'playwright-core';
const EXE = process.env.PW_EXE || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = 'http://localhost:8765/mojiworld_game.html';
const R = []; const ok = (n, c, x) => { R.push(!!c); console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' — ' + x : '')); };
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 150)));
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('#lo-menu', { state: 'visible', timeout: 90000 });
await page.evaluate(() => localStorage.setItem('levelx_save_v1', JSON.stringify({ v: 1, t: Date.now(),
  player: { cls: 'mage', level: 45, look: { name: 'X' }, _storyBeatsSeen: { tutorial_intro: 1 } }, game: { currentMap: 'town' } })));
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('#menu-continue', { state: 'visible', timeout: 90000 });
await page.click('#menu-continue');
await page.waitForSelector('#loading-overlay', { state: 'detached', timeout: 30000 });
await page.waitForTimeout(800);

const r = await page.evaluate(() => {
  player._god = true;
  loadMap('forest'); game.paused = false;
  game.combo = 0; player.mods = player.mods || {}; player.mods.xpBoost = 0;
  // The seeded save leaves expToNext at the default (100); a mid-measurement
  // level-up would consume EXP and skew the deltas. Park it far away.
  player.exp = 0; player.expToNext = 1e12;
  const evt = LX_EVENT_EXP_MULT, mon = LX_MONSTER_EXP_MULT;
  const out = { evt, mon };

  // (1a) SOLO baseline kill
  let m = spawnMonster(player.x + 60, player.y, 'slime', false, false);
  const base = m.exp;
  let before = player.exp | 0;
  game.combo = 0; m.currentHp = 0; killMonster(m);
  out.solo = (player.exp | 0) - before;

  // (1b) kill with a live ally right next to the monster -> x2
  net.connected = true;
  net.peers = { 7: { id: 7, name: 'Ally', map: game.currentMap, x: player.x, y: player.y, _last: performance.now() } };
  m = spawnMonster(player.x + 60, player.y, 'slime', false, false);
  before = player.exp | 0;
  game.combo = 0; m.currentHp = 0; killMonster(m);
  out.withAlly = (player.exp | 0) - before;

  // (2) ally-kill share: become a NON-HOST peer and feed a kill broadcast.
  net.isHost = false; net.hostId = 1; net.myId = 7;
  const mkMsg = (u, x, y) => ({ t: 'kill', id: 1, u, e: 100, c: 0, x, y, map: game.currentMap, tp: 'slime', b: 0 });
  before = player.exp | 0;
  _coopApplyKill(mkMsg(9001, Math.round(player.x), Math.round(player.y)));   // near
  out.shareNear = (player.exp | 0) - before;
  before = player.exp | 0;
  _coopApplyKill(mkMsg(9002, Math.round(player.x) + 3000, Math.round(player.y)));   // far, same map
  out.shareFar = (player.exp | 0) - before;
  // restore
  net.isHost = true; net.hostId = null; net.connected = false; net.peers = {};
  out.base = base;
  return out;
});
console.log(JSON.stringify(r));
ok('solo baseline kill sane', r.solo > 0, r.solo);
ok('kill with nearby ally = exactly 2x solo', r.withAlly === r.solo * 2, `${r.withAlly} vs 2x${r.solo}`);
const expNear = Math.floor(100 * 1 * 1 * r.evt * r.mon * 1.35 * 1 * 2);
const expFar  = Math.floor(100 * 1 * 1 * r.evt * r.mon * 1.35 * 1 * 1);
ok('ally-kill share near = x2 share', r.shareNear === expNear, `${r.shareNear} vs ${expNear}`);
ok('ally-kill share far (same map) = base share', r.shareFar === expFar, `${r.shareFar} vs ${expFar}`);
ok('near share is exactly double far share', r.shareNear === r.shareFar * 2);
ok('no page errors', errs.length === 0, errs.join(' | '));
await b.close();
const fails = R.filter(x => !x).length;
console.log(`\n${R.length - fails}/${R.length} checks passed`);
process.exit(fails ? 1 : 0);
