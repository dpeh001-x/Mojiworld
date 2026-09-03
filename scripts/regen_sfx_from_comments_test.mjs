// Test: THE SFX COMMENT REGENERATOR - parsing, planning, generating (mocked).
//
// Runs the tool against a SCRATCH tree (LX_SFX_ROOT): the real manifest and
// names snapshot copied in, fixture clips at the manifest paths, and a local
// mock of the ludo endpoints. No credits, no repo audio touched.
//   node scripts/regen_sfx_from_comments_test.mjs
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

// ---- scratch root -----------------------------------------------------------
const T = fs.mkdtempSync(path.join(os.tmpdir(), 'lx_sfx_regen_'));
for (const rel of ['data/sfx_manifest.js', 'tools/sound_review_names.json', 'scripts/sfx_duration_test.mjs']) {
  fs.mkdirSync(path.join(T, path.dirname(rel)), { recursive: true }); fs.copyFileSync(path.join(REPO, rel), path.join(T, rel));
}
process.env.LX_SFX_ROOT = T;
const tool = await import('./regen_sfx_from_comments.mjs');
const manSrc = fs.readFileSync(path.join(T, 'data/sfx_manifest.js'), 'utf8');
const MAN = JSON.parse(manSrc.slice(manSrc.indexOf('['), manSrc.lastIndexOf(']') + 1));
const NAMES = JSON.parse(fs.readFileSync(path.join(T, 'tools/sound_review_names.json'), 'utf8'));
const byId = (id) => MAN.find((m) => m.id === id);
const bossKey = Object.keys(NAMES.mons).find((k) => NAMES.mons[k].boss && byId('mob_' + k + '_hit'));
const bgm = MAN.find((m) => m.cat === 'bgm');
const SHORT = fs.readFileSync(path.join(REPO, 'audio/ui/jump.mp3'));          // 0.21s
const LONG = fs.readFileSync(path.join(REPO, 'audio/skill/warrior_roar.mp3')); // 1.70s - over every sfx bar
const put = (id, buf) => { const p = path.join(T, byId(id).file); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, buf); };
for (const id of ['mob_snail_hit', 'mob_snail_die', 'mob_' + bossKey + '_hit', 'npc_captain_plum', 'npc_ashka', 'archer_arrow', bgm.id]) put(id, SHORT);
// snail_die was "regenerated" AFTER the review date below - must be skipped without --force
fs.utimesSync(path.join(T, byId('mob_snail_die').file), new Date('2026-09-02'), new Date('2026-09-02'));
for (const id of ['mob_snail_hit', 'mob_' + bossKey + '_hit', 'npc_captain_plum', 'npc_ashka', 'archer_arrow'])
  fs.utimesSync(path.join(T, byId(id).file), new Date('2026-08-01'), new Date('2026-08-01'));

// ---- fixtures: one of each export --------------------------------------------
const report = ['MOJIWORLD - SOUND REVIEW', 'Tester: Sam', 'Date:   2026-08-20', '', 'Reviewed 5 of 300 sounds.', '',
  '=================================================', 'NEEDS WORK (3)', '=================================================',
  '1. Slippy  [hit sound]', '   file: ' + byId('mob_snail_hit').file, '   > too metallic, should be a wet squelch', '     and about half as long', '',
  '2. Slippy  [death sound]', '   file: ' + byId('mob_snail_die').file, '   > sad little deflate please', '',
  '3. Ghosty  [hit sound]', '   file: audio/monster/mob_not_a_real_mob_hit.mp3', '   > whatever', '',
  '=================================================', 'NOT SURE (2)', '=================================================',
  '1. Captain Plum  [NPC voice]', '   file: ' + byId('npc_captain_plum').file, '   > should sound like an old salty captain, lower', '',
  '2. Ashka  [NPC voice]', '   file: ' + byId('npc_ashka').file, '   > cannot find this monster', '',
  '=================================================', 'MARKED GOOD, BUT WITH A COMMENT (1)', '=================================================',
  '1. Arrow  [hit sound]', '   file: ' + byId('archer_arrow').file, '   > love it', ''].join('\n');
