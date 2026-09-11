// Story voice-over: the Gravitos gate beat is read aloud, one clip per stanza.
// Per user: "Yes lets incorporate the audio".
//   node scripts/story_voice_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 11267);
const checks = [];
const html = readFileSync(path.join(ROOT, PAGE), 'utf8');
const CLIPS = [1, 2, 3].map((n) => `audio/story/gravitos_gate_${n}.mp3`);
const sizes = CLIPS.map((c) => (existsSync(path.join(ROOT, c)) ? statSync(path.join(ROOT, c)).size : 0));
checks.push(['the three reads ship', sizes.every((b) => b > 150000 && b < 1200000), sizes.map((b) => Math.round(b / 1024) + ' KB').join(' / ')]);
let durs = null;
try { durs = CLIPS.map((c) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join(ROOT, c)]).toString().trim())); } catch (e) { durs = null; }
checks.push(['each is a whole stanza read (25-50 s)', durs === null || durs.every((d) => d >= 25 && d <= 50), durs ? durs.map((d) => d.toFixed(1) + ' s').join(' / ') : 'ffprobe unavailable, skipped']);
const gate = (html.match(/gravitos_gate: \{[\s\S]*?\n  \},/) || [''])[0];
const voices = [...gate.matchAll(/voice: '([^']+)'/g)].map((m) => m[1]);
checks.push(['each gate stanza names its own read, in order', JSON.stringify(voices) === JSON.stringify(CLIPS), voices.join(', ')]);
const sfx = readFileSync(path.join(ROOT, 'data/sfx_manifest.js'), 'utf8');
checks.push(['the animator SFX board lists them as story voice-over', CLIPS.every((c) => sfx.includes(`"file":"${c}","cat":"story-voice"`))]);

// ---- in a running game ----------------------------------------------------------
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; const bad = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
page.on('requestfailed', (q) => { if (/audio\/story\//.test(q.url())) bad.push('failed ' + q.url()); });
page.on('response', (q) => { if (/audio\/story\//.test(q.url()) && q.status() >= 400) bad.push(q.status() + ' ' + q.url()); });
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
const r = await page.evaluate(async () => {
  const wait = (ms) => new Promise((x) => setTimeout(x, ms));
  const ev = (n) => (0, eval)(n);
  const ov = document.getElementById('story-beat-overlay');
  const el = (n) => ev('_storyVoiceEls')['audio/story/gravitos_gate_' + n + '.mp3'];
  const live = (n) => { const e = el(n); return !!e && !e.paused && e.currentTime > 0; };
  const out = {};
  try { if (typeof audio !== 'undefined' && audio) audio.muted = false; } catch (e) {}
  player._storyBeatsSeen = {};
  const duck0 = ev('_vidDuckDepth');
  _playStoryBeat('gravitos_gate'); await wait(1500);
  out.prewarmed = [1, 2, 3].every((n) => !!el(n));
  out.s1 = live(1); out.s1src = el(1) ? el(1).src : '';
  out.master = ev('_SFX_MASTER_VOL'); out.base = el(1) ? el(1)._sfxBase : -1; out.vol = el(1) ? el(1).volume : -1;
  out.duckedDuring = ev('_vidDuckDepth') > duck0;
  ov.click(); await wait(1500);
  out.s1stopped = el(1).paused; out.s2 = live(2);
  _setSfxMasterVolume(0.3); out.volAfterSlider = el(2).volume; _setSfxMasterVolume(out.master);
  _lxSyncSfxMuted(true); out.mutedAfterToggle = el(2).muted; _lxSyncSfxMuted(false); out.unmutedAfterToggle = !el(2).muted;
  ov.click(); await wait(1500);
  out.s2stopped = el(2).paused; out.s3 = live(3);
  ov.click(); await wait(800);
  out.closed = !ov.classList.contains('on'); out.s3stopped = el(3).paused; out.duckReleased = ev('_vidDuckDepth') === duck0;
  _playStoryBeat({ mode: 'dialog', stanzas: [{ speaker: 'Nobody', text: 'A beat with no voice of its own.' }] }); await wait(700);
  out.silentBeat = [1, 2, 3].every((n) => el(n).paused) && ev('_vidDuckDepth') === duck0;
  for (let i = 0; i < 3 && ov.classList.contains('on'); i++) { ov.click(); await wait(300); }
  return out;
});
await browser.close(); server.kill();

checks.push(['opening the beat buffers all three reads up front', r.prewarmed]);
checks.push(['stanza 1 is read aloud as it opens', r.s1 && /gravitos_gate_1\.mp3$/.test(r.s1src), r.s1src.slice(-40)]);
checks.push(['the read sits on the SFX volume (its base times the master)', r.base >= 0.8 && Math.abs(r.vol - r.base * r.master) < 0.01, `${r.vol.toFixed(3)} = ${r.base} x ${r.master}`]);
checks.push(['the music ducks under the read', r.duckedDuring]);
checks.push(['advancing stops stanza 1 and reads stanza 2', r.s1stopped && r.s2]);
checks.push(['the SFX slider reaches a read that is already playing', Math.abs(r.volAfterSlider - r.base * 0.3) < 0.01, r.volAfterSlider.toFixed(3)]);
checks.push(['the mute toggle reaches it too, both ways', r.mutedAfterToggle && r.unmutedAfterToggle]);
checks.push(['advancing again stops stanza 2 and reads stanza 3', r.s2stopped && r.s3]);
checks.push(['closing the beat stops the read and hands the music back', r.closed && r.s3stopped && r.duckReleased]);
checks.push(['a beat with no voice stays silent and leaves the music alone', r.silentBeat]);
checks.push(['no failed request for a read', bad.length === 0, bad.slice(0, 2).join(' | ')]);
checks.push(['no page errors', errs.length === 0, errs.slice(0, 2).join(' | ')]);
let fails = 0;
for (const [n, ok, extra] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra ? '  [' + extra + ']' : '')); if (!ok) fails++; }
console.log(`${checks.length - fails}/${checks.length} passed`);
process.exit(fails ? 1 : 0);
