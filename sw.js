// Mojiworld asset cache — v0.29.473
// Stale-while-revalidate for same-origin game assets (sprites, backgrounds,
// audio). Serves the cached copy instantly for fast repeat loads, while
// refreshing it in the background so sprite redos still propagate on the
// next visit. The game HTML itself is NOT cached (always network) so code
// updates are never stale.
//
// v0.29.473 — the cache key had never been bumped since v0.26.949, so the
// activate sweep below ("drop old cache generations on version bumps") had
// been a no-op for every release since. Bumping it forces one clean
// generation change, which is what finally evicts art a returning player has
// been stuck on. Bump this whenever shipped art changes and you need every
// existing browser to drop its copy.
//
// v0.29.630 — bumped again, and this is exactly the failure the note above
// predicted. Two players on the SAME map and the SAME version saw DIFFERENT
// backgrounds in Everdawn Central: one the new wooden-village plate, the other
// the old pink-storefront one. Nothing was desynced — 280bae14 replaced
// backgrounds/bg_v3_everdawn_central.webp (236 KB -> 3.5 MB, a completely
// different painting) without bumping this key, so a returning browser kept
// serving its cached copy.
//
// Stale-while-revalidate makes this quiet rather than loud: the stale art is
// served instantly and the refresh lands in the background, so the player sees
// the OLD plate for the whole session and a correct one next time — which reads
// as "it's different for me" rather than "it's out of date". Any art swap that
// REPLACES a filename (rather than adding one) needs this bump; a new filename
// is safe because nothing is cached under it yet.
//
// v0.30.73 - v5 -> v6. The Sage "Meteor Sigil" art drop REPLACES eleven filenames
// (Sprites/projectiles/p_ult_sage.webp, Sprites/fx/sage_ult.webp and
// Sprites/fx/anim/sage_ult_0..8.webp), so without this bump every returning
// browser keeps serving the old meteor and the old sigil indefinitely.
//
// v0.30.52 - v4 -> v5. Six background filenames were REPLACED with different
// paintings (forest, azureAcademia, emeraldVillage, tidepoolShoals,
// abyssalTrench, worldmap_bg). That is precisely the "REPLACES a filename"
// case above, so without this bump every returning browser keeps serving the
// old art indefinitely - silently, because SWR serves stale first.
// v0.30.311 - v6 -> v7. This week's drops REPLACED many filenames without a
// bump: the Regulus pounce re-roll (leo_0..8), Virga's idle redraw, the
// star-beam redraw, the Caprikor ice shot - so returning browsers served
// stale (or MIXED stale/new) frames until a hard refresh, which is exactly
// what the user hit. The bump is now ENFORCED at push time by
// .claude/hooks/push-clobber-gate.js: a push that modifies existing art
// bytes without changing this line is blocked.
// v0.30.316 - v7 -> v8. gravitos_laserring.webp was REPLACED (regenerated at
// 768 with real margin), so returning browsers would serve the old 513 crop
// from the v7 generation. This is the enforced rule, not a courtesy: the push
// gate blocks a commit that modifies art bytes without bumping this line.
// v0.30.348 - v8 -> v9. The QTE shackle sigil was REPLACED: the 768 static
// AND all nine 952px animated frames (Sprites/fx/anim/qte_chains_0..8), which
// are what actually render during a shackle QTE. Without the bump a returning
// browser mixes the new static with the old frames.
// v0.30.426 - v9 -> v10. The smith golem's 28 assets were REPLACED under their
// own names (re-canvased to one scale / one foot line); returning browsers would
// serve the old frames from the v9 generation.
// v0.30.428 - v10 -> v11. gravitos2punch_0..8 REPLACED (regenerated punch set); returning
// browsers would otherwise serve the old frames from the v10 generation.
// v0.30.429 - v11 -> v12. Boss attack art drop REPLACED under existing names
// (gravitos2soul_2..8, gravitos2punch_4, towerSovereign_6); returning browsers would
// otherwise serve the old frames from the v11 generation.
// v0.30.435 - v12 -> v13. smithgolem idle/walk/attack_0..8 REPLACED under their own names
// (cut-out rig of the static sprite, 1280x1024); returning browsers would otherwise mix
// the old 1024px frames from the v12 generation with the new tables.
// v0.30.436 - v13 -> v14. smithgolem idle/walk/attack_0..8 REPLACED under their own names
// (cut-out rig of the static sprite, 1280x1024); returning browsers would otherwise mix
// the old 1024px frames from the v13 generation with the new tables.
// v0.30.440 - v14 -> v15. smithgolem idle/walk/attack_0..8 REPLACED under their own names
// (cut-out rig of the static sprite, 1280x1024); returning browsers would otherwise mix
// the old 1024px frames from the v14 generation with the new tables.
// v0.30.441 - v15 -> v16. smithgolem idle/walk/attack_0..8 REPLACED under their own names
// (cut-out rig of the static sprite, 1280x1024); returning browsers would otherwise mix
// the old 1024px frames from the v15 generation with the new tables.
// v0.30.442 - v16 -> v17. 28 monster attack frames REPLACED under their own names
// (user art drop: 11 sets, edge clean-ups + the smith golem impact frames re-anchored);
// returning browsers would otherwise serve the old frames from the v16 generation.
// v0.30.443 - v17 -> v18. 9 monster attack frames REPLACED under their own names
// (user art drop: 11 sets, edge clean-ups + the smith golem impact frames re-anchored);
// returning browsers would otherwise serve the old frames from the v17 generation.
// v0.30.446 - v18 -> v19. 7 monster attack frames REPLACED under their own names
// (user art drop: 11 sets, edge clean-ups + the smith golem impact frames re-anchored);
// returning browsers would otherwise serve the old frames from the v18 generation.
// v0.30.465 - v19 -> v20. dash_mage.webp and mstormorb.webp REPLACED under
// their own names (regenerated art); returning browsers would otherwise serve the old
// sprites from the v19 generation alongside the new animation frames.
// v0.30.469 - v20 -> v21. p_lightning.webp REPLACED under its own name
// (redrawn horizontal, tip right); returning browsers would otherwise keep serving the old
// vertical bolt from the v20 generation next to the new frames.
// v0.30.473 - v21 -> v22. dash_mage.webp and its nine anim frames REPLACED
// under their own names (violet -> light blue); a returning browser would otherwise mix the
// old violet still with the new blue frames from the v21 generation.
// v0.30.479 - v22 -> v23. qte_holy.webp and its nine anim frames
// REDRAWN under their own names (winged sunburst -> binding seal) and re-canvassed 768/952 -> 1024;
// dash_mage, dash_rogue and dash_warrior loops replaced the same way. A returning browser would
// otherwise mix old and new frames of the same sigil.
// v0.30.719 - v48 -> v49. Sprites/ui/bravo_backdrop.webp is REPLACED under its own name (a
// lopsided spire stair -> a symmetrical vaulted sanctum) and Sprites/ui/bravo_arch.webp is NEW and
// is the velvet the three blessing arches are now lined with. A returning browser would keep the
// old backdrop out of cache and never fetch either.
// v0.30.722 - v49 -> v50. Sprites/ui/boon_card_back.webp is NEW art - the faint damask
// stock the boon pick cards are printed on. A returning browser would never fetch it and would
// keep showing flat panels.
// v0.30.723 - v50 -> v51. Sprites/fx/doombringer_ult.webp and its nine anim/ frames are
// REPLACED under their own names (a medium sword inside a fireball -> a colossal point-down
// doom-blade). A returning browser would keep the old plate cached and never fetch the new one.
// v0.30.726 - v51 -> v52. Sprites/fx/warcry.webp is REPLACED under its own name (a
// lion head -> an expanding shout-wave), and its nine anim/ frames plus Sprites/fx/fx_warcry_mark.webp
// are NEW. A returning browser would keep the lion cached and never fetch any of them.
// v0.30.734 - v53 -> v54. Sprites/fx/warcry.webp and its nine anim/ frames are REPLACED
// under their own names again - feathered at the circumference, where they previously ended on the
// square edge of their own canvas. A returning browser would keep the hard-cut plates cached.
// v0.30.737 - v54 -> v55. Sprites/fx/ground_slam.webp is REPLACED under its own name
// (red-and-cyan clip-art -> an amber crater) and its nine anim/ frames are NEW. A returning browser
// would keep the old sticker cached and never fetch any of them.
// v0.30.744 - v56 -> v57. Sprites/fx/ground_slam.webp and its nine anim/ frames are
// REPLACED under their own names again - the silhouette is feathered, where it previously ended in
// a hard outline at its widest points. A returning browser would keep the crisp-cut plates cached.
// v0.30.491 - v23 -> v24. Sprites/ui/edicts_bg.webp is NEW art
// referenced from CSS; a returning browser with the old manifest would render the Edicts panel
// on its fallback gradient and never fetch the plate.
// v0.30.495 - v24 -> v25. backgrounds/title_keyart_c.webp is NEW
// art referenced from CSS; a returning browser with the old manifest would show the character
// creation page on its old flat scrim and never fetch it.
// v0.30.498 - v25 -> v26. backgrounds/title_keyart.webp is REPLACED
// under its own name (new art, 1376x768 -> 2944x1632). Without a new generation a returning
// browser keeps serving the old painting from cache and never sees this one.
// v0.30.506 - v26 -> v27. Sprites/ui/cs_preview_bg.webp is NEW
// art referenced from CSS; a returning browser with the old manifest would keep the character
// preview box on its flat grey radial and never fetch the alcove.
// v0.30.507 - v27 -> v28. All ten Sprites/fx/block_mage*
// files are REPLACED under their own names (the ward redrawn as an incantation shard). This is
// the exact case the generation exists for: v0.30.487 replaced this same set without bumping,
// so a returning browser kept serving the old opaque ward out of cache.
// v0.30.533 - v28 -> v29. Both mspore files are REPLACED
// under their own names (the pod recoloured white/pink/red and turned to face right). Without a
// new generation a returning browser keeps firing the old mint pod out of cache.
// v0.30.538 - v29 -> v30. Sprites/ui/cs/ico_*.webp (five files) are NEW art referenced from the creator's markup; a returning browser with the old manifest would show the picker labels without their icons and never fetch them.
// v0.30.540 - v30 -> v31. Sprites/ui/cs_preview_bg.webp is REPLACED under its own name (violet niche -> pale grey alcove) and Sprites/ui/cs_preview_bg_floor.webp is NEW and is the one the CSS now draws; a returning browser would keep the violet plate out of cache and never fetch the grey one.
// v0.30.544 - v31 -> v32. Sprites/projectiles/mspore.webp is
// REPLACED under its own name again (the pod redrawn as a smooth white spore puff). The last
// bump was demonstrably load-bearing: the browser was still serving v28's copy.
// v0.30.546 - v32 -> v33. Sprites/projectiles/mspore.webp is
// REPLACED under its own name again (the pod redrawn as a smooth white spore puff). The last
// bump was demonstrably load-bearing: the browser was still serving v28's copy.
// v0.30.551 - v33 -> v34. Nine NEW frames at
// Sprites/projectiles/anim/mspore_0..8.webp. A returning browser with the old manifest would
// never fetch them and would keep drawing the static puff.
// v0.30.577 - v35 -> v36. Sprites/vfx/sovereign_drain_pillar.webp is REPLACED
// under its own name (the drain column redrawn cel-shaded). Without a new generation a returning
// browser keeps the painterly one out of cache.
// v0.30.x - v37 -> v38. Sprites/skills/marksman_oneshot.webp and marksman_ult.webp are REPLACED
// under their own names (the Deadeye revamp's icons), as are audio/skill/marksman_oneshot.mp3 and marksman_ult.mp3
// and - missed by v0.30.610 - Sprites/projectiles/p_ult_marksman.webp. Without a new generation a returning browser
// keeps the old icon, the old cast sounds and the old round out of cache.
// v0.30.x - v38 -> v39. The 42 MP3s shipfix had staged as text (v0.30.572's nineteen monster clips and
// their backups, v0.30.617's four Deadeye cues) are REPAIRED under their own names; browsers cached the broken bytes.
// v0.30.x - v44 -> v45. War of Banners' art is REPLACED under its own names: the cast burst
// (fx/warlord_ult + its nine frames), the banner wave (projectiles/p_ult_warlord + its nine frames)
// and the skill icon. Without a new generation a returning browser keeps the old set out of cache.
// v0.30.x - v46 -> v47. The War of Banners burst frames were re-baked with a softer impact flash
// (v0.30.691) under their own names, and that ship did not bump: anyone who loaded v0.30.689 has the
// blown-out frames cached.
// v0.30.x - v52 -> v53. warrior_shockwave.webp and its nine frames are REPLACED under their
// own names (the crescent was recarved thinner and translucent, and the animation is now a
// crescent-into-fireball), so a returning browser would otherwise keep the old opaque set.
// v0.30.767 - v57 -> v58. crusader_ult.webp and its nine frames are REPLACED under their own names
// (the Bastion of Dawn medallion, which was cut off at its edges, is now the Dawnbreak nova), so a
// returning browser would otherwise keep the old set.
// v0.30.868 - v64 -> v65. Sprites/monsters/idle/scorpion_5.webp and scorpion_6.webp are REPLACED under their own
// names (the Pincer's stray antennas cut out - pincer-antennas), so a returning browser would otherwise keep them.
// v0.30.895 - v65 -> v66. Sprites/ui/block_warrior / rogue / mage / archer / shield.webp are REPLACED under
// their own names (the Block icons repainted in the skill icons' style - block-icons), so a returning browser would
// otherwise keep the old ones.
// v0.30.947 - v66 -> v67. FORTY-FOUR AUDIO FILES ARE REPLACED UNDER THEIR OWN NAMES since the v66 bump:
// v0.30.900 recut 31 monster / boss / npc / voice cues, and v0.30.907 trimmed 1.0-3.8 s of leading silence from
// 13 music tracks so they loop without a gap. mp3 is in ASSET_RE, so this is exactly the case the notes above
// keep describing - and the quiet one: stale-while-revalidate serves the OLD cut instantly and refreshes in the
// background, so a returning player hears the gap for the whole session and the fix only the session after.
// scripts/sw_cache_freshness.mjs now fails when an asset is replaced without this line moving.
// v0.30.980 - v68 -> v69. Sprites/bosses/walk/kingKrook_5.webp and kingKrook_6.webp are REPLACED under their own
// names (mirrored: they faced left inside a right-facing walk, so King Krook turned round every stride). Without
// this bump a returning player's stale-while-revalidate cache keeps drawing him turning for a whole session.
// v0.30.1074 - v70 -> v71. The app icon is REPLACED under its own names (assets/mojiworld_icon_512.png,
// mojiworld_icon_184.jpg, favicon-32.png, apple-touch-icon.png: Guguma on a punk wall instead of in the gate), so a
// returning browser's stale-while-revalidate cache would keep the old tab and home-screen icon for a session.
// v0.30.1077 - v71 -> v72. The app icon is REPLACED under its own names AGAIN (assets/mojiworld_icon_512.png,
// mojiworld_icon_184.jpg, favicon-32.png, apple-touch-icon.png: the punk wall becomes a black comic panel with a
// smaller burst), so a returning browser's stale-while-revalidate cache would keep v0.30.1074's icon for a session.
// v0.30.1083 - v72 -> v73. The app icon is REPLACED under its own names AGAIN (assets/mojiworld_icon_512.png,
// mojiworld_icon_184.jpg, favicon-32.png, apple-touch-icon.png: the comic panel becomes a pop-art shard: one white
// diagonal burst, pink as accents only), so a returning browser's stale cache would keep v0.30.1077's icon a session.
// v0.30.1100 - v73 -> v74. The app icon is REPLACED under its own names AGAIN (assets/mojiworld_icon_512.png,
// mojiworld_icon_184.jpg, favicon-32.png, apple-touch-icon.png: the white shard turns black, dark hot pink slashes
// and a ringed sticker), so a returning browser's stale cache would keep v0.30.1083's icon for a session.
// v0.30.x sage-voice - v74 -> v75. audio/npc/npc_mystery_sage.mp3 ("???", Sage Mira) is REPLACED under its own
// name (recast from a 130 Hz sigh to a soft young elf woman), so a returning browser would otherwise keep the old clip.
// v0.30.x cs-stage4 - v79 -> v80. Sprites/ui/cs/stage_pop.svg (the character-creation stage) is REPLACED under its own
// name (the backdrop becomes a punk gig wall), so a returning browser would otherwise show v0.30.1194's stage once.
// v0.30.1209 cs-stage5 - v80 -> v81. Sprites/ui/cs/stage_pop.svg (the character-creation stage) is REPLACED under its own
// name again (the gig wall becomes a comic theatre stage), so a returning browser would otherwise show v0.30.1207's once.
// v0.30.x cs-stage6 - v81 -> v82. Sprites/ui/cs/stage_pop.svg (the character-creation stage) is REPLACED under its own name again
// (muted backstage, a pronounced floor), so a returning browser would otherwise show v0.30.1209's once.
// v0.30.x cs-stage7 - v82 -> v83. Sprites/ui/cs/stage_pop.svg (the character-creation stage) is REPLACED under its own name again
// (soft podium shadows, the podium raised), so a returning browser would otherwise show v0.30.1211's once.
// v0.30.x cs-stage8 - v83 -> v84. Sprites/ui/cs/stage_pop.svg (the character-creation stage) is REPLACED under its own name again
// (a measured contact shadow under the hero's feet), so a returning browser would otherwise show v0.30.1216's once.
// v0.30.x cs-stage9 - v84 -> v85. Sprites/ui/cs/stage_pop.svg (the character-creation stage) is REPLACED under its own name again
// (a cel-shaded contact shadow under the hero), so a returning browser would otherwise show v0.30.1218's once.
// v0.30.1228 - v85 -> v86. Eighteen monsters' art is REPLACED under its own names - the static sprite and all 27
// idle/walk/attack frames of cookie, blockRhirhi, seasponge (reefmaw.webp), towerShardling, drownedCur, blockEle, blockHupo,
// blockPopo, blockGary, horny, sparkSprite, stormKitty, coralImp, voltipup, stump, tidepoolTurtle, towerWarden and
// mournshade - so a returning browser's stale-while-revalidate cache would keep drawing the old monsters for a session.
// v0.30.1236 - v86 -> v87. Sprites/fx/swing_{blockRhirhi,blockHupo,blockPopo,blockGary,towerWarden}.webp are REPLACED
// under their own names (pop-style trails recoloured to the redesigned monsters), so a returning browser would keep the old ones.
// v0.30.x proj-pop - v87 -> v88. twelve Sprites/projectiles stills and 27 anim/ frames (mdark, splash, mtidemark) are REPLACED under their own names
// (pop-punk redraw), so a returning browser would otherwise keep the old art until its cache refreshed.
// v0.30.x own-shots - v88 -> v89. Sprites/projectiles gains msandball / mjellyglob / manglerlure and their anim/ loops (new names, no replacement)
// - bumped anyway so the new cast of files is fetched fresh alongside the game that asks for them.
// v0.30.x mage-orb - v89 -> v90. Sprites/projectiles/p_mage_orb.webp and anim/bolt_0..8 (the mage Z bolt) are REPLACED under their own names
// (pop-punk orb, electric loop), so a returning browser would otherwise keep the old bolt until its cache refreshed.
// v0.30.1263 - v90 -> v91. 13 Sprites/vfx statics, 10 Sprites/vfx/anim sets and the fx quake burst
// (Sprites/fx/quake_ring.webp + anim/quakeRing_0..8) are REPLACED under their own names (pop restyle), so a returning
// browser would keep drawing the old effects for a session.
// v0.30.1274 - v91 -> v92. v0.30.1274 - edge-fixed projectiles: 35 sets tapered or inset (same names)
// v0.30.x region-pop - v92 -> v93. all 83 Sprites/world/regions icons are REPLACED under their own names (pop-punk redraw, matched to
// each map's monsters), so a returning browser would otherwise keep the old icons until its cache refreshed.
// v0.30.1277 - v93 -> v94. Sprites/fx/anim/forge_success_0..8, forge_fail_0..8 and Sprites/fx/forge_success.webp are REPLACED under their own names (HD forge animation)
// v0.30.x vigil-icon - v94 -> v95. Sprites/world/regions/confusedVigil.webp is REPLACED under its own name (a signpost + crimson rift, no longer
// Barnaby), so a returning browser would otherwise keep v0.30.1275's icon until its cache refreshed.
// v0.30.1290 talent-pop - v96 -> v97. all 78 Sprites/talents icons and the 27 Sprites/talents/bg card plates are REPLACED under
// their own names (pop-punk redraw), so a returning browser would otherwise keep the old art until its cache refreshed.
// v0.30.1292 - v97 -> v98. 30 Sprites/projectiles stills and 30 Sprites/projectiles/anim loops
// (pop-punk rework, 300 files) are REPLACED or ADDED under their own names, so a returning
// browser would keep drawing the old effects for a session.
// v0.30.1294 chest-pop - v98 -> v99. the six Sprites/objects/chest_<tier>[_open].webp sprites are REPLACED under
// their own names (pop-punk redraw), so a returning browser would otherwise keep the old art until its cache refreshed.
// v0.30.1298 chest-redesign - v99 -> v100. the six Sprites/objects/chest_<tier>[_open].webp sprites are REPLACED again under
// their own names (pop-punk redraw), so a returning browser would otherwise keep the old art until its cache refreshed.
// v0.30.1305 gold-grand - v100 -> v101. Sprites/objects/chest_gold.webp and chest_gold_open.webp are REPLACED under their own names
// (the grand gold chest), so a returning browser would otherwise keep the plain one until its cache refreshed.
// v0.30.1308 silver-embellish - v101 -> v102. Sprites/objects/chest_silver.webp and chest_silver_open.webp are REPLACED under
// their own names (the embellished silver chest), so a returning browser would otherwise keep the plain one until its cache refreshed.
// v0.30.1312 - v103 -> v104. 7 projectile stills + loops and the vfx quake plume + loop
// (outlines trimmed, 80 files) are REPLACED under their own names, so a returning
// browser would keep drawing the old effects for a session.
// v0.30.1318 - v104 -> v105. 24 outline-trimmed files (mstarshot still + loop, mrivet 5/7,
// mblightseed 4-7, quake plume still + 1-7) are cleaned and REPLACED under their own names, so a returning
// browser would keep drawing the old effects for a session.
// v0.30.1338 flat-props - v105 -> v106. twelve Sprites/objects props (the market stalls, shuriken rack, throne, anvil, wagon,
// crate stack, well and five more) are REPLACED under their own names (redrawn flat for the side-scroller), so a returning browser
// would otherwise keep the angled art until its cache refreshed.
// v0.30.1346 flat-props-2 - v106 -> v107. the hearth, the signpost and the three fountains in Sprites/objects are REPLACED under
// their own names (redrawn flat for the side-scroller), so a returning browser would otherwise keep the angled art until its cache refreshed.
// v0.30.1352 flat-props-3 - v108 -> v109. the signpost and the hearth are RESTORED and the two Azure fountains REPLACED under
// their own names (per user: the old signpost and hearth are better; the fountains redrawn with a bold black outline), so a returning
// browser would otherwise keep the v0.30.1346 art until its cache refreshed.
// v0.30.1369 krook-monocle - v112 -> v113. King Krook's walk frames Sprites/bosses/walk/kingKrook_5.webp and _6.webp are
// REPLACED under their own names (per user: his monocle jumped to his other eye while he walked), so a returning browser would
// otherwise keep the old two frames until its cache refreshed.
// fruit-four - v114 -> v115. Pinechad, Meloncholy, Thornmaw and Elderbark are redrawn and re-animated under their
// own names (statics + 27 frames each), so a returning browser would otherwise keep the old art until its cache refreshed.
// v0.30.1391 - v118 -> v119. Elderbark (static + idle / walk / attack 0..8) is REPLACED under its own names
// (a slight outline; the attack frames sharpened), so a returning
// browser would keep drawing the old art for a session.
// stump-root - v119 -> v120. Stumpy's 28 images (back root planted) and Thornmaw's 9 walk frames (both feet step) are
// replaced under their own names, so a returning browser would otherwise keep the old frames until its cache refreshed.
// v0.30.1398 - v120 -> v121. Elderbark attack 0..8 are REPLACED under their own names
// (redrawn crisp: 4k upscale + shock filter), so a returning
// browser would keep drawing the old art for a session.
// v0.30.1404 army-2 - v123 -> v124. The three serious throne-room soldiers (Sprites/objects/bastion_soldier_{bucket,shield,visor}.webp)
// are REPLACED under their own names by the regenerated, complete art (per user: several were incomplete).
// v0.30.1405 army-3 - v124 -> v125. Seven squad idle frames (Sprites/npc/idle/soldier_flop_1..6.webp and soldier_mope_4.webp)
// are REPLACED under their own names with a faint animator ground shadow cleared.
// v0.30.1407 - v126 -> v127. Elderbark walk 0..8 are REPLACED under their own names
// (redrawn crisp: 4k upscale + shock filter), so a returning
// browser would keep drawing the old art for a session.
// v0.30.1414 - v127 -> v128. Storm Kitty attack, Thornmaw attack and Gravitos idle 0..8 are REPLACED under their own names
// (redrawn crisp: 4k upscale + shock filter), so a returning
// browser would keep drawing the old art for a session.
// nine-mobs - v128 -> v129. Tomb Hexer, Ossifer, Bone Golem, Thundermole, Bones, Petalfly, Sunbun, Ossuary Tyrant and Drowned
// Cur are redrawn and re-animated under their own names, so a returning browser would otherwise keep the old art.
// v0.30.1468 - v135 -> v136. Aquarius idle 2..7 are REPLACED under their own names (their missing black outline
// painted back in), so a returning browser would keep drawing the old art for a session.
// v0.30.1482 - v139 -> v140. parry_riposte (+ its 9 frames), bloom_burst, skin_ward, overflow_arc and rampage_aura
// are REPLACED under their own names (boon FX regenerated and animated), so a returning browser would keep drawing the old art for a session.
// v0.30.1486 - v140 -> v141. nova_ring, echo_slash, time_ripple, crescendo_hit, execute_mark, coin_burst, doppel_flash and frost_bloom
// are REPLACED under their own names (the remaining boon FX regenerated and animated), so a returning browser would keep drawing the old art for a session.
// v0.30.1538 - v146 -> v147. 47 NPC stills + their nine idle frames each (470 files) are REPLACED under their own names
// (outline evened to 1.42 game px; Guguma untouched), so a returning browser would keep drawing the old art for a session.
// v0.30.1559 - v147 -> v148. 1,259 monster files (outlines sized to the monster, Lantern Wisp's halo removed) are REPLACED under their own names
// so a returning browser would keep drawing the old art for a session.
// v0.30.1566 - v149 -> v150. Everdawn's town props (palette pass + the flower cart's second wheel) are REPLACED under their own names
// so a returning browser would keep drawing the old art for a session.
// v0.30.1578 - v150 -> v151. Gravitos's form-1 and form-2 frames (115 files) are REPLACED under their own names (each sequence's
// calibration baked into its frames, feet locked to the form's lines) so a returning browser would keep drawing the old art for a session.
// v0.30.1624 - v156 -> v157. Gravitos's walk frames 0-8 (all three forms) and ten attack frames are REPLACED under their own names (and
// walk frames 9-15 are new), so a returning browser would keep drawing the old art for a session.
// v0.30.1633 - v158 -> v159. Gravitos's form 1 punch frames 0-8 and its still are REPLACED under their own names (frames 9-15 retired),
// so a returning browser would keep drawing the old punch for a session.
// v0.30.1634 - v159 -> v160. the Cinnabar Gates' world-map emblem (Sprites/world/regions/cinnabarCaves.webp, the torii for the crystal) is REPLACED under their own names
// so a returning browser would keep drawing the old art for a session.
// v0.30.1638 - v160 -> v161. Gravitos's form 1 chest blast frames 0-8 and its attack still are REPLACED under their own names, so a
// returning browser would keep drawing the old pose for a session.
// v0.30.1654 - v164 -> v165. Gravitos's form 2 soul cast frames 0-8 and its still are REPLACED under their own names, so a
// returning browser would keep drawing the old cast for a session.
// v0.30.1657 - v165 -> v166. Scorpio's venom shot (p_venom.webp + anim/venom_0..8) is REPLACED under its own names, so a
// returning browser would keep drawing the old green glob for a session.
// v0.30.1707 - v166 -> v167. Lady Honk's column beam (fx_col_lady_honk.webp) is REPLACED under its own name with the softened edges,
// so a returning browser would keep drawing the hard-edged beam for a session.
const CACHE = 'mojiworld-assets-v167';   // v0.30.1707 - Lady Honk's beam softened (same name)
const ASSET_RE = /\.(png|webp|jpg|jpeg|gif|svg|mp3|ogg|wav|m4a|woff2)$/i;   // v0.30.558 - woff2: the bundled creator faces

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    // Drop old cache generations on version bumps.
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('mojiworld-assets-') && k !== CACHE).map((k) => caches.delete(k)));
    // v0.30.1733 bughunt5 - the shell kept one copy per full URL (the deploy's ?v= on every table, a ?join= page per invite, the 10-minute
    // version.json?t= check), so it grew by megabytes a release and answered offline with the OLDEST copy. Keys are the path now:
    // fold each path's newest old copy into its new key (so an upgrade made online still opens offline), then drop the rest.
    try {
      const sh = await caches.open(SHELL), olds = (await sh.keys()).filter((r) => new URL(r.url).search);
      const newest = new Map();
      for (const r of olds) { const u = new URL(r.url); if (!/\/version\.json$/.test(u.pathname)) newest.set(_lxShellKey(u), r); }
      for (const [key, r] of newest) { if (!(await sh.match(key))) { const res = await sh.match(r); if (res) await sh.put(key, res); } }
      for (const r of olds) await sh.delete(r);
    } catch (err) {}
    await self.clients.claim();
  })());
});

