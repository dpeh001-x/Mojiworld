// No stray cards or overlays (per user: "ensure that this is fixed and no other stray bravo cards or other UI", after Bravo's card
// turned up over the Gravitos door). One page, four sweeps:
//   A. DIALOG RESIDUE - every NPC on every map: open it, click every strip tab, close it (closeDialog / closeAllModals / Esc in
//      turn); then a boss confirm card and a plain one must each equal a card opened from a clean box, the strip must be gone, and
//      the NPC re-opened over a boss card must equal its own fresh card (classes, boss shade, confirm flag, strip, portrait,
//      subtitle, name and the box's element counts). The build before v0.30.1515: 58 findings.
//   B. MAP ENTRY - every map: load it; after 1.6 s no dialog, modal or overlay is up except the map fade, a boss intro, and the
//      Void's own intro on the Void.
//   C. LEAVING THE VOID EARLY - the Guguma intro ends with the Void: hidden 0.3 s into the next map, and no chirp there. (Before:
//      on screen ~2 s more, then a chirp.)
//   D. CONTROL - staying in the Void, the intro shows, chirps once and clears by itself.
// node scripts/stray_ui_sweep_test.mjs   (MOJI_GAME_FILE / PORT override; ~6 min)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = process.env.MOJI_SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11991), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT }); await new Promise((r) => setTimeout(r, 1200));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x).slice(0, 400) + ']' : '')); };
const errs = [];
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await p.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof openNPC === 'function' && document.getElementById('lo-menu'), null, { timeout: 180000 });
  await p.waitForTimeout(5000);
  await p.evaluate(async () => {
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { _lxBootHold.release('menu'); } catch (e) {}
    if (!player.cls) applyClass('mage'); player.level = 90; player._god = true; player._gravitosCineSeen = true; player._expLootAck = true; player._tutorialSeen = true;
    try { player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; player._storyBeatsSeen.everdawn_welcome = true; } catch (e) {}
    game.paused = false;
    window.__sig = () => {
      const d = document.getElementById('dialog'), t = document.getElementById('dialog-tabs'), po = document.getElementById('dialog-portrait'), hd = d.querySelector('.dialog-header');
      return JSON.stringify({ cls: [...d.classList].filter((c) => c !== 'typing').sort().join(' '), shade: d.style.getPropertyValue('--boss-shade') ? 'shade' : '', confirm: !!d._lxConfirm,
        tabsOn: t.className, tabs: [...t.querySelectorAll('button')].map((x) => x.dataset.tab).join(','),
        port: [po.textContent, po.style.backgroundColor, po.style.display, po.style.fontSize, po.style.color, (po.style.backgroundImage || '').replace(/\s+/g, '').slice(0, 90)].join('|'),
        sub: document.getElementById('dialog-subtitle').textContent, name: document.getElementById('dialog-name').textContent,
        kids: d.children.length, hkids: hd ? hd.querySelectorAll('*').length : -1 });
    };
    window.__skip = () => { const d = document.getElementById('dialog'); try { if (typeof d._twSkip === 'function') d._twSkip(); } catch (e) {} };
  });
  // ---- A ----
  const A = await p.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const boss = () => _openConfirmDialog('⚠ Boss Arena Ahead', 'Step in?', 'Enter the arena', closeDialog, 'Not yet', closeDialog, { bossSprite: 'Sprites/bosses/gravitos.webp' });
    const plain = () => _openConfirmDialog('Leave the fight?', 'Sure?', 'Leave anyway', closeDialog, 'Keep fighting', closeDialog);
    closeAllModals(); boss(); __skip(); const cBoss = __sig(); closeDialog(); plain(); __skip(); const cPlain = __sig(); closeDialog();
    const maps = Object.keys(MAPS).filter((id) => Array.isArray(MAPS[id].npcs) && MAPS[id].npcs.length && !/^tower_b/.test(id));
    const bad = [], noCard = []; let n = 0, k = 0, bravo = 0;
    for (const id of maps) {
      try { closeAllModals(); loadMap(id); } catch (e) { bad.push({ id, err: 'loadMap ' + e.message }); continue; }
      await sleep(900);
      for (const id2 of ['story-beat-overlay', 'boss-intro-overlay']) { const el = document.getElementById(id2); if (el) el.style.display = 'none'; }
      for (const npc of (game.npcs || []).slice()) {
        if (!npc || !npc.name) continue; n++;
        try {
          closeAllModals(); closeDialog();
          openNPC(npc); __skip(); await sleep(30);
          const d = document.getElementById('dialog');
          if (d.style.display !== 'block') { noCard.push(id + '/' + npc.name); closeAllModals(); continue; }
          const s0 = __sig(), tabsN = document.querySelectorAll('#dialog-tabs button').length; if (tabsN) bravo++;
          for (const tb of [...document.querySelectorAll('#dialog-tabs button')]) { tb.click(); __skip(); await sleep(20); }
          const way = k++ % 3;
          if (way === 0) closeDialog(); else if (way === 1) closeAllModals(); else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          await sleep(30); if (d.style.display === 'block') closeDialog();
          const tabsLeft = document.getElementById('dialog-tabs').className;
          boss(); __skip(); const c1 = __sig(); closeDialog();
          plain(); __skip(); const c2 = __sig(); closeDialog();
          boss(); openNPC(npc); __skip(); await sleep(30); const s1 = __sig(); closeDialog();
          if (tabsLeft) bad.push({ id, npc: npc.name, issue: 'strip on after close' });
          if (c1 !== cBoss) bad.push({ id, npc: npc.name, issue: 'boss card residue' });
          if (c2 !== cPlain) bad.push({ id, npc: npc.name, issue: 'confirm card residue' });
          if (s1 !== s0) bad.push({ id, npc: npc.name, issue: 'NPC card wears the boss card' });
        } catch (e) { bad.push({ id, npc: npc.name, err: String(e.message).slice(0, 120) }); }
      }
    }
    closeAllModals();
    return { maps: maps.length, npcs: n, strips: bravo, bad, noCard };
  });
  ok(`A. dialog residue: ${A.npcs} NPCs on ${A.maps} maps, every confirm card and re-opened card clean`, A.maps >= 15 && A.npcs >= 40 && A.strips >= 1 && A.bad.length === 0, { strips: A.strips, bad: A.bad.slice(0, 4) });
  ok('A. every NPC opens a card', A.noCard.length === 0, A.noCard.slice(0, 6));
  // ---- B ----
  const B = await p.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const ALLOWED = new Set(['map-fade-overlay', 'boss-intro-overlay']);
    const visible = (id) => {
      const out = [];
      const d = document.getElementById('dialog'); if (d && d.style.display === 'block') out.push('dialog:' + document.getElementById('dialog-name').textContent);
      for (const el of document.querySelectorAll('[id$=overlay],[id$=modal],.modal-overlay')) {
        if (!el.id || ALLOWED.has(el.id) || (id === 'void' && el.id === 'void-intro-overlay')) continue;
        const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0 || el.offsetWidth === 0 || el.classList.contains('tut-dock')) continue;
        out.push(el.id);
      }
      return [...new Set(out)];
    };
    const ids = Object.keys(MAPS).filter((id) => !/^tower_b/.test(id)), hits = [];
    for (const id of ids) {
      try { closeAllModals(); loadMap(id); } catch (e) { hits.push({ id, err: 'loadMap ' + e.message }); continue; }
      await sleep(1600);
      const v = visible(id); if (v.length) hits.push({ id, v });
      closeAllModals();
    }
    return { maps: ids.length, hits };
  });
  ok(`B. map entry: ${B.maps} maps, nothing on screen but the map fade, a boss intro and the Void's own intro`, B.maps >= 80 && B.hits.length === 0, B.hits.slice(0, 6));
  // ---- C + D ----
  const V = await p.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const ov = document.getElementById('void-intro-overlay'); let chirps = 0;
    const op = audio.play.bind(audio); audio.play = (key, ...a) => { if (key === 'chirp') chirps++; return op(key, ...a); };
    closeAllModals(); loadMap('void'); await sleep(1600); const inVoid = ov.classList.contains('show');
    loadMap('town'); await sleep(300); const leaveShown = ov.classList.contains('show'); await sleep(3500); const leaveChirps = chirps;
    chirps = 0; loadMap('void'); await sleep(1500); const ctrlShow = ov.classList.contains('show'); await sleep(4500);
    return { inVoid, leaveShown, leaveChirps, ctrlShow, ctrlCleared: !ov.classList.contains('show'), ctrlChirps: chirps };
  });
  ok('C. leaving the Void early ends its intro (hidden 0.3 s into town, no chirp there)', V.inVoid && !V.leaveShown && V.leaveChirps === 0, V);
  ok('D. CONTROL - staying in the Void, the intro shows, chirps once and clears', V.ctrlShow && V.ctrlChirps === 1 && V.ctrlCleared, V);
  ok('no page errors', errs.length === 0, [...new Set(errs)].slice(0, 3));
} finally { await browser.close().catch(() => {}); server.kill(); }
console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
