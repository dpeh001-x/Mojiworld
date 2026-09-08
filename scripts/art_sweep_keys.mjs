// Dump the runtime registries' keys so art on disk can be matched against what the game can reference.
import { chromium } from 'playwright-core'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn as _spawn } from 'node:child_process'; import { writeFileSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const _PORT = process.env.PERF_PORT || '9492';
const _srv = _spawn(process.execPath, [path.join(ROOT, 'serve.js'), _PORT], { stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--disable-background-timer-throttling'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('http://localhost:' + _PORT + '/mojiworld_game.html?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof monsterTypes === 'object', { timeout: 60000 });
await page.waitForTimeout(4000);
const r = await page.evaluate(() => {
  const keys = (n) => { try { const v = eval(n); return v ? Object.keys(v) : null; } catch (e) { return null; } };
  const out = {};
  for (const n of ['monsterTypes', 'MONSTER_SPRITES', 'BOSS_SPRITES', 'BOSS_ATTACK_FRAMES', 'BOSS_IDLE_FRAMES', 'BOSS_WALK_FRAMES', 'ZODIAC_SPRITES', 'NPC_SPRITE_FILES', '_NPC_SPRITES', 'LX_FX', 'LX_VFX', 'LX_SUMMON', 'LX_MOB_PROJ', 'LX_MOB_CAST', 'LX_PLAYER_PROJ', 'LX_BULT_PROJ', 'LX_ITEMS', 'LX_OBJECTS', 'LX_TILES', 'BG_IMAGES', 'LX_UI', 'LX_HAIR', 'LX_HEAD', 'LX_EYES', 'LX_MOUTH', 'MAPS']) out[n] = keys(n);
  try { out._PROJ_ANIM_KEYS = Array.from(_PROJ_ANIM_KEYS); } catch (e) {} try { out._FX_ANIM_KEYS = Array.from(_FX_ANIM_KEYS); } catch (e) {}
  // file names the registries actually point at (src of every Image in the light registries)
  const srcs = new Set(); const seen = new Set();
  const collect = (v, d) => { if (!v || d > 3 || seen.has(v)) return; if (v instanceof HTMLImageElement) { if (v.src) srcs.add(v.src.replace(/^.*?\/(Sprites|backgrounds|assets)\//, '$1/')); return; } if (typeof v !== 'object') return; seen.add(v); if (Array.isArray(v)) { for (const x of v) collect(x, d + 1); return; } for (const k in v) { try { collect(v[k], d + 1); } catch (e) {} } };
  for (const n of ['BG_IMAGES', 'LX_TILES', 'LX_WORLD', 'LX_FX', 'LX_VFX', 'LX_PLAYER_PROJ', 'LX_MOB_PROJ', 'LX_MOB_CAST', 'LX_SUMMON', 'LX_UI', 'LX_HAIR', 'LX_HEAD', 'LX_EYES', 'LX_MOUTH', 'BOSS_SPRITES', 'MONSTER_SPRITES', '_NPC_SPRITES', 'LX_OBJECTS', 'LX_ITEMS', 'LX_BULT_PROJ', 'LX_EQ_REGISTRIES', 'ZODIAC_SPRITES']) { try { collect(eval(n), 0); } catch (e) {} }
  out.registrySrcs = Array.from(srcs);
  // map bg keys actually used by maps
  try { out.mapBgs = Array.from(new Set(Object.values(MAPS).map((m) => m && m.bg).filter(Boolean))); } catch (e) {}
  try { out.mapSpawnTypes = Array.from(new Set(Object.values(MAPS).flatMap((m) => (m && m.spawns || []).map((s) => s && s.type)).filter(Boolean))); } catch (e) {}
  try { out.mapNpcs = Array.from(new Set(Object.values(MAPS).flatMap((m) => (m && m.npcs || []).map((n) => n && n.name)).filter(Boolean))); } catch (e) {}
  try { out.fliers = Object.keys(monsterTypes).filter((k) => monsterTypes[k] && (monsterTypes[k].flies === true || monsterTypes[k].floating === true || monsterTypes[k].hover === true)); } catch (e) {}
  try { out.bossKeys = Object.keys(monsterTypes).filter((k) => monsterTypes[k] && monsterTypes[k].isBoss); } catch (e) {}
  return out;
});
await browser.close(); try { _srv.kill(); } catch (e) {}
writeFileSync(process.argv[2], JSON.stringify(r));
console.log(Object.entries(r).map(([k, v]) => k + ':' + (v ? v.length : 'null')).join('  '));
