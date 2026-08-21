// Arcane Burst's cue lands DURING the skill, per user: "Arcane Burst sound
// effect only happens AFTER the skill is done, it should play during the skill".
//
// The cast path was never late — measured, the audio element starts within
// 20-64ms of castSkill(). The lateness was baked into the asset:
// mage_thunder.mp3 opened with a soft tick, then ~500ms of digital silence,
// then the actual thunder crack at 1039ms. Arcane Burst's visuals run ~570ms
// (a 34-frame sprite burst at 60fps), so the bang arrived after the spell had
// finished drawing — 89% of the clip's energy landed after the skill was over.
//
// This checks the property that matters and not the byte count: the impact of
// whatever clip the skill resolves to must fall inside the skill's own visual
// window. It walks the game's real alias table, so re-pointing Arcane Burst at
// a different cue keeps it honest.
// Run: node scripts/skill_sfx_timing_test.mjs [file.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const URL = 'file:///' + path.join(ROOT, args[0] || 'mojiworld_game.html').split(path.sep).join('/');
const browser = await chromium.launch({ channel: 'chrome',
  args: ['--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
let bad = 0;
const check = (ok, label, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  — ' + JSON.stringify(detail) : ''}`); if (!ok) bad++; };

// Arcane Burst's on-screen life: spawnSpriteBurst life 34 frames at 60fps.
const SKILL_MS = 570;

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof castSkill === 'function' && typeof loadMap === 'function', { timeout: 90000 });
const r = await page.evaluate(async (SKILL_MS) => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;
  const cards = [...document.querySelectorAll('#class-select-modal .cls-card')];
  const mage = cards.find((c) => /mage/i.test(c.textContent || '')) || cards[0];
  if (mage && !player.cls) { try { mage.click(); } catch (e) {} }
  const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
  const out = {};

  // Resolve the cue exactly the way _playSkillSfx does.
  const id = 'arcaneBurst';
  const key = (typeof _SKILL_SFX_FILES !== 'undefined' && _SKILL_SFX_FILES[id])
    ? id : ((typeof _SKILL_SFX_ALIAS !== 'undefined' && _SKILL_SFX_ALIAS[id]) || id);
  const file = (typeof _SKILL_SFX_FILES !== 'undefined') ? _SKILL_SFX_FILES[key] : null;
  out.key = key; out.file = file;
  if (!file) return out;

  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const dec = await ctx.decodeAudioData(await (await fetch(file)).arrayBuffer());
  const ch = dec.getChannelData(0), sr = dec.sampleRate;
  let peak = 0, peakAt = 0;
  for (let i = 0; i < ch.length; i++) { const v = Math.abs(ch[i]); if (v > peak) { peak = v; peakAt = i; } }
  out.durMs = Math.round(dec.duration * 1000);
  out.peakAtMs = Math.round(peakAt / sr * 1000);
  out.peak = +peak.toFixed(3);
  // Share of the clip's loudness that lands after the spell stops drawing.
  let total = 0, after = 0;
  const B = 0.05;
  for (let i = 0; i * B < dec.duration; i++) {
    const s0 = Math.floor(i * B * sr), s1 = Math.min(ch.length, Math.floor((i + 1) * B * sr));
    let sum = 0;
    for (let j = s0; j < s1; j++) sum += ch[j] * ch[j];
    const rms = Math.sqrt(sum / Math.max(1, s1 - s0));
    total += rms;
    if (i * B * 1000 >= SKILL_MS) after += rms;
  }
  out.pctEnergyAfterSkill = Math.round(100 * after / Math.max(1e-9, total));
  // Longest run of near-silence before the impact — the dead air that caused this.
  let gap = 0, run = 0;
  for (let i = 0; i < peakAt; i++) {
    if (Math.abs(ch[i]) < peak * 0.01) { run++; if (run > gap) gap = run; } else run = 0;
  }
  out.leadSilenceMs = Math.round(gap / sr * 1000);

  // And the cast path itself must still fire the cue promptly.
  player.level = 60; player.mp = player.maxMp = 999;
  loadMap('forest');
  await new Promise((res) => setTimeout(res, 1200));
  if (typeof audio !== 'undefined' && audio) audio.muted = false;
  const el = (typeof _skillSfxEl === 'function') ? _skillSfxEl(key) : null;
  out.elFound = !!el;
  if (el) {
    player.skillCooldowns = {}; player.mp = 999;
    const t0 = performance.now();
    castSkill(id);
    let started = null;
    for (let i = 0; i < 240 && started == null; i++) {
      await new Promise((res) => requestAnimationFrame(res));
      if (el.currentTime > 0.001) started = performance.now() - t0;
    }
    out.startedAfterCastMs = started == null ? null : Math.round(started);
  }
  return out;
}, SKILL_MS);
await browser.close();

console.log(`  arcaneBurst -> ${r.key} (${r.file})`);
console.log(`  clip ${r.durMs}ms, peak at ${r.peakAtMs}ms, lead silence ${r.leadSilenceMs}ms, ${r.pctEnergyAfterSkill}% of energy after the ${SKILL_MS}ms skill`);
console.log(`  cue started ${r.startedAfterCastMs}ms after the cast`);

check(!!r.file, 'Arcane Burst resolves to a sound file', r.key);
check(r.peakAtMs != null && r.peakAtMs < 250,
      'the clip\'s impact lands at the start, not seconds later (was 1039ms)', r.peakAtMs);
check(r.leadSilenceMs < 200, 'no long dead air before the impact (was ~500ms)', r.leadSilenceMs);
check(r.pctEnergyAfterSkill <= 35,
      'most of the sound happens while the skill is still on screen (was 89% after)', r.pctEnergyAfterSkill);
check(r.peak > 0.5, 'and the transient survived the trim — it was not clipped away', r.peak);
check(r.elFound && r.startedAfterCastMs != null && r.startedAfterCastMs < 250,
      'the cast still fires the cue immediately', r.startedAfterCastMs);
check(errs.length === 0, 'no page errors', [...new Set(errs)].slice(0, 3));
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
