// v0.30.468 — the Sovereign's Crown Shards and homing volley use their OWN art.
// Guards the exact regression the user reported: a pink bee orbiting the apex
// boss, and a homer sharing Aetherion's/Pisces' dark orb.
//   node scripts/sovereign_regalia_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 11171);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const bad = [];
page.on('response', (r) => { if (r.status() >= 400 && /sovCrownShard|msovereign/.test(r.url())) bad.push(r.status() + ' ' + r.url()); });
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'Sov');
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*warrior\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);

const r = await page.evaluate(async () => {
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const out = [];
  const ok = (n, c, extra) => out.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 150) });
  window._prologueActive = false; player.level = 90; player._god = true;

  // ---- the type exists, is inert, and is out of the dex ----
  const t = monsterTypes.sovCrownShard;
  ok('sovCrownShard is a real type', !!t, t && t.name);
  ok('it is a pure objective (no dmg, no reward)', t && t.atk === 0 && t.exp === 0 && t.mojicoins === 0, t && `atk${t.atk} exp${t.exp} coin${t.mojicoins}`);
  ok('it is hidden from the Mojidex', !_mjxAllTypes().includes('sovCrownShard'));
  ok('sparkling is untouched and still in the dex', !!monsterTypes.sparkling && _mjxAllTypes().includes('sparkling'));

  // ---- its art resolves (static + 9 idle frames) ----
  loadMap('forest'); await wait(1200); game.paused = false;
  _monsterFramesFor('sovCrownShard');
  await wait(2500);
  const set = _monsterFramesFor('sovCrownShard');
  const idle = (set && set.idle) || [];
  ok('crown shard has 9 idle frames', idle.length === 9, idle.length + ' frames');
  ok('every crown frame decoded', idle.length === 9 && idle.every((im) => im && im.naturalWidth > 0),
     idle.map((im) => im && im.naturalWidth).join(','));
  const cs = MONSTER_SPRITES.sovCrownShard;
  ok('crown static decoded', !!(cs && cs.naturalWidth > 0), cs ? ('nw ' + cs.naturalWidth + ' ' + (cs.src||'').split('/').pop()) : 'MONSTER_SPRITES.sovCrownShard is undefined');
  ok('crown art is NOT the sparkling bee', !!cs && cs !== MONSTER_SPRITES.sparkling && (cs.src || '').includes('sovCrownShard'),
     cs ? (cs.src||'').split('/').pop() : 'n/a');

  // ---- the homer's art resolves and is its own ----
  ok('homer key is registered for frames', typeof _PROJ_ANIM_KEYS !== 'undefined' && _PROJ_ANIM_KEYS.has('msovereign'));
  const hs = (typeof LX_MOB_PROJ !== 'undefined') ? LX_MOB_PROJ.msovereign : null;
  ok('homer static is registered', !!hs, hs ? ((hs.src||'obj').split('/').pop()) : 'LX_MOB_PROJ.msovereign is undefined');
  ok('homer is not the shared mdark', !!hs && hs !== LX_MOB_PROJ.mdark);
  ok('mdark still exists for Aetherion + Pisces', !!LX_MOB_PROJ.mdark);

  // ---- the live fight: shards spawn as the new type, volley uses the new key ----
  loadMap('tower_b10'); await wait(1600); game.paused = false;
  let sov = (game.monsters || []).find((m) => m.type === 'towerSovereign');
  if (!sov) { try { sov = spawnMonster(700, 300, 'towerSovereign', true, false); } catch (e) {} await wait(600); }
  if (!sov) { ok('Sovereign present', false); return out; }
  sov._expeditionFinalBoss = true;
  sov.maxHp = 5e7; sov.currentHp = sov.maxHp;
  sov.aggro = true; sov.aggroTarget = player;
  player.x = sov.x - 160; player.y = sov.y; player.hp = getMaxHp();
  // force the regalia raise and the volley on the next tick
  sov._sovRegaliaAt = 0; sov._sovereignHomingAt = 0;
  const t0 = game.time | 0;
  for (let i = 0; i < 240 && ((game.monsters || []).every((m) => m.type !== 'sovCrownShard')); i++) {
    player.hp = getMaxHp(); game.paused = false; await wait(30);
  }
  const shards = (game.monsters || []).filter((m) => m.type === 'sovCrownShard');
  ok('Regalia spawns Crown Shards of the new type', shards.length >= 4, shards.length + ' shards');
  ok('no sparkling bee was summoned', (game.monsters || []).every((m) => m.type !== 'sparkling'));
  ok('shards are tagged to the Sovereign', shards.every((q) => q._sovShardOf === sov));
  // volley
  sov._sovShielded = false; sov._sovExposedUntil = 0; sov._sovSpentUntil = 0;
  sov._sovereignHomingAt = 0;
  for (let i = 0; i < 200 && !(game.projectiles || []).some((p) => p.skill === 'msovereign'); i++) {
    sov._sovShielded = false; sov._sovereignHomingAt = 0;
    player.hp = getMaxHp(); game.paused = false; await wait(30);
  }
  const mine = (game.projectiles || []).filter((p) => p.skill === 'msovereign');
  ok('the volley fires msovereign projectiles', mine.length >= 3, mine.length + ' in flight');
  ok('the volley no longer fires mdark', !(game.projectiles || []).some((p) => p.skill === 'mdark' && p._sourceLabel === 'a Sovereign Homer'));
  return out;
});
await browser.close(); server.kill();
let fails = 0;
for (const x of r) { console.log((x.pass ? 'PASS ' : 'FAIL ') + x.n + (x.extra ? '  [' + x.extra + ']' : '')); if (!x.pass) fails++; }
if (bad.length) { console.log('FAIL failed asset requests:'); for (const b of bad) console.log('   ' + b); fails++; }
else console.log('PASS no 404 for sovCrownShard / msovereign art');
console.log(`${r.length + 1 - fails}/${r.length + 1} passed`);
process.exit(fails ? 1 : 0);
