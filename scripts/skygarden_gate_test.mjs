// Live test: SKY GARDEN IS SEALED UNTIL LV 15.
//
// Per user: "For sky garden can you add a level gate of 15 to enter".
// Both ways in have to hold - walking through a portal and W-map fast travel -
// and nothing else in the world may change.
//   node scripts/skygarden_gate_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const net_ = await import('node:net');
const free = (p) => new Promise((r) => { const s = net_.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof MAPS !== 'undefined' && MAPS.skyGarden && typeof tryPortal === 'function',
  null, { timeout: 120000 });

const r = await page.evaluate(() => {
  const out = {};
  const into = [];
  for (const [k, m] of Object.entries(MAPS))
    for (const p of (m.portals || []))
      if (p.dest === 'skyGarden') into.push({ from: k, x: p.x, y: p.y, name: p.name, gate: p.levelGate || 0 });
  out.into = into;
  out.exits = (MAPS.skyGarden.portals || []).map(p => ({ to: p.dest, gate: p.levelGate || 0 }));
  out.levelReq = MAPS.skyGarden.levelReq;
  out.wmGate = (typeof _wmMaxLevelGate === 'function') ? _wmMaxLevelGate('skyGarden') : null;
  // every OTHER gate in the world, so this change cannot have leaked
  out.otherGates = Object.entries(MAPS).flatMap(([k, m]) => (m.portals || [])
    .filter(p => p.levelGate && p.dest !== 'skyGarden')
    .map(p => `${k}>${p.dest}:${p.levelGate}`)).sort();

  // ---- walk into it for real, at Lv 14 and at Lv 15 ----
  const ent = into[0];
  const walk = (lv) => {
    player.level = lv;
    game.paused = false;
    loadMap(ent.from);
    const py = (typeof ent.y === 'number') ? ent.y : null;
    player.x = ent.x - player.w / 2;
    if (py != null) player.y = py - player.h; else {
      // put the feet exactly on whatever tryPortal treats as the ground there
      const gy = (typeof _defaultPortalY === 'function') ? _defaultPortalY(ent.x) : (game.mapData.groundY || 480);
      player.y = gy - player.h;
    }
    const before = game.currentMap;
    let toast = '';
    const realToast = window.showToast;
    window.showToast = (t) => { toast = String(t); };
    try { tryPortal(); } finally { window.showToast = realToast; }
    return { before, after: game.currentMap, toast };
  };
  out.at14 = walk(14);
  out.at15 = walk(15);
  // and back out again from inside, at a level below the gate
  player.level = 8;
  const exit = (MAPS.skyGarden.portals || [])[0];
  loadMap('skyGarden');
  player.x = exit.x - player.w / 2;
  const egy = (typeof _defaultPortalY === 'function') ? _defaultPortalY(exit.x) : (game.mapData.groundY || 480);
  player.y = (typeof exit.y === 'number' ? exit.y : egy) - player.h;
  const eBefore = game.currentMap; tryPortal();
  out.exitAt8 = { before: eBefore, after: game.currentMap, to: exit.to || exit.dest };
  return out;
});

ok('every way in carries the Lv 15 gate',
  r.into.length > 0 && r.into.every(p => p.gate === 15),
  { entrances: r.into.map(p => `${p.from} (Lv ${p.gate})`) });
ok('...and each one says so on the portal label',
  r.into.every(p => /Lv\s*15\+/.test(p.name || '')), { names: r.into.map(p => p.name) });
ok('W-map fast travel reads the same gate (no walk-in bypass)', r.wmGate === 15, { wmGate: r.wmGate });
ok('the map keeps levelReq 15 through the sweep, so the W-map label is honest',
  r.levelReq === 15, { levelReq: r.levelReq });
ok('at Lv 14 the portal refuses and the player stays put',
  r.at14.after === r.at14.before && /Sealed/i.test(r.at14.toast), r.at14);
ok('at Lv 15 the portal lets you through', r.at15.after === 'skyGarden', r.at15);
ok('getting OUT is never gated - a low-level player inside can always leave',
  r.exits.every(p => p.gate === 0) && r.exitAt8.after !== 'skyGarden', { exits: r.exits, walked: r.exitAt8 });
ok('no other portal gate in the world changed',
  r.otherGates.length >= 8 && !r.otherGates.some(s => /skyGarden/.test(s)),
  { count: r.otherGates.length, sample: r.otherGates.slice(0, 4) });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
await b.close(); srv.kill();
process.exit(results.every(q => q.pass) ? 0 : 1);
