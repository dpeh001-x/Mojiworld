#!/usr/bin/env node
// SFX COMMENT REGENERATOR - turn reviewer comments into regenerated clips.
// =============================================================================
// Every earlier pass (gen_sfx_regen_pass, regen_sfx_batch, gen_tester_sfx_pass2)
// was a fresh hand-written script with the reviewer's comments transcribed into
// hardcoded prompts. This is the durable replacement: it reads the exports the
// review pages already produce and does the whole round trip itself.
//
// INPUTS (any mix; format is sniffed from the content, not the extension):
//   * the tester report text  - tools/sound_review.html "Copy everything"
//   * mojiworld_sound_progress.json - the same page's "Save my progress"
//   * regen_notes.json        - tools/monster_sound_review.html work order
//   * sfx_regen_list.json     - monster_animator.html SFX board export
//   * --paste                 - a report pasted on stdin (chat hand-back)
//
// WHAT IT DOES
//   1. matches every commented clip to data/sfx_manifest.js (id or file path)
//   2. decides what to regenerate: NEEDS WORK, plus NOT SURE / no-verdict rows
//      that carry a comment; GOOD-with-comment only with --include-good
//   3. skips what a human would skip, and SAYS why: comments that are not a
//      sound critique ("cannot find this monster", "can be used"), clips
//      already regenerated after the review was written, music-length clips
//      unless --allow-music, anything with no manifest entry
//   4. composes the prompt the way the shipped passes did: the game-wide style
//      rule for the category, the clip's in-game context, the reviewer's
//      comment as explicit creative direction, and the short-one-shot suffix
//   5. generates via ludo.ai, measuring duration from the MP3's own frame
//      headers (the API's word is not trusted), retrying shorter and finally
//      frame-trimming; backs the original up under audio/_regen_backup/<tag>/
//      and replaces it atomically; resumable (a clip with a backup is skipped
//      unless --force); stops dead on 402
//   6. writes audio/_regen_backup/<tag>/regen_notes.json - what each clip was
//      asked to be - and merges monster entries into audio/monster/regen_notes.json
//   7. --finish regenerates the SFX manifest + tester page and runs the
//      duration test, then reminds you of the sw.js cache bump the push gate
//      will demand (audio replaced under its own name is cached art)
//
//   node scripts/regen_sfx_from_comments.mjs review.txt              # dry-run plan
//   node scripts/regen_sfx_from_comments.mjs review.txt --generate   # 2cr / clip
//   node scripts/regen_sfx_from_comments.mjs a.json b.txt --json     # plan as JSON
//   node scripts/regen_sfx_from_comments.mjs --finish                # post-run bake
//   flags: --tag=<backup folder> (default pre_<date>)  --only=<substr>  --limit=N
//          --include-good  --allow-music  --force  --since=<YYYY-MM-DD>
//          --verdicts=bad,meh,none  --paste
// =============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

// LX_SFX_ROOT lets the test run the full generate path against a scratch tree
// (copied manifest + fixture clips) so it never touches the repo's audio.
const ROOT = process.env.LX_SFX_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const opt = (k, d) => { const a = argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const INPUTS = argv.filter((a) => !a.startsWith('--'));
const today = new Date().toISOString().slice(0, 10);
const TAG = opt('tag', 'pre_' + today.replace(/-/g, ''));
const VERDICTS = new Set(opt('verdicts', 'bad,meh,none').split(',').map((s) => s.trim()).filter(Boolean));
const LIMIT = Number(opt('limit', 0)) || 0;
const ONLY = opt('only', '');
const SINCE = opt('since', '');

// ---- MP3 duration straight from the frame headers ---------------------------
const RATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
const SR = [44100, 48000, 32000, 0];
export function frames(buf) {
  let p = 0;
  if (buf.subarray(0, 3).toString('latin1') === 'ID3') {
    const sz = ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f);
    p = 10 + sz;
  }
  const out = []; let dur = 0;
  while (p + 4 < buf.length) {
    if (buf[p] !== 0xff || (buf[p + 1] & 0xe0) !== 0xe0) { p++; continue; }
    const br = RATES[(buf[p + 2] >> 4) & 0x0f] * 1000;
    const sr = SR[(buf[p + 2] >> 2) & 0x03];
    if (!br || !sr) { p++; continue; }
    const len = Math.floor(144 * br / sr) + ((buf[p + 2] >> 1) & 1);
    dur += 1152 / sr;
    out.push({ off: p, end: p + len, at: dur });
    p += len;
  }
  return { list: out, dur };
}
export const durationOf = (buf) => frames(buf).dur;
export function trimTo(buf, maxSec) {
  const f = frames(buf);
  if (f.dur <= maxSec || !f.list.length) return buf;
  let cut = f.list[f.list.length - 1].end;
  for (const fr of f.list) if (fr.at > maxSec) { cut = fr.off; break; }
  return buf.subarray(0, cut);
}

