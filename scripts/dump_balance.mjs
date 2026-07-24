// Dump the live balance dataset (mob levels/stats, map rosters, portal graph)
// from mojiworld_game.html via headless Chromium.
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';

const GAME = 'file:///home/user/Mojiworld/mojiworld_game.html';
const OUT = process.argv[2] || '/tmp/claude-0/-home-user-Mojiworld/3c64728e-ba49-5082-af88-e733867e39b2/scratchpad/balance.json';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
page.on('pageerror', e => console.error('pageerror:', String(e).slice(0, 200)));
await page.goto(GAME, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => typeof monsterTypes === 'object' && typeof MAPS === 'object' && typeof MOB_NATURAL_LEVEL === 'object', null, { timeout: 60000 });

const data = await page.evaluate(() => {
  const mobs = {};
  for (const [k, t] of Object.entries(monsterTypes)) {
    mobs[k] = {
      name: t.name, hp: t.hp, atk: t.atk, def: t.def || 0,
      exp: t.exp || 0, mojicoins: t.mojicoins || 0,
      level: t.level, natural: (MOB_NATURAL_LEVEL[k] !== undefined) ? MOB_NATURAL_LEVEL[k] : null,
    };
  }
  const mapOut = {};
  for (const [id, m] of Object.entries(MAPS)) {
    mapOut[id] = {
      name: m.name, levelReq: m.levelReq || null,
      mobStatMul: m.mobStatMul || 1,
      isBossArena: !!m.isBossArena,
      bossType: m.bossType || null,
      spawns: (m.spawns || []).map(s => ({ type: s.type, count: s.count })),
      portals: (m.portals || []).map(p => p.dest || p.to || p.map || null).filter(Boolean),
    };
  }
  return { mobs, maps: mapOut };
});

writeFileSync(OUT, JSON.stringify(data, null, 1));
console.log('mobs:', Object.keys(data.mobs).length, 'maps:', Object.keys(data.maps).length);
console.log('wrote', OUT);
await browser.close();
