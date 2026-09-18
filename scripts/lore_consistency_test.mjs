// LORE CONSISTENCY (v0.30.873, per user "Tidy up the lore and look for inconsistencies"). Each check pins one contradiction
// the lore pass resolved, against the game's own data where it can: portal arrows against where each portal stands on its
// map, Old Arlen's directions against the route finder, the Codex's ending count against JOBS / MASTERS, the region cards
// against the Quest Journal's act numbers, and the Amnesiac's pronoun.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/lore_consistency_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11189';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(SERVE_ROOT, cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', reducedMotion: 'reduce', viewport: { width: 1280, height: 720 } })).newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return m && getComputedStyle(m).display !== 'none' && m.getBoundingClientRect().height > 0; }, null, { timeout: 180000 }); await page.waitForTimeout(1500);
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms)); const out = {};
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.cls = 'warrior'; player.level = 30; player._tutorialSeen = true; player._storyBeatsSeen = new Proxy({}, { get: () => true });
    loadMap('town', 600); await sleep(2500); game.paused = false; try { closeAllModals(); } catch (e) {}
    // portal arrows on every map: a leading / trailing arrow outside the middle fifth points to the portal's own side
    const arrow = (n) => (/^[◀▶]/.test(n) ? n[0] : /[◀▶]$/.test(n) ? n[n.length - 1] : null);
    const save = game.mapData; let raw = 0, shown = 0, total = 0; const bad = [];
    for (const id in MAPS) { const m = MAPS[id], w = m && m.worldWidth; if (!w) continue; game.mapData = m;
      for (const p of (m.portals || [])) { const n = String(p.name || ''); if (!arrow(n) || typeof p.x !== 'number') continue; const f = p.x / w; if (f > 0.4 && f < 0.6) continue;
        total++; const want = f <= 0.4 ? '◀' : '▶'; if (arrow(n) !== want) raw++;
        const d = typeof _lxPortalArrow === 'function' ? _lxPortalArrow(n, p.x) : n; if (arrow(d) !== want) { shown++; if (bad.length < 4) bad.push(id + ': ' + d); } } }
    game.mapData = save;
    const east = (game.mapData.portals || []).find((p) => p.dest === 'forest');
    out.arrows = { total, rawWrong: raw, shownWrong: shown, bad, townEast: east ? (typeof _lxPortalArrow === 'function' ? _lxPortalArrow(east.name, east.x) : east.name) : null };
    // Old Arlen's directions against the route finder
    const text = () => (document.getElementById('dialog-text') || {}).textContent || '';
    const arlen = (game.npcs || []).find((n) => n && n.name === 'Old Arlen'); if (arlen) { openNPC(arlen); await sleep(300); }
    const r1 = _qnavRoute('town', 'slimeCave'), r2 = _qnavRoute('town', 'boss');
    out.arlen = { text: text().slice(0, 700), grotto: r1 && r1.next && r1.next.portal.dest, mooma: r2 && r2.next && r2.next.portal.dest };
    try { closeAllModals(); } catch (e) {}
    const innie = (game.npcs || []).find((n) => n && n.name === 'Auntie Innie'); if (innie) { openNPC(innie); await sleep(300); }
    out.innie = [...document.querySelectorAll('#dialog-options button')].map((b) => b.textContent); try { closeAllModals(); } catch (e) {}
    // region cards vs the journal's acts; the Amnesiac's stage directions
    const beats = Object.entries(STORY_BEATS);
    out.cards = { act: beats.filter(([, b]) => (b.stanzas || []).some((x) => /ACT [IVX]+/.test(x.text || ''))).map(([k]) => k), crossings: beats.filter(([, b]) => (b.stanzas || []).some((x) => /CROSSING/.test(x.text || ''))).length };
    out.amn = beats.flatMap(([k, b]) => (b.stanzas || []).filter((x) => x.speaker === 'The Amnesiac' && /\*[^*]*\b(they|their|them)\b[^*]*\*/.test(x.text || '')).map(() => k));
    const src = [...document.scripts].map((x) => x.textContent).join('\n');
    out.endings = { jobs: Object.keys(JOBS).length, masters: Object.keys(MASTERS).length, text: (src.match(/(\w+) classes across the four archetypes, (\w+) masters beyond them;\s+(\w+) endings/) || []).slice(1) };
    out.gone = ['Twelve ages of six words', 'Twelve ages of native', 'The Houses leave you no fragment', 'first time in three hundred years', 'a version of yourself' + String.fromCharCode(92) + 'nthat never decided',
      'sixteen endings', "'Why the Megamall?'", 'the thing at the top of the tower', 'the Vermilion Reach', 'near the Shadow Realm', 'fatwa', 'by a copy of yourself, holding a sword.'].filter((t) => src.includes(t));
    return out;
  });
  check(r.arrows.total > 40 && r.arrows.shownWrong === 0, 'every portal arrow points to the side of the map its portal stands on', J({ total: r.arrows.total, wrongAsWritten: r.arrows.rawWrong, wrongShown: r.arrows.shownWrong, bad: r.arrows.bad }));
  check(/^▶/.test(r.arrows.townEast || ''), 'Everdawn Central\u2019s east exit reads "▶ Emerald Thicket"', J(r.arrows.townEast));
  check(r.arlen.grotto === 'bastion' && /West, out through the Bastion/.test(r.arlen.text) && r.arlen.mooma === 'forest' && /Emerald Thicket[\s\S]*Mooma/.test(r.arlen.text), 'Old Arlen sends you west for Gelwater Grotto and east for Mooma, as the maps do', J({ grotto: r.arlen.grotto, mooma: r.arlen.mooma }));
  check(r.innie.includes('Why set up in the plaza?') && !r.innie.includes('Why the Megamall?'), 'Auntie Innie is asked about the plaza she stands in', J(r.innie));
  check(r.cards.act.length === 0 && r.cards.crossings === 5, 'region cards are the Six Crossings, not a second set of acts', J(r.cards));
  check(r.amn.length === 0, 'the Amnesiac is "he" in every story-beat stage direction', J(r.amn));
  const w = { nine: 9, seventeen: 17 };
  check(w[(r.endings.text[0] || '').toLowerCase()] === r.endings.jobs && w[r.endings.text[1]] === r.endings.masters && w[r.endings.text[2]] === r.endings.masters, 'the Codex counts the classes, masters and endings the game has', J(r.endings));
  check(r.gone.length === 0, 'none of the contradicted wordings is left', J(r.gone));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 3)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 300)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
