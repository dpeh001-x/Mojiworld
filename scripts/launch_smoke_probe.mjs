// Launch smoke: boot the shipped page the way a player does (no dev flag), then tour every map, cast every
// skill and open every panel, recording runtime errors, console errors, 404s, "undefined"/"NaN" leaking into
// visible text, frame times and heap. Prints a JSON line (LAUNCH_SMOKE {...}) and a short table.
//
//   [SERVE_ROOT=<dir with serve.js + data/ + art>] node scripts/launch_smoke_probe.mjs [candidate.html] [--out=file.json]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11099';
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1800));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--enable-precise-memory-info', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const errs = [], cons = [], notFound = [], failed = [];
const stamp = () => Date.now();
page.on('pageerror', (e) => errs.push({ t: stamp(), msg: String(e.message).slice(0, 200) }));
page.on('console', (m) => { if (m.type() === 'error') cons.push({ t: stamp(), msg: m.text().slice(0, 200) }); });
page.on('response', (r) => { if (r.status() === 404) notFound.push({ t: stamp(), url: r.url().replace(/^https?:\/\/[^/]+\//, '') }); });
page.on('requestfailed', (r) => failed.push({ t: stamp(), url: r.url().replace(/^https?:\/\/[^/]+\//, ''), why: (r.failure() || {}).errorText }));
const out = { ver: null, boot: {}, maps: [], skills: [], panels: [], errors: errs, consoleErrors: cons, notFound, failed };
try {
  // ---- 1. boot as a player: no ?dev=1 ----
  const t0 = stamp();
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof castSkill === 'function' && typeof GAME_VERSION === 'string', null, { timeout: 180000 });
  const tScripts = stamp() - t0;
  // the title menu lives inside the loading overlay: "booted" = the menu is showing by itself
  const overlayGone = await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return !!m && getComputedStyle(m).display !== 'none' && m.getBoundingClientRect().height > 0; }, null, { timeout: 90000 }).then(() => true).catch(() => false);
  out.boot = Object.assign({ scriptsReadyMs: tScripts, overlayGoneMs: stamp() - t0, overlayGone, errorsDuringBoot: errs.length, notFoundDuringBoot: notFound.length },
    await page.evaluate(() => ({ ver: GAME_VERSION, title: document.title, menuVisible: !!document.querySelector('#lo-menu') && getComputedStyle(document.querySelector('#lo-menu')).display !== 'none', canvas: !!document.querySelector('canvas'), sw: 'serviceWorker' in navigator, onerror: typeof window.onerror === 'function' || !!window.__lxCrashNotes, dpr: devicePixelRatio })));
  out.ver = out.boot.ver;
  // ---- 2. enter the world the way the harnesses do ----
  await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    loadMap('forest', 300); await sleep(1500);
    for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); }
    game.paused = false; player._god = true; player.level = 60; player.maxHp = 99999; player.hp = 99999; player.maxMp = 9999; player.mp = 9999;
  });
  // ---- 3. every map: load, settle, sample frames, heap ----
  const mapIds = await page.evaluate(() => Object.keys(MAPS));
  for (const id of mapIds) {
    const e0 = errs.length, c0 = cons.length, n0 = notFound.length;
    const r = await page.evaluate(async (id) => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const t0 = performance.now(); let err = null;
      try { loadMap(id); } catch (e) { err = String(e.message).slice(0, 160); }
      await sleep(400); game.paused = false;
      for (const oid of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(oid); if (o) o.classList.remove('on'); }
      // frame samples
      const dts = []; let last = performance.now();
      await new Promise((res) => { let n = 0; const tick = () => { const now = performance.now(); dts.push(now - last); last = now; if (++n < 45) requestAnimationFrame(tick); else res(); }; requestAnimationFrame(tick); });
      const s = dts.slice(3).sort((a, b) => a - b), med = s[Math.floor(s.length / 2)] || 0, p95 = s[Math.floor(s.length * 0.95)] || 0, worst = s[s.length - 1] || 0;
      const mem = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null;
      const m = game.map || game.mapData || {};
      const fell = (m && m.h && player.y > (m.h + 400)) || player.y > 20000;
      return { id, err, ms: Math.round(performance.now() - t0), monsters: game.monsters.length, npcs: (game.npcs || []).length, portals: (game.portals || []).length, onGround: !!player.onGround, fell, hp: player.hp, med: +med.toFixed(1), p95: +p95.toFixed(1), worst: +worst.toFixed(1), mem, hasBg: !!(m.bg || m.background || m.bgImage || m.backdrop), video: !!document.querySelector('video') };
    }, id).catch((e) => ({ id, err: 'evaluate: ' + String(e.message).slice(0, 120) }));
    r.newErrors = errs.length - e0; r.newConsole = cons.length - c0; r.new404 = notFound.length - n0;
    out.maps.push(r);
  }
  // ---- 4. every skill, one cast each, with a dummy in front ----
  await page.evaluate(async () => { const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); loadMap('forest', 300); await sleep(1200); game.paused = false; });
  const skillIds = await page.evaluate(() => Object.keys(SKILLS));
  for (const id of skillIds) {
    const e0 = errs.length, c0 = cons.length;
    const r = await page.evaluate(async (id) => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const sk = SKILLS[id];
      player.cls = sk.cls; player.job = sk.job || null; player.masteries = {}; player.master = sk.master || null; if (sk.master) player.masteries[sk.master] = true;
      player.mp = 9999; player.hp = player.maxHp; player.facing = 1; player.pet = null; player.pack = []; player.ultPet = null;
      for (const k of Object.keys(player.skillCooldowns || {})) player.skillCooldowns[k] = 0;
      game.monsters.length = 0; const m = spawnMonster(player.x + 150, player.y - 10, 'slime', false); if (m) { m.maxHp = 9e9; m.currentHp = 9e9; }
      let err = null; try { castSkill(id); } catch (e) { err = String(e.message).slice(0, 160); }
      await sleep(350);
      return { id, err, cast: !!(player.skillCooldowns && player.skillCooldowns[id] > 0) || !!err === false };
    }, id).catch((e) => ({ id, err: 'evaluate: ' + String(e.message).slice(0, 120) }));
    r.newErrors = errs.length - e0; r.newConsole = cons.length - c0; out.skills.push(r);
  }
  // ---- 5. every panel: open, look for leaked placeholders in the visible text, close ----
  const PANELS = ['openAdvancement', 'openAttributes', 'openBackupModal', 'openCharStudio', 'openClassSelect', 'openCodex', 'openCraftingModal', 'openEdictsPanel', 'openEnhancementModal', 'openHelp', 'openJukebox', 'openLevelUpPanel', 'openLoreMap', 'openMasterAdvancement', 'openMojidex', 'openMultiplayer', 'openPostalWisp', 'openReforgeModal', 'openSettingsModal', 'openSkillsReference', 'openTalentPick', 'openTaxi', 'toggleKeybindModal', 'toggleQuestJournal', 'toggleWorldMap', 'showPowerupShop', 'togglePhotoMode'];
  for (const fn of PANELS) {
    const e0 = errs.length, c0 = cons.length;
    const r = await page.evaluate(async (fn) => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      if (typeof window[fn] !== 'function') return { fn, skipped: 'not a function' };
      let err = null; try { const v = window[fn](); if (v && typeof v.then === 'function') await Promise.race([v, sleep(800)]); } catch (e) { err = String(e.message).slice(0, 160); }
      await sleep(350);
      const txt = document.body.innerText || '';
      const leaks = ['undefined', 'NaN', '[object Object]', 'null', 'TODO', 'lorem'].filter((w) => new RegExp('(^|[^A-Za-z])' + w.replace('[', '\\[').replace(']', '\\]') + '([^A-Za-z]|$)').test(txt));
      const open = [...document.querySelectorAll('.modal.open, .open[id$="modal"], [id$="modal"].on, [id$="overlay"].open, [id$="overlay"].on')].map((el) => el.id).slice(0, 4);
      try { if (typeof closeAllModals === 'function') closeAllModals(); } catch (e) {}
      try { if (fn === 'togglePhotoMode' && typeof togglePhotoMode === 'function' && game._photoMode) togglePhotoMode(); } catch (e) {}
      try { if (fn === 'toggleWorldMap' && game._worldMapOpen) toggleWorldMap(); } catch (e) {}
      game.paused = false;
      return { fn, err, open, leaks };
    }, fn).catch((e) => ({ fn, err: 'evaluate: ' + String(e.message).slice(0, 120) }));
    r.newErrors = errs.length - e0; r.newConsole = cons.length - c0; out.panels.push(r);
  }
  out.finalMem = await page.evaluate(() => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null);
} catch (e) { out.fatal = String(e.message).slice(0, 300); }
finally { await browser.close(); server.kill(); }
const outFile = arg('out', ''); if (outFile) writeFileSync(outFile, JSON.stringify(out, null, 1));
const bad = { mapErr: out.maps.filter((m) => m.err || m.newErrors || m.fell), skillErr: out.skills.filter((s) => s.err || s.newErrors), panelErr: out.panels.filter((p) => p.err || p.newErrors || (p.leaks && p.leaks.length)) };
console.log(`build ${out.ver}  boot: scripts ${out.boot.scriptsReadyMs} ms, overlay gone ${out.boot.overlayGone} (${out.boot.overlayGoneMs} ms), onerror handler ${out.boot.onerror}`);
console.log(`maps ${out.maps.length} (problems ${bad.mapErr.length})  skills ${out.skills.length} (problems ${bad.skillErr.length})  panels ${out.panels.length} (problems ${bad.panelErr.length})`);
console.log(`runtime errors ${errs.length}  console errors ${cons.length}  404s ${notFound.length}  failed requests ${failed.length}  heap end ${out.finalMem} MB`);
for (const m of bad.mapErr) console.log('  MAP ' + m.id + ': ' + (m.err || '') + (m.fell ? ' FELL OUT OF WORLD' : '') + (m.newErrors ? ' +' + m.newErrors + ' errors' : ''));
for (const s of bad.skillErr) console.log('  SKILL ' + s.id + ': ' + (s.err || '') + (s.newErrors ? ' +' + s.newErrors + ' errors' : ''));
for (const p of bad.panelErr) console.log('  PANEL ' + p.fn + ': ' + (p.err || '') + (p.newErrors ? ' +' + p.newErrors + ' errors' : '') + (p.leaks && p.leaks.length ? ' leaks ' + p.leaks.join(',') : ''));
const uniq404 = [...new Set(notFound.map((n) => n.url))]; console.log('404s: ' + (uniq404.slice(0, 25).join(', ') || 'none') + (uniq404.length > 25 ? ` (+${uniq404.length - 25})` : ''));
const uniqErr = [...new Set(errs.map((e) => e.msg))]; for (const m of uniqErr.slice(0, 12)) console.log('  ERR ' + m);
const slow = out.maps.filter((m) => m.worst > 250).sort((a, b) => b.worst - a.worst).slice(0, 8); console.log('worst map-load frames (ms): ' + slow.map((m) => `${m.id} ${m.worst}`).join(', '));
console.log('LAUNCH_SMOKE ' + JSON.stringify({ ver: out.ver, boot: out.boot, maps: out.maps.length, mapProblems: bad.mapErr.length, skills: out.skills.length, skillProblems: bad.skillErr.length, panels: out.panels.length, panelProblems: bad.panelErr.length, errors: errs.length, consoleErrors: cons.length, notFound: uniq404.length, heapEndMb: out.finalMem }));
