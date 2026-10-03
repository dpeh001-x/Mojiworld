// BAKE THE PLATFORM TINT PER MAP, from the game's OWN sampler.
// ============================================================================
// _mapPlatformTint() infers a map's platform colours from its backdrop by drawing the
// background into a 48x48 scratch canvas and reading it back (_lxDominantColor). That
// readback is a GPU->CPU sync stall on a texture that was uploaded microseconds earlier,
// and it lands on the FIRST DRAWN FRAME of every map: profiled at 39-67 ms per transition
// (town 67, mushroom 61, cryptHollow 48, coralReef 39), the dominant cost in a 120-290 ms
// map-change freeze.
//
// The function already short-circuits on an authored tint - "an authored map is correct on
// its FIRST frame and cannot flicker through a fallback while the art downloads". So the fix
// is to author every map's tint. Rather than eyeball 100+ colours, this generator drives the
// REAL GAME headlessly, lets its own sampler run, and dumps the resulting cache. The baked
// values are therefore identical to what the sampler would have produced, by construction -
// this cannot change how anything looks.
//   node scripts/gen_map_platform_tint.mjs            # write data/map_platform_tint.js
//   node scripts/gen_map_platform_tint.mjs --check    # exit 1 if the table is stale/missing
import { chromium } from 'playwright-core'; import { existsSync, writeFileSync, readFileSync, renameSync } from 'node:fs';
import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import net from 'node:net';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data', 'map_platform_tint.js');
const CHECK = process.argv.includes('--check');
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const free = (p) => new Promise((r) => { const s = net.createServer(); s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT; for (let p = 8961; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env: { ...process.env, MOJI_GAME_FILE: process.env.MOJI_GAME_FILE || '' } });
await new Promise((r) => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof MAPS === 'object' && typeof loadMap === 'function' && typeof _mapPlatformTint === 'function', null, { timeout: 180000 });
await page.evaluate(() => new Promise((res) => { let n = 0; const t = () => { window._lxBootGateDone = true; try { _prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const o = document.getElementById(id); if (o) o.style.display = 'none'; } const c = document.querySelector('.cls-card'); if (c) c.click(); if (++n > 150) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); }));
await page.waitForTimeout(1500);
const baked = await page.evaluate(async () => {
  const out = {}; const ids = Object.keys(MAPS);
  // sample, do not echo: _mapPlatformTint answers from the baked table before it samples, so with the table loaded every run
  // wrote the old values back and --check passed in a loop (the Bone Graveyard kept the blue of a backdrop it no longer has)
  window.LX_MAP_PLATFORM_TINT = {}; for (const k of Object.keys(_MAP_PLATFORM_TINT_CACHE)) delete _MAP_PLATFORM_TINT_CACHE[k];
  try { _lxBootHold.release('menu'); } catch (e) {}   // held plates download only once the boot hold lets go
  // the level-1 hero gets killed by a map's monsters and respawns in the void, and the next maps were read from there - each run
  // lost a different few (Lava Cavern and Bubble Grotto in one, the Bastion throne room and Expedition floor 8 in another), so
  // --check flapped: keep the hero up and the maps empty
  try { player._god = true; player.invulnerable = 9e9; } catch (e) {}
  const settle = (n) => new Promise((res) => { let i = 0; const t = () => { game.paused = false; if (++i >= n) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
  for (const id of ids) {
    delete _MAP_PLATFORM_TINT_CACHE[id];
    try { loadMap(id); } catch (e) { continue; }
    try { game.monsters.length = 0; player.hp = player.maxHp; } catch (e) {}
    // ask for the map's own plate and wait for it, rather than hoping it decodes inside the settle loop's ~2 s
    { const bg = (MAPS[id] && MAPS[id].bg && typeof BG_IMAGES !== 'undefined') ? BG_IMAGES[MAPS[id].bg] : null;
      if (bg && !bg._loaded) { try { _lxWantImg(bg, true); } catch (e) {} for (let w = 0; w < 120 && !bg._loaded; w++) await new Promise((r) => setTimeout(r, 250)); } }
    // let the backdrop decode and the sampler run on a real drawn frame, then read the cache
    for (let tries = 0; tries < 40; tries++) { await settle(3); let hit = _MAP_PLATFORM_TINT_CACHE[id]; if (!(hit && hit.fromBg) && game.currentMap === id && game.mapData && !game.mapData.isVoid) { try { _mapPlatformTint(game.mapData); } catch (e) {} hit = _MAP_PLATFORM_TINT_CACHE[id]; } if (hit && hit.fromBg && hit.tint) { out[id] = { top: String(hit.tint.top), body: String(hit.tint.body) }; break; } }
  }
  return out;
});
await b.close(); srv.kill();
const ids = Object.keys(baked).sort();
console.log(`sampled ${ids.length} maps`);
if (!ids.length) { console.error('nothing sampled - the cache never resolved'); process.exit(2); }
const body = '{\n' + ids.map((k) => `  ${JSON.stringify(k)}: { "top": ${JSON.stringify(baked[k].top)}, "body": ${JSON.stringify(baked[k].body)} }`).join(',\n') + '\n}';
const text = `// GENERATED by scripts/gen_map_platform_tint.mjs - do not hand-edit.\n`
  + `// The platform tint each map's own backdrop sampler produces, baked so the game never has to\n`
  + `// read pixels back from a just-uploaded background texture on the first drawn frame of a map.\n`
  + `// That readback profiled at 39-67 ms per map change. Values come FROM the sampler, so the look\n`
  + `// is unchanged by construction. Re-run after changing a map's backdrop art or its sky stops\n`
  + `// (the run empties this table first, so it re-samples every map rather than reading these values back).\n`
  + `window.LX_MAP_PLATFORM_TINT = ${body};\n`;
if (CHECK) {
  const cur = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  if (cur.trim() !== text.trim()) { console.error(`STALE: ${OUT} differs - re-run without --check`); process.exit(1); }
  console.log(`${OUT} is up to date.`); process.exit(0);
}
writeFileSync(OUT + '.tmp', text); renameSync(OUT + '.tmp', OUT);
console.log(`wrote ${OUT} (${ids.length} maps)`);
