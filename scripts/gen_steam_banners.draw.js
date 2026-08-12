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

  // ── CONSTELLATION HELPERS ────────────────────────────────────────────────
  // Stars are sampled from the creature's OWN alpha mask, so every point sits
  // on the animal rather than in a generic scatter around it. That is what
  // makes the figure read as a constellation OF that monster instead of a
  // sprite with dots sprinkled near it.
  function starsFromSprite(img, w, h, n, seed) {
    const off = document.createElement('canvas');
    const sw = Math.max(24, Math.round(w)), sh = Math.max(24, Math.round(h));
    off.width = sw; off.height = sh;
    const oc = off.getContext('2d');
    oc.drawImage(img, 0, 0, sw, sh);
    const d = oc.getImageData(0, 0, sw, sh).data;
    const solid = [];
    for (let y = 0; y < sh; y += 2)
      for (let x = 0; x < sw; x += 2)
        if (d[(y * sw + x) * 4 + 3] > 140) solid.push([x, y]);
    if (!solid.length) return [];
    // Farthest-point sampling — picks a spread of landmarks (head, paws, tail)
    // instead of clumping wherever the sprite happens to be densest.
    const pts = [solid[(seed * 7919) % solid.length]];
    while (pts.length < n) {
      let best = null, bestD = -1;
      for (let i = 0; i < solid.length; i += 3) {
        const p = solid[i];
        let dm = Infinity;
        for (const q of pts) {
          const dx = p[0] - q[0], dy = p[1] - q[1];
          const dd = dx * dx + dy * dy;
          if (dd < dm) dm = dd;
        }
        if (dm > bestD) { bestD = dm; best = p; }
      }
      if (!best) break;
      pts.push(best);
    }
    return pts;
  }

  // Chain the stars nearest-neighbour so the lines trace the body rather than
  // criss-crossing it — a real star chart's lines follow the figure.
  function chain(pts) {
    if (pts.length < 2) return pts;
    const left = pts.slice(1);
    const out = [pts[0]];
    while (left.length) {
      const c = out[out.length - 1];
      let bi = 0, bd = Infinity;
      for (let i = 0; i < left.length; i++) {
        const dx = left[i][0] - c[0], dy = left[i][1] - c[1];
        const dd = dx * dx + dy * dy;
        if (dd < bd) { bd = dd; bi = i; }
      }
      out.push(left.splice(bi, 1)[0]);
    }
    return out;
  }

  function drawConstellation(ctx, img, cx, cy, h, opts) {
    const o = opts || {};
    const s = h / img.naturalHeight, w = img.naturalWidth * s;
    const x0 = cx - w / 2, y0 = cy - h / 2;
    // 1. the creature itself, a dim luminous ghost
    ctx.save();
    ctx.globalAlpha = o.ghost == null ? 0.20 : o.ghost;
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(img, x0, y0, w, h);
    ctx.restore();
    // 2. star chart over it
    const pts = starsFromSprite(img, w, h, o.stars || 8, o.seed || 1);
    if (pts.length < 2) return null;
    const ch = chain(pts).map(p => [x0 + p[0], y0 + p[1]]);
    ctx.save();
    ctx.strokeStyle = o.line || 'rgba(190,215,255,0.34)';
    ctx.lineWidth = o.lw || 1.15;
    ctx.beginPath();
    ch.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    ctx.stroke();
    for (let i = 0; i < ch.length; i++) {
      const p = ch[i], big = (i === 0 || i === ch.length - 1);
      const r = big ? 2.6 : 1.7;
      ctx.fillStyle = o.star || 'rgba(226,238,255,0.92)';
      ctx.shadowColor = o.glow || 'rgba(150,200,255,0.95)';
      ctx.shadowBlur = big ? 12 : 7;
      ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    return ch[0];
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

    // ── THE EVERDAWN SKY — one woven star chart ──────────────────────────
    // The margin-figures variants below are honest but disjoint: two sprites
    // parked at the edges of a dark plate, with nothing tying them to each
    // other or to the middle. This one is a single artwork instead.
    //
    // The twelve ZODIAC bosses are the natural cast for it — a zodiac already
    // IS a set of constellations, so the conceit is the game's own rather than
    // decoration bolted on. They sit on a wheel around the frame, which puts
    // every figure in the margins Steam leaves visible and leaves the centre
    // open for the content column FOR FREE — the composition does the job the
    // scrim had to force in the other variants.
    //
    // Each creature is a dim luminous ghost with a star chart drawn over it,
    // and the star points are sampled from its OWN alpha mask (see
    // starsFromSprite) so they land on horns, paws and tails instead of being
    // scattered nearby. The wheel is then laced together — ring arcs between
    // neighbours, long chords across the middle — so the whole plate reads as
    // one connected sky rather than twelve separate stickers.
    if (variant === 'constellation') {
      const zod = {};
      for (const k in (job.ZODIAC || {})) {
        try { zod[k] = await load(job.ZODIAC[k]); } catch (e) { /* skip a missing sign */ }
      }
      const order = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
                     'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces']
                    .filter(k => zod[k]);

      // deep-space plate
      cover(ctx, bg.aetherion || bg.inner || bg.celestial, 0, 0, W, H, 0.45);
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = '#252c52'; ctx.fillRect(0, 0, W, H);
      ctx.restore();
      const sky = ctx.createRadialGradient(W / 2, H * 0.5, 0, W / 2, H * 0.5, W * 0.62);
      sky.addColorStop(0, 'rgba(10,14,34,0.55)');
      sky.addColorStop(1, 'rgba(5,7,20,0.88)');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

      // starfield — denser toward the edges, so the middle stays calm
      ctx.save();
      for (let i = 0; i < 420; i++) {
        const rx = (i * 97.13) % 1, ry = (i * 61.79) % 1;
        const edge = Math.abs(rx - 0.5) * 2;
        const a = 0.05 + edge * 0.28 * (((i * 29) % 7) / 7 + 0.35);
        ctx.fillStyle = `rgba(210,228,255,${a.toFixed(3)})`;
        const r = 0.5 + ((i * 13) % 5) * 0.42;
        ctx.beginPath(); ctx.arc(rx * W, ry * H, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();

      // the wheel
      // Wheel radii are sized so no sign is clipped by the frame. The first
      // pass used rx/ry of 0.405/0.40, which put the 12 and 6 o'clock signs
      // half off the top and bottom edges (figure half-height 87px against a
      // 324px radius from a 405px centre) and shaved the 3 o'clock sign on the
      // right. Radii now leave a margin of at least half a figure on every
      // side: a constellation cut by the canvas edge stops reading as one.
      const figH = H * 0.205, half = figH * 0.62;
      const cx = W / 2, cy = H * 0.50;
      // rx is pushed to whatever the frame allows rather than a fixed fraction.
      // Steam's ~940px content column covers x 249-1189 here, so every pixel
      // the wheel gains outward moves the 9 and 3 o'clock signs further into
      // the margins the visitor actually sees. A wheel still necessarily puts
      // signs at 12 and 6 inside the covered band — that is the cost of a
      // composition that reads as one connected sky instead of edge decoration,
      // and it is affordable because the whole plate is dark enough (mean
      // luminance ~12/255) that nothing shows through the page copy anyway.
      const rx = W / 2 - half - 16;
      const ry = Math.min(H * 0.355, H / 2 - half - 14);
      const nodes = [];
      order.forEach((k, i) => {
        const a = (-Math.PI / 2) + (i / order.length) * Math.PI * 2;
        const px = cx + Math.cos(a) * rx, py = cy + Math.sin(a) * ry;
        const anchor = drawConstellation(ctx, zod[k], px, py, figH, {
          ghost: 0.20, stars: 10, seed: i + 3, lw: 1.1,
        });
        nodes.push(anchor || [px, py]);
      });

      // lace the wheel together: ring arcs + long chords through the middle
      ctx.save();
      ctx.lineWidth = 0.9;
      ctx.strokeStyle = 'rgba(150,190,255,0.16)';
      ctx.beginPath();
      nodes.forEach((p, i) => {
        const q = nodes[(i + 1) % nodes.length];
        const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
        const bow = 0.10;
        ctx.moveTo(p[0], p[1]);
        ctx.quadraticCurveTo(mx + (cx - mx) * bow, my + (cy - my) * bow, q[0], q[1]);
      });
      ctx.stroke();
      ctx.strokeStyle = 'rgba(150,190,255,0.085)';
      ctx.beginPath();
      for (let i = 0; i < nodes.length; i++) {
        const q = nodes[(i + 5) % nodes.length];     // 5-step chords cross the centre
        ctx.moveTo(nodes[i][0], nodes[i][1]); ctx.lineTo(q[0], q[1]);
      }
      ctx.stroke();
      ctx.restore();

      // settle the middle just enough for page copy, without erasing the lacing
      const mid = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.34);
      mid.addColorStop(0, 'rgba(4,6,16,0.62)');
      mid.addColorStop(1, 'rgba(4,6,16,0)');
      ctx.fillStyle = mid; ctx.fillRect(0, 0, W, H);
      vignette(ctx, W, H, 0.52);
      return c.toDataURL('image/png').split(',')[1];
    }

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
