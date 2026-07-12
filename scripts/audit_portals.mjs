// Audit: for every MAPS entry, flag portals a standing player can never
// trigger. tryPortal fires when |playerCenterX - po.x| < 50 AND
// |playerFeetY - portalY| < 100 (portalY = po.y ?? map ground line). So a
// portal is REACHABLE only if some platform/ground top is within that window
// horizontally and vertically.
import { chromium } from 'playwright-core';
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = 'http://localhost:8765/mojiworld_game.html';
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
const page = await (await b.newContext()).newPage();
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('#lo-menu', { state: 'visible', timeout: 90000 });
const report = await page.evaluate(() => {
  const out = [];
  for (const id of Object.keys(MAPS)) {
    const md = MAPS[id];
    if (!md || !Array.isArray(md.portals) || !md.portals.length) continue;
    const plats = md.platforms || [];
    const ground = plats.find(p => p.type === 'ground');
    const groundY = ground ? ground.y : 480;
    for (const po of md.portals) {
      const py = (typeof po.y === 'number') ? po.y : groundY;
      const px = po.x || 0;
      // reachable if ANY platform top is in the trigger window at this x
      const hit = plats.some(p =>
        (px + 50 > p.x) && (px - 50 < p.x + p.w) &&      // horizontal overlap of trigger band
        Math.abs(p.y - py) < 100                          // feet-on-top within vertical window
      );
      if (!hit) {
        // nearest platform for a suggested fix
        let best = null, bd = 1e9;
        for (const p of plats) {
          const cx = Math.max(p.x, Math.min(px, p.x + p.w));
          const d = Math.hypot(cx - px, p.y - py);
          if (d < bd) { bd = d; best = p; }
        }
        out.push({
          map: id, name: md.name, dest: po.dest, portal: { x: px, y: (typeof po.y === 'number') ? po.y : null, resolvedY: py },
          tall: !!(md.isVerticalTower || md.isUnderwater || (md.worldHeight && md.worldHeight > 700)),
          nearest: best ? { x: best.x, y: best.y, w: best.w, type: best.type, dist: Math.round(bd) } : null,
        });
      }
    }
  }
  return out;
});
console.log('UNREACHABLE PORTALS:', report.length);
for (const r of report) {
  console.log(`- ${r.map} (${r.name})  -> ${r.dest}   portal x=${r.portal.x} y=${r.portal.y === null ? '(ground ' + r.portal.resolvedY + ')' : r.portal.y}  tall=${r.tall}  nearest plat: ${r.nearest ? `x=${r.nearest.x} y=${r.nearest.y} w=${r.nearest.w} (${r.nearest.dist}px away)` : 'NONE'}`);
}
await b.close();
