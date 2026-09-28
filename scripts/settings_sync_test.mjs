// Damage numbers (and every other setting) survive a settings apply made before the Settings window opens (per user: "the
// damage numbers are not displaying when I attack or receive damage"). The jukebox's volume wheel called applySettingsLive,
// which read the unfilled controls and saved every effect switch OFF. Fresh browser profiles, each seeded with a store:
//  A. the jukebox wheel, Settings never opened: numbers stay on, the other saved settings survive, the volume turn sticks,
//     and a hit draws its number
//  B. a store the bug already wrote (all four effect switches off) is repaired once at boot
//  C. damage numbers turned off on purpose (alone) stay off - the repair does not touch a choice
//  D. the Settings switch still turns numbers off and on
//   node scripts/settings_sync_test.mjs [page.html] [port]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(import.meta.url)('playwright-core');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const FILE = (args[0] && /\.html$/i.test(args[0])) ? args[0] : 'mojiworld_game.html';
const PORT = Number(args.find((a) => /^\d+$/.test(a)) || process.env.PORT || 12081);
let bad = 0, total = 0; const check = (ok, label, d) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${d !== undefined ? '  ' + JSON.stringify(d) : ''}`); if (!ok) bad++; };
const env = { ...process.env }; if (FILE !== 'mojiworld_game.html') env.MOJI_GAME_FILE = FILE; else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const errs = [];
const boot = async (store, extra) => {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(([st, ex]) => { try { if (!sessionStorage.getItem('__seeded')) { sessionStorage.setItem('__seeded', '1'); localStorage.setItem('mojiworld_prologue_seen', '1');
    if (st) localStorage.setItem('LX_SETTINGS', JSON.stringify(st)); for (const k in (ex || {})) localStorage.setItem(k, ex[k]); } } catch (e) {} }, [store, extra]);
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof applySettingsLive === 'function' && typeof _jbVolSet === 'function' && typeof LX_GFX === 'object', null, { timeout: 180000 });
  await page.waitForTimeout(4000);
  return { ctx, page };
};
const saved = () => { try { return JSON.parse(localStorage.getItem('LX_SETTINGS') || 'null'); } catch (e) { return null; } };
try {
  { const { ctx, page } = await boot({ sfx: 30, uiScale: 90, bgm: 70, fxDmgNum: true, fxWeather: true, fxAmbient: true, fxShadows: true }, { LX_FXWIPE_FIX1: '1' });   // A
    const r = await page.evaluate(async (savedSrc) => { const saved = new Function('return (' + savedSrc + ')')();
      _jbVolSet(55);
      const s = saved() || {}; const o = { dmgnum: LX_GFX.dmgnum, saved: { fxDmgNum: s.fxDmgNum, fxWeather: s.fxWeather, sfx: s.sfx, uiScale: s.uiScale, bgm: s.bgm } };
      for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const e = document.getElementById(id); if (e) { e.style.display = 'none'; e.classList.add('fade'); } }
      window._lxBootGateDone = true; loadMap('forest', 300); await new Promise((z) => setTimeout(z, 2500)); game.paused = false;
      game.monsters.length = 0; const m = spawnMonster(player.x + 120, player.y, 'slime', false, false) || game.monsters[game.monsters.length - 1]; m.currentHp = m.maxHp = 1e7;
      const C = CanvasRenderingContext2D.prototype, oF = C.fillText; let n = 0; const oDN = window.drawDamageNumbers;
      window.drawDamageNumbers = function () { C.fillText = function () { n++; return oF.apply(this, arguments); }; try { return oDN.apply(this, arguments); } finally { C.fillText = oF; } };
      hitMonster(m, 777, false, null); await new Promise((z) => setTimeout(z, 500)); window.drawDamageNumbers = oDN;
      o.numbers = (game.damageNumbers || []).length; o.textDrawn = n; return o; }, saved.toString());
    check(r.dmgnum === true && r.saved.fxDmgNum !== false && r.saved.fxWeather !== false, 'A. the jukebox wheel before Settings opens leaves damage numbers (and weather) on', r);
    check(r.saved.sfx === 30 && r.saved.uiScale === 90 && r.saved.bgm === 55, 'A. ...the other saved settings survive and the volume turn sticks (sfx 30, HUD 90, music 55)', r.saved);
    check(r.numbers >= 1 && r.textDrawn > 0, 'A. ...and a hit draws its damage number', { numbers: r.numbers, textDrawn: r.textDrawn });
    await ctx.close(); }
  { const { ctx, page } = await boot({ fxDmgNum: false, fxWeather: false, fxAmbient: false, fxShadows: false, sfx: 40 }, null);   // B
    const r = await page.evaluate((savedSrc) => { const s = (new Function('return (' + savedSrc + ')')())() || {}; return { dmgnum: LX_GFX.dmgnum, fxDmgNum: s.fxDmgNum, fxWeather: s.fxWeather, sfx: s.sfx, flag: localStorage.getItem('LX_FXWIPE_FIX1') }; }, saved.toString());
    check(r.dmgnum === true && r.fxDmgNum === true && r.fxWeather === true && r.sfx === 40 && r.flag === '1', "B. a store the bug wrote (all four effect switches off) is repaired at boot, once", r);
    await ctx.close(); }
  { const { ctx, page } = await boot({ fxDmgNum: false, fxWeather: true, fxAmbient: true, fxShadows: true }, null);   // C
    const r = await page.evaluate((savedSrc) => { const s = (new Function('return (' + savedSrc + ')')())() || {}; return { dmgnum: LX_GFX.dmgnum, fxDmgNum: s.fxDmgNum }; }, saved.toString());
    check(r.dmgnum === false && r.fxDmgNum === false, 'C. damage numbers switched off on purpose stay off', r);
    await ctx.close(); }
  { const { ctx, page } = await boot({ fxDmgNum: true }, { LX_FXWIPE_FIX1: '1' });   // D
    const r = await page.evaluate((savedSrc) => { const saved = new Function('return (' + savedSrc + ')')(); openSettingsModal(); const t = document.getElementById('set-fx-dmgnum');
      t.click(); const off = { dmgnum: LX_GFX.dmgnum, saved: (saved() || {}).fxDmgNum }; t.click(); const on = { dmgnum: LX_GFX.dmgnum, saved: (saved() || {}).fxDmgNum }; closeSettingsModal(); return { off, on }; }, saved.toString());
    check(r.off.dmgnum === false && r.off.saved === false && r.on.dmgnum === true && r.on.saved === true, 'D. the Settings switch still turns damage numbers off and back on', r);
    await ctx.close(); }
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
} finally { await browser.close(); server.kill(); }
console.log(`\n${total - bad}/${total} checks passed`); process.exit(bad ? 1 : 0);
