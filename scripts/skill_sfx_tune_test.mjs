// Skill Sound Tuner: the tester's page, the bake and the game must agree.
//  A. game  - data/skill_sfx_tune.js loads; a tuned skill plays on its OWN
//             element with the tuned loudness / pitch / start, waits its delay,
//             stops and fades on the audio clock, swaps its clip or stays silent;
//             an untuned skill on the same bucket is untouched; the settings
//             slider still scales it; junk clamps; castSkill goes through it; the
//             catalog still resolves every skill to the clip the game plays.
//  B. page  - tools/skill_sfx_tester.html lists every skill, its rules give the
//             game's numbers over a grid of settings, and it plays a tuning with
//             the same volume / rate / pitch lock / start / delay / stop.
//  C. hand-back - its "Copy everything" text bakes (apply_sfx_patch.mjs) into
//             exactly what the page heard; a stale base is a CONFLICT; an unknown
//             skill refuses the patch; regen reads the "needs a new sound" items.
//  D. data  - every baked entry names a real skill, and no baked trim refers to
//             a clip since regenerated to a different length.
// Run: node scripts/skill_sfx_tune_test.mjs [game.html]
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = process.argv.slice(2).find((a) => !a.startsWith('--'));
const url = (p) => 'file:///' + path.resolve(ROOT, p).split(path.sep).join('/');
let bad = 0;
const check = (ok, label, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  - ' + JSON.stringify(detail) : ''}`); if (!ok) bad++; };
const near = (a, b, e) => typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= e;
const CAT = JSON.parse(readFileSync(path.join(ROOT, 'tools', 'skill_sfx_catalog.js'), 'utf8').match(/window\.LX_SKILL_SFX_CATALOG = (\{[\s\S]*\});/)[1]);
const ROW = Object.fromEntries(CAT.rows.map((r) => [r.id, r]));
// Skills are picked from the catalog, not hard-coded: two that share a clip (the
// tuned one and its untouched sibling), plus fixed roles for swap/mute/cast.
const byFile = {}; CAT.rows.forEach((r) => { if (r.file) (byFile[r.file] = byFile[r.file] || []).push(r.id); });
const FIXED = ['fireball', 'iceSpike', 'arcaneBurst'];
const [TUNED, SIB] = Object.values(byFile).find((ids) => ids.length > 1 && !ids.some((i) => FIXED.includes(i))) || [];
const JUNK = (CAT.rows.find((r) => r.file && !r.cue && ![TUNED, SIB, ...FIXED].includes(r.id)) || {}).id;
const V = { vol: [0, 0.5, 1, 1.37, 2, 7, -1, 'x'], pitch: [0, -12, 3.5, 12, 40, null], start: [0, 0.2, 11], end: [0, 0.1, 0.5, 20],
  fade: [0, 0.05, 0.3, 9], delay: [0, 0.3, 4], file: ['', 'audio/skill/mage_ice.mp3', '../x.mp3', 'audio/skill/a.b.mp3'], mute: [false, true, 'yes'] };
let seed = 7; const rnd = (n) => (seed = (seed * 1103515245 + 12345) % 2147483648) % n;
const GRID = [[null, 1], ['str', 1]];
for (let i = 0; i < 240; i++) { const t = {}; for (const [k, vs] of Object.entries(V)) if (rnd(3)) t[k] = vs[rnd(vs.length)]; GRID.push([t, [0, 0.8, 1.5][rnd(3)]]); }

const browser = await chromium.launch({ channel: 'chrome', args: ['--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const errs = [];
console.log(`A. the game  (tuned ${TUNED}, sibling ${SIB}, junk ${JUNK})`);
check(!!(TUNED && SIB && JUNK) && FIXED.every((i) => ROW[i]), 'the catalog has the skills this test needs');
const gp = await ctx.newPage();
gp.on('pageerror', (e) => errs.push('game: ' + String(e).slice(0, 160)));
await gp.goto(url(arg || 'mojiworld_game.html'), { waitUntil: 'domcontentloaded' });
await gp.waitForFunction(() => typeof castSkill === 'function' && typeof loadMap === 'function' && typeof _playSkillSfx === 'function', null, { timeout: 120000 });
const A = await gp.evaluate(async ({ rows, TUNED, SIB, JUNK }) => {
  const out = {}, wait = (ms) => new Promise((r) => setTimeout(r, ms)), tail = (s) => s.split('/').slice(-3).join('/');
  const key = (id) => (_SKILL_SFX_FILES[id] ? id : (_SKILL_SFX_ALIAS[id] || id));
  out.shipped = (window.LX_SKILL_SFX_TUNE && typeof window.LX_SKILL_SFX_TUNE === 'object') ? JSON.parse(JSON.stringify(window.LX_SKILL_SFX_TUNE)) : null;
  out.hooks = [typeof _lxSkillSfxTune, typeof _lxSkillSfxPlan, typeof _lxPlayTunedSkillSfx].every((t) => t === 'function');
  out.drift = rows.filter((r) => (_SKILL_SFX_FILES[key(r.id)] || null) !== r.file).map((r) => r.id);
  out.noRow = Object.keys(SKILLS).filter((id) => !rows.some((r) => r.id === id));
  const ov = document.getElementById('loading-overlay'); if (ov) ov.style.display = 'none';
  window._lxBootGateDone = true;
  const cards = [...document.querySelectorAll('#class-select-modal .cls-card')];
  const mage = cards.find((c) => /mage/i.test(c.textContent || '')) || cards[0];
  if (mage && !player.cls) { try { mage.click(); } catch (e) {} }
  const gm = document.getElementById('class-select-modal'); if (gm) gm.style.display = 'none';
  player.level = 60; player.mp = player.maxMp = 999;
  loadMap('forest');
  await wait(1200);
  if (typeof audio !== 'undefined' && audio) audio.muted = false;
  const plays = [], orig = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () { plays.push({ el: this, src: this.src, volume: this.volume, rate: this.playbackRate, pp: this.preservesPitch, t0: this.currentTime, at: performance.now() }); return orig.apply(this, arguments); };
  const by = (el) => plays.find((p) => p.el === el);
  const tKey = key(TUNED), tFile = _SKILL_SFX_FILES[tKey];
  const d = await new Promise((res) => { const a = new Audio(); a.preload = 'metadata'; a.onloadedmetadata = () => res(a.duration); a.onerror = () => res(0); a.src = tFile; });
  out.tfb = { vol: 1.6, pitch: -3, start: 0.1, end: +Math.min(0.45, d * 0.7).toFixed(3), fade: 0.1, delay: 0.25 };
  out.master = _SFX_MASTER_VOL;
  window.LX_SKILL_SFX_TUNE = { [TUNED]: out.tfb, fireball: { file: 'audio/skill/mage_ice.mp3' }, iceSpike: { mute: true },
    [JUNK]: { vol: 99, pitch: 'x', start: -5, fade: 'y', file: '../../secret.mp3', delay: -2 }, arcaneBurst: { vol: 0.5 } };
  plays.length = 0; const t0 = performance.now();
  _playSkillSfx(TUNED);
  await wait(130); out.early = plays.filter((p) => p.el === _skillSfxEls['~' + TUNED]).length;
  await wait(420);
  const p = by(_skillSfxEls['~' + TUNED]);
  out.fb = p ? { delay: Math.round(p.at - t0), volume: p.volume, rate: p.rate, pp: p.pp, t0: p.t0, own: true, bucket: p.el === _skillSfxEls[tKey] } : null;
  await wait(900);
  out.after = p ? { paused: p.el.paused, t: p.el.currentTime, vol: p.el.volume } : null;
  plays.length = 0; _playSkillSfx(SIB); await wait(60);
  const q = by(_skillSfxEls[key(SIB)]); out.sib = q ? { volume: q.volume, rate: q.rate, pp: q.pp, base: q.el._sfxBase } : null;
  plays.length = 0; _playSkillSfx('fireball'); await wait(60);
  const w = by(_skillSfxEls['~fireball']); out.swap = w ? tail(w.src) : null;
  plays.length = 0; _playSkillSfx('iceSpike'); await wait(80);
  out.ice = { plays: plays.filter((x) => x.src.endsWith(_SKILL_SFX_FILES[key('iceSpike')])).length, el: !!_skillSfxEls['~iceSpike'] };
  out.junk = _lxSkillSfxTune(JUNK);
  plays.length = 0; _playSkillSfx(JUNK); await wait(60);
  const j = by(_skillSfxEls['~' + JUNK]); out.junkPlay = j ? { volume: j.volume, rate: j.rate, src: tail(j.src), own: tail(_SKILL_SFX_FILES[key(JUNK)]) } : null;
  _setSfxMasterVolume(0.5); out.scaled = _skillSfxEls['~' + TUNED].volume; _setSfxMasterVolume(out.master);
  plays.length = 0; player.skillCooldowns = {}; player.mp = 999;
  try { castSkill('arcaneBurst'); } catch (e) { out.castErr = String(e); }
  await wait(150);
  const c = by(_skillSfxEls['~arcaneBurst']); out.cast = c ? { volume: c.volume } : null;
  return out;
}, { rows: CAT.rows.map((r) => ({ id: r.id, file: r.file })), TUNED, SIB, JUNK });
const m = A.master, fb = A.fb || {}, fa = A.after || {};
check(A.hooks, 'the game has _lxSkillSfxTune / _lxSkillSfxPlan / _lxPlayTunedSkillSfx');
check(A.shipped !== null, 'data/skill_sfx_tune.js loads (window.LX_SKILL_SFX_TUNE)');
check(!A.drift.length && !A.noRow.length, 'the catalog matches the game (else run scripts/gen_skill_sfx_catalog.mjs)', { drift: A.drift, noRow: A.noRow });
check(A.early === 0 && fb.delay >= 235 && fb.delay <= 520, 'a 0.25 s delay: silent at 130 ms, then plays', { early: A.early, delay: fb.delay });
check(!!A.fb && fb.bucket === false, 'a tuned skill plays on its own element, never its shared bucket', fb);
check(near(fb.volume, 0.8 * m, 0.005), 'loudness 160% of the skill base, times the master volume', { got: fb.volume, want: 0.8 * m });
check(near(fb.rate, Math.pow(2, -3 / 12), 0.001) && fb.pp === false, 'pitch -3: rate 0.841 with the pitch lock off', fb);
check(near(fb.t0, 0.1, 0.02), 'starts 0.1 s into the clip', fb.t0);
check(fa.paused === true && fa.t >= A.tfb.end - 0.02 && fa.t <= A.tfb.end + 0.1, `stops at ${A.tfb.end} s of the clip, on the audio clock`, fa);
check(fa.vol < fb.volume * 0.5, '... fading out into the stop', fa);
check(!!A.sib && near(A.sib.volume, 0.5 * m, 0.005) && A.sib.rate === 1 && A.sib.pp !== false && A.sib.base === 0.5, `untuned ${SIB} on the same clip plays exactly as before`, A.sib);
check(A.swap === 'audio/skill/mage_ice.mp3', 'a clip swap plays the chosen clip', A.swap);
check(A.ice.plays === 0 && !A.ice.el, 'a muted skill plays nothing and builds nothing', A.ice);
const jj = A.junk || {};
check(jj.vol === 2 && jj.pitch === 0 && jj.start === 0 && jj.fade === 0 && jj.delay === 0 && jj.file === '' && jj.mute === false, 'junk values clamp to safe ones', jj);
check(!!A.junkPlay && near(A.junkPlay.volume, m, 0.005) && A.junkPlay.rate === 1 && A.junkPlay.src === A.junkPlay.own, "... and still play the skill's own clip, capped at full volume", A.junkPlay);
check(near(A.scaled, 0.8 * 0.5, 0.005), 'the settings slider still scales a tuned skill', A.scaled);
check(!!A.cast && near(A.cast.volume, 0.25 * m, 0.005), 'castSkill goes through the tuning (Arcane Burst at 50%)', A.cast || A.castErr);

console.log('B. the tester page');
const tp = await ctx.newPage();
tp.on('pageerror', (e) => errs.push('page: ' + String(e).slice(0, 160)));
await tp.goto(url('tools/skill_sfx_tester.html'), { waitUntil: 'load' });
await tp.waitForFunction(() => window.__lxTuner && document.querySelectorAll('#list .row[id^="r_"]').length > 0, null, { timeout: 20000 });
const gamePlans = await gp.evaluate(({ grid, m }) => grid.map(([t, d]) => { window.LX_SKILL_SFX_TUNE.__probe = t; const o = _lxSkillSfxTune('__probe'); return o && { o, p: _lxSkillSfxPlan(o, m, d) }; }), { grid: GRID, m });
const B = await tp.evaluate(async ({ grid, m, id, tfb }) => {
  const T = window.__lxTuner, wait = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
  out.rows = document.querySelectorAll('#list .row[id^="r_"]').length;
  out.plans = grid.map(([t, d]) => { const o = T.sanitize(t); return o && { o, p: T.plan(o, m, d) }; });
  T.state().master = m;
  const plays = [], orig = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () { plays.push({ volume: this.volume, rate: this.playbackRate, pp: this.preservesPitch, t0: this.currentTime, at: performance.now() }); return orig.apply(this, arguments); };
  T.setTune(id, tfb);
  const t0 = performance.now(); T.play(id);
  await wait(130); out.early = plays.length;
  await wait(420);
  const p = plays[0]; out.fb = p ? { delay: Math.round(p.at - t0), volume: p.volume, rate: p.rate, pp: p.pp, t0: p.t0 } : null;
  await wait(900);
  out.after = { paused: player.paused, t: player.currentTime };
  return out;
}, { grid: GRID, m, id: TUNED, tfb: A.tfb });
check(B.rows === CAT.rows.length, `the page lists every skill (${CAT.rows.length})`, B.rows);
const gi = gamePlans.findIndex((g, i) => JSON.stringify(g) !== JSON.stringify(B.plans[i]));
check(gi < 0, `its rules give the game's numbers for all ${GRID.length} settings`, gi < 0 ? undefined : { input: GRID[gi], game: gamePlans[gi], page: B.plans[gi] });
const pf = B.fb || {};
check(near(pf.volume, fb.volume, 1e-6) && pf.rate === fb.rate && pf.pp === fb.pp && near(pf.t0, fb.t0, 0.02), "it plays a tuning with the game's volume, rate, pitch lock and start", { page: pf, game: fb });
check(B.early === 0 && pf.delay >= 235 && pf.delay <= 520 && B.after.paused && near(B.after.t, fa.t, 0.1), '... the same delay and the same stop', { page: [B.early, pf.delay, B.after], game: [fb.delay, fa] });

console.log('C. the hand-back');
const C = await tp.evaluate(({ TUNED, SIB, tfb }) => {
  const T = window.__lxTuner, s = T.state();
  T.bake({ [SIB]: { vol: 0.5 } });   // as if SIB had already been tuned in the game
  T.setTune(TUNED, tfb); T.setTune('fireball', { file: 'audio/skill/mage_ice.mp3' }); T.setTune('iceSpike', { mute: true }); T.setTune(SIB, {});
  s.v.arcaneBurst = 'bad'; s.c.arcaneBurst = 'too thin, should be a deep boom';
  return { text: T.report(), patch: T.patch() };
}, { TUNED, SIB, tfb: A.tfb });
const tmp = mkdtempSync(path.join(os.tmpdir(), 'sfxtune-')), tbl = path.join(tmp, 'tune.js'), rep = path.join(tmp, 'report.txt');
const header = readFileSync(path.join(ROOT, 'data', 'skill_sfx_tune.js'), 'utf8').split('window.LX_SKILL_SFX_TUNE = ')[0];
const seedTable = (entry) => writeFileSync(tbl, header + `window.LX_SKILL_SFX_TUNE = {\n  "${SIB}": ${entry}\n};\n`);
const apply = (...extra) => {
  try { return { code: 0, out: execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'apply_sfx_patch.mjs'), rep, '--table=' + tbl, ...extra], { encoding: 'utf8', stdio: 'pipe' }) }; }
  catch (e) { return { code: e.status, out: String(e.stdout || '') + String(e.stderr || '') }; }
};
writeFileSync(rep, C.text); seedTable('{"vol":0.5}');
const r1 = apply(), T1 = JSON.parse(readFileSync(tbl, 'utf8').match(/window\.LX_SKILL_SFX_TUNE = (\{[\s\S]*?\});/)[1]);
check(r1.code === 0, 'apply_sfx_patch.mjs bakes the pasted report', r1.out.slice(0, 300));
check(!!T1[TUNED] && JSON.stringify(T1[TUNED]) === JSON.stringify(C.patch.tune[TUNED]) && T1[TUNED].vol === 1.6, 'the baked entry is exactly what the page heard', { baked: T1[TUNED], page: C.patch.tune[TUNED] });
check(!!T1.fireball && T1.fireball.file === 'audio/skill/mage_ice.mp3' && !!T1.iceSpike && T1.iceSpike.mute === true, 'a clip swap and a mute bake', { fireball: T1.fireball, iceSpike: T1.iceSpike });
check(!(SIB in T1) && !/CONFLICT/.test(r1.out), 'a skill put back to its plain recording leaves the table', T1[SIB]);
check(/needs a new sound/.test(r1.out) && /arcaneBurst: too thin/.test(r1.out), '"needs a new sound" notes are listed with the regen command', r1.out.slice(-300));
seedTable('{"vol":0.7}'); const r2 = apply('--dry-run');
check(r2.code === 0 && r2.out.includes('CONFLICT ' + SIB), 'a table changed after the tester loaded it is reported as a CONFLICT', r2.out.slice(0, 300));
writeFileSync(rep, C.text.replace('"tune":{', '"tune":{"noSuchSkill":{"vol":1.2},')); const r3 = apply('--dry-run');
check(r3.code === 2 && /unknown skill id/.test(r3.out), 'an unknown skill id refuses the whole patch', r3.out.slice(0, 200));
rmSync(tmp, { recursive: true, force: true });
const { sniff } = await import(pathToFileURL(path.join(ROOT, 'scripts', 'regen_sfx_from_comments.mjs')).href);
const parsed = sniff(C.text, 'tuner'), hit = parsed.rows.find((r) => r.file === ROW.arcaneBurst.file);
check(!!hit && hit.verdict === 'bad' && /deep boom/.test(hit.comment), 'regen_sfx_from_comments reads the "needs a new sound" item', parsed.rows);
check(!parsed.rows.some((r) => r.file === ROW[TUNED].file || r.file === 'audio/skill/mage_ice.mp3'), '... and never a skill that was only tuned', parsed.rows.map((r) => r.file));

console.log('D. the baked table');
const shipped = A.shipped || {};
const unknown = Object.keys(shipped).filter((id) => !ROW[id]);
check(!unknown.length, `every baked entry names a real skill (${Object.keys(shipped).length} baked)`, unknown);
const withDur = Object.entries(shipped).filter(([id, t]) => ROW[id] && t && typeof t.dur === 'number').map(([id, t]) => [id, t.dur, t.file || ROW[id].file]);
const stale = await tp.evaluate(async (list) => {
  const out = [];
  for (const [id, dur, file] of list) {
    const d = await new Promise((res) => { const a = new Audio(); a.preload = 'metadata'; a.onloadedmetadata = () => res(a.duration); a.onerror = () => res(0); a.src = file; });
    if (!(Math.abs(d - dur) <= 0.03)) out.push({ id, tunedOn: dur, now: +d.toFixed(3) });
  }
  return out;
}, withDur);
check(!stale.length, 'no baked trim refers to a clip that has since changed length (re-tune these)', stale);
check(!errs.length, 'no page errors in the game or the page', errs.slice(0, 4));
await browser.close();
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
