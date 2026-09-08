// Live test: ASCENSION AT 100 WITH GUGUMA, HEIRLOOM BOON, ASCENDANT EDICTS.
//   node scripts/ascension_rework_test.mjs   (MOJI_GAME_FILE overrides the build)
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import net from 'node:net';
import { spawn } from 'node:child_process';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const free = (p) => new Promise((r) => { const s = net.createServer(); s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2]; for (let p = 8961; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore', env: { ...process.env, MOJI_GAME_FILE: process.env.MOJI_GAME_FILE || '' } });
await new Promise((r) => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof offerPrestige === 'function' && typeof _gugumaAscendPrompt === 'function' && typeof spawnMonster === 'function', null, { timeout: 120000 });
await page.evaluate(() => new Promise((res) => { let n = 0; const t = () => { window._lxBootGateDone = true;
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  const c = document.querySelector('.cls-card'); if (c) c.click();
  const m = document.getElementById('class-select-modal'); if (m) m.style.display = 'none';
  if (++n > 150) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); }));
await page.waitForTimeout(1200);
const g = await page.evaluate(async () => {
  const out = {}; const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  try { loadMap('forest'); } catch (e) {} await wait(400);
  out.cap = PRESTIGE_LEVEL;
  // XP freezes at the cap
  // the freeze lives in _maybeLevelUp: at the cap it zeroes exp and returns
  player.level = 100; player.exp = 999999; player.expToNext = 100; try { _maybeLevelUp(); } catch (e) { out.gainErr = String(e).slice(0, 80); }
  out.frozen = player.level === 100 && player.exp === 0;
  // Guguma's chip with an heirloom picker
  player.boons = []; player.boonsEquipped = []; game.prestige = { count: 0, xpMult: 1, dmgMult: 1, bonusAP: 0 };
  acquirePowerup(POWERUPS[0]); acquirePowerup(POWERUPS[1]); const heirId = player.boons[0].id;
  game._prestigeOffered = false; _gugumaAscendPrompt(); await wait(100);
  const chip = document.getElementById('guguma-ascend');
  out.chip = !!chip && /Guguma/.test(chip.textContent) && !!chip.querySelector('#guguma-heirloom');
  out.heirOpts = chip ? chip.querySelectorAll('#guguma-heirloom option').length : 0;
  // choose the heirloom, ascend, confirm
  chip.querySelector('#guguma-heirloom').value = '0'; chip.querySelector('#guguma-heirloom').dispatchEvent(new Event('change'));
  chip.querySelector('#guguma-ascend-go').click(); await wait(250);
  const cm = document.getElementById('confirm-modal'); out.confirmTitle = (document.getElementById('confirm-title') || {}).textContent;
  out.confirmMentionsHeirloom = /HEIRLOOM/.test((document.getElementById('confirm-body') || {}).textContent || '');
  document.getElementById('confirm-yes').click(); await wait(500);
  out.afterLevel = player.level; out.count = game.prestige && game.prestige.count; out.boons = (player.boons || []).map(x => x.id); out.eq = (player.boonsEquipped || []).slice();
  out.chipGone = !document.getElementById('guguma-ascend');
  // Ascendant Edicts: locked at count 1 for Dry Run, Iron Foe unlocked
  out.edicts = EDICTS.filter(e => e.asc).map(e => e.id + ':' + e.asc);
  out.ironLocked = _edictLocked(EDICTS.find(e => e.id === 'ascIronFoe')); out.dryLocked = _edictLocked(EDICTS.find(e => e.id === 'ascDryRun'));
  game.prestige.count = 2; game.edicts = { ascDryRun: true, ascIronFoe: true };
  out.capWithDry = _boonCap();
  const hp0 = player.hp = 10; player.maxHp = 100; player.consumables = { hp_s: 5, mp_s: 5 };
  try { useQuickPotion('hp'); } catch (e) {} out.potionSealed = player.hp === hp0 && player.consumables.hp_s === 5;
  // base HP jitters per spawn, so compare the MEAN of eight spawns each way
  const meanHp = (n) => { let s = 0; for (let k = 0; k < n; k++) { game.monsters = []; spawnMonster(Math.round(player.x + 200 + k * 7), Math.round(player.y), 'slime', false); s += game.monsters[game.monsters.length - 1].maxHp; } return s / n; };
  game.edicts = {}; const hpOff = meanHp(8); game.edicts = { ascIronFoe: true }; const hpOn = meanHp(8);
  out.ironHp = Math.abs(hpOn / hpOff - 1.5) < 0.06 ? 1.5 : +(hpOn / hpOff).toFixed(3);
  game.edicts = {}; game.monsters = [];
  return out;
});
ok('PRESTIGE_LEVEL is 100 and XP freezes there', g.cap === 100 && g.frozen === true, { cap: g.cap, frozen: g.frozen, err: g.gainErr });
ok('at 100 Guguma\'s chip appears with an heirloom picker (none + equipped boons)', g.chip && g.heirOpts === 3, { chip: g.chip, opts: g.heirOpts });
ok('Ascend with Guguma opens the confirm, titled for her and naming the heirloom', /GUGUMA/.test(g.confirmTitle || '') && g.confirmMentionsHeirloom, { title: g.confirmTitle });
ok('confirming resets to Lv 1, counts the ascension, and the heirloom rides through equipped', g.afterLevel === 1 && g.count === 1 && g.boons.length === 1 && g.eq[0] === 0 && g.chipGone, { lv: g.afterLevel, count: g.count, boons: g.boons, eq: g.eq });
ok('two Ascendant Edicts exist; Iron Foe unlocks at 1, Dry Run stays locked at 1', g.edicts.length === 2 && g.ironLocked === false && g.dryLocked === true, { edicts: g.edicts, iron: g.ironLocked, dry: g.dryLocked });
ok('Dry Run: +1 boon slot and potions sealed', g.capWithDry === 4 && g.potionSealed === true, { cap: g.capWithDry, sealed: g.potionSealed });
ok('Iron Foe: enemies spawn with 1.5x HP', g.ironHp === 1.5, { ratio: g.ironHp });
ok('no page errors', errs.length === 0, { errs: errs.slice(0, 3) });
await b.close(); srv.kill();
let pass = 0; for (const t of results) { console.log((t.pass ? '  PASS  ' : '  FAIL  ') + t.n); if (!t.pass) console.log('        ' + JSON.stringify(t.x).slice(0, 360)); if (t.pass) pass++; }
console.log('\n' + pass + '/' + results.length + ' checks passed'); process.exit(pass === results.length ? 0 : 1);
