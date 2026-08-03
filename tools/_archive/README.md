# tools/_archive — one-off scripts, kept for the record

104 files that each did a job once and are not part of any workflow. They were
sitting alongside the durable tools in `tools/`, so 68% of that directory was
noise you had to read past to find the thing you wanted.

Nothing here is wired into the game, the build, or any test. Moving them broke
nothing, and moving them back would change nothing.

## What is in here

| Group | Examples | What they were |
| --- | --- | --- |
| `_patch_*.mjs` | `_patch_c1_preloader`, `_patch_r_iosboot` | Scripted edits to `mojiworld_game.html` for one specific version each. **Already unrunnable** — they hardcode `C:/Users/Xenon/Desktop/Mojiworld/…`, a machine this repo has not lived on since the move to `C:\Users\dpeh0\Mojiworld`. |
| `_chlog_*.mjs` | `_chlog_943`, `_chlog_949` | Changelog entry injectors for a single release. |
| `_b60_*`, `_bake_*`, `_boot_*` | `_b60_1_mobs`, `_bake_mob_offsets` | Data bakes whose output is already committed under `data/`. |
| `_gen_*`, `_forge_ui_*` | `_gen_miniboss_sfx`, `_forge_ui_2_css` | Asset/UI generators superseded by the `gen_*` tools that stayed in `tools/`. |
| `_dev_*`, `_equip_*`, `_fiery_*` | `_dev_maxstats_4999` | Debug helpers and content drops for one feature. |

## Why keep them at all

They are the only record of *how* several baked artifacts were produced —
`data/mob_offsets.js` and the equipment prompt set among them. Deleting them
would lose that provenance for a few kilobytes of saving. Archiving keeps the
history without keeping the clutter.

## If you want one back

`git mv tools/_archive/<file> tools/<file>` — and expect to fix its paths
first, since most were written against an older repo root.
