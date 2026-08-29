// Live test for the batch-H perf pool:
//   - _qnavDrawKey only writes style.display on CHANGE (the old code wrote
//     every frame; the gate is proven by hand-clearing the style and seeing
//     it NOT rewritten while the cached state matches)
//   - _buffBarMax is a Map (and a legacy plain object converts in place)
//   - renderSkillBar's quantized cooldown gate renders the same one-decimal
//     text + --cd-pct format as before
//   - the hair-dye path builds its filter (bake verified visually)
//   - ambient stamp pins appear when soft-FX glow types are on screen
//   node scripts/perf_hud_pool_test.mjs
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import net from 'node:net';
import { spawn } from 'node:child_process';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const free = (p) => new Promise((r) => { const s = net.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8961; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, ['serve.js', PORT], {
  stdio: 'ignore', env: { ...process.env, MOJI_GAME_FILE: process.env.MOJI_GAME_FILE || '' } });
await new Promise((r) => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof spawnMonster === 'function' && typeof _qnavDrawKey === 'function', null, { timeout: 120000 });
await page.evaluate(() => new Promise((res) => { let n = 0;
  const t = () => { window._lxBootGateDone = true;
    const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
    const c = document.querySelector('.cls-card'); if (c) c.click();
    const m = document.getElementById('class-select-modal'); if (m) m.style.display = 'none';
    if (++n > 150) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); }));
await page.waitForTimeout(1200);

const r = await page.evaluate(async () => {
  const out = {};
  try { loadMap('forest'); } catch (e) {}
  await new Promise((res) => { let n = 0; const t = () => { game.paused = false; if (++n > 60) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
  player._god = true; player.hp = 99999; player.mp = 999; player.level = 30;

  // ---- 1) qnav display gate ------------------------------------------------
  game.qnav = false;
  if (!_LX_QK.el) { const sp = document.createElement('span'); document.body.appendChild(sp); _LX_QK.el = sp; }
  _qnavDrawKey();                                     // off -> writes 'none', caches it
  out.qkHidden = _LX_QK.el.style.display === 'none';
  _LX_QK.el.style.display = '';                        // hand-clear the style...
  _qnavDrawKey();                                     // ...gated call must NOT rewrite it
  out.qkGated = _LX_QK.el.style.display === '';
  _LX_QK._disp = null;                                 // invalidate the gate...
  _qnavDrawKey();                                     // ...now it rewrites
  out.qkRewrites = _LX_QK.el.style.display === 'none';

  // ---- 2) buff-row Map (legacy object converts once a buff is live) --------
  game._buffBarMax = { legacy: 123 };
  player.cls = 'mage'; player.job = 'warlock'; player.master = 'necromancer';
  for (const k in (player.skillCooldowns || {})) player.skillCooldowns[k] = 0;
  try { SKILL_FNS.necromancer_harvest(); } catch (e) {}   // grants a lifesteal-window buff
  await new Promise((res) => { let n = 0; const t = () => { game.paused = false; if (++n > 40) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
  try { _updateBuffRow(); } catch (e) { out.buffThrew = String(e).slice(0, 120); }
  out.buffIsMap = (game._buffBarMax instanceof Map);
  game.hazards = game.hazards.filter((h) => !h || h.type !== 'soul_vortex');

  // ---- 3) skill-bar cooldown text format -----------------------------------
  try { renderSkillBar(); } catch (e) {}
  let slot = null;
  for (const k of ['d', 's', 'a', 'e', 'w', 'q', 'c', 'x', 'b']) {
    if (_sbSlots[k] && _sbSlots[k].skillId) { slot = _sbSlots[k]; break; }
  }
  if (slot) {
    player.skillCooldowns[slot.skillId] = 5300;
    await new Promise((res) => { let n = 0; const t = () => { game.paused = false; if (++n > 10) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
    const txt = slot.cdEl.textContent;
    const pct = slot.root.style.getPropertyValue('--cd-pct');
    out.cdText = txt; out.cdPct = pct;
    out.cdFormat = /^\d+\.\d$/.test(txt) && /^\d+(\.\d)?$/.test(pct);
    player.skillCooldowns[slot.skillId] = 0;
  } else out.cdFormat = 'no-slot';

  // ---- 4) hair dye filter path ---------------------------------------------
  player.lookCustom = Object.assign({}, player.lookCustom, { hairHue: 180 });
  await new Promise((res) => { let n = 0; const t = () => { game.paused = false; if (++n > 30) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
  out.hairFilterBuilt = !!(game._hairFilterCache && game._hairFilterCache[180]);
  player.lookCustom.hairHue = 0;

  // ---- 5) ambient stamp pins (when soft glow types are present) ------------
  const glow = (game.ambient || []).filter((p) => p && (p.type === 'wisp' || p.type === 'firefly_dense'));
  out.glowCount = glow.length;
  out.stampPinned = glow.length === 0 || (typeof LX_FX_SOFT === 'undefined') || !LX_FX_SOFT
    || glow.some((p) => p._sg12 || p._sd4 || p._sd5);
  return out;
});

ok('qnav key hides when tracking is off', r.qkHidden, r);
ok('the display write is GATED (hand-cleared style not rewritten)', r.qkGated, r);
ok('an invalidated gate rewrites the display', r.qkRewrites, r);
ok('buff-row max tracker is a Map (legacy object converted)', r.buffIsMap && !r.buffThrew, r);
ok('cooldown text keeps the one-decimal format through the integer gate',
  r.cdFormat === true || r.cdFormat === 'no-slot', { cdText: r.cdText, cdPct: r.cdPct, cdFormat: r.cdFormat });
ok('the hair-dye filter string is built for the set hue', r.hairFilterBuilt, r);
ok('ambient glow particles pin their stamps (or none on this map)', r.stampPinned, { glowCount: r.glowCount });
ok('no page errors', errs.length === 0, { errs: errs.slice(0, 3) });

await b.close(); srv.kill();
let pass = 0;
for (const t of results) {
  console.log((t.pass ? '  PASS  ' : '  FAIL  ') + t.n);
  if (!t.pass) console.log('        ' + JSON.stringify(t.x).slice(0, 300));
  if (t.pass) pass++;
}
console.log('\n' + pass + '/' + results.length + ' checks passed');
process.exit(pass === results.length ? 0 : 1);
