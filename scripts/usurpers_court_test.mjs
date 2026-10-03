// The Usurpers' Court (per user: "Make another distorted portal map, make it larger and grander, like from some kind of evil plot,
// ensure it is also in the world map, to include the 4 distorted captains to spawn as monsters in the map, this map should be before
// the confused vigil, after the fractured reflection"). In the running game:
//   - THE MAP: Lv 40, larger than every other Distorted Portal map, a fixed layout, a bridge
//   - THE CHAIN (after the Stage Editor bake): Fractured Reflection -> court -> Confused Vigil, and back, Lv 40 gates
//   - THE WORLD MAP: its pin 60+ px from every pin, and no lane of the court or the moved Vigil crosses another lane
//   - NO HOP ADDED: the Vigil stays one hop past the Reflection, the Forge one past the Vigil (_distMul scales by hops)
//   - THE FOUR CAPTAINS: Willeo, Harea, Lady Honk and Taiger all spawn, inside the map
//   - THE HALL: no ledge moved by the spacing pass, every ledge reachable (90 up / 120 across), the props on the floor and clear
//     of every ledge, the backdrop registered and decoded
//   node scripts/usurpers_court_test.mjs          (PORT / MOJI_SERVE_ROOT / MOJI_GAME_FILE override the served tree)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 10247); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const errs = [];
try {
  const page = await browser.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof MAPS === 'object' && MAPS.usurpersCourt, null, { timeout: 180000 }); await page.waitForTimeout(4000);
  const R = await page.evaluate(async () => {
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const o = document.getElementById(id); if (o) o.style.display = 'none'; }
    window._lxBootGateDone = true; window._prologueActive = false; player._god = true; player.invulnerable = 9e9; player._storyBeatsSeen = new Proxy({}, { get: () => true });
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {}, M = MAPS.usurpersCourt;
    out.map = { name: M.name, lvl: M.levelReq, ww: M.worldWidth, fixed: !!M.fixedLayout, bridge: !!M.bridge, others: ['distortedThreshold', 'fracturedReflection', 'confusedVigil'].map((k) => MAPS[k].worldWidth) };
    out.doors = {};
    for (const id of ['fracturedReflection', 'usurpersCourt', 'confusedVigil']) { loadMap(id, 300); await sleep(400); out.doors[id] = game.mapData.portals.map((p) => ({ dest: p.dest, x: p.x, gate: p.levelGate || 0 })); }
    const pins = {}; for (const [k, m] of Object.entries(MAPS)) if (m.wmX != null && m.wmY != null) pins[k] = [m.wmX, m.wmY];
    const lanes = [], seen = new Set();
    for (const [k, m] of Object.entries(MAPS)) for (const p of (m.portals || [])) { if (!pins[k] || !pins[p.dest]) continue; const s = [k, p.dest].sort().join('|'); if (!seen.has(s)) { seen.add(s); lanes.push([k, p.dest]); } }
    out.pins = pins; out.lanes = lanes;
    out.hops = Object.fromEntries(['fracturedReflection', 'usurpersCourt', 'confusedVigil', 'sundered_forge'].map((k) => [k, _townDistance(k)]));
    loadMap('usurpersCourt', 4040); await sleep(5000);
    const md = game.mapData;
    out.mobs = {}; for (const m of game.monsters || []) out.mobs[m.type] = (out.mobs[m.type] || 0) + 1;
    out.outside = (game.monsters || []).filter((m) => m.x < 0 || m.x > md.worldWidth || m.y > 600).length;
    out.moved = md.platforms.filter((p) => !M.platforms.some((a) => a.x === p.x && a.y === p.y && a.w === p.w)).length;
    const pl = md.platforms;
    out.unreachable = pl.filter((p) => p.type !== 'ground').filter((p) => !pl.some((q) => q !== p && q.y > p.y && q.y - p.y <= 90 && q.x < p.x + p.w + 120 && q.x + q.w > p.x - 120)).map((p) => p.x + ',' + p.y);
    out.props = [];
    for (const p of (MAP_PROPS.usurpersCourt || [])) {
      const im = LX_OBJECTS[p.key]; await new Promise((res) => { if (im.complete && im.naturalWidth) return res(); im.addEventListener('load', res); setTimeout(res, 15000); });
      const f = Math.max(0.7, Math.min(1.4, Math.max(im.naturalWidth, im.naturalHeight) / 512)), h = 80 * (p.scale || 1) * f, w = h * im.naturalWidth / im.naturalHeight;
      const top = _detectSpriteBboxTop(im), bot = _detectSpriteBboxBottom(im), sy = p.y - h * ((bot + 1) / im.naturalHeight) + 1, y0 = sy + h * (top / im.naturalHeight);
      const ground = pl.some((q) => q.type === 'ground' && p.x >= q.x + 40 && p.x <= q.x + q.w - 40 && Math.abs(q.y - p.y) <= 2);
      const hit = pl.some((q) => q.type !== 'ground' && q.x < p.x + w / 2 - 6 && q.x + q.w > p.x - w / 2 + 6 && q.y < p.y - 2 && q.y + (q.h || 12) > y0);
      out.props.push({ key: p.key, x: p.x, ground, hit, door: Math.min(...md.portals.map((d) => Math.abs(d.x - p.x))) });
    }
    let bg = null; try { bg = BG_IMAGES.usurpersCourt; } catch (e) {}
    if (bg && !(bg.complete && bg.naturalWidth)) await new Promise((res) => { bg.addEventListener('load', res); bg.addEventListener('error', res); setTimeout(res, 20000); });
    out.bg = bg ? { w: bg.naturalWidth, h: bg.naturalHeight } : null;
    return out;
  });
  const m = R.map;
  ok(`the court: "${m.name}", Lv ${m.lvl}, ${m.ww} px wide - larger than the chain's other maps (${m.others.join(' / ')}), a fixed layout, a bridge`,
    /Usurpers' Court/.test(m.name) && m.lvl === 40 && m.ww > Math.max(...m.others) && m.fixed && m.bridge);
  const d = R.doors, has = (id, dest) => d[id].find((p) => p.dest === dest);
  ok('the Fractured Reflection\'s deeper door opens on the court, Lv 40 gated (the bake places it)', !!has('fracturedReflection', 'usurpersCourt') && has('fracturedReflection', 'usurpersCourt').gate === 40 && !has('fracturedReflection', 'confusedVigil'), JSON.stringify(d.fracturedReflection));
  ok('the court: its deeper door (far west) to the Confused Vigil, its back door (far east) to the Fractured Reflection', !!has('usurpersCourt', 'confusedVigil') && has('usurpersCourt', 'confusedVigil').x < 300 && !!has('usurpersCourt', 'fracturedReflection') && has('usurpersCourt', 'fracturedReflection').x > 3900, JSON.stringify(d.usurpersCourt));
  ok('the Confused Vigil\'s back door returns to the court', !!has('confusedVigil', 'usurpersCourt') && !has('confusedVigil', 'fracturedReflection'), JSON.stringify(d.confusedVigil));
  const P = R.pins, near = Object.entries(P).filter(([k]) => k !== 'usurpersCourt').map(([k, v]) => [k, Math.hypot(v[0] - P.usurpersCourt[0], v[1] - P.usurpersCourt[1])]).sort((a, b) => a[1] - b[1])[0];
  ok('the world map: the court has a pin, 60+ px from every other pin', !!P.usurpersCourt && near[1] >= 60, `nearest ${near[0]} ${near[1].toFixed(0)}`);
  const X = (a, b, c, e) => { const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])); return o(a, b, c) !== o(a, b, e) && o(c, e, a) !== o(c, e, b); };
  const mine = R.lanes.filter((l) => l.includes('usurpersCourt') || l.includes('confusedVigil')), crosses = [];
  for (const l of mine) for (const o of R.lanes) if (o !== l && !o.some((k) => l.includes(k)) && X(P[l[0]], P[l[1]], P[o[0]], P[o[1]])) crosses.push(l.join('-') + ' x ' + o.join('-'));
  ok(`the world map: the court joins the Reflection and the Vigil, and none of their ${mine.length} lanes crosses another`, mine.some((l) => l.includes('fracturedReflection') && l.includes('usurpersCourt')) && mine.some((l) => l.includes('confusedVigil') && l.includes('usurpersCourt')) && !crosses.length, crosses.join(', '));
  const h = R.hops;
  ok('no hop added: the Vigil is still one past the Reflection and the Forge one past the Vigil; the court is no further than the Vigil', h.confusedVigil === h.fracturedReflection + 1 && h.sundered_forge === h.confusedVigil + 1 && h.usurpersCourt <= h.confusedVigil, JSON.stringify(h));
  ok('the four distorted captains spawn: Willeo, Harea, Lady Honk and Taiger, all inside the hall', ['willeo', 'harea', 'lady_honk', 'taiger'].every((t) => R.mobs[t] > 0) && R.outside === 0, JSON.stringify(R.mobs));
  ok('the hall: no ledge moved by the spacing pass, every ledge has a footing within 90 px up / 120 px across', R.moved === 0 && !R.unreachable.length, `moved ${R.moved} unreachable ${R.unreachable.join(' ')}`);
  ok(`the court's ${R.props.length} props stand on the floor, clear of every ledge and 110+ px from the doors`, R.props.length >= 5 && R.props.every((p) => p.ground && !p.hit && p.door >= 110), JSON.stringify(R.props.filter((p) => !p.ground || p.hit || p.door < 110)));
  ok('the court\'s backdrop is registered and decodes at 2912 x 1632', !!R.bg && R.bg.w === 2912 && R.bg.h === 1632, JSON.stringify(R.bg));
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