// v0.30.1728 release10 OFFLINE START (per user: "Make it work offline"). The game can be installed as an app, but it would not open without a
// connection: only same-origin art was ever stored. Three more kinds of request are kept now, so after one visit an installed
// game opens and plays offline:
//   - the page and its own scripts and tables (a navigation, .html, .js, .json, .webmanifest on this origin): network FIRST, so an
//     update still arrives at once online; the last good copy answers when the network is gone. Kept in SHELL, which survives the
//     art generations below (activate only drops 'mojiworld-assets-*').
//   - art from the web build's CDN (another origin, pinned per commit, so a URL never changes meaning): cache first. It is fetched
//     as CORS so the copy can be stored; an opaque copy costs ~7 MB of quota each and is never stored. A CDN that refuses CORS
//     falls back to the page's own request, unstored, as before.
//   - music: a ranged request still goes to the network first. A whole-file answer (a 200, or a 206 covering every byte) is also
//     stored whole; a cross-origin track is fetched once more as CORS to be stored. Offline, the stored file answers the range
//     with a proper 206 slice (v0.29.473's pitfall was answering a range with a 200). Films (.mp4) stay network-only - too big.
const SHELL = 'mojiworld-shell-v1';
const SHELL_RE = /(\.html?|\.js|\.json|\.webmanifest|\/)$/i;
const AUDIO_RE = /\.(mp3|ogg|wav|m4a)$/i;

