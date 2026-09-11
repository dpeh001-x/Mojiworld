// Gravitos's manifesto: a higher force, subtly held by a higher one; his beats play over the
// Singularity arena. Per user: "change the contents of the gravitos speech, make him be a higher
// force that subtly is controlled by an even higher force. Change the storybeat background to
// gravitosarena".
//   node scripts/gravitos_beat_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 11259);
const checks = [];
const html = readFileSync(path.join(ROOT, PAGE), 'utf8');
const gate = (html.match(/gravitos_gate: \{[\s\S]*?\n  \},/) || [''])[0];
checks.push(['the gate beat is found', gate.length > 200]);
// the tells, all oblique: nothing names the hand
checks.push(['he was sent, and did not ask what else the sky kept', /The sky sent me\. I did not ask what else it kept\./.test(gate)]);
checks.push(['the weight was set on him by a hand he was never shown', /set on my shoulders, and I have never once been told by whom/.test(gate)]);
checks.push(['he will not say whose hand tied the tourniquet', /Do not ask me whose hand tied it\./.test(gate)]);
checks.push(['he listens upward before he threatens', /listening to something above the Singularity that you cannot hear/.test(gate)]);
checks.push(['he was made to break heroes', /I have broken kinder heroes than you\. I was made to\./.test(gate)]);
checks.push(['the old flat claim of ownership is gone', !/shattering — is mine\.\\n/.test(gate)]);
checks.push(['nothing names who holds him (subtle, per user)', !/Sovereign|Watcher|Amnesiac|Interference/i.test(gate)]);
checks.push(['the opener the look test pins is kept', /Singularity does not echo/.test(gate)]);
const GROUND = 'backgrounds/bg_v3_gravitosArena.webp';
checks.push(['all three Gravitos beats name the arena as their ground', ['gravitos_gate', 'gravitos_awakened', 'gravitos_ascendant'].every((id) => new RegExp(id + ": \\{\\s*mode: 'dialog',\\s*ground: '" + GROUND.replace(/[./]/g, '\\$&') + "'").test(html))]);
checks.push(['the arena painting ships', existsSync(path.join(ROOT, GROUND))]);

// ---- in a running game ----------------------------------------------------------
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
const r = await page.evaluate(async () => {
  const wait = (ms) => new Promise((x) => setTimeout(x, ms));
  const ov = document.getElementById('story-beat-overlay');
  const bg = () => getComputedStyle(ov).backgroundImage;
  const out = {};
  player._storyBeatsSeen = {};
  _playStoryBeat('gravitos_gate'); await wait(300);
  out.gateOn = ov.classList.contains('on'); out.gateBg = bg(); out.gateText = document.getElementById('story-beat-text').textContent || '';
  // walk it to the end so the next beat can open
  for (let i = 0; i < 8 && ov.classList.contains('on'); i++) { ov.click(); await wait(150); }
  out.closed = !ov.classList.contains('on');
  _playStoryBeat({ mode: 'dialog', stanzas: [{ speaker: 'Nobody', text: 'A plain beat with no ground of its own.' }] }); await wait(300);
  out.plainBg = bg();
  for (let i = 0; i < 4 && ov.classList.contains('on'); i++) { ov.click(); await wait(150); }
  return out;
});
await browser.close(); server.kill();

checks.push(['the gate beat opens', r.gateOn]);
checks.push(['it plays over the Singularity arena, not the festival key art', /bg_v3_gravitosArena\.webp/.test(r.gateBg) && !/title_keyart_c/.test(r.gateBg), r.gateBg.slice(0, 120)]);
checks.push(['the rewritten opener renders (directions parsed, no stray asterisks)', /Singularity does not echo/.test(r.gateText) && r.gateText.indexOf('*') === -1, r.gateText.slice(0, 70)]);
checks.push(['a beat with no ground of its own gets the key art back', r.closed && /title_keyart_c/.test(r.plainBg) && !/gravitosArena/.test(r.plainBg), r.plainBg.slice(0, 120)]);
checks.push(['no page errors', errs.length === 0, errs.slice(0, 2).join(' | ')]);
let fails = 0;
for (const [n, ok, extra] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra ? '  [' + extra + ']' : '')); if (!ok) fails++; }
console.log(`${checks.length - fails}/${checks.length} passed`);
process.exit(fails ? 1 : 0);
