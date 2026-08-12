// Canvas composition for the Steam banners. Injected into the page by
// gen_steam_banners.mjs; every draw call runs at the real output resolution so
// nothing is upscaled after the fact.
(function () {
  const load = (src) => new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('load failed: ' + src));
    i.src = src;
  });

  // draw `img` to fill w×h without distortion (object-fit: cover)
  function cover(ctx, img, x, y, w, h, focusY) {
    const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) * (focusY == null ? 0.5 : focusY), dw, dh);
  }

  // draw a transparent sprite at a target HEIGHT, anchored by its feet
  function figure(ctx, img, cx, baseY, targetH, opts) {
    const o = opts || {};
    const s = targetH / img.naturalHeight;
    const w = img.naturalWidth * s;
    ctx.save();
    if (o.alpha != null) ctx.globalAlpha = o.alpha;
    if (o.shadow !== false) {
      ctx.shadowColor = o.shadowColor || 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = targetH * 0.09;
      ctx.shadowOffsetY = targetH * 0.03;
    }
    if (o.flip) { ctx.translate(cx, 0); ctx.scale(-1, 1); ctx.translate(-cx, 0); }
    ctx.drawImage(img, cx - w / 2, baseY - targetH, w, targetH);
    ctx.restore();
  }

  // soft contact shadow so figures sit on the ground instead of floating
  function contact(ctx, cx, baseY, w) {
    ctx.save();
    const g = ctx.createRadialGradient(cx, baseY, 0, cx, baseY, w * 0.55);
    g.addColorStop(0, 'rgba(0,0,0,0.45)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, baseY, w * 0.55, w * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function vignette(ctx, W, H, strength) {
    const g = ctx.createRadialGradient(W / 2, H * 0.48, Math.min(W, H) * 0.22, W / 2, H / 2, Math.max(W, H) * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(4,6,14,${strength == null ? 0.62 : strength})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  // bottom-weighted scrim: keeps the logo and any text legible over busy art
  function scrim(ctx, W, H, topFrac) {
    const g = ctx.createLinearGradient(0, H * (topFrac == null ? 0.35 : topFrac), 0, H);
    g.addColorStop(0, 'rgba(6,8,18,0)');
    g.addColorStop(1, 'rgba(6,8,18,0.80)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  function logoAt(ctx, logo, cx, cy, maxW, maxH) {
    const s = Math.min(maxW / logo.naturalWidth, maxH / logo.naturalHeight);
    const w = logo.naturalWidth * s, h = logo.naturalHeight * s;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = h * 0.20;
    ctx.shadowOffsetY = h * 0.045;
    ctx.drawImage(logo, cx - w / 2, cy - h / 2, w, h);
    ctx.restore();
  }

  window.__renderBanner = async function (job) {
    const { w: W, h: H, variant, logo: wantLogo, CAST, BG, MOB, LOGO, LINEUP } = job;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const cast = {};
    for (const k in CAST) cast[k] = await load(CAST[k]);
    const bg = {};
    for (const k in BG) bg[k] = await load(BG[k]);
    const mob = {};
    for (const k in MOB) { try { mob[k] = await load(MOB[k]); } catch (e) { mob[k] = null; } }
    const logo = await load(LOGO);

    // the four instructors stand on a baseline a little above the bottom edge
    const baseY = H * 0.92;
    const figH = H * (W / H > 2.6 ? 0.66 : 0.60);   // wide heroes get taller figures

    // ── STORE PAGE BACKGROUND ────────────────────────────────────────────
    // Different job from a capsule. Steam centres the store page's ~940px
    // content column over this image, so the middle ~65% is never really seen
    // and everything behind it only has to not fight the page chrome. What the
    // visitor actually sees is the two side margins (~250px each) and a sliver
    // of top and bottom. So: crush the whole plate dark, push a further scrim
    // down the centre column, and let the margins keep the only real detail.
    // The old background did the reverse — bright key art with every character
    // stacked in the middle, all of it hidden behind the page.
    if (variant === 'eclipse' || variant === 'veil' || variant === 'abyss') {
      const plate = variant === 'eclipse' ? bg.arena
                  : variant === 'veil'    ? bg.hood
                  :                         (bg.aetherion || bg.inner);
      cover(ctx, plate, 0, 0, W, H, variant === 'eclipse' ? 0.30 : 0.45);

      // 1. darken to a low-contrast base. Tuned by eye against the render: the
      //    first pass multiplied by #232a44 and then flat-filled another 42%
      //    black on top, which crushed the plate to near-solid black — the
      //    colosseum arches vanished entirely and the result read as an empty
      //    page with two characters glued to it rather than as artwork. The
      //    architecture has to stay faintly legible in the margins for this to
      //    be a background at all, so both stages are lighter now and the real
      //    darkening work is done by the centre-column scrim in step 3.
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = variant === 'veil' ? '#4a3f6b' : '#3d4675';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      ctx.fillStyle = 'rgba(6,8,18,0.18)';
      ctx.fillRect(0, 0, W, H);

      // 2. cool colour wash so the whole page reads as one temperature
      const wash = ctx.createLinearGradient(0, 0, W, H);
      wash.addColorStop(0, variant === 'veil' ? 'rgba(40,20,66,0.30)' : 'rgba(16,22,48,0.30)');
      wash.addColorStop(1, variant === 'abyss' ? 'rgba(8,14,32,0.42)' : 'rgba(12,10,30,0.36)');
      ctx.fillStyle = wash; ctx.fillRect(0, 0, W, H);

      // 3. the content column — darken hard where the page sits, feathered so
      //    the transition into the margins is invisible rather than a band.
      const colW = 940, x0 = (W - colW) / 2;
      const col = ctx.createLinearGradient(x0 - 190, 0, x0 + colW + 190, 0);
      col.addColorStop(0.00, 'rgba(4,5,12,0)');
      col.addColorStop(0.16, 'rgba(4,5,12,0.66)');
      col.addColorStop(0.50, 'rgba(4,5,12,0.74)');
      col.addColorStop(0.84, 'rgba(4,5,12,0.66)');
      col.addColorStop(1.00, 'rgba(4,5,12,0)');
      ctx.fillStyle = col; ctx.fillRect(0, 0, W, H);

      // 4. edge falloff top/bottom + a heavy vignette so nothing draws the eye
      const tb = ctx.createLinearGradient(0, 0, 0, H);
      tb.addColorStop(0.00, 'rgba(4,5,12,0.72)');
      tb.addColorStop(0.22, 'rgba(4,5,12,0.10)');
      tb.addColorStop(0.78, 'rgba(4,5,12,0.18)');
      tb.addColorStop(1.00, 'rgba(4,5,12,0.85)');
      ctx.fillStyle = tb; ctx.fillRect(0, 0, W, H);
      vignette(ctx, W, H, 0.58);

      // 5. a single instructor silhouette in each margin — the only figurative
      //    content, kept low-alpha and low in frame so it reads as atmosphere
      //    rather than as a subject competing with the page.
      const marg = variant === 'veil' ? ['taiga', 'hera'] : ['will', 'taiga'];
      [[W * 0.085, false], [W * 0.915, true]].forEach((p, i) => {
        const img = cast[marg[i]];
        if (!img) return;
        ctx.save();
        ctx.globalAlpha = 0.30;
        figure(ctx, img, p[0], H * 0.99, H * 0.62, { flip: p[1], shadow: false });
        ctx.restore();
      });

      // 6. a faint drifting ember/mote field, brightest at the edges
      ctx.save();
      for (let i = 0; i < 120; i++) {
        const rx = (i * 97.13) % 1, ry = (i * 61.79) % 1;
        const edge = Math.max(0, 1 - Math.abs(rx - 0.5) * 2.4);   // 0 centre, 1 edges
        const a = 0.05 + (1 - edge) * 0.16;
        ctx.fillStyle = `rgba(${variant === 'veil' ? '196,150,255' : '160,196,255'},${a})`;
        const r = 0.6 + ((i * 13) % 5) * 0.45;
        ctx.beginPath(); ctx.arc(rx * W, ry * H, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();

      return c.toDataURL('image/png').split(',')[1];
    }

    if (variant === 'council') {
      // One hub backdrop, the four instructors assembled across it with depth:
      // the two centre figures are larger and nearer, the outer two set back.
      cover(ctx, bg.central, 0, 0, W, H, 0.42);
      ctx.save(); ctx.filter = 'blur(' + Math.max(1, W * 0.0016) + 'px)'; ctx.drawImage(c, 0, 0); ctx.restore();
      vignette(ctx, W, H, 0.58);
      // Spacing is tightened on ultra-wide (the hero) — at 3.1:1 an even
      // quarter-split left a dead hole through the middle of the frame, which
      // is the first thing the eye lands on. The group now reads as a party
      // standing together with the outer two set back, and the wide crops keep
      // their negative space at the EDGES where Steam's own UI overlaps anyway.
      const wide = (W / H) > 2.6;
      const xs = wide ? [0.255, 0.415, 0.575, 0.735] : [0.155, 0.385, 0.615, 0.845];
      const depth = [0.88, 1.06, 1.06, 0.88];
      LINEUP.forEach((L, i) => {
        const img = cast[L.k], hh = figH * depth[i], cx = W * xs[i];
        contact(ctx, cx, baseY, hh * 0.55);
        figure(ctx, img, cx, baseY, hh, { flip: i > 1 });
      });
      scrim(ctx, W, H, 0.55);
      if (wantLogo) logoAt(ctx, logo, W / 2, H * 0.155, W * 0.64, H * 0.30);

    } else if (variant === 'realms') {
      // Four vertical realms, each instructor standing in their own home biome:
      // Emerald Village, Bastion Throne, the Floating Abode, Shadow-Woven Hood.
      const panel = W / 4;
      LINEUP.forEach((L, i) => {
        ctx.save();
        ctx.beginPath(); ctx.rect(i * panel, 0, panel, H); ctx.clip();
        cover(ctx, bg[L.bg], i * panel, 0, panel, H, 0.45);
        const tint = ctx.createLinearGradient(0, 0, 0, H);
        tint.addColorStop(0, 'rgba(8,10,22,0.10)');
        tint.addColorStop(1, 'rgba(8,10,22,0.72)');
        ctx.fillStyle = tint; ctx.fillRect(i * panel, 0, panel, H);
        const cx = i * panel + panel / 2;
        contact(ctx, cx, baseY, figH * 0.55);
        figure(ctx, cast[L.k], cx, baseY, figH, { flip: i > 1 });
        ctx.restore();
        if (i) {                                   // thin gold seam between realms
          ctx.save();
          ctx.fillStyle = 'rgba(255,214,120,0.55)';
          ctx.fillRect(i * panel - Math.max(1, W * 0.0012), 0, Math.max(2, W * 0.0024), H);
          ctx.restore();
        }
      });
      vignette(ctx, W, H, 0.45);
      // The wordmark straddles the two centre seams, so it needs its own plate
      // or the gold rules cut straight through the lettering.
      if (wantLogo) {
        ctx.save();
        const pg = ctx.createRadialGradient(W / 2, H * 0.17, 0, W / 2, H * 0.17, W * 0.34);
        pg.addColorStop(0, 'rgba(6,8,18,0.78)');
        pg.addColorStop(1, 'rgba(6,8,18,0)');
        ctx.fillStyle = pg; ctx.fillRect(0, 0, W, H * 0.42);
        ctx.restore();
        logoAt(ctx, logo, W / 2, H * 0.17, W * 0.58, H * 0.27);
      }

    } else {
      // showdown — the four instructors hold the foreground while Gravitos
      // looms out of the storm behind them.
      cover(ctx, bg.celestial, 0, 0, W, H, 0.38);
      ctx.save(); ctx.filter = 'blur(' + Math.max(2, W * 0.0022) + 'px)'; ctx.drawImage(c, 0, 0); ctx.restore();
      const storm = ctx.createLinearGradient(0, 0, W, H);
      storm.addColorStop(0, 'rgba(20,10,40,0.55)');
      storm.addColorStop(1, 'rgba(60,10,30,0.55)');
      ctx.fillStyle = storm; ctx.fillRect(0, 0, W, H);
      // Gravitos has to READ as the threat, which means scale, not placement.
      // The first pass drew it at 1.15x frame height beside the instructors and
      // it just looked like a fifth party member: same visual weight, same
      // ground line, half of it cropped off the right edge. It now stands at
      // ~1.9x frame height, rooted well below the baseline so only the torso up
      // is in frame, pushed back with haze so the eye reads distance.
      if (mob.gravitos) {
        ctx.save();
        ctx.globalAlpha = 0.72;
        figure(ctx, mob.gravitos, W * 0.775, H * 1.30, H * 1.90, { shadow: false });
        ctx.restore();
        const haze = ctx.createLinearGradient(0, 0, 0, H);
        haze.addColorStop(0, 'rgba(40,16,60,0.42)');
        haze.addColorStop(1, 'rgba(40,16,60,0.06)');
        ctx.fillStyle = haze; ctx.fillRect(W * 0.52, 0, W * 0.48, H);
      }
      vignette(ctx, W, H, 0.66);
      // Instructors hold the left half as a tight but NON-overlapping line —
      // the first pass packed four figures at 60% frame height into half the
      // width, so Hera's staff crossed Will and Taiga's cloak crossed Hera.
      // Smaller figures plus a wider spread fixes both.
      const sxs = [0.075, 0.205, 0.335, 0.465];
      LINEUP.forEach((L, i) => {
        const cx = W * sxs[i], hh = figH * 0.82 * (1 + i * 0.03);
        contact(ctx, cx, baseY, hh * 0.55);
        figure(ctx, cast[L.k], cx, baseY, hh, { flip: false });
      });
      scrim(ctx, W, H, 0.5);
      if (wantLogo) logoAt(ctx, logo, W * 0.29, H * 0.155, W * 0.50, H * 0.26);
    }

    return c.toDataURL('image/png').split(',')[1];
  };
})();