// v0.30.1733 bughunt5 - a shell copy is keyed by its PATH: the query never changes what this origin serves (?v= busts the HTTP cache, ?join= /
// ?dev= are read by the page), so the newest copy of each file is the one kept and the one answered.
function _lxShellKey(url) { return url.origin + url.pathname; }
const OFFLINE_PAGE = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mojiworld - offline</title>'
  + '<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#14101f;color:#f3ecff;font:16px/1.5 system-ui,sans-serif;text-align:center">'
  + '<div style="max-width:420px;padding:24px"><h1 style="font-size:22px;margin:0 0 8px">You are offline</h1><p style="margin:0 0 16px;opacity:.85">Mojiworld needs one visit with a connection before it can open offline. Connect, then try again.</p>'
  + '<button onclick="location.reload()" style="font:inherit;padding:8px 18px;border-radius:8px;border:0;background:#8b5cf6;color:#fff;cursor:pointer">Try again</button></div>';
async function _lxShellFirst(e, req) {
  const key = _lxShellKey(new URL(req.url));
  try {
    const net = await fetch(req);
    if (net && net.ok && net.type === 'basic') { const copy = net.clone(); e.waitUntil(caches.open(SHELL).then((c) => c.put(key, copy)).catch(() => {})); }   // opened after the network: a broken store never fails a page that loads
    return net;
  } catch (err) {
    let hit = null;
    try { hit = await (await caches.open(SHELL)).match(key); } catch (err2) {}
    if (hit) return hit;
    if (req.mode === 'navigate') return new Response(OFFLINE_PAGE, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });   // v0.30.1733 bughunt5: was an empty 504 (a blank page)
    return new Response('', { status: 504, statusText: 'offline: not stored yet' });
  }
}
// v0.30.1733 bughunt5 - OFFLINE AFTER ONE VISIT. This worker registers at the end of the page, after the page and its tables have loaded without
// it, so a first visit stored none of them. The page sends their URLs once a worker is active; any not held yet is fetched and kept.
self.addEventListener('message', (e) => {
  const d = e.data;
  if (!d || d.type !== 'lx-shell-warm' || !Array.isArray(d.urls)) return;
  e.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    for (const u of d.urls.slice(0, 64)) {
      try {
        const url = new URL(String(u), self.location.href);
        if (url.origin !== self.location.origin) continue;
        const key = _lxShellKey(url);
        if (await cache.match(key)) continue;
        const net = await fetch(url.href, { credentials: 'same-origin' });
        if (net && net.ok && net.type === 'basic') await cache.put(key, net);
      } catch (err) {}
    }
  })());
});

