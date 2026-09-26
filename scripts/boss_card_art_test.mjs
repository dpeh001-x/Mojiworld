// The boss card shows a zodiac boss even after his idle frames are baked; a failed art load is not remembered for the
// session; the Warlord's Banner text matches what it gives; the whole NPC name plate takes a click.
// Per the 2026-09-26 full audit.
//  - _lxBiSprite returned null for a zodiac sign whose idle set had been right-sized (a canvas has no .src), so the card
//    fell back to the glyph - on most zodiac fights, since the arena prewarm bakes the set before the card plays.
//  - _lxBiBox cached a failed load (null) under its URL for good.
//  - Warlord's Banner said "+85% ATK" (War Cry 0.55 + Bloodlust 0.30); getAtk caps self-buffs at +80% (v0.30.1047).
//  - v0.30.1113 cut the NPC click box off 12 px below the feet; the name plate is drawn from feet + 6 to + 23.
//   node scripts/boss_card_art_test.mjs [page] [port]
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require2 = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require2('playwright-core');
const PORT = String(process.argv[3] || 9994);
const env = { ...process.env }; if (process.argv[2]) env.MOJI_GAME_FILE = process.argv[2];
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
const b = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const page = await (await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof _lxBiSprite === 'function' && typeof ZODIAC_IDLE_FRAMES !== 'undefined', null, { timeout: 180000 });
await page.waitForTimeout(6000);
const R = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((z) => setTimeout(z, ms));
  window._lxBootGateDone = true; window._prologueActive = false;
  for (const id of ['loading-overlay', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  player.cls = player.cls || 'warrior'; player.level = 60; player._god = true; player.invulnerable = 9e9;
  player._storyBeatsSeen = player._storyBeatsSeen || {}; if (typeof STORY_BEATS === 'object') for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true;
  player._storyBeatsSeen.everdawn_welcome = true; player._tutorialSeen = true;
  loadMap('town'); game.paused = false; await sleep(1500);
  const out = {};
  // 1. a zodiac card with its idle set baked (complete + naturalWidth + _lxSrc: what _lxShrinkFrames' bake looks like)
  const set = ZODIAC_IDLE_FRAMES.leo || [];
  for (let i = 0; i < 200 && !(set[0] && set[0].complete && set[0].naturalWidth > 0); i++) await sleep(100);
  for (let i = 0; i < set.length; i++) { const im = set[i]; if (im && im.tagName === 'IMG' && im.naturalWidth > 0) { const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64; cv.complete = true; cv.naturalWidth = 64; cv.naturalHeight = 64; cv._lxSrc = im; set[i] = cv; } }
  const spr = _lxBiSprite('zodiac_leo');
  out.lookup = { baked: set.length > 0 && set.every((x) => x && x.tagName === 'CANVAS'), got: !!spr, src: spr && spr.src ? spr.src.split('/').slice(-2).join('/') : null };
  _playBossIntro('zodiac_leo');
  const ov = document.getElementById('boss-intro-overlay');
  for (let i = 0; i < 60 && !(ov.querySelector('.bi-art.bi-in') || ov.classList.contains('bi-noart')); i++) await sleep(100);
  out.card = { noart: ov.classList.contains('bi-noart'), artIn: !!ov.querySelector('.bi-art.bi-in') };
  try { _dismissBossIntro(); } catch (e) {} await sleep(300); game.paused = false;
  // 2. a failed load is not remembered
  const bad = new Image(); bad.src = 'Sprites/bosses/__nope__.webp';
  out.failed = await new Promise((res) => _lxBiBox(bad, (bx) => res({ box: bx, cached: _LX_BI_BOX.has(bad.src) })));
  // 3. the Warlord's Banner text vs getAtk
  const sk = (typeof SKILLS === 'object' && SKILLS.warlord_warcry) || null;
  player.buffs = player.buffs || {}; player.buffs.warCry = 0; player.buffs.bloodlust = 0; player._equipBonusCache = null;
  const a0 = getAtk(); player.buffs.warCry = 5000; const aW = getAtk(); player.buffs.bloodlust = 5000; const a1 = getAtk(); player.buffs.warCry = 0; player.buffs.bloodlust = 0;
  const said = sk && (sk.desc.match(/Bloodlust \(\+(\d+)% ATK/) || [])[1];
  // the % applies to part of ATK, so read the scale off War Cry alone (+55%) and express both buffs in the tooltip's terms
  const k = ((aW / a0) - 1) / 0.55;
  out.banner = { said: said ? +said : null, gives: Math.round(((a1 / a0) - 1) / k * 100), raw: +((a1 / a0 - 1) * 100).toFixed(1) };
  return out;
});
// 4. click the LOWER half of an NPC's name plate
const P = await page.evaluate(async () => {
  const npc = (game.npcs || []).find((n) => n && n.role && Math.abs((n.x + 20) - (player.x + player.w / 2)) < 2000);
  if (!npc) return { err: 'no npc' };
  player.x = npc.x - 120; player.vx = 0;
  await new Promise((z) => setTimeout(z, 1200));
  try { closeAllModals(); } catch (e) {} game.paused = false;
  const cv = document.getElementById('game-canvas') || document.querySelector('canvas'); const rc = cv.getBoundingClientRect();
  const wx = npc.x + (npc.w || 40) / 2, wy = npc.y + 44 + 18;   // 18 px under the feet: the plate's lower half
  return { name: npc.name, sx: rc.left + (wx - game.camera.x) * rc.width / W, sy: rc.top + (wy - game.camera.y) * rc.height / H };
});
if (!P.err) { await page.mouse.click(P.sx, P.sy); await page.waitForTimeout(600); }
const clicked = P.err ? P : await page.evaluate(() => { const d = document.getElementById('dialog'); return { opened: !!(d && d.style.display === 'block'), who: (document.getElementById('dialog-name') || {}).textContent || '' }; });
await b.close(); srv.kill();
let pass = 0, fail = 0;
const ok = (c, n, d) => { console.log((c ? 'PASS  ' : 'FAIL  ') + n + (d !== undefined ? '  ' + JSON.stringify(d) : '')); c ? pass++ : fail++; };
ok(R.lookup.baked && R.lookup.got && R.lookup.src, 'the card finds a zodiac boss\'s art after his idle set is baked', R.lookup);
ok(!R.card.noart && R.card.artIn, '...and the card shows him, not the fallback glyph', R.card);
ok(R.failed.box === null && !R.failed.cached, 'a failed art load is not remembered for the session', R.failed);
ok(R.banner.said != null && Math.abs(R.banner.said - R.banner.gives) <= 1.5,   // +-1.5: the flat part of ATK rounds the scale
   'Warlord\'s Banner says what it gives (War Cry + Bloodlust vs the self-buff cap)', R.banner);
ok(clicked.opened, 'a click on the lower half of an NPC\'s name plate opens their dialog', { ...clicked, npc: P.name });
ok(errs.length === 0, 'no page errors', errs.slice(0, 3));
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