// ---- the tables the game already keeps ------------------------------------
const manifestSrc = fs.readFileSync(path.join(ROOT, 'data', 'sfx_manifest.js'), 'utf8');
const MANIFEST = JSON.parse(manifestSrc.slice(manifestSrc.indexOf('['), manifestSrc.lastIndexOf(']') + 1));
const BY_ID = new Map(MANIFEST.map((m) => [m.id, m]));
const BY_FILE = new Map(MANIFEST.map((m) => [m.file.replace(/\\/g, '/'), m]));
let NAMES = { npcs: {}, mons: {} };
try { NAMES = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'sound_review_names.json'), 'utf8')); } catch (e) { /* names are optional */ }

// The 1-second pins are read from the test that ENFORCES them, so the two can
// never disagree: any clip listed in sfx_duration_test.mjs keeps its 1.0s bar
// no matter what category rule would otherwise apply (Captain Plum is an NPC
// voice pinned under 1s - the babble bar would be wrong for it).
const PINNED_1S = new Set();
try {
  const t = fs.readFileSync(path.join(ROOT, 'scripts', 'sfx_duration_test.mjs'), 'utf8');
  for (const m of t.matchAll(/'(audio\/[^']+\.mp3)'/g)) PINNED_1S.add(m[1]);
  for (const l of ['Freeze', 'Poison', 'SkillLock', 'Stun']) { PINNED_1S.add(`audio/monster/mob_octoLeg${l}_hit.mp3`); PINNED_1S.add(`audio/monster/mob_octoLeg${l}_die.mp3`); }
} catch (e) { /* no test file: no pins */ }

