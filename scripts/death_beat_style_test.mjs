// The Amnesiac's death beat (v0.30.473). Per user, on the death screen: "generate a nice apt
// background for this when dead, also improve on the fonts".
//
// Everything here is read off the RENDERED overlay: the backdrop is confirmed by the network request
// and the computed style, the typographic hierarchy by measuring real line boxes with a Range (the
// lede is a ::first-line rule, which no API will report directly), and the contrast by sampling the
// pixels behind the prose.
//   node scripts/death_beat_style_test.mjs      MOJI_GAME_FILE / MOJI_SERVE_ROOT / PORT override
// Negative control v0.30.472: no sb-death class, no backdrop, one flat text size, and the dialog's
// full-width measure.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 10361); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
const artReq = []; page.on('response', (r) => { if (/death_backdrop/.test(r.url())) artReq.push(r.status()); });
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof _playStoryBeat === 'function' && typeof _expeditionEndDialogue === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(6000);
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    const o = { ver: GAME_VERSION };
    const ov = () => document.getElementById('story-beat-overlay');
    const show = async (tone) => {
      const e = ov(); if (e) e.classList.remove('on'); await sleep(120);
      _playStoryBeat({ mode: 'dialog', tone: tone || undefined, stanzas: [{ speaker: 'The Amnesiac',
        text: 'You fell. Good.\n\nNot the falling — the getting-up that always follows it. The Void keeps a tally, and it has started to respect yours.' }] });
      await sleep(650);
      const e2 = ov(), cs = e2 ? getComputedStyle(e2) : null;
      const st = document.getElementById('story-beat-stage');
      const tx = document.getElementById('story-beat-text');
      // Real line boxes. ::first-line is not reachable through getComputedStyle, so the lede is
      // verified by measuring the height of the first rendered line against the second.
      let lede = null, body = null;
      if (tx && tx.firstChild) {
        const rg = document.createRange(); rg.selectNodeContents(tx);
        const rects = Array.from(rg.getClientRects()).filter((x) => x.height > 2);
        if (rects.length >= 2) { lede = +rects[0].height.toFixed(1); body = +rects[rects.length - 1].height.toFixed(1); }
      }
      return { cls: !!(e2 && e2.classList.contains('sb-death')),
               bg: !!(cs && /death_backdrop/.test(cs.backgroundImage)),
               stageW: st ? Math.round(st.getBoundingClientRect().width) : 0,
               lede, body, textPx: tx ? getComputedStyle(tx).fontSize : null };
    };
    o.death = await show('death');
    o.normal = await show(null);
    // the real caller: a completed run must NOT be dressed as a death
    const seen = [];
    const orig = _playStoryBeat;
    window._playStoryBeat = function (b) { try { seen.push(b && b.tone); } catch (e) {} return orig.apply(this, arguments); };
    game._expEndCursor = {};
    try { _expeditionEndDialogue('death', 5); _expeditionEndDialogue('complete', 10); _expeditionEndDialogue('abandon', 3); } catch (e) {}
    window._playStoryBeat = orig;
    o.tones = seen;
    return o;
  });
  await page.waitForTimeout(300);
  const shot = await page.screenshot();
  const sharp = require('sharp');
  const meta = await sharp(shot).metadata();
  const band = await sharp(shot).extract({ left: Math.floor(meta.width * 0.22), top: Math.floor(meta.height * 0.35),
    width: Math.floor(meta.width * 0.56), height: Math.floor(meta.height * 0.28) }).greyscale().stats();
  const lum = band.channels[0].mean;
  console.log(`build ${r.ver}  lede ${r.death.lede}px / body ${r.death.body}px  stage ${r.death.stageW} vs ${r.normal.stageW}`);
  ok('the death beat gets its own ground', r.death.cls && r.death.bg, `class ${r.death.cls}, backdrop ${r.death.bg}`);
  ok('...and the backdrop actually loads', artReq.length > 0 && artReq.every((s) => s < 400), `responses ${artReq.join(',') || 'none'}`);
  ok('an ordinary beat is untouched — the tone does not leak', !r.normal.cls && !r.normal.bg, `class ${r.normal.cls}, backdrop ${r.normal.bg}`);
  ok('a COMPLETED run is not dressed as a death', JSON.stringify(r.tones) === JSON.stringify(['death', undefined, 'death']),
    JSON.stringify(r.tones));
  ok('the opening verdict is set larger than the elaboration it introduces', r.death.lede && r.death.body && r.death.lede >= r.death.body * 1.25,
    `lede line ${r.death.lede}px vs body line ${r.death.body}px`);
  ok('the measure is narrower than the full-width dialog', r.death.stageW > 0 && r.death.stageW < r.normal.stageW * 0.9,
    `${r.death.stageW} vs ${r.normal.stageW}`);
  ok('the prose still sits on a dark ground', lum < 45, `${lum.toFixed(1)}/255 behind the text`);
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
