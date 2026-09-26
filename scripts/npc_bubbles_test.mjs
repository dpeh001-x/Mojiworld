// NPC IDLE BUBBLES (v0.30.1122, the 2026-09-26 NPC audit). NPC_CHAT_LINES is read by role with no fallback, so a role
// with no pool is an NPC that never speaks between conversations. Read live, after every boot bake:
//   - COVER: every role an NPC stands with (all maps, the tower floors, the Echo Keeper) has a pool
//   - RULES: every line <= 6 words and names no key (bubbles are not pad-aware)
//   - ORPHANS: no pool belongs to a role nobody has
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/npc_bubbles_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11394';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PAGE = path.resolve(SERVE_ROOT, cand || 'mojiworld_game.html');
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env, MOJI_GAME_FILE: PAGE } });
await new Promise((r) => setTimeout(r, 1800));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await browser.newContext({ serviceWorkers: 'block' })).newPage(); const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof NPC_CHAT_LINES === 'object' && typeof MAPS === 'object' && MAPS.tower_b5, null, { timeout: 180000 });
  const r = await page.evaluate(() => {
    const roles = new Set(['echoKeeper']);   // the Echo Keeper is spawned at load, not placed in MAPS
    for (const id in MAPS) for (const n of (MAPS[id].npcs || [])) if (n && n.role) roles.add(n.role);
    const missing = [...roles].filter((ro) => !(Array.isArray(NPC_CHAT_LINES[ro]) && NPC_CHAT_LINES[ro].length));
    const orphans = Object.keys(NPC_CHAT_LINES).filter((k) => !roles.has(k));
    const bad = []; const KEY = /\b(press|key|click|tap)\b|\[[A-Z]\]/i;
    for (const [k, pool] of Object.entries(NPC_CHAT_LINES)) for (const l of pool) if (l.split(/\s+/).filter(Boolean).length > 6 || KEY.test(l)) bad.push(k + ': ' + l);
    return { roles: roles.size, missing, orphans, bad };
  });
  check(r.missing.length === 0, 'COVER: every role an NPC stands with has a bubble pool (' + r.roles + ' roles)', J(r.missing));
  check(r.bad.length === 0, 'RULES: every bubble is 6 words or fewer and names no key', J(r.bad.slice(0, 5)));
  check(r.orphans.length === 0, 'ORPHANS: no pool belongs to a role nobody has', J(r.orphans));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 2)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