// v0.30.1733 bughunt5 - the CDN's art and music live in their OWN cache. They were kept in the art generation (CACHE), and every bump - there
// for same-origin files replaced under their own names - deleted them all, though a pinned CDN URL never changes meaning: one
// online launch after a bump and an offline start drew most sprites invisible and played no music. Trimmed by count (oldest
// first) instead; a copy still in an older generation answers until the new cache has it.
const CDN = 'mojiworld-cdn-v1', CDN_MAX = 9000;
async function _lxCdnTrim(cache) {
  if (Math.random() > 0.02) return;   // about one store in fifty pays for the count
  try { const keys = await cache.keys(); for (let i = 0; i < keys.length - CDN_MAX; i++) await cache.delete(keys[i]); } catch (err) {}
}
async function _lxCdnMatch(href) {
  try { const hit = await (await caches.open(CDN)).match(href); if (hit) return hit; } catch (err) {}
  try { return (await (await caches.open(CACHE)).match(href)) || null; } catch (err) { return null; }
}
async function _lxCdnAsset(e, req, url) {
  const cache = await caches.open(CDN);
  const hit = await _lxCdnMatch(url.href);
  if (hit) return hit;
  try {
    const net = await fetch(url.href, { mode: 'cors', credentials: 'omit' });
    if (net && net.ok) e.waitUntil(cache.put(url.href, net.clone()).then(() => _lxCdnTrim(cache)).catch(() => {}));
    return net;
  } catch (err) {
    try { return await fetch(req); } catch (err2) { return new Response('', { status: 504, statusText: 'offline asset miss' }); }
  }
}