// ---- per-category rules: style, endpoint, requested length, hard bar --------
const SHORT = ' Very short one-shot, punchy, no tail, no music, no reverb wash, mono game SFX.';
const BABBLE = 'Animal Crossing style character voice BABBLE for a video game: nonsense vocal syllables only, NOT real words, NOT speech, NOT singing. Single voice, clean dry studio recording, no music, no background noise. ';
const CUTE = 'Game-wide style: regular monsters are cute, adorable cartoon creatures - playful, endearing, toy-like, chibi MapleStory tone. ';
const BOSSY = 'Game-wide style: big bosses are weighty and dramatic, but cartoonish, never realistic-scary. ';
export const RULES = {
  'monster-hit': { ep: 'sfx', req: 0.5, max: 1.0, style: 'monster' },
  'monster-die': { ep: 'sfx', req: 0.9, max: 1.0, style: 'monster' },
  'mob-fire':    { ep: 'sfx', req: 0.45, max: 1.0, style: 'A monster projectile being fired. ' },
  'skill':       { ep: 'sfx', req: 0.6, max: 1.2, style: 'A player skill cast sound: short, succinct and punchy, cut cleanly with no echo tail. ' },
  'ui':          { ep: 'sfx', req: 0.4, max: 1.0, style: 'A clean, pleasant game UI sound that stays pleasant when repeated often. ' },
  'voice':       { ep: 'sfx', req: 0.8, max: 1.5, style: 'A player-character voice bark: one short wordless vocalization, cartoon hero tone. ' },
  'boss-voice':  { ep: 'sfx', req: 1.6, max: 2.0, style: 'A boss intro VOICE - a short in-character vocalization, NOT music. ' + BOSSY },
  'npc':         { ep: 'sfx', req: 1.2, max: 1.8, style: BABBLE },
  'bgm':         { ep: 'music', req: 85, max: 0, style: 'Loopable video-game background music track. ' },
  'ambient':     { ep: 'music', req: 60, max: 0, style: 'Loopable ambient soundscape bed for a video-game map, no melody, no drums. ' },
};
// ---- input parsers: every export the review pages produce -------------------
// All of them normalise to { id?, file?, verdict: 'bad'|'meh'|'good'|'none', comment, source }.
// A leading "Tester:" is the label audio/monster/regen_notes.json stores
// comments under; strip it so a round trip never yields "Tester: Tester: ...".
const norm = (s) => String(s || '').replace(/\r/g, '').trim().replace(/^tester\s*:\s*/i, '');
export function parseReport(text, source) {
  // tools/sound_review.html "Copy everything": sections of numbered items with
  // a "file:" line and ">"-prefixed comment lines. The section header carries
  // the verdict. The Date: line dates the review for the already-regenerated check.
  const out = []; let verdict = 'none', cur = null, date = null;
  const m = text.match(/^Date:\s*(\d{4}-\d{2}-\d{2})/m); if (m) date = m[1];
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\r$/, '');
    const hdr = line.match(/^(NEEDS WORK|NOT SURE|MARKED GOOD, BUT WITH A COMMENT|COMMENTED, NO VERDICT GIVEN|MARKED GOOD, NOTHING TO CHANGE)\b/);
    if (hdr) { verdict = { 'NEEDS WORK': 'bad', 'NOT SURE': 'meh', 'MARKED GOOD, BUT WITH A COMMENT': 'good', 'COMMENTED, NO VERDICT GIVEN': 'none', 'MARKED GOOD, NOTHING TO CHANGE': 'ok' }[hdr[1]]; cur = null; continue; }
    if (verdict === 'ok') continue;
    const item = line.match(/^\s*\d+\.\s+(.+?)\s+\[(hit sound|death sound|NPC voice|fallback sound)\]\s*$/);
    if (item) { cur = { name: item[1], verdict, comment: '', source }; out.push(cur); continue; }
    if (!cur) continue;
    const f = line.match(/^\s*file:\s*(\S+)/); if (f) { cur.file = f[1].replace(/\\/g, '/'); continue; }
    const c = line.match(/^\s*>\s?(.*)$/);
    if (c) { if (!/^\(no comment written\)/.test(c[1])) cur.comment = (cur.comment ? cur.comment + ' ' : '') + norm(c[1]); continue; }
    if (cur.comment && /^\s{4,}\S/.test(line)) cur.comment += ' ' + norm(line);
  }
  return { rows: out.filter((r) => r.file), date };
}
export function parseProgress(j, source) {
  // { v: {id: 'bad'|'meh'|'good'}, c: {id: comment}, who }
  const ids = new Set([...Object.keys(j.v || {}), ...Object.keys(j.c || {})]);
  return { rows: [...ids].map((id) => ({ id, verdict: (j.v || {})[id] || 'none', comment: norm((j.c || {})[id]), source })), date: null, who: j.who || '' };
}
export function parseNotes(j, source) {
  // regen_notes.json: { '<monsterId>_<kind>': comment } -> manifest id mob_<monsterId>_<kind>
  return { rows: Object.entries(j).filter(([, v]) => typeof v === 'string').map(([k, v]) => ({
    id: BY_ID.has(k) ? k : 'mob_' + k, verdict: 'bad', comment: norm(v), source })), date: null };
}
export function parseRegenList(j, source) {
  // animator SFX board: { items: [{ id, file, cat, when }] } - ticked, no comment
  return { rows: (j.items || []).map((it) => ({ id: it.id, file: it.file, verdict: 'bad', comment: norm(it.comment), source })), date: null };
}
export function sniff(text, source) {
  const t = text.trim();
  if (/^MOJIWORLD\s+.*SOUND REVIEW/m.test(t) || /^\s*file:\s*audio\//m.test(t)) return parseReport(t, source);
  let j; try { j = JSON.parse(t); } catch (e) { throw new Error(source + ': not a sound-review report and not JSON'); }
  if (j && Array.isArray(j.items)) return parseRegenList(j, source);
  if (j && (j.v || j.c)) return parseProgress(j, source);
  if (j && typeof j === 'object') return parseNotes(j, source);
  throw new Error(source + ': unrecognised JSON shape');
}

// ---- matching, skipping, composing -----------------------------------------
const NOT_A_CRITIQUE = [
  /cannot find|can'?t find|couldn'?t find|not (able to )?find|where is this|did not (see|hear)|didn'?t (see|hear)|never (met|saw|heard)/i,
  /^\s*(can be used|usable|keep( it)?|fine( as is)?|ok(ay)?|good enough|works|no change|leave( it)?|it'?s fine)\s*[.!]?\s*$/i,
];
export const isCritique = (c) => !!c && !NOT_A_CRITIQUE.some((re) => re.test(c));
const monsterIdOf = (m) => { const k = m.id.match(/^mob_(.+)_(hit|die)$/); return k ? { key: k[1], kind: k[2] } : null; };
export function contextFor(m) {
  const mi = monsterIdOf(m);
  if (mi) {
    const info = (NAMES.mons || {})[mi.key] || {};
    const who = info.name ? `${info.name} (${mi.key})` : mi.key;
    return { who, boss: !!info.boss, lv: info.lv, line: `${who}${info.lv ? ', Lv ' + info.lv : ''}${info.boss ? ', a BOSS' : ''}. ${m.when}.` };
  }
  if (m.cat === 'npc') {
    const key = m.id.replace(/^npc_/, ''); const n = (NAMES.npcs || {})[key] || {};
    const who = n.name ? `${n.name}${n.role ? ', ' + n.role : ''}` : key;
    return { who, boss: false, line: `${who}${n.maps && n.maps.length ? ' (seen in ' + n.maps.slice(0, 2).join(', ') + ')' : ''}. ${m.when}.` };
  }
  return { who: m.id, boss: false, line: `${m.id}: ${m.when}.` };
}
export function compose(m, comment) {
  const rule = RULES[m.cat] || RULES.ui;
  const ctx = contextFor(m);
  const style = rule.style === 'monster' ? (ctx.boss ? BOSSY : CUTE) : rule.style;
  const direction = comment ? ` Creative direction from the reviewer, who judged the CURRENT clip wrong - fix exactly this: "${comment}".` : '';
  const tail = rule.ep === 'sfx' && m.cat !== 'npc' ? SHORT : '';
  return (style + ctx.line + direction + tail).replace(/\s+/g, ' ').trim();
}
export function plan(parsedList, opts) {
  const seen = new Map();   // id -> merged row (last comment wins, worst verdict wins)
  const rank = { bad: 3, none: 2, meh: 1, good: 0 };
  const reviewDate = opts.since || parsedList.map((p) => p.date).filter(Boolean).sort().pop() || null;
  const unmatched = [], skipped = [], regenerate = [];
  for (const p of parsedList) for (const r of p.rows) {
    const m = (r.id && BY_ID.get(r.id)) || (r.file && BY_FILE.get(r.file.replace(/\\/g, '/'))) || null;
    if (!m) { unmatched.push({ id: r.id, file: r.file, comment: r.comment, source: r.source }); continue; }
    const prev = seen.get(m.id);
    const merged = { id: m.id, file: m.file, cat: m.cat, verdict: r.verdict, comment: r.comment, source: r.source };
    if (prev) { merged.verdict = rank[r.verdict] >= rank[prev.verdict] ? r.verdict : prev.verdict; merged.comment = r.comment || prev.comment; merged.source = prev.source + '+' + r.source; }
    seen.set(m.id, merged);
  }
  for (const r of seen.values()) {
    const m = BY_ID.get(r.id); const rule = RULES[m.cat] || RULES.ui;
    const skip = (reason) => skipped.push({ id: r.id, file: r.file, reason, comment: r.comment });
    if (opts.only && !r.id.includes(opts.only) && !r.file.includes(opts.only)) continue;
    if (r.verdict === 'good' && !opts.includeGood) { skip('marked GOOD - praise is not a work order (--include-good)'); continue; }
    if (r.verdict !== 'bad' && !r.comment) { skip('no comment and not NEEDS WORK'); continue; }
    if (!opts.verdicts.has(r.verdict === 'good' ? 'good' : r.verdict)) { skip('verdict ' + r.verdict + ' not selected (--verdicts)'); continue; }
    if (r.comment && !isCritique(r.comment)) { skip('not a sound critique: "' + r.comment.slice(0, 70) + '"'); continue; }
    if (rule.ep === 'music' && !opts.allowMusic) { skip('music-length clip (' + m.cat + ') - needs --allow-music (3cr, ' + rule.req + 's)'); continue; }
    const abs = path.join(ROOT, m.file);
    // A backup under THIS tag means this run already did the clip: the most
    // specific reason, so it is checked before the generic date rule.
    if (opts.tag && !opts.force && fs.existsSync(path.join(ROOT, 'audio', '_regen_backup', opts.tag, m.file.replace(/^audio\//, '')))) {
      skip('already regenerated under ' + opts.tag + ' (backup exists) - --force to redo'); continue;
    }
    if (reviewDate && !opts.force && fs.existsSync(abs)) {
      const mt = fs.statSync(abs).mtime.toISOString().slice(0, 10);
      if (mt > reviewDate) { skip('already regenerated after the review (' + mt + ' > ' + reviewDate + ') - re-review it, or --force'); continue; }
    }
    const max = PINNED_1S.has(m.file) ? Math.min(rule.max || 1.0, 1.0) : rule.max;
    const req = max ? Math.min(rule.req, Math.max(0.35, max - 0.1)) : rule.req;
    regenerate.push({ id: r.id, file: r.file, cat: m.cat, verdict: r.verdict, comment: r.comment, source: r.source,
      ep: rule.ep, req, max, pinned: PINNED_1S.has(m.file), prompt: compose(m, r.comment) });
  }
  regenerate.sort((a, b) => a.file.localeCompare(b.file));
  const cut = opts.limit ? regenerate.slice(0, opts.limit) : regenerate;
  return { reviewDate, regenerate: cut, deferred: regenerate.length - cut.length, skipped, unmatched,
    credits: cut.reduce((n, r) => n + (r.ep === 'music' ? 3 : 2), 0) };
}
// ---- main -------------------------------------------------------------------
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) await main();

async function readInputs() {
  const parsed = [];
  for (const f of INPUTS) {
    const abs = path.isAbsolute(f) ? f : path.join(process.cwd(), f);
    if (!fs.existsSync(abs)) { console.error('input not found: ' + f); process.exit(2); }
    parsed.push(sniff(fs.readFileSync(abs, 'utf8'), path.basename(f)));
  }
  if (has('--paste')) parsed.push(sniff(fs.readFileSync(0, 'utf8'), 'stdin'));
  return parsed;
}
function printPlan(P) {
  console.log(`# SFX comment regenerator - tag ${TAG}${P.reviewDate ? ', review dated ' + P.reviewDate : ''}`);
  console.log(`# ${P.regenerate.length} to regenerate (${P.credits} credits)${P.deferred ? ', ' + P.deferred + ' deferred by --limit' : ''}, ${P.skipped.length} skipped, ${P.unmatched.length} unmatched\n`);
  for (const r of P.regenerate) {
    const abs = path.join(ROOT, r.file);
    const cur = fs.existsSync(abs) ? durationOf(fs.readFileSync(abs)).toFixed(2) + 's' : '(new)';
    console.log(`  ${cur.padStart(7)} -> req ${r.req}s${r.max ? ' (bar ' + r.max + 's' + (r.pinned ? ', pinned' : '') + ')' : ''}  ${r.file}  [${r.verdict}]`);
    console.log(`          "${r.comment || '(no comment - ticked only)'}"`);
    console.log(`          prompt: ${r.prompt.slice(0, 150)}${r.prompt.length > 150 ? '...' : ''}`);
  }
  if (P.skipped.length) { console.log('\n## skipped'); for (const s of P.skipped) console.log(`  ${s.file}  - ${s.reason}`); }
  if (P.unmatched.length) { console.log('\n## unmatched (not in data/sfx_manifest.js - run gen_sfx_manifest.mjs?)'); for (const u of P.unmatched) console.log(`  ${u.id || u.file}  "${(u.comment || '').slice(0, 60)}"`); }
  if (!has('--generate')) console.log('\n# Re-run with --generate (needs LUDO_API_KEY). Then: --finish');
}

async function main() {
  if (has('--finish')) return finish();
  if (!INPUTS.length && !has('--paste')) { console.error('usage: regen_sfx_from_comments.mjs <review.txt|progress.json|regen_notes.json|sfx_regen_list.json>... [--generate] [--json] [--finish]'); process.exit(2); }
  const P = plan(await readInputs(), { only: ONLY, limit: LIMIT, includeGood: has('--include-good'), allowMusic: has('--allow-music'),
    force: has('--force'), since: SINCE, verdicts: VERDICTS, tag: TAG });
  if (has('--json')) { console.log(JSON.stringify({ tag: TAG, ...P }, null, 2)); return; }
  printPlan(P);
  if (!has('--generate')) return;
  if (!P.regenerate.length) { console.log('nothing to generate'); return; }
  const apiKey = process.env.LUDO_API_KEY;
  if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
  const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
  const TIMEOUT = Number(process.env.LUDO_REQ_TIMEOUT_MS || 150000);
  const PACE = Number(process.env.LUDO_PACE_MS || 1200);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const BACKUP = path.join(ROOT, 'audio', '_regen_backup', TAG);
  fs.mkdirSync(BACKUP, { recursive: true });
  const notesPath = path.join(BACKUP, 'regen_notes.json');
  const record = fs.existsSync(notesPath) ? JSON.parse(fs.readFileSync(notesPath, 'utf8')) : {};
  let failures = 0, made = 0, skipped = 0;
  console.log('');
  for (const r of P.regenerate) {
    const abs = path.join(ROOT, r.file);
    const bak = path.join(BACKUP, r.file.replace(/^audio\//, ''));
    if (fs.existsSync(bak) && !has('--force')) { skipped++; console.log(`${r.file}: already regenerated under ${TAG} (backup exists) - skip, --force to redo`); continue; }
    let done = false, last, dur = 0, buf = null, req = r.req;
    for (let a = 1; a <= 3 && !done; a++) {
      if (r.ep === 'sfx') req = Math.max(0.35, r.req - (a - 1) * 0.2);   // ask shorter when the model overshoots
      try {
        process.stdout.write(`${r.file} attempt ${a} (req ${req}s) ... `);
        const body = r.ep === 'music' ? { description: r.prompt, duration: req, augment_prompt: true } : { description: r.prompt, duration: req, loop: false };
        const res = await fetch(`${API}/audio/${r.ep === 'music' ? 'music' : 'sound-effect'}`, {
          method: 'POST', headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(r.ep === 'music' ? 300000 : TIMEOUT), body: JSON.stringify(body) });
        if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text().catch(() => '')).slice(0, 120)}`);
        const j = await res.json();
        const url = j.url || (j.result && j.result.url);
        if (!url) throw new Error('no url in response');
        const dl = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
        if (!dl.ok) throw new Error(`download HTTP ${dl.status}`);
        buf = Buffer.from(await dl.arrayBuffer());
        if (buf.length < 1000) throw new Error(`suspiciously small (${buf.length}B)`);
        dur = durationOf(buf);
        if (!dur) throw new Error('not a decodable MP3');
        if (r.max) {
          if (dur >= r.max && a < 3) throw new Error(`${dur.toFixed(2)}s - over the ${r.max}s bar, retrying shorter`);
          if (dur >= r.max) { buf = trimTo(buf, r.max - 0.05); dur = durationOf(buf); process.stdout.write('(trimmed) '); }
          if (dur >= r.max) throw new Error(`still ${dur.toFixed(2)}s after trim`);
        }
        done = true;
      } catch (e) {
        last = e; console.log('FAIL: ' + e.message);
        if (/\b402\b|credits/i.test(e.message)) { console.error('OUT OF CREDITS - stopping; re-run to resume'); process.exit(3); }
        if (a < 3) await sleep(1500 * a);
      }
    }
    if (!done) { failures++; console.error(`giving up on ${r.file}: ${last && last.message}`); await sleep(PACE); continue; }
    const beforeKb = fs.existsSync(abs) ? Math.round(fs.statSync(abs).size / 1024) : 0;
    fs.mkdirSync(path.dirname(bak), { recursive: true });
    if (fs.existsSync(abs) && !fs.existsSync(bak)) fs.copyFileSync(abs, bak);   // the FIRST backup is the true original
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs + '.tmp', buf); fs.renameSync(abs + '.tmp', abs);   // atomic, per project convention
    console.log(`OK ${dur.toFixed(2)}s, ${(buf.length / 1024).toFixed(0)} KB`);
    record[r.id] = { file: r.file, cat: r.cat, verdict: r.verdict, comment: r.comment, prompt: r.prompt, requested: req, measured: +dur.toFixed(3),
      before_kb: beforeKb, after_kb: Math.round(buf.length / 1024), source: r.source, at: new Date().toISOString() };
    fs.writeFileSync(notesPath + '.tmp', JSON.stringify(record, null, 2) + '\n'); fs.renameSync(notesPath + '.tmp', notesPath);
    made++; await sleep(PACE);
  }
  mergeMonsterNotes(record);
  console.log(`\n${made} regenerated, ${skipped} skipped (resumable), ${failures} failed. Record: audio/_regen_backup/${TAG}/regen_notes.json`);
  console.log('Next: node scripts/regen_sfx_from_comments.mjs --finish');
  // exitCode, not process.exit(): on Windows, exiting while fetch's sockets are
  // still open dies with 0xC0000409 even after every clip was written.
  process.exitCode = failures ? 1 : 0;
}
// audio/monster/regen_notes.json is the long-standing per-monster record
// ({ '<monsterId>_<kind>': direction }); keep feeding it so history stays in one place.
function mergeMonsterNotes(record) {
  const p = path.join(ROOT, 'audio', 'monster', 'regen_notes.json');
  let notes = {}; try { notes = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { /* fresh */ }
  let n = 0;
  for (const [id, r] of Object.entries(record)) {
    const k = id.match(/^mob_(.+)_(hit|die)$/); if (!k || !r.comment) continue;
    notes[k[1] + '_' + k[2]] = 'Tester: ' + r.comment; n++;
  }
  if (n) { fs.writeFileSync(p + '.tmp', JSON.stringify(notes, null, 2) + '\n'); fs.renameSync(p + '.tmp', p); }
}
function finish() {
  const run = (s) => { console.log('> node ' + s); execFileSync(process.execPath, [path.join(ROOT, 'scripts', s)], { stdio: 'inherit', cwd: ROOT }); };
  run('gen_sfx_manifest.mjs');
  run('gen_sound_review.mjs');
  try { run('sfx_duration_test.mjs'); } catch (e) { console.error('sfx_duration_test FAILED - fix before shipping'); process.exit(1); }
  console.log('\nREMAINING MANUAL STEP: bump `const CACHE` in sw.js. Audio replaced under its own filename is cached art;');
  console.log('the push gate blocks a push that modifies audio without the bump. Then commit clips + manifest + tester page + notes + sw.js together.');
}
