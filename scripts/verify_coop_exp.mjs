// Verify v0.28.7: (1) killing with an ally nearby gives x2 EXP (was x1.5),
// (2) an ally's kill grants a share, x2 when near the kill, x1 when far.
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
// Resolve a browser that actually EXISTS. The Linux path stays first so CI is
// untouched, but it is the only candidate this line used to have - and with
// PW_EXE unset on a dev machine that made the launch throw before a single
// assertion ran. 66 scripts shared the line, so 66 gates were passing by never
// executing. Falling through to the local Chrome is what the tests that do run
// already rely on (they pass channel:'chrome').
const EXE = [process.env.PW_EXE,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].find((p) => p && existsSync(p));
// Needs a server already running (node serve.js <port>); PORT overrides the old default.
const URL = `http://localhost:${process.env.PORT || '8765'}/mojiworld_game.html`;
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
  // Pin the guest/host side multipliers that vary per run: loadMap rolls a world affix (e.g. x1.12 EXP) and
  // each kill feeds the map kill-streak ladder (_ksXpMul). Neither is what this suite measures.
  game._mapAffix = WORLD_AFFIXES[0];
  const _pinKs = () => { game.mapKillStreak = 0; player._ksTier = 0; };
  _pinKs();
  const evt = LX_EVENT_EXP_MULT, mon = LX_MONSTER_EXP_MULT;
  const out = { evt, mon };

  // (1a) SOLO baseline kill
  let m = spawnMonster(player.x + 60, player.y, 'slime', false, false);
  const base = m.exp;
  let before = player.exp | 0;
  m.exp = 100;   // a round table EXP so floor() rounding cannot hide a missing x2 (a slime pays 1-2)
  _pinKs(); game.combo = 0; m.currentHp = 0; killMonster(m);
  out.solo = (player.exp | 0) - before;

  // (1b) kill with a live ally right next to the monster -> x2
  net.connected = true;
  net.peers = { 7: { id: 7, name: 'Ally', map: game.currentMap, x: player.x, y: player.y, _last: performance.now() } };
  m = spawnMonster(player.x + 60, player.y, 'slime', false, false);
  before = player.exp | 0;
  m.exp = 100;   // a round table EXP so floor() rounding cannot hide a missing x2 (a slime pays 1-2)
  _pinKs(); game.combo = 0; m.currentHp = 0; killMonster(m);
  out.withAlly = (player.exp | 0) - before;

  // (2) ally-kill share: become a NON-HOST peer and feed a kill broadcast.
  net.isHost = false; net.hostId = 1; net.myId = 7;
  net.peers = {};   // peer 7 above was the ally; now I AM 7 - left in, it would count me as my own party member
  _pinKs(); game._mapAffix = WORLD_AFFIXES[0];
  // v0.30.862 (a23b19ec, per user): a guest pays a host kill only for a monster it MIRRORED, capped by its own
  // table - an unknown uid pays nothing. Register each uid as a mirrored slime whose table EXP is 100.
  // bughunt guest-dealt (parityB-3): the mirrored slime is the guest's own level (45) so the level-gap falloff is x1 here and the x2 wedge reads plainly;
  // the falloff itself is pinned below (Lv70 guest on a Lv10 mirror).
  for (const u of [9001, 9002]) _lxCoopRewardNote({ uid: u, type: 'slime', exp: 100, mojicoins: 0, level: 45 });
  out.mult = [(game.prestige && game.prestige.xpMult) || 1, typeof _diffExpMul === 'function' ? _diffExpMul() : 1,
    typeof _affixExpMul === 'function' ? _affixExpMul() : 1, typeof _ksXpMul === 'function' ? _ksXpMul() : 1].reduce((a, v) => a * v, 1);
  before = player.exp | 0;
  _coopApplyKill({ t: 'kill', id: 1, u: 9003, e: 100, c: 0, x: Math.round(player.x), y: Math.round(player.y), map: game.currentMap, tp: 'slime', b: 0 });
  out.shareUnmirrored = (player.exp | 0) - before;
  const mkMsg = (u, x, y) => ({ t: 'kill', id: 1, u, e: 100, c: 0, x, y, map: game.currentMap, tp: 'slime', b: 0 });
  before = player.exp | 0;
  _coopApplyKill(mkMsg(9001, Math.round(player.x), Math.round(player.y)));   // near
  out.shareNear = (player.exp | 0) - before;
  before = player.exp | 0;
  _coopApplyKill(mkMsg(9002, Math.round(player.x) + 3000, Math.round(player.y)));   // far, same map
  out.shareFar = (player.exp | 0) - before;
  // bughunt guest-dealt (parityB-3): a Lv70 guest on a Lv10 mirror gets the host's level-gap falloff (x0.15) - it paid 100% before - and Dawn's Favor (+10%) after the story
  player.level = 70; player.expToNext = 1e12; player.exp = 0;
  for (const u of [9101, 9102, 9103]) _lxCoopRewardNote({ uid: u, type: 'slime', exp: 100, mojicoins: 0, level: 10 });
  out.gapMul = _lxExpLevelGapMul({ level: 10 });
  before = player.exp | 0; _coopApplyKill(mkMsg(9101, Math.round(player.x), Math.round(player.y)));   // near: x2 wedge, x0.15 falloff
  out.gapNear = (player.exp | 0) - before;
  const _sc = window._lxStoryComplete; window._lxStoryComplete = () => true;
  before = player.exp | 0; _coopApplyKill(mkMsg(9102, Math.round(player.x), Math.round(player.y)));   // the same after the story: x1.1
  out.gapNearDawn = (player.exp | 0) - before;
  window._lxStoryComplete = _sc;
  out.dawnMul = (() => { window._lxStoryComplete = () => true; const v = _lxDawnExpMul(); window._lxStoryComplete = _sc; return v; })();
  player.level = 45;
  // restore
  net.isHost = true; net.hostId = null; net.connected = false; net.peers = {};
  out.base = base;
  return out;
});
console.log(JSON.stringify(r));
ok('solo baseline kill sane', r.solo > 0, r.solo);
ok('kill with nearby ally = exactly 2x solo', r.withAlly === r.solo * 2, `${r.withAlly} vs 2x${r.solo}`);
// v0.30.923 (bb8fe7e4): EXP is raw again - the guest share drops the band, the monster knob and the x1.35 curve,
// so the share is the host's e times the guest's own multipliers (prestige/difficulty/affix/ladder; 1 on this save).
ok('guest multipliers neutral on this save', r.mult === 1, r.mult);
ok('a kill of a monster never mirrored pays nothing (v0.30.862)', r.shareUnmirrored === 0, r.shareUnmirrored);
const expNear = Math.floor(100 * r.mult * 2);
const expFar  = Math.floor(100 * r.mult * 1);
ok('ally-kill share near = x2 share', r.shareNear === expNear, `${r.shareNear} vs ${expNear}`);
ok('ally-kill share far (same map) = base share', r.shareFar === expFar, `${r.shareFar} vs ${expFar}`);
ok('near share is exactly double far share', r.shareNear === r.shareFar * 2);
// bughunt guest-dealt (parityB-3)
ok('level-gap falloff for Lv70 vs Lv10 is x0.15', Math.abs(r.gapMul - 0.15) < 1e-9, r.gapMul);
ok('a Lv70 guest on a Lv10 mirror: near share = floor(100 x 2 x 0.15) (was 200)', r.gapNear === Math.floor(100 * r.mult * 2 * 0.15), `${r.gapNear} vs ${Math.floor(100 * r.mult * 2 * 0.15)}`);
ok('Dawn\'s Favor (+10%) after the story reaches the guest share', Math.abs(r.dawnMul - 1.1) < 1e-9 && r.gapNearDawn === Math.floor(100 * r.mult * 2 * 0.15 * 1.1), `${r.gapNearDawn} vs ${Math.floor(100 * r.mult * 2 * 0.15 * 1.1)}`);
ok('no page errors', errs.length === 0, errs.join(' | '));
await b.close();
const fails = R.filter(x => !x).length;
console.log(`\n${R.length - fails}/${R.length} checks passed`);
process.exit(fails ? 1 : 0);