async function _lxStoreWholeAudio(cache, key, res) {
  try {
    if (await cache.match(key)) return;
    if (res.type === 'opaque') {   // a cross-origin track: fetch it once more, whole, as CORS so it can be kept
      const c = await fetch(key, { mode: 'cors', credentials: 'omit' });
      if (c && c.status === 200) await cache.put(key, c);
      return;
    }
    let total = 0;
    if (res.status === 206) {
      const m = /bytes\s+(\d+)-(\d+)\/(\d+)/i.exec(res.headers.get('content-range') || '');
      if (!m || +m[1] !== 0 || +m[2] !== +m[3] - 1) return;   // only an answer that holds every byte
      total = +m[3];
    } else if (res.status !== 200) return;
    const blob = await res.blob();
    if (total && blob.size !== total) return;
    await cache.put(key, new Response(blob, { status: 200, headers: { 'Content-Type': res.headers.get('content-type') || 'audio/mpeg', 'Content-Length': String(blob.size) } }));
  } catch (err) {}
}

async function _lxSliceRange(full, range) {
  const blob = await full.blob(); const size = blob.size;
  const m = /bytes=(\d*)-(\d*)/i.exec(range || '');
  let s = 0, en = size - 1;
  if (m) {
    if (m[1] !== '') { s = +m[1]; if (m[2] !== '') en = Math.min(+m[2], size - 1); }
    else if (m[2] !== '') s = Math.max(0, size - (+m[2]));
  }
  if (!size || s >= size || s > en) return new Response('', { status: 416, headers: { 'Content-Range': 'bytes */' + size } });
  return new Response(blob.slice(s, en + 1), { status: 206, headers: {
    'Content-Type': full.headers.get('content-type') || 'audio/mpeg', 'Content-Range': 'bytes ' + s + '-' + en + '/' + size,
    'Content-Length': String(en - s + 1), 'Accept-Ranges': 'bytes' } });
}

