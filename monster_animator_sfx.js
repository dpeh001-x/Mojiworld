/* monster_animator_sfx.js — SFX board for monster_animator.html.
 * Lists every game audio clip (sfx_manifest.js), plays them individually or in
 * sequence, shows WHEN each fires in-game, and lets you tick clips for a
 * ludo.ai regeneration pass. Ticks persist to localStorage('lx_sfx_regen');
 * Export downloads sfx_regen_list.json for the regen script. */
(function () {
  'use strict';
  const MAN = window.LX_SFX_MANIFEST || [];
  const LS_KEY = 'lx_sfx_regen';
  let regen = {};
  try { regen = JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {}; } catch (_) {}
  const persist = () => { try { localStorage.setItem(LS_KEY, JSON.stringify(regen)); } catch (_) {} };

  const board = document.getElementById('sfxboard');
  const stage = document.getElementById('stagewrap');
  const hint = document.getElementById('hint');
  if (!board) return;

  let cur = null;            // currently playing Audio element
  let playAllIdx = -1;       // -1 = not in play-all mode
  let filterCat = 'all', filterQ = '', onlyTicked = false;

  const cats = ['all', ...new Set(MAN.map(m => m.cat))];
  const visible = () => MAN.filter(m =>
    (filterCat === 'all' || m.cat === filterCat) &&
    (!onlyTicked || regen[m.id]) &&
    (!filterQ || m.id.toLowerCase().includes(filterQ) || m.when.toLowerCase().includes(filterQ)));

  function stop() {
    if (cur) { try { cur.pause(); } catch (_) {} cur = null; }
    playAllIdx = -1;
    board.querySelectorAll('.sfx-row.playing').forEach(r => r.classList.remove('playing'));
    const b = document.getElementById('sfx-playall'); if (b) b.textContent = '▶ Play all (filtered)';
  }
  function play(item, row, onEnd) {
    if (cur) { try { cur.pause(); } catch (_) {} }
    board.querySelectorAll('.sfx-row.playing').forEach(r => r.classList.remove('playing'));
    if (row) { row.classList.add('playing'); row.scrollIntoView({ block: 'nearest' }); }
    cur = new Audio(item.file);
    const durEl = row && row.querySelector('.sfx-dur');
    cur.addEventListener('loadedmetadata', () => { if (durEl) durEl.textContent = cur.duration.toFixed(2) + 's'; }, { once: true });
    cur.addEventListener('ended', () => { if (row) row.classList.remove('playing'); if (onEnd) onEnd(); }, { once: true });
    cur.addEventListener('error', () => { if (durEl) durEl.textContent = 'LOAD ERR'; if (onEnd) onEnd(); }, { once: true });
    cur.play().catch(() => { if (durEl) durEl.textContent = 'blocked'; if (onEnd) onEnd(); });
  }
  function playAll() {
    const list = visible();
    // BGM/boss themes are minutes long — in play-all, sample 2.5s then advance.
    let i = 0;
    const step = () => {
      if (i >= list.length || playAllIdx === -2) { stop(); return; }
      playAllIdx = i;
      const item = list[i];
      const row = board.querySelector('.sfx-row[data-id="' + CSS.escape(item.id) + '"]');
      let advanced = false;
      const next = () => { if (advanced) return; advanced = true; i++; setTimeout(step, 250); };
      play(item, row, next);
      const isLong = item.cat === 'bgm' || item.cat === 'boss-theme' || item.cat === 'ambient';
      if (isLong) setTimeout(next, 2500);
    };
    const b = document.getElementById('sfx-playall'); if (b) b.textContent = '■ Stop';
    step();
  }

  function render() {
    const list = visible();
    const ticked = Object.keys(regen).filter(k => regen[k]).length;
    let h = '<div class="sfx-top">' +
      '<input id="sfx-q" placeholder="search id / trigger…" value="' + filterQ + '" />' +
      '<select id="sfx-cat">' + cats.map(c => '<option' + (c === filterCat ? ' selected' : '') + '>' + c + '</option>').join('') + '</select>' +
      '<label class="mut"><input type="checkbox" id="sfx-onlyticked"' + (onlyTicked ? ' checked' : '') + '/> ticked only</label>' +
      '<button id="sfx-playall">▶ Play all (filtered)</button>' +
      '<span class="mut">' + list.length + ' shown · <b style="color:#ff9e3d">' + ticked + ' ticked for regen</b></span>' +
      '<button id="sfx-export" class="primary">⬇ Export regen list</button></div>' +
      '<div class="sfx-rows">';
    for (const m of list) {
      h += '<div class="sfx-row" data-id="' + m.id + '">' +
        '<button class="sfx-play" title="play">▶</button>' +
        '<span class="sfx-id" title="' + m.file + '">' + m.id + '</span>' +
        '<span class="sfx-cat cat-' + m.cat + '">' + m.cat + '</span>' +
        '<span class="sfx-when">' + m.when + '</span>' +
        '<span class="sfx-dur mut">' + m.kb + 'kB</span>' +
        '<label class="sfx-tick" title="tick to include in the ludo.ai regeneration export">' +
        '<input type="checkbox" data-tick="' + m.id + '"' + (regen[m.id] ? ' checked' : '') + '/> regen</label></div>';
    }
    h += '</div>';
    board.innerHTML = h;
    // wiring
    document.getElementById('sfx-q').addEventListener('input', e => { filterQ = e.target.value.toLowerCase(); render(); document.getElementById('sfx-q').focus(); document.getElementById('sfx-q').setSelectionRange(filterQ.length, filterQ.length); });
    document.getElementById('sfx-cat').addEventListener('change', e => { filterCat = e.target.value; render(); });
    document.getElementById('sfx-onlyticked').addEventListener('change', e => { onlyTicked = e.target.checked; render(); });
    document.getElementById('sfx-playall').addEventListener('click', () => { if (playAllIdx >= 0) { playAllIdx = -2; stop(); } else playAll(); });
    document.getElementById('sfx-export').addEventListener('click', exportList);
    board.querySelectorAll('.sfx-play').forEach(b => b.addEventListener('click', () => {
      const id = b.closest('.sfx-row').dataset.id;
      const item = MAN.find(m => m.id === id);
      if (item) play(item, b.closest('.sfx-row'));
    }));
    board.querySelectorAll('[data-tick]').forEach(c => c.addEventListener('change', () => {
      regen[c.dataset.tick] = c.checked; if (!c.checked) delete regen[c.dataset.tick];
      persist(); render();
    }));
  }

  function exportList() {
    const items = MAN.filter(m => regen[m.id]).map(m => ({ id: m.id, file: m.file, cat: m.cat, when: m.when,
      ludoNote: 'Regenerate via POST /audio/sound-effect (2cr). Current role: ' + m.when }));
    const blob = new Blob([JSON.stringify({ note: 'SFX ticked for ludo.ai regeneration (monster_animator SFX board)', count: items.length, items }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'sfx_regen_list.json';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  // ---- mode toggle (top bar button) ----
  const btn = document.getElementById('sfxmode');
  let on = false;
  if (btn) btn.addEventListener('click', () => {
    on = !on;
    board.style.display = on ? 'block' : 'none';
    stage.style.display = on ? 'none' : 'block';
    if (hint) hint.style.display = on ? 'none' : 'block';
    btn.classList.toggle('primary', on);
    if (on) render(); else stop();
  });
})();