const progress = { v: { ['mob_' + bossKey + '_hit']: 'bad' }, c: { ['mob_' + bossKey + '_hit']: 'needs more weight, a real boss thud' }, who: 'Sam' };
const notes = { snail_hit: 'Tester: too metallic' };
const list = { items: [{ id: bgm.id, file: bgm.file, cat: 'bgm', when: bgm.when }] };
fs.writeFileSync(path.join(T, 'review.txt'), report);
fs.writeFileSync(path.join(T, 'progress.json'), JSON.stringify(progress));
fs.writeFileSync(path.join(T, 'notes.json'), JSON.stringify(notes));
fs.writeFileSync(path.join(T, 'list.json'), JSON.stringify(list));

// ---- 1) parsers --------------------------------------------------------------
const pr = tool.sniff(report, 'review.txt');
ok('report: rows carry file + merged multi-line comment + verdict, and the review date',
  pr.date === '2026-08-20' && pr.rows.length === 6 && pr.rows[0].file === byId('mob_snail_hit').file
  && pr.rows[0].comment === 'too metallic, should be a wet squelch and about half as long' && pr.rows[0].verdict === 'bad' && pr.rows[5].verdict === 'good',
  { date: pr.date, n: pr.rows.length, c0: pr.rows[0] && pr.rows[0].comment });
ok('progress json / regen_notes / animator list are all sniffed and normalised',
  tool.sniff(JSON.stringify(progress), 'p').rows[0].id === 'mob_' + bossKey + '_hit'
  && tool.sniff(JSON.stringify(notes), 'n').rows[0].id === 'mob_snail_hit'
  && tool.sniff(JSON.stringify(list), 'l').rows[0].id === bgm.id, {});

// ---- 2) plan ------------------------------------------------------------------
const P = tool.plan([pr, tool.sniff(JSON.stringify(progress), 'p'), tool.sniff(JSON.stringify(list), 'l')],
  { only: '', limit: 0, includeGood: false, allowMusic: false, force: false, since: '', verdicts: new Set(['bad', 'meh', 'none']) });
const ids = P.regenerate.map((r) => r.id);
const reason = (id) => (P.skipped.find((s) => s.id === id) || {}).reason || '';
ok('NEEDS WORK + commented NOT SURE are regenerated', ids.includes('mob_snail_hit') && ids.includes('npc_captain_plum') && ids.includes('mob_' + bossKey + '_hit'), { ids });
ok('GOOD-with-comment is skipped (praise is not a work order)', /GOOD/.test(reason('archer_arrow')), { reason: reason('archer_arrow') });
ok('"cannot find this monster" is skipped as not a critique', /not a sound critique/.test(reason('npc_ashka')), { reason: reason('npc_ashka') });
ok('a clip regenerated AFTER the review date is skipped (needs re-review or --force)', /already regenerated/.test(reason('mob_snail_die')), { reason: reason('mob_snail_die') });
ok('bgm is deferred to --allow-music (3cr music endpoint)', /allow-music/.test(reason(bgm.id)), { reason: reason(bgm.id) });
ok('a file missing from the manifest lands in unmatched, not silently dropped', P.unmatched.length === 1 && /not_a_real_mob/.test(P.unmatched[0].file), { unmatched: P.unmatched });
const snail = P.regenerate.find((r) => r.id === 'mob_snail_hit'), boss = P.regenerate.find((r) => r.id === 'mob_' + bossKey + '_hit');
const plum = P.regenerate.find((r) => r.id === 'npc_captain_plum');
ok('prompts: regular mob gets the CUTE rule, boss gets the weighty-cartoon rule, comment is the creative direction',
  /cute, adorable/.test(snail.prompt) && /weighty and dramatic/.test(boss.prompt) && /Slippy/.test(snail.prompt)
  && /fix exactly this: "too metallic/.test(snail.prompt) && /one-shot/.test(snail.prompt), { snail: snail.prompt.slice(0, 120) });
ok('NPC voice uses the babble rule; Captain Plum keeps the 1.0s pin read from sfx_duration_test', /BABBLE/.test(plum.prompt) && plum.max === 1.0 && plum.pinned === true
  && tool.RULES.npc.max === 1.8, { max: plum.max, pinned: plum.pinned });
ok('--force lifts the already-regenerated skip', tool.plan([pr], { only: '', limit: 0, includeGood: false, allowMusic: false, force: true, since: '', verdicts: new Set(['bad', 'meh', 'none']) })
  .regenerate.some((r) => r.id === 'mob_snail_die'), {});
ok('credits are 2 per sfx clip', P.credits === P.regenerate.length * 2, { credits: P.credits, n: P.regenerate.length });

// ---- 3) generate against a mock ludo ----------------------------------------
let calls = 0, mode = 'ok';
const srv = http.createServer((req, res) => {
  if (req.url.startsWith('/clip')) { const n = Number(new URL(req.url, 'http://x').searchParams.get('n')); res.end(n === 1 ? LONG : SHORT); return; }
  let body = ''; req.on('data', (d) => body += d); req.on('end', () => {
    calls++;
    if (mode === '402') { res.statusCode = 402; res.end('{"error":"insufficient credits"}'); return; }
    res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ url: `http://127.0.0.1:${srv.address().port}/clip?n=${calls}` }));
  });
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const env = { ...process.env, LX_SFX_ROOT: T, LUDO_API_KEY: 'test', LUDO_API_BASE: `http://127.0.0.1:${srv.address().port}`, LUDO_PACE_MS: '0' };
// ASYNC spawn on purpose: spawnSync would block this process's event loop, and
// the mock server lives in this process - the child would wait on fetch
// timeouts forever (that is exactly how the first run of this test hung).
const run = (args) => new Promise((res) => {
  const c = spawn(process.execPath, [path.join(REPO, 'scripts/regen_sfx_from_comments.mjs'), ...args], { cwd: T, env });
  let stdout = '', stderr = '';
  c.stdout.on('data', (d) => stdout += d); c.stderr.on('data', (d) => stderr += d);
  c.on('close', (status) => res({ status, stdout, stderr }));
});
const g1 = await run(['review.txt', '--generate', '--tag=t1', '--only=snail_hit']);
const bak = path.join(T, 'audio/_regen_backup/t1/monster/mob_snail_hit.mp3');
const rec = fs.existsSync(path.join(T, 'audio/_regen_backup/t1/regen_notes.json')) ? JSON.parse(fs.readFileSync(path.join(T, 'audio/_regen_backup/t1/regen_notes.json'), 'utf8')) : {};
ok('generate: the over-bar first take is retried shorter and the short second take ships', g1.status === 0 && /over the 1s bar, retrying shorter/.test(g1.stdout)
  && calls === 2 && fs.readFileSync(path.join(T, byId('mob_snail_hit').file)).equals(SHORT), { status: g1.status, calls, tail: g1.stdout.slice(-200) });
