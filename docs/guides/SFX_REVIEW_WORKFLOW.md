# SFX review round trip

How a tester's sound comments become regenerated clips, end to end. One tool
now does the whole middle of this; nothing gets transcribed by hand any more.

## 1. The tester reviews

Send them `tools/sound_review.html` (open from disk or the raw.githack URL).
They play, give a verdict (good / not sure / needs work), and write what the
sound *should* be. They hand back **either**:

- the **"Copy everything"** text (pasted in chat), or
- `mojiworld_sound_progress.json` from **"Save my progress"**.

Developer-side inputs work too: `regen_notes.json` from
`tools/monster_sound_review.html`, and `sfx_regen_list.json` from the
animator's SFX board. The tool sniffs the format from the content.

## 2. Plan (no credits)

```bash
node scripts/regen_sfx_from_comments.mjs review.txt
```

Prints what will be regenerated, what is skipped and **why**, and what could
not be matched to `data/sfx_manifest.js`. Skips a human would make:

| Skip reason | Rule |
| --- | --- |
| not a sound critique | "cannot find this monster", "can be used", "fine as is" ... |
| already regenerated since the review | clip mtime is newer than the review date (`--force` overrides) |
| music-length clip | bgm / ambient go through `/audio/music` (3cr, 60-85s); needs `--allow-music` |
| GOOD with a comment | praise is not a work order; `--include-good` overrides |

`--json` emits the same plan as JSON (this is what the test asserts against).

## 3. Generate

```bash
node scripts/regen_sfx_from_comments.mjs review.txt --generate --tag=pre_<something>
```

Per clip: prompt = category style rule + in-game context (name, level, boss,
NPC role, trigger) + the reviewer's comment as explicit creative direction +
the short-one-shot suffix. Duration is measured from the MP3's own frame
headers; over-bar takes are retried shorter, then frame-trimmed. The original
is copied to `audio/_regen_backup/<tag>/...` before the atomic replace, and a
clip that already has a backup under the tag is skipped on re-runs (resumable).
A 402 stops the run immediately.

The bars are per category (monster 1.0s, skill 1.2s, NPC babble 1.8s, boss
voice 2.0s ...) and any file pinned in `scripts/sfx_duration_test.mjs` keeps
its 1.0s bar regardless - the tool reads the pins from the test.

## 4. Finish

```bash
node scripts/regen_sfx_from_comments.mjs --finish
```

Regenerates `data/sfx_manifest.js` (byte sizes) and `tools/sound_review.html`
(so the tester's next pass on the same URL plays the new clips), runs the
duration test, and prints the remaining manual step:

**bump `const CACHE` in `sw.js`.** Audio replaced under its own filename is
cached art; the push gate blocks the push without the bump.

## 5. Record

`audio/_regen_backup/<tag>/regen_notes.json` records, per clip, the comment,
the composed prompt, the requested and measured durations and the before /
after sizes. Monster entries are also merged into
`audio/monster/regen_notes.json` (the existing convention).

Commit the clips, the manifest, the tester page, the notes and the `sw.js`
bump together, with a changelog entry.
