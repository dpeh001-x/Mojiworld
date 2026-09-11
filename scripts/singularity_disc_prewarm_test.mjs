// The Singularity's painted accretion disc is decoded before the fight, not during the boss
// intro. Per user: "somehow this ugly procedural art is back instead of this nicer purple art".
//   node scripts/singularity_disc_prewarm_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 11265);
const checks = [];
const html = readFileSync(path.join(ROOT, PAGE), 'utf8');
checks.push(['loadMap asks for the disc', /_lxPrewarmSingularityDisc\(id\)/.test(html)]);

const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.fill('#hero-name-input', 'Disc'); await page.click('#cs-nav-next').catch(() => {}); await page.waitForTimeout(800);
await page.evaluate(() => { const c = document.querySelector('#class-options .class-card'); if (c) c.click(); });
await page.waitForTimeout(1500);
const r = await page.evaluate(async () => {
  const wait = (ms) => new Promise((x) => setTimeout(x, ms));
  const out = {};
  // the map that leads in: the first map with a portal to the arena
  const lead = Object.keys(MAPS).find((id) => Array.isArray(MAPS[id].portals) && MAPS[id].portals.some((po) => po && po.dest === 'gravitosArena'));
  out.lead = lead || null;
  if (lead) {
    loadMap(lead); await wait(50);
    out.requestedOnLead = !!(FX_ANIM_FRAMES && FX_ANIM_FRAMES.singularity && FX_ANIM_FRAMES.singularity.length);
    // give the lead map the time a walk to the portal takes
    await wait(6000);
    out.decodedOnLead = (FX_ANIM_FRAMES.singularity || []).filter((f) => f && f.complete && f.naturalWidth > 0).length;
  }
  // a cold arena load, no lead: the disc must still be requested at load, before any draw
  FX_ANIM_FRAMES.singularity = undefined; if (typeof _LX_GF !== 'undefined') _LX_GF.discImg = null;
  const t0 = performance.now(); loadMap('gravitosArena');
  out.requestedOnArenaLoad = !!(FX_ANIM_FRAMES.singularity && FX_ANIM_FRAMES.singularity.length);
  out.staticRequested = !!(_LX_GF && _LX_GF.discImg);
  let firstArt = null;
  for (let i = 0; i < 80; i++) { if (_lxGfDiscArt()) { firstArt = Math.round(performance.now() - t0); break; } await wait(100); }
  out.msToArt = firstArt;
  return out;
});
await browser.close(); server.kill();
console.log(JSON.stringify(r));
checks.push(['a map leads into the arena', !!r.lead, String(r.lead)]);
checks.push(['loading the map that leads in requests the disc loop straight away', r.requestedOnLead === true]);
checks.push(['by the time a player has crossed that map, the loop is decoded', r.decodedOnLead >= 16, `${r.decodedOnLead}/16 after 6 s`]);
checks.push(['a cold arena load requests the loop and the static at load time, before any draw', r.requestedOnArenaLoad === true && r.staticRequested === true]);
checks.push(['painted art is available within the cinematic\'s first seconds even on a cold load', r.msToArt !== null && r.msToArt <= 8000, `${r.msToArt} ms`]);
checks.push(['no page errors', errs.length === 0, errs.slice(0, 2).join(' | ')]);
let fails = 0;
for (const [n, ok, extra] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra ? '  [' + extra + ']' : '')); if (!ok) fails++; }
console.log(`${checks.length - fails}/${checks.length} passed`);
process.exit(fails ? 1 : 0);
