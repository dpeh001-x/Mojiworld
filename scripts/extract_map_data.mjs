// Extracts per-map data from the live game (MAPS + _wmComputePositions +
// _WM_BIOME_ICON) so the standalone tools/map_editor.html can offer a real map
// dropdown and a W-key world-map switcher with the game's own node layout.
// Writes scripts/map_data.json (consumed by the embed step below).
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import { writeFileSync } from 'fs';
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
const URL = 'file:///home/user/Mojiworld/mojiworld_game.html';

const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
try {
  const page = await browser.newContext().then(c => c.newPage());
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof MAPS === 'object' && typeof _wmComputePositions === 'function' && typeof _WM_BIOME_ICON === 'object', null, { timeout: 30000 });

  const data = await page.evaluate(() => {
    const clean = (o) => {   // shallow → plain primitives only, drop _-keys/functions/undefined
      const out = {};
      for (const k in o) {
        if (k[0] === '_') continue;
        const v = o[k];
        const t = typeof v;
        if (v === undefined || t === 'function' || t === 'object') continue;
        out[k] = v;
      }
      return out;
    };
    const groundOf = (m) => {
      const plats = m.platforms || [];
      let best = null;
      for (const p of plats) { if (p.type === 'ground' && (!best || p.w > best.w)) best = p; }
      if (best) return best.y;
      // else: lowest platform top
      let y = 480; for (const p of plats) if (typeof p.y === 'number') y = Math.max(y, p.y);
      return y;
    };
    let positions = {}, W = 1200, H = 750;
    try { const r = _wmComputePositions(); positions = r.positions; W = r.W; H = r.H; } catch (e) {}
    const maps = {};
    for (const id in MAPS) {
      const m = MAPS[id];
      const pos = positions[id];
      maps[id] = {
        id,
        name: m.name || id,
        worldWidth: m.worldWidth || 1600,
        worldHeight: m.worldHeight || 560,   // tall/underwater maps scroll vertically in-game
        groundY: groundOf(m),
        levelReq: m.levelReq || 0,
        icon: _WM_BIOME_ICON[id] || '📍',
        isVoid: !!m.isVoid,
        wm: pos ? { x: Math.round(pos.x), y: Math.round(pos.y), tier: pos.tier || '' } : null,
        platforms: (m.platforms || []).map(clean),
        npcs: (m.npcs || []).map(clean),
        portals: (m.portals || []).map(clean),
      };
    }
    return { W, H, count: Object.keys(maps).length, maps };
  });

  writeFileSync('scripts/map_data.json', JSON.stringify(data));
  const withNode = Object.values(data.maps).filter(m => m.wm).length;
  console.log('maps:', data.count, '| on W-map:', withNode, '| viewBox:', data.W + 'x' + data.H);
  // spot-check town
  const t = data.maps.town;
  console.log('town:', t.npcs.length, 'npcs,', t.portals.length, 'portals, ground', t.groundY, 'wm', JSON.stringify(t.wm));
} finally { await browser.close(); }
