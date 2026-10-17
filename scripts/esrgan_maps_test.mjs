// esrgan-maps confirming test: the 30 upscaled files are the reviewed ones, every one is drawn in EXACTLY the box the old art
// was (sizes and anchors computed from the OLD art's dimensions), and each is now drawn from at least one source pixel per
// screen pixel at DPR 2 (the bug: 1456-px plates, the 760-px Dawn Gate and the 768-px shockwave were stretched up to 2x).
//   node scripts/esrgan_maps_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build; PORT=<port>)
// On origin (old art) FILES, SIZES, the three SHARP checks and SW fail; the box / anchor / timing / table checks pass on both.
import { chromium } from 'playwright-core';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '11721';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
// [repo path, new sha256, new W, new H, old W, old H]
const ART = [
  ["backgrounds/bg_v3_forest.webp","9e01e9b2bec6d2f4c6152a05b70b5740972980034a12162c60c5689099a79e84",2912,1632,1456,816],
  ["backgrounds/bg_v3_meadow.webp","da1a284317ade2bb571c8ac1bb1d5bd096bfe25f403d2358fe6c9aebe1555729",2912,1632,1456,816],
  ["backgrounds/bg_v3_misty.webp","3c44e1a956e5f58498e817b5b0245326c4f7bf3a8feaf63171d74911c894f140",2912,1632,1456,816],
  ["backgrounds/bg_v3_dungeon.webp","0cc795a12ee19fd233fa52ba5e152e2e2f4d62522e5a40bd75e536fd525682e1",2912,1632,1456,816],
  ["backgrounds/bg_v3_cinematic_underwater_1.webp","0a852d31374f9a50e003bd4232d204062fae7ad65c7d962499ce32368360c682",2912,1632,1456,816],
  ["backgrounds/bg_v3_cinematic_underwater_2.webp","3baa4fed05fc8e2354794a4442a4690812746de7eb7f64bbd06ce24e7c8d4d03",2912,1632,1456,816],
  ["backgrounds/bg_v4_elderwoodGrove.webp","e29a18e7a5773edc827149600f89e991bc87f87dc72607ddb87f76a1aef4e9af",2940,1610,1344,736],
  ["backgrounds/bg_v4_verdantHaven.webp","1373a0795f66fa09d1ccee05724cca04e7541658e59b4f7284203ec40fc3b9aa",2940,1610,1344,736],
  ["backgrounds/bg_v4_fieryHideout.webp","2836b1122aabc0ef833952542b15679adfb2a3a88591a6a666632de1aa35ece7",2940,1610,1344,736],
  ["backgrounds/bg_v4_bloomhaven.webp","7c9ac6c34c6ac82f233f3200570011d7a7a95dd9b6bccf0ad05fa99cc6be6ff8",2940,1610,1344,736],
  ["backgrounds/bg_v4_gloomsporeVerge.webp","f19f4a4b9410c44f44f9e7a146213530bccd7431434d81df3b4f5a7e266e43b0",2940,1610,1344,736],
  ["backgrounds/bg_v4_mossyReaches.webp","ef3da31365e4d70ab458a54485976f96c59e9588676c23fab8bae43b0be87f68",2940,1610,1344,736],
  ["backgrounds/bg_v4_sunderedCatacomb.webp","14278382f8eb511b31d5b5e539131c051ae94955471228ecea77329e72735feb",2940,1610,1344,736],
  ["backgrounds/bg_v4_hallOfEchoes.webp","45628967e0b6ea73f2036d7bfbab3dc1ac413ca3876497a0df823d5d2e456cd0",2940,1610,1344,736],
  ["backgrounds/bg_v4_stormCrest.webp","f71844761869c762e34e94335564e20ad5ae4675af84fffcc7591aeed560b66c",2940,1610,1344,736],
  ["backgrounds/bg_v4_ossuarySprawl.webp","7d9770c31367d8137dfc36cd04280b16917cf892d5a092651ee99e08002881d6",2912,2184,1152,864],
  ["backgrounds/bg_v4_glasswindSteppe.webp","6e9868ba8a6f273e5e9698a0ea96445f787d0e0022f9ffacd094af26ae8a7102",2912,1664,1344,768],
  ["backgrounds/bg_v4_glasswindSteppe2.webp","f959795cff57ccda9761e44eb5edb271b11ac898515b1fb25e1428c42b99da68",2912,1664,1344,768],
  ["backgrounds/title_keyart_c.webp","cb897940676de337e46b929090e21a5f5ac0a2810d695147ec328ce2a45aff34",2752,1536,1376,768],
  ["Sprites/ui/death_keyart.webp","84b1588bcfbfd2550d378c598f441038e37e8da5ab94a0af6fbeb22c964a25ae",1920,1080,1920,1080],
  ["Sprites/objects/town_dawn_gate.webp","778b0ea2bf2d1dd482158bf646d1288cd2eb530f1df7b38934bceefb0872e9c9",1520,978,760,489],
  ["Sprites/fx/dawn_crest.webp","20a3b6342467cdb0e7f1ed3c6be21a3413730923dbd56c37ff5ae58bd8bd7cf0",1034,1089,696,733],
  ["Sprites/fx/arcane_shockwave.webp","28111f3c619cd40ad629180dcebaf225dfe6c170adbc6195838c3eece395e30a",1536,1536,768,768],
  ["Sprites/fx/anim/arcane_shockwave_0.webp","b224b6a6deb29bd38f30f655d329e2902fc64f41a50180cdd79029f09fa00cb3",1536,1536,768,768],
  ["Sprites/fx/anim/arcane_shockwave_1.webp","88b8dd1b0f55b1251f09e993446835004982dee879303da0e056511beb25bbad",1536,1536,768,768],
  ["Sprites/fx/anim/arcane_shockwave_2.webp","ab184883ffc3188afee1565baef0d1d7cb8a78f6bfbc3f0e72e31f395c0cd9c6",1536,1536,768,768],
  ["Sprites/fx/anim/arcane_shockwave_3.webp","6c4c265212056e8b6f4092c784ad15f62432e2741e2b7ce09ec5d1c1c69b0448",1536,1536,768,768],
  ["Sprites/fx/anim/arcane_shockwave_4.webp","83b39204a158e45157e43eca89276332934f9553e87a9f46de8361d097a826dc",1536,1536,768,768],
  ["Sprites/fx/anim/arcane_shockwave_5.webp","ac45bf9395d9589c6260a4622d4f88fa91ec82479b3c945ae94f71efd4f083f1",1536,1536,768,768],
  ["Sprites/fx/anim/arcane_shockwave_6.webp","b5b605b4ef737f48bbc5e7b905e82d04ad1325bbc85509886fd5093785d59313",1536,1536,768,768],
  ["Sprites/fx/anim/arcane_shockwave_7.webp","7e8dc4a27c98a0a7d5934751f8fff70813676c6cb9e05525973416161db79776",1536,1536,768,768],
  ["Sprites/fx/anim/arcane_shockwave_8.webp","22f784ac192a68ebb7a2c576631c31f9c6f12cd30ebadc92672c3f93c287f478",1536,1536,768,768],
];
const MAPS = [
  ["forest","forest",1456,816],
  ["meadow","cadetsStrand",1456,816],
  ["misty","glimmerwood",1456,816],
  ["dungeon","-",1456,816],
  ["underwater","-",1456,816],
  ["U2","-",1456,816],
  ["elderwoodGrove","ancient",1344,736],
  ["verdantHaven","verdantHaven",1344,736],
  ["fieryHideout","fieryHideout",1344,736],
  ["bloomhaven","bloomhaven",1344,736],
  ["gloomsporeVerge","gloomsporeVerge",1344,736],
  ["mossyReaches","boneGraveyard",1344,736],
  ["sunderedCatacomb","boneGraveyard2",1344,736],
  ["hallOfEchoes","boss_rush",1344,736],
  ["stormCrest","stormCrest",1344,736],
  ["ossuarySprawl","ossuarySprawl",1152,864],
  ["glasswindSteppe","glasswindSteppe",1344,768],
  ["glasswindSteppe2","glasswindSteppe2",1344,768],
];   // [bg key, map id ('-' = forest with its bg forced), old W, old H]
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
try {
  // FILES: the bytes the server hands out are the reviewed upscales
  { const miss = [];
    for (const [rel, want] of ART) { let h = null; try { const r = await fetch(`http://localhost:${PORT}/${rel}`); h = crypto.createHash('sha256').update(Buffer.from(await r.arrayBuffer())).digest('hex'); } catch (e) {} if (h !== want) miss.push(rel); }
    check(!miss.length, 'FILES: all ' + ART.length + ' upscaled files are the reviewed ones (sha256)', { notNew: miss.length, first: miss.slice(0, 3) }); }
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  if (process.env.ESRM_DEBUG) { p.on('console', (m) => { if (m.text().indexOf('[esrm]') === 0) console.error(m.text()); }); await p.addInitScript(() => { window.__dbg = true; }); }
  await p.route((u) => /[/]assets[/]fonts[/].*[.]woff2$/.test(u.pathname), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (existsSync(path.join(ROOT, rel))) return r.continue();
    try { r.fulfill({ status: 200, contentType: 'font/woff2', body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 24 }) }); } catch (e) { r.continue(); }
  });
  // render scale 2: the store is 1920 x 1120 device px for the 960 x 560 view (the DPR-2 case the audit measured)
  await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('lx_render_scale', '2'); localStorage.setItem('lx_drs', 'off'); } catch (e) {} });
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof BG_IMAGES === 'object' && typeof SKILL_FNS === 'object' && typeof _lxBgScaled === 'function', null, { timeout: 150000 });
  await p.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; try { applyClass('mage'); } catch (e) { player.cls = 'mage'; } player.level = 70;
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true }); try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    loadMap('forest'); await new Promise((s) => setTimeout(s, 2500)); document.getElementById('everdawn-welcome-overlay')?.remove();
    player.invulnerable = 999999; game.monsters.length = 0;
    // one recorder for every check: the drawImage calls on the game canvas while __rec is set
    const P = CanvasRenderingContext2D.prototype, oD = P.drawImage; window.__rec = null;
    P.drawImage = function (im) { if (window.__rec && this === ctx) { const t = this.getTransform(), n = arguments.length; if (n === 5 || n === 9) window.__rec.push({ im, dx: arguments[n - 4], dy: arguments[n - 3], dw: arguments[n - 2], dh: arguments[n - 1], a: t.a, e: t.e, f: t.f, cam: game.camera.x, life: window.__swFx ? window.__swFx.life : null }); } return oD.apply(this, arguments); };   // life: the shockwave burst's, read AT the draw
    window.__frames = (n) => new Promise((res) => { let k = 0; const f = () => (++k >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); });
    window.__until = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (fn()) return true; } catch (e) {} await new Promise((r) => setTimeout(r, 100)); } return false; };
  });
  // SIZES: every new file decodes at its new size, at the old aspect (to 0.003%)
  { const r = await p.evaluate(async (ART) => { const out = [];
      for (const [rel, , nw, nh, ow, oh] of ART) { let w = 0, h = 0;   // fetch + createImageBitmap: the game's image hooks (lazy art, the boot hold) never see it
        try { const bm = await createImageBitmap(await (await fetch(rel + '?esrm=' + Date.now())).blob()); w = bm.width; h = bm.height; bm.close(); } catch (e) {}
        out.push({ rel, w, h, ok: w === nw && h === nh, asp: Math.abs((w / h) / (ow / oh) - 1) }); }
      return out; }, ART);
    const wrong = r.filter((q) => !q.ok); check(!wrong.length, 'SIZES: every file decodes at its upscaled size', wrong.slice(0, 4).map((q) => q.rel.split('/').pop() + ' ' + q.w + 'x' + q.h));
    const worst = Math.max(...r.map((q) => q.asp)); check(worst < 4e-5, 'ASPECT: every file keeps the old aspect (to 0.004%)', { worst }); }
  // BACKDROPS: per map, the plate's blit box = the box the OLD dimensions give (the game's own sizing helpers), and the source
  // pixels behind it (after the >3% crop the game applies) cover the drawn width at >= 1 px per device px.
  { const rows = await p.evaluate(async (MAPS) => {
      const out = [];
      for (const [key, map, ow, oh] of MAPS) {
        const t0 = Date.now(); loadMap(map === '-' ? 'forest' : map); await __frames(20); game.monsters.length = 0;
        if (key === 'U2') BG_IMAGES.__lxU2 = BG_CINEMATIC_VARIANTS[1];   // the 2nd underwater plate has no key of its own (the ?art=cinematic rotation)
        const K = key === 'U2' ? '__lxU2' : key;
        const md = game.mapData; if (map === '-') md.bg = K;
        const im = BG_IMAGES[K]; if (!im) { out.push({ key, err: 'no plate' }); continue; }
        try { if (im._lxLazy && typeof _lxWantImg === 'function') _lxWantImg(im, true); } catch (e) {}
        await __until(() => im._loaded && im.naturalWidth > 0, 60000); try { await im.decode(); } catch (e) {}
        await __frames(6); window.__rec = []; await __frames(10);   // several: a frame between sim steps can be a smoothed blit with no backdrop draw
        const bake = im._lxBgS, hit = window.__rec.find((c) => (c.im === im || c.im === bake || (bake && c.im === bake._lxTintBake)) && c.a > 0); window.__rec = null;
        if (window.__dbg) console.log('[esrm] ' + key + ' ' + (Date.now() - t0) + ' ms, loaded ' + im._loaded + ', hit ' + !!hit);
        if (!hit) { out.push({ key, map, err: 'no backdrop draw seen' }); continue; }
        const OA = ow / oh, dpr = ctx.canvas.width / W; let ew = W, eh = H, ey = 0;
        if (md.bgNoMirror) { const s = _lxNoMirrorSize(md.worldWidth, OA); ew = s.w; eh = s.h; ey = md.bgCropTop != null ? Math.round((H - eh) * md.bgCropTop) : H - eh; }
        else { const wc = _lxWideCover(OA, W, H); if (wc) { ew = wc.w; eh = wc.h; ey = H - wc.h; } }
        const boxAsp = (ew * dpr) / (eh * dpr), crop = Math.abs(OA / boxAsp - 1) > 0.03, srcW = crop ? Math.min(im.naturalWidth, im.naturalHeight * boxAsp) : im.naturalWidth;
        out.push({ key, map: game.currentMap, nat: im.naturalWidth + 'x' + im.naturalHeight, box: [hit.dw, hit.dh, hit.dy], exp: [ew, eh, ey], same: Math.abs(hit.dw - ew) < 1e-6 && Math.abs(hit.dh - eh) < 1e-6 && Math.abs(hit.dy - ey) < 1e-6, dens: +(srcW / (ew * dpr)).toFixed(3), old: +((crop ? Math.min(ow, oh * boxAsp) : ow) / (ew * dpr)).toFixed(3), pano: !!md.bgNoMirror });
      }
      return out; }, MAPS);
    const errs2 = rows.filter((q) => q.err), moved = rows.filter((q) => !q.err && !q.same), soft = rows.filter((q) => !q.err && !(q.dens >= 0.99 || (q.pano && q.dens >= 1.9 * q.old)));
    check(!errs2.length && rows.length === MAPS.length, 'BACKDROPS: all ' + MAPS.length + ' plates load and draw', errs2.slice(0, 3));
    check(!moved.length, 'BACKDROP BOX: every plate is drawn in exactly the box (size + anchor) its old dimensions gave', moved.slice(0, 3));
    check(!soft.length, 'SHARP BACKDROPS: every plate has >= 1 source px per device px at DPR 2 (a scrolling panorama: >= 1.9x its old density)', soft.slice(0, 4).map((q) => q.key + ' ' + q.dens + ' (old ' + q.old + ')')); }
  // DAWN GATE (town): drawn at w = L.w, h = w x 489/760, at the anchor the old art gave; its bake is minted from >= 1 source px per px
  { const r = await p.evaluate(async () => {
      loadMap('town'); await __frames(20); game.monsters.length = 0;
      const ok = await __until(() => !!_lxMallLuxImg('town_dawn_gate'), 60000); if (!ok) return { err: 'gate art never loaded' };
      const img = _lxMallLuxImg('town_dawn_gate'), cfg = _lxTownCfg(), L = cfg.landmarks.find((q) => q.key === 'town_dawn_gate');
      player.x = L.x - 40; player.vx = 0; await __frames(30);
      const d = _lxMallDpr(), cv = _lxMallBakes['tlandtown_dawn_gate' + L.w + '|' + d];
      window.__rec = []; await __frames(10); const rec = window.__rec; window.__rec = null;
      const hit = rec.find((c) => c.im === cv), cam = hit ? hit.cam : game.camera.x; if (!cv || !hit) return { err: 'gate draw not seen', cv: !!cv };
      const w = L.w, h = w * 489 / 760, x = L.x - cam - w / 2, top = (cfg.floorY || 480) + (L.sink || 0) - h * (L.foot != null ? L.foot : 1);
      const exp = [_lxMallSnap(x), _lxMallSnap(top), Math.ceil(w * d) / d, Math.ceil(h * d) / d];
      return { got: [hit.dx, hit.dy, hit.dw, hit.dh], exp, camMoved: game.camera.x !== cam, nat: [img.naturalWidth, img.naturalHeight], bake: [cv.width, cv.height], table: !!_lxBboxFromTable(img) };
    });
    check(!r.err && r.got.every((v, i) => Math.abs(v - r.exp[i]) < 1e-6), 'GATE: the Dawn Gate is drawn at exactly its old size and anchor', r);
    check(!r.err && r.nat[0] >= r.bake[0] && r.nat[1] >= r.bake[1], 'SHARP GATE: its drawn bake is minted from >= 1 source px per px (was 760 px into 1014)', r.err ? r : { nat: r.nat, bake: r.bake });
    check(!r.err && r.table, 'GATE TABLE: the precomputed bbox row matches the art (no getImageData scan)', r.err ? r : { nat: r.nat }); }
  // DAWN CREST: D = 250 (breathing), H = D x 733/696 (the OLD aspect, to 0.02 px) at the old anchor
  { const r = await p.evaluate(async () => {
      loadMap('forest'); await __frames(10); game.monsters.length = 0;
      window._lxStoryComplete = () => true; player.dawnAuraOff = false; player._dawnFavorSeen = true;
      const A = _lxDawnArt(); if (!(await __until(() => A.crest && A.crest.complete && A.crest.naturalWidth > 0, 60000))) return { err: 'crest never loaded' };
      const oA = window.drawDawnAura; let rec = null;
      window.drawDawnAura = function () { const c0 = window.__rec; window.__rec = []; try { return oA.apply(this, arguments); } finally { rec = { calls: window.__rec, px: player.x, py: player.y, cam: game.camera.x }; window.__rec = c0; } };
      await __frames(4); window.drawDawnAura = oA;
      if (!rec || rec.calls.length < 2) return { err: 'crest draw not seen', n: rec && rec.calls.length };
      const c = rec.calls[1], D = c.dw, H0 = D * 733 / 696, cx = Math.round(rec.px - rec.cam) + player.w / 2, sy = Math.round(rec.py);
      return { got: [c.dx, c.dy, c.dw, c.dh], exp: [cx - D * LX_DAWN_OPEN_FX, sy + player.h * LX_DAWN_OPEN_AT - H0 * LX_DAWN_OPEN_FY, D, H0], nat: [A.crest.naturalWidth, A.crest.naturalHeight] };
    });
    check(!r.err && r.got.every((v, i) => Math.abs(v - r.exp[i]) < 0.02), 'CREST: the Dawn crest is drawn at its old size and anchor (to 0.02 px)', r); }
  // ARCANE BURST SHOCKWAVE: the real cast; every draw is the frame and box the old timing gives (frameGap 2 over 26 frames,
  // 0.5 -> 1.1 grow of size = 2 x the blast radius), and the peak draw has >= 1 source px per device px
  { const r = await p.evaluate(async () => {
      loadMap('forest'); await __frames(10); game.monsters.length = 0;
      const fr = _fxAnimFrames('arcane_shockwave');
      const ready = () => { const f = _fxAnimFrames('arcane_shockwave'); return f && f.length === 9 && f.every((im) => im && (im.tagName === 'CANVAS' || _lxFxReady(im))); };
      if (!(await __until(ready, 90000))) return { err: 'shockwave frames never ready', n: fr && fr.length };
      await __frames(30);   // let the shrink bakes for this render scale land
      const dpr = ctx.canvas.width / W, seen = [];
      window.__rec = []; game.smoothFx = (game.smoothFx || []).filter((f) => f.spriteKey !== 'arcane_shockwave');
      SKILL_FNS.arcaneBurst();
      const fx = game.smoothFx.find((f) => f.spriteKey === 'arcane_shockwave'); if (!fx) return { err: 'cast spawned no shockwave' }; window.__swFx = fx;
      for (let i = 0; i < 40 && game.smoothFx.includes(fx); i++) {
        window.__rec = []; await __frames(1);
        for (const c of window.__rec) { const src = String(c.im.src || (c.im._lxSrc && c.im._lxSrc.src) || ''); const m = /arcane_shockwave(?:_(\d))?\.webp/.exec(src); if (!m) continue;
          seen.push({ life: c.life, max: fx.maxLife, size: fx.size, fi: m[1] == null ? -1 : +m[1], dw: c.dw, dh: c.dh, sw: c.im.width, a: c.a }); }
      }
      window.__rec = null; window.__swFx = null;
      return { seen, dpr };
    });
    if (r.err) { check(false, 'SHOCKWAVE: cast and frames', r); check(false, 'SHOCKWAVE TIMING', r); check(false, 'SHARP SHOCKWAVE', r); }
    else {
      const bad1 = r.seen.filter((q) => { const t = 1 - q.life / q.max, want = q.size * (0.5 + t * 0.6), fi = Math.floor((q.max - q.life) / 2) % 9; return q.fi !== fi || Math.abs(q.dw - want) > 1e-6 || Math.abs(q.dh - want) > 1e-6; });
      const fis = new Set(r.seen.map((q) => q.fi)); check(r.seen.length >= 8 && fis.size >= 6 && Math.max(...r.seen.map((q) => q.max - q.life)) >= 20, 'SHOCKWAVE: the real Arcane Burst cast draws the ring through its whole life (most of its 9 frames)', { draws: r.seen.length, frames: [...fis] });
      check(!bad1.length, 'SHOCKWAVE TIMING + BOX: every draw is the old frame (frameGap 2, 9 frames) at the old size (size x 0.5..1.1)', bad1.slice(0, 3));
      const peak = r.seen.reduce((a, q) => (q.dw > a.dw ? q : a), r.seen[0]); const dens = peak.sw / (peak.dw * r.dpr);
      check(dens >= 0.99, 'SHARP SHOCKWAVE: the largest ring draw has >= 1 source px per device px at DPR 2 (was 0.55)', { dens: +dens.toFixed(3), src: peak.sw, dw: peak.dw }); } }
  // SW: the asset cache generation moved on, so returning browsers drop the old art
  { const t = await p.evaluate(async () => (await fetch('sw.js?esrm=' + Date.now())).text());
    check(/esrgan-maps/.test(t) && /const CACHE = 'mojiworld-assets-v\d+';\s+\/\/ esrgan-maps/.test(t), 'SW: sw.js bumps the asset cache for the replaced art', t.match(/const CACHE = [^\n]{0,80}/)); }
  // EDGES TABLE: the precomputed feather probe rows for the upscaled sprites equal a live probe of the new art (same code as
  // scripts/gen_sprite_edges.mjs), so no sprite is feathered from a stale row
  { const r = await p.evaluate(async (rels) => {
      const S = 48, cv = document.createElement('canvas'); cv.width = S; cv.height = S; const g = cv.getContext('2d', { willReadFrequently: true });
      const probe = (img) => { g.clearRect(0, 0, S, S); g.drawImage(img, 0, 0, S, S); const d = g.getImageData(0, 0, S, S).data, a = (x, y) => d[(y * S + x) * 4 + 3];
        const scan = (get) => { let n = 0, first = -1, last = -1; for (let i = 0; i < S; i++) if (get(i) > 24) { n++; if (first < 0) first = i; last = i; } return n > 1 ? (n + ':' + first + ':' + last) : ''; };
        const v = [scan((i) => a(0, i)), scan((i) => a(S - 1, i)), scan((i) => a(i, 0)), scan((i) => a(i, S - 1))].join('|'); return v === '|||' ? '' : v; };
      const out = [];
      for (const rel of rels) { const im = new Image(); im.src = URL.createObjectURL(await (await fetch(rel + '?esrm=' + Date.now())).blob()); try { await im.decode(); } catch (e) {}
        const k = rel.replace(/^Sprites\//, ''); out.push({ k, live: probe(im), table: (window.LX_SPRITE_EDGES || {})[k] }); }   // a blob URL: the game's image hooks never see it
      return out; }, ART.map((q) => q[0]).filter((q) => q.startsWith('Sprites/objects/') || q.startsWith('Sprites/fx/')));   // the trees gen_sprite_edges covers (not ui/)
    const off = r.filter((q) => q.live !== q.table); check(!off.length, 'EDGES TABLE: the feather rows of the ' + r.length + ' upscaled sprites match a live probe', off); }
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
} finally { await browser.close(); srv.kill(); }
console.log(bad ? `${bad} of ${total} FAILED` : `all ${total} passed`);
process.exit(bad ? 1 : 0);
