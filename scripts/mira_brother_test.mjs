// Sage Mira is the Amnesiac's sister - and the world says so only when the twelfth zodiac falls.
//
// Per user: "sage Mira is actually the amnesiac's brother, another one of those fallen" (read as his sister: Mira is "the woman
// at the gate"), then "add more story beats for Mira and the Amnesiac and generate necessary 720p short films as well" and
// "Make this beat specific when beating all the zodiac bosses, then there will be a reveal that mira is the amnesiac's sister".
// One page, a fresh warrior, real dialogue buttons, a real killMonster of the twelfth sign:
//   1. BEFORE the Twelve nobody calls them sister and brother: Mira's "Who are you?" says "one of us answered", her "Who
//      answered?" says ask me when the wheel turns, he has no gate question, the Warden's line is "a face", the Codex hides
//      its two clauses, and neither idle pool holds their after-lines;
//   2. the twelfth kill plays zodiac_twelve_done and then mira_twelve_reveal (her film, clip_mira_twelve, loading), which
//      names her; the next talk with him plays amnesiac_twelve_dream (his film) and then opens his dialogue;
//   3. AFTER: her brother pages, his gate question and page, the Warden's "my sister", the Codex clauses, their bubbles;
//   4. a save that beat the Twelve before this build hears both scenes before either of them talks;
//   5. text caps (NPC pages and beat stanzas <= 60 words, bubbles <= 6) and both films shipped for the Steam build.
// The build before fails 1-5.   node scripts/mira_brother_test.mjs     MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync, readFileSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11773), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
const errs = [];
const words = (t) => String(t || '').replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof openNPC === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (!player.cls) { applyClass('warrior'); player.level = 80; }
    player._tutorialSeen = true; player._gravitosCineSeen = true; player._miraNamed = false;
    const UNDER = ['zodiac_twelve_done', 'mira_twelve_reveal', 'amnesiac_twelve_dream'];
    player._storyBeatsSeen = {}; for (const k of Object.keys(STORY_BEATS)) if (!UNDER.includes(k)) player._storyBeatsSeen[k] = true;
    if (!game.bestiary) game.bestiary = {};
    for (const z of ZODIAC_SIGNS) delete game.bestiary['_boss_zodiac_' + z.id];
    const text = () => (document.getElementById('dialog-text') || {}).textContent || '';
    const opts = () => [...document.querySelectorAll('#dialog-options button')].map((b) => (b.textContent || '').trim());
    const click = async (re) => { const b = [...document.querySelectorAll('#dialog-options button')].find((x) => re.test(x.textContent || '')); if (b) { b.click(); await sleep(250); } return !!b; };
    const settle = async () => { const d = document.getElementById('dialog'); for (let i = 0; i < 200 && d.classList.contains('typing'); i++) await sleep(50); await sleep(100); };
    const dlgOpen = () => (document.getElementById('dialog') || {}).style.display === 'block';
    const close = async () => { try { closeDialog(); } catch (e) {} await sleep(200); };
    const ov = () => document.getElementById('story-beat-overlay'), beatOn = () => !!(ov() && ov().classList.contains('on'));
    const spk = () => (document.getElementById('story-beat-speaker') || {}).textContent || '', btxt = () => (document.getElementById('story-beat-text') || {}).textContent || '';
    const waitFor = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (fn()) return true; } catch (e) {} await sleep(100); } return false; };
    const clip = async () => { await waitFor(() => { const v = document.getElementById('story-beat-clip'); return v && v.readyState >= 2; }, 12000);
      const v = document.getElementById('story-beat-clip'); if (v) await sleep(1200);   // its soundtrack gets going; the scene's score should be waiting silent
      return v ? { src: (v.currentSrc || v.src || '').split('/').pop(), ready: v.readyState, w: v.videoWidth, h: v.videoHeight, muted: v.muted, bytes: v.webkitAudioDecodedByteCount || 0,
        scoreSilent: _cineBgm.paused || _cineBgm.volume < 0.02, score: String(_cineBgm.src).split('/').pop() } : null; };
    const through = async (who) => { const t0 = Date.now(); while (beatOn() && spk() === who && Date.now() - t0 < 20000) { ov().click(); await sleep(300); } return !beatOn() || spk() !== who; };   // pages ONE scene: a queued next scene is left alone
    const stanza0 = (id) => { const t = STORY_BEATS.warden_falls.stanzas[0].text; return typeof t === 'function' ? t({}) : t; };
    const codex = async (tab) => { openLoreMap(tab); await sleep(200); const b = document.getElementById('lore-body'); const s = [...b.querySelectorAll('.cdx-sib')].map((x) => getComputedStyle(x).display);
      const r = { text: b.innerText, sib: s }; try { closeLoreMap(); } catch (e) {} await sleep(100); return r; };
    const pools = async (role) => { const n = (game.npcs || []).find((x) => x.role === role); /* the drawn copies roll the bubbles, not mapData's */ if (!n) return null; const orig = window._pickChatLine; let got = null;
      window._pickChatLine = (p) => { if (!got && p && p.some((l) => (NPC_CHAT_LINES[role] || []).includes(l))) got = p.slice(); return orig(p); };
      for (let i = 0; i < 40 && !got; i++) { n._chatNext = 0; n._chat = null; await sleep(120); } window._pickChatLine = orig; return got; };
    const am = () => game.mapData.npcs.find((n) => n.role === 'amnesiac'), sage = () => game.mapData.npcs.find((n) => n.role === 'sage');
    // ---- 1. BEFORE the Twelve --------------------------------------------------------------------------------------------
    loadMap('wayfarersLantern2', 400); await sleep(1500); game.paused = false;
    openNPC(sage()); await sleep(300); out.preOpenBeat = beatOn();
    await click(/Who are you\?/); await settle(); out.pre1 = { text: text(), opts: opts() };
    await click(/Who answered\?/); await settle(); out.pre3 = { text: text(), opts: opts() };
    await close(); game.paused = false; out.preSagePool = await pools('sage');
    loadMap('town', 400); await sleep(1500); game.paused = false;
    player.x = am().x; out.preAmPool = await pools('amnesiac');
    openNPC(am()); await sleep(250); await click(/Talk/); await settle(); out.preAmOpts = opts(); await close();
    out.preWarden = stanza0('warden_falls'); out.preWorld = await codex('world'); out.preFac = await codex('factions');
    // ---- 2. the twelfth kill ----------------------------------------------------------------------------------------------
    const last = ZODIAC_SIGNS[ZODIAC_SIGNS.length - 1].id;
    for (const z of ZODIAC_SIGNS) if (z.id !== last) game.bestiary['_boss_zodiac_' + z.id] = 1;
    const m = { type: 'zodiac_' + last, name: 'Last', isZodiac: true, zodiacSign: last, x: player.x + 60, y: player.y, w: 60, h: 60, level: 85, exp: 0, mojicoins: 0,
      currentHp: 0, maxHp: 1, hp: 0, atk: 1, def: 1, vx: 0, vy: 0, dead: false, zodiacBoss: true, isBoss: true };
    game.monsters.push(m); try { killMonster(m); } catch (e) { out.killErr = String(e.message).slice(0, 100); }
    { const i = game.monsters.indexOf(m); if (i >= 0) game.monsters.splice(i, 1); }
    out.twelveOn = await waitFor(() => beatOn() && /twelfth sign exhales/.test(btxt()), 9000);
    out.twelveClosed = await through('');
    out.revealOn = await waitFor(() => beatOn() && spk() === 'Mira', 4000);
    out.reveal = { speaker: spk(), text: btxt().slice(0, 140), clip: await clip(), named: player._miraNamed === true };
    out.revealClosed = await through('Mira'); await sleep(700);
    out.seen = { reveal: !!player._storyBeatsSeen.mira_twelve_reveal, dream: !!player._storyBeatsSeen.amnesiac_twelve_dream };
    try { closeAllModals(); } catch (e) {} await sleep(300); game.paused = false;
    // his half, then his dialogue
    openNPC(am()); out.dreamOn = await waitFor(() => beatOn() && spk() === 'The Amnesiac', 3000);
    out.dream = { text: btxt().slice(0, 140), clip: await clip() };
    out.dreamClosed = await through('The Amnesiac'); out.amAfterBeat = await waitFor(dlgOpen, 3000);
    await click(/Talk/); await settle(); out.postAmOpts = opts();
    await click(/The woman at the gate\?/); await settle(); out.am4 = text(); await close();
    openNPC(am()); await sleep(400); out.secondTalkNoBeat = !beatOn() && dlgOpen(); await close();
    out.postAmPool = await pools('amnesiac');
    // ---- 3. AFTER: her pages, the Warden, the Codex, her bubbles ------------------------------------------------------------
    loadMap('wayfarersLantern2', 400); await sleep(1500); game.paused = false;
    openNPC(sage()); await sleep(300); out.postOpenBeat = beatOn(); out.tag = (document.getElementById('dialog-name') || {}).textContent || '';
    await click(/Who are you\?/); await settle(); out.post1 = { text: text(), opts: opts() };
    await click(/Your brother\?/); await settle(); out.post3 = { text: text(), opts: opts() };
    await click(/Should I tell him\?/); await settle(); out.post4 = text(); await close();
    out.postSagePool = await pools('sage');
    out.postWarden = stanza0(); out.postWorld = await codex('world'); out.postFac = await codex('factions');
    // ---- 4. a save that beat the Twelve before this build ------------------------------------------------------------------
    player._storyBeatsSeen.mira_twelve_reveal = false; player._storyBeatsSeen.amnesiac_twelve_dream = false; player._miraNamed = false;
    openNPC(sage()); out.legacySage = { beat: await waitFor(() => beatOn() && spk() === 'Mira', 3000) };
    await through('Mira'); out.legacySage.dialogAfter = await waitFor(dlgOpen, 3000); out.legacySage.tag = (document.getElementById('dialog-name') || {}).textContent || ''; await close();
    player._storyBeatsSeen.mira_twelve_reveal = false;
    loadMap('town', 400); await sleep(1500); game.paused = false;
    const order = []; openNPC(am());
    for (let i = 0; i < 120 && order.length < 3; i++) { const s = beatOn() ? spk() : (dlgOpen() ? 'DIALOG' : ''); if (s && s !== order[order.length - 1]) order.push(s); if (beatOn()) ov().click(); await sleep(200); }
    out.legacyOrder = order; await close();
    // ---- 5. the text caps
    const wc = (t) => String(t || '').replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
    out.stanzaWords = UNDER.slice(1).flatMap((k) => ((STORY_BEATS[k] || {}).stanzas || []).map((s) => wc(s.text)));
    out.pageWords = [out.pre3.text, out.post3.text, out.am4].map(wc);
    out.twelveLines = (typeof NPC_CHAT_LINES_TWELVE !== 'undefined') ? NPC_CHAT_LINES_TWELVE : {};
    return out;
  });
  const J = (x) => JSON.stringify(x).slice(0, 300), sib = /beside her brother|when her brother lost his/;
  ok('1. before the Twelve: her "Who are you?" says one of us answered, never "brother"', !R.preOpenBeat && /^Mira\. I picked it the day I was sent/.test(R.pre1.text) && /One of us answered for all of us/.test(R.pre1.text) && !/brother|sister/i.test(R.pre1.text) && R.pre1.opts.includes('Who answered?') && !R.pre1.opts.includes('Your brother?'), J(R.pre1));
  ok('1. "Who answered?": ask me again when the wheel turns', /Ask me again when the wheel turns/.test(R.pre3.text) && !/brother|sister/i.test(R.pre3.text) && !R.pre3.opts.includes('Should I tell him?'), J(R.pre3));
  ok('1. he has no gate question yet, and the Warden\'s rest is a face', R.preAmOpts.length > 0 && !R.preAmOpts.includes('The woman at the gate?') && /The rest is a face I cannot place yet/.test(R.preWarden) && !/sister/i.test(R.preWarden), J({ o: R.preAmOpts, w: R.preWarden.slice(60, 200) }));
  ok('1. the Codex hides both sibling clauses', R.preWorld.sib.length === 1 && R.preFac.sib.length === 1 && [...R.preWorld.sib, ...R.preFac.sib].every((d) => d === 'none') && !sib.test(R.preWorld.text + R.preFac.text), J({ w: R.preWorld.sib, f: R.preFac.sib }));
  ok('1. neither idle pool holds their after-lines', !!R.preSagePool && !!R.preAmPool && !R.preSagePool.includes('Say it first, brother') && !R.preAmPool.some((l) => /sister/i.test(l)), J({ s: R.preSagePool, a: R.preAmPool }));
  ok('2. the twelfth kill plays zodiac_twelve_done, then Mira\'s reveal over her film', !R.killErr && R.twelveOn && R.twelveClosed && R.revealOn && R.reveal.speaker === 'Mira' && /stands up for the first time in twelve ages/.test(R.reveal.text) && !!R.reveal.clip && R.reveal.clip.src === 'clip_mira_twelve.mp4' && R.reveal.clip.ready >= 2 && R.reveal.clip.w === 1280, J({ e: R.killErr, t: R.twelveOn, c: R.twelveClosed, on: R.revealOn, r: R.reveal }));
  ok('2. the reveal names her and is kept; his half waits for the next talk', R.reveal.named && R.revealClosed && R.seen.reveal && !R.seen.dream, J(R.seen));
  ok('2. talking to him plays his half over his film, then opens his dialogue (once)', R.dreamOn && /I dreamed\. I don't dream/.test(R.dream.text) && !!R.dream.clip && R.dream.clip.src === 'clip_amnesiac_twelve.mp4' && R.dream.clip.ready >= 2 && R.dreamClosed && R.amAfterBeat && R.secondTalkNoBeat, J({ on: R.dreamOn, d: R.dream, after: R.amAfterBeat, again: R.secondTalkNoBeat }));
  ok('2. both films play with their soundtracks, each scene\'s score (the Gate\'s theme, Everdawn Central\'s) waiting silent under its film',
    !!R.reveal.clip && R.reveal.clip.muted === false && R.reveal.clip.bytes > 0 && R.reveal.clip.scoreSilent && R.reveal.clip.score === 'bgm_wayfarer.mp3'
    && !!R.dream.clip && R.dream.clip.muted === false && R.dream.clip.bytes > 0 && R.dream.clip.scoreSilent && R.dream.clip.score === 'bgm_mojiworld.mp3', J({ mira: R.reveal.clip, amnesiac: R.dream.clip }));
  ok('3. after: he asks after the woman at the gate, and knows what she is', R.postAmOpts.includes('The woman at the gate?') && /My sister\. I know it the way you know a stair in the dark/.test(R.am4) && /Don't say it for me/.test(R.am4), J({ o: R.postAmOpts, t: R.am4.slice(0, 160) }));
  ok('3. after: Mira names her brother - "Your brother?", "Should I tell him?"', !R.postOpenBeat && R.tag === 'Mira' && /My brother picked his beside me/.test(R.post1.text) && /My brother answered for all of us/.test(R.post1.text) && R.post1.opts.includes('Your brother?') && /He does not remember my name\. I have never told him/.test(R.post3.text) && R.post3.opts.includes('Should I tell him?') && /say mine first/.test(R.post4), J({ tag: R.tag, o1: R.post1.opts, t3: R.post3.text.slice(0, 120) }));
  ok('3. after: the Warden\'s rest is his sister; the Codex shows both clauses', /The rest is a woman on the last step\. My sister\./.test(R.postWarden) && J(R.postWorld.sib) === J(['inline']) && J(R.postFac.sib) === J(['inline']) && /beside her brother/.test(R.postWorld.text) && /when her brother lost his/.test(R.postFac.text), J({ w: R.postWorld.sib, f: R.postFac.sib }));
  ok('3. after: their idle pools gain their lines', !!R.postAmPool && R.postAmPool.includes('I have a sister.') && !!R.postSagePool && R.postSagePool.includes('Say it first, brother'), J({ s: R.postSagePool, a: R.postAmPool }));
  ok('4. a save that beat the Twelve before: her scene before she talks; at his door hers, then his, then his dialogue', R.legacySage.beat && R.legacySage.dialogAfter && R.legacySage.tag === 'Mira' && J(R.legacyOrder) === J(['Mira', 'The Amnesiac', 'DIALOG']), J({ s: R.legacySage, o: R.legacyOrder }));
  ok('5. every new stanza and page within 60 words, every new bubble within 6', R.stanzaWords.length === 6 && R.stanzaWords.every((w) => w <= 60) && R.pageWords.every((w) => w <= 60) && Object.values(R.twelveLines).flat().every((l) => l.split(/\s+/).length <= 6), J({ s: R.stanzaWords, p: R.pageWords }));
  const pkg = readFileSync(path.join(SERVE_ROOT, 'steam', 'package.json'), 'utf8'), CD = path.join(SERVE_ROOT, 'steam', 'higgsfield', 'cinematics');
  const films = ['clip_mira_twelve', 'clip_amnesiac_twelve'].map((c) => ({ c, mp4: existsSync(path.join(CD, c + '.mp4')), spec: existsSync(path.join(CD, c + '.SPEC.md')), pkg: pkg.includes('"steam/higgsfield/cinematics/' + c + '.mp4"') }));
  ok('5. both films on disk with their SPEC records, and packed into the Steam build', films.every((f) => f.mp4 && f.spec && f.pkg), J(films));
  await ctx.close();
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { ok('harness: ' + String(e.message).slice(0, 200), false); }
await browser.close(); server.kill();
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
