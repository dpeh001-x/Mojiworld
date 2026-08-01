// v0.29.323 — certify the first-paint boot gate: the world reveals on
// BAZAAR + CRITICAL + start-map background, while DEFERRED still streams.
//
//   node serve.js 8788 && node scripts/boot_gate_test.mjs 8788
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const PORT = process.argv[2] || '8788';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

async function bootOnce(throttleKbps) {
  const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
  const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  if (throttleKbps) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false, latency: 30,
      downloadThroughput: throttleKbps * 1024 / 8, uploadThroughput: 256 * 1024 / 8,
    });
  }
  const t0 = Date.now();
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  // poll the gate's own counters until it reveals (or 150s)
  let snap = null, tReveal = null;
  for (let i = 0; i < 1500; i++) {
    snap = await page.evaluate(() => {
      const s = window._lxBootStats;
      return s ? { gated: s.gated, gatedTotal: s.gatedTotal, all: s.all, allTotal: s.allTotal, revealed: s.revealed } : null;
    });
    if (snap && snap.revealed) { tReveal = Date.now() - t0; break; }
    await new Promise(r => setTimeout(r, 100));
  }
  await b.close();
  return { snap, tReveal, errs };
}

// Run 1 — unthrottled sanity.
const fast = await bootOnce(0);
ok('boot stats are exposed', !!fast.snap, fast.snap);
ok('gate reveals (unthrottled)', fast.tReveal != null, { ms: fast.tReveal });
ok('gated set is a small fraction of the full manifest',
   fast.snap && fast.snap.gatedTotal < fast.snap.allTotal * 0.35,
   fast.snap && { gated: fast.snap.gatedTotal, all: fast.snap.allTotal });
ok('gated set fully loaded at reveal', fast.snap && fast.snap.gated >= fast.snap.gatedTotal, fast.snap);
ok('no page errors (unthrottled)', fast.errs.length === 0, fast.errs.slice(0, 3));

// Run 2 — throttled to 12 Mbps (12,288 kbps → 1.5 MB/s): the world must open
// while DEFERRED is still in flight. This is the property the whole change
// exists to provide. (First cut of this test passed 1500 believing it was
// 12 Mbps; that is 1.5 Mbps ≈ 0.19 MB/s, at which the measured 16.8 MB
// critical path NEEDS ~90 s — the "failure" was the test's arithmetic.)
const slow = await bootOnce(12288);
ok('gate reveals under throttling', slow.tReveal != null, { ms: slow.tReveal });
ok('reveal does NOT wait for the full manifest under throttling',
   slow.snap && slow.snap.all < slow.snap.allTotal,
   slow.snap && { loadedAtReveal: slow.snap.all, fullManifest: slow.snap.allTotal });
ok('reveal within 30s at 12 Mbps (pre-change, the full 279-asset gate needed several minutes)',
   slow.tReveal != null && slow.tReveal < 30000, { ms: slow.tReveal });
ok('no page errors (throttled)', slow.errs.length === 0, slow.errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.x != null ? '  ' + JSON.stringify(x.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
