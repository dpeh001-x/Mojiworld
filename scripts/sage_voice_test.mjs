// "???" (Sage Mira) has a voice that matches her (v0.30.x sage-voice).
//   node scripts/sage_voice_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build)
// Per user: "regenerate ??? NPC sound voice, as it doesnt match". The clip is measured (a young woman's pitch band,
// real voice in it - not the 130 Hz sigh it replaced), the service worker's cache generation carries the bump a
// same-name replacement needs, and talking to ??? in game plays exactly this file.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { voiceReport } from './sfx_analyze.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '11121';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const CLIP = path.join(ROOT, 'audio', 'npc', 'npc_mystery_sage.mp3');
const m = voiceReport(CLIP);
console.log('clip', JSON.stringify(m));
check(m.f0 >= 230 && m.f0 <= 460 && m.vowelBand >= 0.25, 'the ??? clip sits in a young woman\'s pitch band with real voice in it (the old one was a 130 Hz sigh)', m);
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
check(/sage-voice/.test(sw) && /^const CACHE = 'mojiworld-assets-v\d+';.*sage-voice/m.test(sw), 'sw.js bumps its asset cache for the replaced clip, so returning browsers drop the old one', sw.match(/^const CACHE.*$/m));
const size = fs.statSync(CLIP).size;
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  const got = [];
  p.on('response', async (r) => { if (/audio\/npc\/npc_mystery_sage\.mp3/.test(r.url())) { let n = -1; try { n = (await r.body()).length; } catch (e) {} got.push({ s: r.status(), n }); } });
  await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof openNPC === 'function', null, { timeout: 150000 });
  const r = await p.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'mage'; player.level = 80;
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true }); try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    const mapId = Object.keys(MAPS).find((id) => (MAPS[id].npcs || []).some((n) => n.name === '???'));
    loadMap(mapId); await new Promise((s) => setTimeout(s, 2500)); document.getElementById('everdawn-welcome-overlay')?.remove();
    try { if (!audio.ctx) audio.init(); } catch (e) {}
    const npc = game.npcs.find((n) => n.name === '???');
    if (!npc) return { mapId, err: 'no ??? on its map' };
    player.x = npc.x; openNPC(npc);
    await new Promise((s) => setTimeout(s, 2500));
    return { mapId, key: _npcTalkKey('???') };
  });
  await p.waitForTimeout(500);
  console.log('in game', JSON.stringify({ r, got, size }));
  check(!r.err && r.key === 'mystery_sage' && got.some((g) => g.s === 200 && g.n === size), 'talking to ??? loads exactly this clip', { r, got, size });
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await ctx.close();
} finally { await browser.close().catch(() => {}); srv.kill(); }
console.log(bad ? `\n${bad} of ${total} FAILED` : `\nall ${total} passed`);
process.exit(bad ? 1 : 0);