async function _lxAudioRange(e, req, url, range) {
  const cache = await caches.open(url.origin === self.location.origin ? CACHE : CDN);   // v0.30.1733 bughunt5: a CDN track outlives an art bump
  try {
    const net = await fetch(req);
    if (net) e.waitUntil(_lxStoreWholeAudio(cache, url.href, net.clone()));
    return net;
  } catch (err) {
    const full = (await cache.match(url.href)) || (url.origin === self.location.origin ? null : await _lxCdnMatch(url.href));
    if (!full) return new Response('', { status: 504, statusText: 'offline audio miss' });
    return _lxSliceRange(full, range);
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  const same = url.origin === self.location.origin;
  if (req.cache === 'no-store' || (same && /\/version\.json$/.test(url.pathname))) return;   // v0.30.1733 bughunt5: the 10-minute version check was stored per ?t=
  // v0.29.473 — never answer a ranged media request with a cached 200 (it can stall or fail to restart audio). Music now gets a
  // network-first pass that also stores the whole track, and offline a real 206 slice; every other ranged request (films) is the
  // network's, as before.
  const range = req.headers && req.headers.get('range');
  if (range) {
    if (!AUDIO_RE.test(url.pathname)) return;
    e.respondWith(_lxAudioRange(e, req, url, range));
    return;
  }
  if (same && (req.mode === 'navigate' || SHELL_RE.test(url.pathname))) { e.respondWith(_lxShellFirst(e, req)); return; }
  if (!ASSET_RE.test(url.pathname)) return;
  if (!same) { e.respondWith(_lxCdnAsset(e, req, url)); return; }
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req);
    let written = null;   // the cache write itself (bughunt cisec-12): waitUntil below waits for IT, and a quota / aborted-body rejection is swallowed
    const refresh = fetch(req).then((res) => {
      if (res && res.ok) written = cache.put(req, res.clone()).catch(() => {});
      return res;
    }).catch(() => null);
    // v0.29.473 — keep the worker alive until the background refresh has
    // actually written. Without this the SW returns the cached hit, goes idle,
    // and the browser is free to terminate it before cache.put lands — so the
    // "refreshes for the next visit" contract silently never happened and a
    // player could sit on stale art indefinitely, not just for one session.
    e.waitUntil(refresh.then(() => written));   // (the response is still returned as soon as it arrives: only the lifetime waits)
    if (hit) return hit;                       // instant cached copy; refresh continues in bg
    const net = await refresh;
    return net || new Response('', { status: 504, statusText: 'offline asset miss' });
  })());
});
