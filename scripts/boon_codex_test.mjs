// Live test: THE BOON CODEX - seen / held / synergies, milestones, the live cap.
//   node scripts/boon_codex_test.mjs   (MOJI_GAME_FILE overrides the build)
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
await page.waitForFunction(() => typeof _boonDex === 'function' && typeof acquirePowerup === 'function' && typeof POWERUPS !== 'undefined', null, { timeout: 120000 });
await page.evaluate(() => new Promise((res) => { let n = 0; const t = () => { window._lxBootGateDone = true;
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  const c = document.querySelector('.cls-card'); if (c) c.click();
  const m = document.getElementById('class-select-modal'); if (m) m.style.display = 'none';
  if (++n > 150) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); }));
await page.waitForTimeout(1200);
const g = await page.evaluate(async () => {
  const out = {}; const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  game.boonDex = undefined; player.boons = []; player.boonsEquipped = []; player.titles = {}; player.setshards = 0;
  out.cap0 = _boonCap();
  // acquire two boons -> held; synergy pair -> syn
  const syn = BOON_SYNERGIES[0]; const ids = syn.pair;
  acquirePowerup(POWERUPS.find(p => p.id === ids[0])); acquirePowerup(POWERUPS.find(p => p.id === ids[1]));
  _applyEquippedBoons(); if (typeof _detectActiveSynergies === 'function') _detectActiveSynergies();
  const d = _boonDex(); out.held = Object.keys(d.held).length; out.seenAfterHeld = Object.keys(d.seen).length; out.syn = !!d.syn[syn.key];
  // seen via the pick modal
  try { showPowerupChoice({}); await wait(200); } catch (e) { out.choiceErr = String(e).slice(0, 100); }
  out.seenAfterChoice = Object.keys(_boonDex().seen).length; try { closeAllModals(); } catch (e) {}
  // milestones: hold everything -> 50% pays coins+shards, 100% opens the slot + title
  const coins0 = player.mojicoins; for (const p of POWERUPS) _boonDexMark('held', p.id);
  out.ms = Object.keys(_boonDex().ms); out.shards = player.setshards; out.coinsUp = player.mojicoins > coins0; out.slotBonus = _boonDex().slotBonus; out.cap1 = _boonCap();
  out.title = !!(player.titles && player.titles['Boon Collector']);
  for (const s of BOON_SYNERGIES) _boonDexMark('syn', s.key); out.synTitle = !!(player.titles && player.titles['Synergist']);
  // achievement wired
  out.ach = !!ACHIEVEMENTS.find(a => a.id === 'boonCodex' && a.test());
  // panel renders the codex strip; persistence key listed
  // the boon panel renders into #lp-boons inside the level-up window; build that window first
  try { if (typeof openLevelUpPanel === 'function') openLevelUpPanel(); } catch (e) {}
  try { renderBoonPanel(); } catch (e) { out.panelErr = String(e).slice(0, 100); }
  const host = document.getElementById('lp-boons'); out.hostExists = !!host; out.panel = !!(host && /Boon Codex/.test(host.textContent));
  out.saved = GAME_SAVE_FIELDS.includes('boonDex') && _LX_SIGNED_GAME_KEYS.includes('boonDex');
  return out;
});
ok('cap starts at 3; acquiring boons marks them held (and seen)', g.cap0 === 3 && g.held === 2 && g.seenAfterHeld >= 2, g);
ok('equipping a synergy pair marks the synergy awakened', g.syn === true, { syn: g.syn });
ok('the pick modal marks its offers as seen', !g.choiceErr && g.seenAfterChoice >= 3, { seen: g.seenAfterChoice, err: g.choiceErr });
ok('50% held pays coins + 50 setshards; 100% held opens the Collector\'s Slot (cap 4) and the title', g.ms.includes('held50') && g.ms.includes('held100') && g.shards === 50 && g.coinsUp && g.slotBonus === 1 && g.cap1 === 4 && g.title, { ms: g.ms, shards: g.shards, cap: g.cap1 });
ok('all synergies award the Synergist title; the achievement fires', g.synTitle && g.ach, { synTitle: g.synTitle, ach: g.ach });
ok('the boon panel shows the codex strip; boonDex is saved and signed', g.panel && g.saved, { panel: g.panel, saved: g.saved });
ok('no page errors', errs.length === 0, { errs: errs.slice(0, 3) });
await b.close(); srv.kill();
let pass = 0; for (const t of results) { console.log((t.pass ? '  PASS  ' : '  FAIL  ') + t.n); if (!t.pass) console.log('        ' + JSON.stringify(t.x).slice(0, 360)); if (t.pass) pass++; }
console.log('\n' + pass + '/' + results.length + ' checks passed'); process.exit(pass === results.length ? 0 : 1);
