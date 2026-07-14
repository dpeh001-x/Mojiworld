// Build zodiac_vfx_review.html: scan the four asset categories from disk and
// inject the data + runtime into the skeleton's placeholders. Atomic write.
import { readdirSync, existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const R = (p) => join(root, p);
const ls = (p) => existsSync(R(p)) ? readdirSync(R(p)) : [];

const SIGNS = ['aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces'];
const cap = (s) => s[0].toUpperCase() + s.slice(1);

// frames for an animated key: Sprites/projectiles/anim/<key>_N.webp (sorted)
const animFrames = (key) => ls('Sprites/projectiles/anim')
  .filter(f => new RegExp('^' + key + '_\\d+\\.webp$').test(f))
  .sort((a, b) => (+a.match(/_(\d+)/)[1]) - (+b.match(/_(\d+)/)[1]))
  .map(f => 'Sprites/projectiles/anim/' + f);
const bossFrames = (state, sign) => ls('Sprites/bosses/zodiac/' + state)
  .filter(f => new RegExp('^' + sign + '_\\d+\\.webp$').test(f))
  .sort((a, b) => (+a.match(/_(\d+)/)[1]) - (+b.match(/_(\d+)/)[1]))
  .map(f => 'Sprites/bosses/zodiac/' + state + '/' + f);

// A) Zodiac attack projectiles (animated)
const PROJ = [
  ['zodiac', 'Aries', 'fiery cosmic ram-bolt', 'p_zodiacbolt.png'],
  ['taurus_boulder', 'Taurus', 'molten granite boulder (falling)', 'p_taurus_boulder.png'],
  ['gemini_shard', 'Gemini', 'twin crystalline spire shard', 'p_gemini_shard.png'],
  ['cancerBubble', 'Cancer', 'clawed water bubble', 'p_cancerbubble.png'],
  ['scale', 'Libra', 'balance-scale energy', 'p_scale.png'],
  ['markedShot', 'Sagittarius', 'blazing marked arrow-star', 'p_markedshot.png'],
  ['icePillar', 'Capricorn', 'ice spire', 'p_icepillar.png'],
  ['droplet', 'Pisces', 'twin-fish water orb', 'p_droplet.png'],
  ['deathOrb', 'Aetherion / void', 'void singularity insta-kill orb', 'p_deathorb.png'],
].map(([key, sign, desc, base]) => {
  const frames = animFrames(key);
  return { id: 'proj:' + key, name: sign + ' — ' + key, desc,
    frames: frames.length ? frames : ['Sprites/projectiles/' + base] };
});

// B) Zodiac glyph / symbol sprites (static, Sprites/zodiac/<sign>.webp)
const GLYPH = SIGNS.filter(s => existsSync(R('Sprites/zodiac/' + s + '.webp')))
  .map(s => ({ id: 'glyph:' + s, name: cap(s) + ' glyph', desc: 'constellation symbol VFX',
               frames: ['Sprites/zodiac/' + s + '.webp'] }));

// C) Shared combat VFX (static, Sprites/vfx/*.webp)
const SHARED = ls('Sprites/vfx').filter(f => f.endsWith('.webp'))
  .map(f => ({ id: 'vfx:' + f, name: f.replace('.webp', ''), desc: 'shared combat VFX',
               frames: ['Sprites/vfx/' + f] }));

// D) Zodiac boss animations (animated) — attack / idle / walk per sign
const BOSS = {};
for (const state of ['attack', 'idle', 'walk']) {
  BOSS[state] = SIGNS.map(s => {
    const frames = bossFrames(state, s);
    return { id: 'boss:' + state + ':' + s, name: cap(s), desc: state + ' animation',
      frames: frames.length ? frames : ['Sprites/bosses/zodiac/' + s + '.png'] };
  });
}

const DATA = {
  sections: [
    { title: 'A · Zodiac Attack Projectiles', sub: 'The projectile/skill VFX each sign casts (9-frame animations). The clearest "attack VFX" set.', items: PROJ },
    { title: 'B · Zodiac Glyph / Symbol VFX', sub: 'Per-sign constellation symbols (Sprites/zodiac/).', items: GLYPH },
    { title: 'C · Shared Combat VFX', sub: 'Reusable effect sprites (Sprites/vfx/) — several fire during zodiac signature attacks (gravity well, lightning pillar, frost beam, quake/shock rings…).', items: SHARED },
    { title: 'D · Boss Attack Animations', sub: 'Each sign’s ATTACK pose animation (the on-boss half of the attack VFX).', items: BOSS.attack },
    { title: 'E · Boss Idle Animations', sub: 'Idle loops (Sprites/bosses/zodiac/idle/).', items: BOSS.idle },
    { title: 'F · Boss Walk Animations', sub: 'Walk cycles (Sprites/bosses/zodiac/walk/).', items: BOSS.walk },
  ],
};

const SCRIPT = `
const DATA = JSON.parse(document.getElementById('data').textContent);
const LS = 'lx_zodiac_vfx_marks_v1';
let marks = {}; try { marks = JSON.parse(localStorage.getItem(LS) || '{}'); } catch (e) {}
const save = () => localStorage.setItem(LS, JSON.stringify(marks));
const main = document.getElementById('main');
const timers = [];
let filterFlagged = false;

function card(it) {
  const el = document.createElement('div');
  el.className = 'card'; el.dataset.id = it.id;
  const st = (marks[it.id] && marks[it.id].status) || '';
  if (st) el.classList.add('s-' + st);
  const th = document.createElement('div');
  th.className = 'thumb' + (document.getElementById('chkChecker').checked ? ' checker' : '');
  const img = document.createElement('img');
  img.src = it.frames[0]; img.loading = 'lazy'; img.alt = it.name;
  img.onerror = () => { th.style.color = '#e05a6a'; th.textContent = 'missing'; };
  th.appendChild(img);
  if (it.frames.length > 1) {
    let i = 0;
    const tag = document.createElement('div'); tag.className = 'frametag';
    tag.textContent = it.frames.length + ' frames'; th.appendChild(tag);
    const t = setInterval(() => {
      if (!document.getElementById('chkAnim').checked) return;
      i = (i + 1) % it.frames.length; img.src = it.frames[i];
    }, 110);
    timers.push(t);
  }
  el.appendChild(th);
  const meta = document.createElement('div'); meta.className = 'meta';
  meta.innerHTML = '<div class="name">' + it.name + '</div>'
    + '<div class="path">' + it.desc + '<br>' + it.frames[0].replace(/_0(\\.webp|\\.png)$/, '_*$1') + '</div>';
  const stat = document.createElement('div'); stat.className = 'status';
  [['keep', 'Keep'], ['edit', 'Edit'], ['regen', 'Regen']].forEach(([k, lbl]) => {
    const b = document.createElement('button'); b.textContent = lbl;
    if (st === k) b.className = 'on-' + k;
    b.onclick = () => {
      marks[it.id] = marks[it.id] || {};
      marks[it.id].status = (marks[it.id].status === k) ? '' : k;
      marks[it.id].name = it.name; marks[it.id].path = it.frames[0];
      save(); render();
    };
    stat.appendChild(b);
  });
  meta.appendChild(stat);
  const ta = document.createElement('textarea');
  ta.placeholder = 'notes…'; ta.value = (marks[it.id] && marks[it.id].note) || '';
  ta.oninput = () => { marks[it.id] = marks[it.id] || {}; marks[it.id].note = ta.value;
    marks[it.id].name = it.name; marks[it.id].path = it.frames[0]; save(); };
  meta.appendChild(ta);
  el.appendChild(meta);
  return el;
}

function render() {
  timers.forEach(clearInterval); timers.length = 0;
  main.innerHTML = '';
  for (const sec of DATA.sections) {
    const items = sec.items.filter(it => !filterFlagged
      || (marks[it.id] && (marks[it.id].status || marks[it.id].note)));
    if (!items.length) continue;
    const s = document.createElement('section');
    s.innerHTML = '<h2>' + sec.title + ' <span style="color:#9a8fc0;font-weight:400">(' + sec.items.length + ')</span></h2><p class="sub">' + sec.sub + '</p>';
    const g = document.createElement('div'); g.className = 'grid';
    items.forEach(it => g.appendChild(card(it)));
    s.appendChild(g); main.appendChild(s);
  }
  const c = { keep: 0, edit: 0, regen: 0 };
  Object.values(marks).forEach(m => { if (m.status) c[m.status]++; });
  document.getElementById('counts').innerHTML =
    '<span class="c-keep">✅ ' + c.keep + '</span><span class="c-edit">✏️ ' + c.edit + '</span><span class="c-regen">🔄 ' + c.regen + '</span>';
}

document.getElementById('chkChecker').onchange = render;
document.getElementById('btnFilter').onclick = (e) => {
  filterFlagged = !filterFlagged;
  e.target.textContent = filterFlagged ? 'Show all' : 'Show flagged only'; render();
};
document.getElementById('btnReset').onclick = () => {
  if (confirm('Clear all marks?')) { marks = {}; save(); render();
    document.getElementById('exportOut').style.display = 'none'; }
};
document.getElementById('btnExport').onclick = () => {
  const out = document.getElementById('exportOut');
  const order = { regen: 0, edit: 1, keep: 2 };
  const rows = Object.entries(marks).filter(([, m]) => m.status || m.note)
    .sort((a, b) => (order[a[1].status] ?? 3) - (order[b[1].status] ?? 3));
  if (!rows.length) { out.textContent = 'No marks yet.'; out.style.display = 'block'; return; }
  const ico = { keep: '✅ KEEP ', edit: '✏️ EDIT ', regen: '🔄 REGEN' };
  out.textContent = 'ZODIAC VFX MARK-UP\\n==================\\n\\n' + rows.map(([id, m]) =>
    (ico[m.status] || '·      ') + '  ' + (m.name || id)
    + '\\n         ' + (m.path || '')
    + (m.note ? '\\n         → ' + m.note : '')).join('\\n\\n');
  out.style.display = 'block'; out.scrollIntoView({ behavior: 'smooth' });
};
render();
`;

const skelPath = R('zodiac_vfx_review.html');
let html = readFileSync(skelPath, 'utf8');
html = html.replace('__DATA__', JSON.stringify(DATA))
           .replace('__SCRIPT__', SCRIPT);
const tmp = skelPath + '.tmp';
writeFileSync(tmp, html);
renameSync(tmp, skelPath);
const n = DATA.sections.reduce((a, s) => a + s.items.length, 0);
console.log('built zodiac_vfx_review.html —', DATA.sections.length, 'sections,', n, 'assets');
for (const s of DATA.sections) console.log('  ' + s.title + ': ' + s.items.length);
