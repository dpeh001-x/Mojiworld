// MUTE -> UNMUTE SFX RECOVERY — guard.
// ============================================================================
// Reported: "if you left the game on mute, then unmute, the game takes some
// time for all the sfx to come back."
//
// Only the FILE-based layer was affected (the synth cues in audio.play() need
// no loading, which is why part of the audio returned instantly and the rest
// trickled). Three faults:
//   1. _uiSfxEl / _skillSfxEl stamp `a.muted = audio.muted` at creation, and
//      the first-gesture prewarm builds an element for EVERY UI id. Mute then,
//      and every one is born muted — while toggleMute() mirrored its new state
//      onto the BGM elements but never onto these caches. Those clips never
//      came back at all without a reload.
//   2. _playSkillSfx / _playUiSfx returned on the mute check BEFORE building
//      the element, so a muted session downloaded nothing and each cue paid
//      construct-and-fetch on its first use after unmuting.
//   3. Skill SFX used preload 'metadata', so even unmuted the first play waited
//      on the byte body — the UI path had already been fixed for this.
//
// Replays the real sequence against the live audio object: mute, play cues,
// unmute, then inspect the actual cached HTMLAudioElements.
// Run: node scripts/mute_unmute_sfx_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9329;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`,
  { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);

const R = await page.evaluate(async () => {
  const uiIds = Object.keys(_UI_SFX_FILES).slice(0, 6);
  const skillIds = Object.keys(_SKILL_SFX_FILES).slice(0, 6);

  // ---- Start muted, exactly as the player left it ------------------------
  audio.muted = true;
  if (typeof game !== 'undefined') game.muted = true;

  // The first-gesture prewarm builds an element for EVERY UI id — while muted.
  for (const id of uiIds) { try { _uiSfxEl(id); } catch (e) {} }
  // And the player goes on playing: cues fire but are silenced.
  for (const id of uiIds) { try { _playUiSfx(id); } catch (e) {} }
  for (const id of skillIds) { try { _playSkillSfx(id); } catch (e) {} }
  await new Promise(r => setTimeout(r, 400));

  const builtWhileMuted = {
    ui: uiIds.filter(id => !!_uiSfxEls[id]).length,
    skill: skillIds.filter(id => !!_skillSfxEls[id]).length,
  };

  // ---- Unmute the way a player does --------------------------------------
  audio.toggleMute();          // muted -> unmuted
  await new Promise(r => setTimeout(r, 400));

  const stillMuted = {
    ui: uiIds.filter(id => _uiSfxEls[id] && _uiSfxEls[id].muted).map(String),
    skill: skillIds.filter(id => _skillSfxEls[id] && _skillSfxEls[id].muted).map(String),
  };
  // preload policy: 'auto' means the body is fetched ahead of first play
  const preloads = {
    ui: uiIds.filter(id => _uiSfxEls[id]).map(id => _uiSfxEls[id].preload),
    skill: skillIds.filter(id => _skillSfxEls[id]).map(id => _skillSfxEls[id].preload),
  };
  return {
    audioMuted: audio.muted, uiCount: uiIds.length, skillCount: skillIds.length,
    builtWhileMuted, stillMuted, preloads,
    hasSync: typeof _lxSyncSfxMuted === 'function',
  };
});
await browser.close(); server.kill();

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 125) });

ok('unmute actually flipped the master flag', R.audioMuted === false);
// Fault 1 — the one that meant sounds never returned at all.
ok('no cached UI clip is left muted after unmute', R.stillMuted.ui.length === 0,
   R.stillMuted.ui.length ? 'still muted: ' + R.stillMuted.ui.join(',') : 'all clear');
ok('no cached skill clip is left muted after unmute', R.stillMuted.skill.length === 0,
   R.stillMuted.skill.length ? 'still muted: ' + R.stillMuted.skill.join(',') : 'all clear');
ok('a mute-sync helper exists for both caches', R.hasSync);
// Fault 2 — nothing warmed during the muted stretch.
ok('skill clips played while muted are still warmed (built ahead of unmute)',
   R.builtWhileMuted.skill === R.skillCount,
   `built ${R.builtWhileMuted.skill}/${R.skillCount} while muted`);
// Fault 3 — headers only.
ok('skill clips buffer the body, not just headers',
   R.preloads.skill.length > 0 && R.preloads.skill.every(p => p === 'auto'),
   `preload=${[...new Set(R.preloads.skill)].join(',')}`);

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
