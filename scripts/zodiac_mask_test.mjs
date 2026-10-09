// ZODIAC IS MASKED IN THE MECHANICS UI (per user, 2026-10-09: "mask zodiac in the mechanics UI"). Until Aetherion falls (_lxTwelveKnown) a hero who opens the
// Achievements list, the Codex (rail, Dex chips, sealed page), the Jukebox or a forge menu (Brok, Furnax) should not meet the word Zodiac, "the Twelve Houses" or
// the sigil trade. The moment she falls every one of them reads as before. Place names (the Zodiac Sanctum map) and the sigil item itself are NOT masked here.
//   [SERVE_ROOT=<dir with serve.js, data, art>] [PORT=n] node scripts/zodiac_mask_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '12081';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--')); const FILE = cand ? path.basename(cand) : 'mojiworld_game.html';
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + String(d).slice(0, 320) + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } }); await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof QUESTS === 'object' && typeof openCodex === 'function' && typeof openJukebox === 'function' && typeof openNPC === 'function' && typeof openLoreMap === 'function' && typeof _lxTwelveKnown === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(2000);
  await page.evaluate(() => { for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; } try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {} });
  // one full sweep of the panels as the hero stands right now
  const sweep = async () => page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = { known: _lxTwelveKnown() };
    const closeAll = () => { try { closeAllModals(); } catch (e) {} for (const m of document.querySelectorAll('[id$="-modal"]')) m.style.display = 'none'; try { closeDialog(); } catch (e) {} game.paused = false; };
    const RX = /zodiac|twelve houses|sigil|star-toucher/i;
    const seen = (root) => { const hits = []; const w = document.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { if (!RX.test(n.nodeValue)) continue; const el = n.parentElement; if (!el || !el.getClientRects().length) continue; const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') continue; hits.push(n.nodeValue.trim().slice(0, 60)); } return hits; };
    closeAll(); openCodex(); await sleep(150);
    out.ach = { hits: seen(), rows: document.querySelectorAll('#codex-list > div').length, text: document.getElementById('codex-list').innerText };
    closeAll(); openLoreMap('bestiary'); await sleep(200); out.rail = { hits: seen(), chips: Array.from(document.querySelectorAll('.cdx-chip')).map((b) => b.textContent.trim()), tab: (document.querySelector('#lore-tabs .lore-tab[data-lore-tab="zodiac"]') || {}).textContent };
    closeAll(); openLoreMap('zodiac'); await sleep(200); out.page = { hits: seen(), h1: document.getElementById('cdx-h1').textContent, tab: (document.querySelector('#lore-tabs .lore-tab[data-lore-tab="zodiac"]') || {}).textContent.replace(/\s+/g, ' ').trim() };
    closeAll(); openJukebox(); await sleep(200);
    const oid = Array.from(_JUKEBOX_ALWAYS).find((id) => id !== 'zodiacHall'); const pad = document.querySelector('.jb-track[data-track-id="zodiacHall"] .jb-name'); out.jb = { name: pad ? pad.textContent : null, heard: _isTrackHeard('zodiacHall'), alwaysId: oid, other: (document.querySelector('.jb-track[data-track-id="' + oid + '"] .jb-name') || {}).textContent };
    closeAll();
    const npcs = Object.values(MAPS).flatMap((m) => m.npcs || []);
    const forge = async (npc) => { closeAll(); game._brokMenu = 'craft'; openNPC(npc); for (let i = 0; i < 80; i++) { await sleep(100); const d = document.getElementById('dialog'); if (d && !d.classList.contains('typing') && document.getElementById('dialog-text').textContent.length > 20) break; }
      return { text: document.getElementById('dialog-text').textContent, opts: Array.from(document.querySelectorAll('#dialog-options button')).map((b) => b.textContent.trim()) }; };
    const brok = npcs.find((n) => /^Brok$/i.test(n.name || '')), furn = npcs.find((n) => /Furnax/i.test(n.name || ''));
    out.brok = brok ? await forge(brok) : null; out.furn = furn ? await forge(furn) : null;
    closeAll(); return out;
  });
  await page.evaluate(() => { player.cls = 'warrior'; player.level = 30; player.quests = { active: {}, completed: {}, unlocked: {}, progress: {} }; _ensureQuests(); game.achievements = game.achievements || {}; });
  const A = await sweep();
  check(A.known === false, 'the fresh hero has not felled Aetherion, so the Twelve are unknown', J(A.known));
  check(A.ach.hits.length === 0 && /\?\?\?/.test(A.ach.text) && A.ach.text.indexOf('Reach level 70') >= 0, 'Achievements: the two Zodiac rows read ??? and the rest of the list is untouched', J(A.ach.hits) + ' rows ' + A.ach.rows);
  check(A.rail.chips.indexOf('Zodiac') < 0 && A.rail.chips.indexOf('Bosses') >= 0, 'the Dex tier chips have no Zodiac chip (All / Beasts / Elites / Bosses stay)', J(A.rail.chips));
  check(A.rail.hits.length === 0 && A.page.hits.length === 0 && A.rail.tab.replace(/\s+/g, '').indexOf('???') >= 0 && A.page.h1 === '???', 'the Codex rail button and the sealed page are named ??? (no Zodiac anywhere on the Codex)', J([A.rail.hits, A.page]));
  check(A.jb.name === '???' && A.jb.heard === false && A.jb.other && A.jb.other !== '???', 'Jukebox: the always-open legacy Zodiac Hall pad is ??? and another always-open theme still shows', J(A.jb));
  check(A.brok && A.furn && !/zodiac|sigil/i.test(A.brok.text + A.furn.text) && !A.brok.opts.concat(A.furn.opts).some((t) => /zodiac|sigil/i.test(t)) && A.brok.opts.some((t) => /Craft Set Piece/.test(t)), "Brok's and Furnax's forge menus have no sigil line and no Trade button (Craft stays)", J([A.brok && A.brok.opts, A.furn && A.furn.opts]));
  // now she falls
  await page.evaluate(() => { game.bestiary = game.bestiary || {}; game.bestiary.aetherion = 1; });
  const B = await sweep();
  check(B.known === true, 'once Aetherion has fallen the Twelve are known', J(B.known));
  check(/Star-Toucher/.test(B.ach.text) && /Defeat all 12 Zodiac signs/.test(B.ach.text), 'Achievements: the Zodiac rows read in full again', '');
  check(B.rail.chips.indexOf('Zodiac') >= 0 && B.page.h1 === 'The Zodiac' && /Zodiac/.test(B.page.tab), 'the Dex chip, the Codex rail button and the page heading are named again', J([B.rail.chips, B.page.h1, B.page.tab]));
  check(B.jb.heard === true && /Zodiac/i.test(B.jb.name || ''), 'Jukebox: the legacy Zodiac Hall pad is named again', J(B.jb));
  check(/ZODIAC SIGILS/.test(B.brok.text) && /ZODIAC SIGILS/.test(B.furn.text) && B.brok.opts.some((t) => /Trade all Zodiac Sigils/.test(t)) && B.furn.opts.some((t) => /Trade all Zodiac Sigils/.test(t)), 'both forge menus offer the sigil line and the Trade button again', J([B.brok.opts, B.furn.opts]));
  // a hero who is already HOLDING a sigil sees the trade even before the Twelve read as known
  await page.evaluate(() => { game.bestiary.aetherion = 0; window.__sc = window._lxSigilCount; window._lxSigilCount = () => 2; });
  const D = await sweep();
  await page.evaluate(() => { window._lxSigilCount = window.__sc; });
  check(D.known === false && D.brok.opts.some((t) => /Trade all Zodiac Sigils/.test(t)) && D.furn.opts.some((t) => /Trade all Zodiac Sigils/.test(t)) && /ZODIAC SIGILS/.test(D.brok.text), 'holding a sigil shows the Trade button and the sigil line even while the Twelve read as unknown', J([D.brok.opts, D.furn.opts]));
  // a row the hero has earned is never hidden, even if the Twelve were somehow still unknown
  const C = await page.evaluate(() => { game.bestiary.aetherion = 0; game.achievements.zodiacAll = true; const k = _lxTwelveKnown(); try { closeAllModals(); } catch (e) {} openCodex(); const t = document.getElementById('codex-list').innerText; game.achievements.zodiacAll = false; return { k, hasName: /The Twelve Houses/.test(t) }; });
  check(C.k === false && C.hasName === true, 'an achievement the hero has earned keeps its real name', J(C));
  check(errs.length === 0, 'no page errors', errs.join(' | '));
} finally { await browser.close(); try { server.kill(); } catch (e) {} }
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