ok('...the original is backed up under the tag and the record carries prompt + measured duration',
  // attempt 1 asked 0.5s (monster-hit rule); the retry asks max(0.35, 0.5-0.2) = 0.35
  fs.existsSync(bak) && rec.mob_snail_hit && rec.mob_snail_hit.measured < 1 && rec.mob_snail_hit.requested === 0.35
  && /too metallic/.test(rec.mob_snail_hit.prompt), { rec: rec.mob_snail_hit });
ok('...monster entries are merged into audio/monster/regen_notes.json',
  JSON.parse(fs.readFileSync(path.join(T, 'audio/monster/regen_notes.json'), 'utf8')).snail_hit === 'Tester: too metallic, should be a wet squelch and about half as long', {});
const g2 = await run(['review.txt', '--generate', '--tag=t1', '--only=snail_hit']);
ok('re-running the same tag is resumable: skipped with the tag reason, no API call, file untouched',
  g2.status === 0 && /already regenerated under t1 \(backup exists\)/.test(g2.stdout) && calls === 2
  && fs.readFileSync(path.join(T, byId('mob_snail_hit').file)).equals(SHORT), { calls, out: g2.stdout.slice(-200) });
mode = '402';
const g3 = await run(['review.txt', '--generate', '--tag=t2', '--only=captain_plum']);
ok('a 402 stops the run with exit 3 and leaves the clip untouched', g3.status === 3 && fs.readFileSync(path.join(T, byId('npc_captain_plum').file)).equals(SHORT), { status: g3.status });
srv.close();

let pass = 0;
for (const t of results) { console.log((t.pass ? '  PASS  ' : '  FAIL  ') + t.n); if (!t.pass) console.log('        ' + JSON.stringify(t.x).slice(0, 400)); if (t.pass) pass++; }
console.log('\n' + pass + '/' + results.length + ' checks passed');
fs.rmSync(T, { recursive: true, force: true });
process.exit(pass === results.length ? 0 : 1);
