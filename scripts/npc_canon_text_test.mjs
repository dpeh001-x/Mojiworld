// NPC CANON TEXT (v0.30.1124, the 2026-09-26 NPC audit). The lines the audit caught contradicting settled canon or the
// game itself, read from the running game:
//   - ZODIAC: the line after a zodiac kill holds no hidden shard and no "stolen" dream (the Twelve hold no fragment;
//     the dreaming was lifted); Guguma no longer says "stolen dream"
//   - MIRA: at the gate she stands on the step she could not cross; her copy at the foot of the Ascension says so
//   - TOWER: the Expedition goes down - no "at the top", B10 is not an apex
//   - PLACES: Will sends you to Mara for the Bastion's steel (Barnaby is in the Frosted Mansion); Vermillion's
//     breathing mountain is the Sauro Slope; Wynn's hamlet is the Frosted Mansion
//   - PLATES: Ren is a thief, Milo an usher (the gate belongs to Mira)
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/npc_canon_text_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11396';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PAGE = path.resolve(SERVE_ROOT, cand || 'mojiworld_game.html');
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const src = readFileSync(PAGE, 'utf8');
check(!/stolen dream/.test(src) && !/meet you at the top|found out at the top|climbed this far|Apex Sanctum/.test(src) && !/Barnaby keeps our steel|east of the mansion/.test(src), 'static: no "stolen dream", no tower "top", no Bastion Barnaby, no mansion east of the Reach');
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env, MOJI_GAME_FILE: PAGE } });
await new Promise((r) => setTimeout(r, 1800));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 760 } });
await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
const page = await ctx.newPage(); const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _bossEpitaph === 'function', null, { timeout: 180000 });
  const r = await page.evaluate(async () => {
    const W8 = (ms) => new Promise((res) => setTimeout(res, ms));
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { tutorial_intro: true, everdawn_welcome: true }); player._tutorialSeen = true;
    applyClass('warrior'); player.level = 80; try { closeAllModals(); } catch (e) {}
    const out = {};
    out.epitaph = _bossEpitaph('zodiac_aries', { zodiacBoss: true, name: 'Ariel, the Ram' });
    const mira = async (map) => { loadMap(map, 300); await W8(700); try { closeAllModals(); } catch (e) {} const n = game.npcs.find((x) => x.role === 'sage');
      game._sageStage = 1; openNPC(n); await W8(200); try { const d = document.getElementById('dialog'); if (d && typeof d._twSkip === 'function') d._twSkip(); } catch (e) {} await W8(1500);
      const t = document.getElementById('dialog-text').innerText; closeDialog(); return t; };
    const gate = await mira('wayfarersLantern2'), ascent = await mira('interdimensionalAscension');
    out.mira = { gate: /stood here ever since, on the step I could not cross/.test(gate), ascent: /foot of this stair is as far as it lets me come/.test(ascent), ascentOld: /stood here ever since/.test(ascent) };
    out.b10 = MAPS.tower_b10 && MAPS.tower_b10.name;
    out.plates = { ren: _dialogSubtitleFor({ role: 'ren', name: 'Ren' }), milo: _dialogSubtitleFor({ role: 'usher', name: 'Milo' }) };
    return out;
  });
  check(!/shard|stolen/i.test(r.epitaph) && /Ariel exhales/.test(r.epitaph), 'ZODIAC: the line after a zodiac kill names no hidden shard and no stolen dream', J(r.epitaph));
  check(r.mira.gate && r.mira.ascent && !r.mira.ascentOld, 'MIRA: at the gate she stands on the step she could not cross; at the foot of the Ascension she says it is as far as it lets her come', J(r.mira));
  check(/^B10/.test(r.b10 || '') && !/Apex/.test(r.b10), 'TOWER: B10 is not an apex of a tower that goes down', J(r.b10));
  check(/Thief/.test(r.plates.ren) && !/Gatekeeper/.test(r.plates.milo), 'PLATES: Ren is a thief, Milo is not a gatekeeper', J(r.plates));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 2)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await ctx.close(); await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
