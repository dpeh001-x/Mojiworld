# cinematicremakehiggsfield — Mojiworld Cinematic Remake Brief (Higgsfield)

Production spec for regenerating the game's story-beat cinematics as short video
clips with Higgsfield. Run each shot prompt with your linked Higgsfield account;
the in-game overlay supplies the stanza text, so **generate clean plates — no
text, no captions, no logos baked into the video**.

## Global settings (apply to every shot)

- **Aspect / length:** 16:9, 5–8 s per shot. One shot per stanza where listed.
- **Style anchor (image-to-video):** use `steam/higgsfield/keyart_wide_source.png`
  or `keyart_autumn_landscape.png` as the style/first-frame reference where a
  scene matches. Otherwise text-to-video with the style prefix below.
- **Style prefix (prepend to every prompt):**
  `Painterly pastel dreamworld, candy-forest fantasy, soft volumetric dawn light,
  storybook Ghibli-adjacent aesthetic, gentle film grain, muted glow, no text,
  no watermark`
- **Negative prompt:** `photorealism, harsh contrast, horror gore, UI elements,
  letters, captions, watermarks`
- **Naming:** export as `cine_<beat_id>_s<shot#>.mp4`
  (e.g. `cine_arrival_frontier_s1.mp4`).
- **Emotional register:** Persona 3 — quiet melancholy, warmth inside sadness.
  Slow cameras. Nothing rushes. Endings linger one beat longer than comfortable.

---

## 1. `arrival_frontier` — ACT II · The Restless Frontier

*Plays on first entry to any Act II map. Mood: the lullaby ends; the world gets teeth.*

- **Shot 1 (title plate)** — `Wide establishing shot, edge of a candy-green
  meadow giving way to a storm-grey frontier plain, a single dirt road crossing
  the boundary line between colour and gloom, wind moving the grass.`
  Camera: slow dolly forward. 6 s.
- **Shot 2** — `A frozen thunderbolt hanging mid-crack in a bruised sky over a
  bleak plateau, frost creeping over wildflowers at the meadow's last edge,
  time visibly stopped.` Camera: slow crane up. 6 s.
- **Shot 3** — `Small lone traveller silhouette walking away from the camera
  into the grey frontier, green country glowing warm behind them, they do not
  look back.` Camera: static, slight push-in. 8 s.

In-game stanzas (for timing reference):
> The green country ends behind you / like a lullaby running out of verses.
> Thunder hangs mid-crack. Frost has held its bite for an age. / Nothing out here waits politely anymore.
> They will not thank you for hope, foreigner. / They will test it. — Walk on.

---

## 2. `arrival_broken_sky` — ACT III · The Broken Sky

*Plays on first entry to any Act III map. Mood: look up; the wound in the sky.*

- **Shot 1** — `Low-angle shot looking straight up at a vast twilight sky
  fractured like stained glass, starlight leaking through the cracks, aurora
  shimmer held perfectly still.` Camera: slow tilt up ending on the largest
  crack. 7 s.
- **Shot 2** — `Storm clouds nailed mid-lightning over a field of crooked
  gravestones, translucent sorrowful wisp-figures drifting between the stones,
  soft blue-violet palette, mournful not scary.` Camera: lateral tracking. 7 s.
- **Shot 3** — `A traveller silhouette on a ridge under the broken sky, holding
  their cloak collar closed against the wind, tiny beneath the fractured
  heavens.` Camera: slow zoom out to emphasize scale. 8 s.

In-game stanzas:
> Look up. / This is where the fracture shows.
> Storms nailed to their crests. / Graves that cannot agree who lies in them. / And the wraiths — not monsters. / Grief that found a door.
> This is where reasons thin, foreigner. / Hold yours by the collar. — The sky is watching you back.

---

## 3. `arrival_sundered_deep` — ACT IV · The Sundered Deep

*Plays on first entry to any Act IV map. Mood: the wound itself; the unfinishedness.*

- **Shot 1** — `Descent into a vast underground wound in the earth: a broken
  forge with its anvil split in two, embers frozen mid-scatter in the air,
  half-finished swords still on the workbench.` Camera: slow descent (crane
  down). 7 s.
- **Shot 2** — `Montage plate: a tide frozen mid-withering over drowned ruins,
  thorn vines grown through twelve ages of dark, skeleton sentries standing
  patient vigil with lanterns, everything half-made and abandoned mid-gesture.`
  Camera: slow dolly through. 8 s.
- **Shot 3** — `A single ember reigniting in the dark forge as a traveller's
  hand reaches toward the broken anvil, one point of warm orange light in a
  blue-black cavern.` Camera: slow push-in on the ember. 6 s.

In-game stanzas:
> This is the wound itself.
> Half-forged. Half-drowned. Half-buried. / Nothing down here got to finish. — That is the nightmare — / not the dark. The unfinishedness.
> So finish something, foreigner. / Every fight you end / is a sentence the world / finally gets to complete.

---

## 4. `arrival_chains_end` — ACT V · The Chain's End

*Plays on first entry to any Act V map. Mood: the last road; lanterns kept for you.*

- **Shot 1** — `A glass-sharp wind blowing crystalline dust across a frozen
  steppe, a narrow mountain road winding relentlessly upward into pale mist,
  no other direction left to go.` Camera: slow aerial follow along the road. 7 s.
- **Shot 2 (the money shot)** — `A long line of warm paper lanterns burning
  along a night mountain path, stretching to the horizon, each flame steady
  against the cold wind, snow drifting past, deep indigo night.` Camera: slow
  dolly along the lantern line. 8 s.
- **Shot 3** — `Traveller silhouette pausing beside one lantern, its warm light
  on their face, the path behind them dark, the path ahead lit lantern by
  lantern up to a distant gate.` Camera: static with gentle lantern flicker. 8 s.

In-game stanzas:
> The wind has teeth of glass, / and the road has stopped pretending / to lead anywhere but up.
> The Wayfarer's lanterns burn in a line — / lit for travellers who never came. / Kept for the one who finally did.
> You are past every point / where turning back was cheap. — Walk on, foreigner. / The lanterns will not last forever.

---

## 5. `arrival_sky_beyond` — ACT VI · The Sky Beyond

*Plays at the Zodiac Sanctum. Mood: past the pillars; no road, only the reason.*

- **Shot 1** — `Looking down from cosmic height: the entire fantasy world tiny
  and glowing far below like a map on the floor of the dark, stars all around,
  two vast gate pillars receding behind.` Camera: slow tilt down then up. 7 s.
- **Shot 2** — `Twelve constellations burning as distant golden houses arranged
  in a great wheel in the void, each one flickering like a dream that cannot
  end, majestic and sorrowful.` Camera: slow orbital pan across the wheel. 8 s.
- **Shot 3** — `A lone traveller walking on starlight toward the centre of the
  zodiac wheel where a colossal patient silhouette holds a dark star on its
  shoulders, no path beneath the traveller's feet — they walk anyway.` Camera:
  slow zoom out to full cosmic scale. 8 s.

In-game stanzas:
> The pillars are behind you. / The world you walked is a map / on the floor of the dark.
> Twelve houses burn in twelve stuck dreams — / champions who rose to wake the world / and became the reasons it stayed asleep.
> There is no road now. / Only the reason you named at the gate. — The sky was never the limit, foreigner. / It was the errand.

---

## 6. `warden_falls` — The Amnesiac's Farewell  ★ PRIORITY

*Plays once after Aetherion's first defeat. Mood: Persona 3 — his memory returns,
and remembering means knowing how this ends. Warmth and grief in the same frame.*

- **Shot 1** — `A hooded figure waiting outside a ruined celestial sanctum at
  dusk, hood lowered for the first time, face calm and finally certain,
  golden hour light after a great battle, drifting motes of light.` Camera:
  slow push-in from behind the approaching player's shoulder. 7 s.
- **Shot 2** — `Close on the hooded figure's face: a smile that is also grief,
  eyes bright with returning memories, tiny shards of light lifting off their
  shoulders and drifting skyward like the first petals of spring.` Camera:
  locked-off close-up, shallow depth. 8 s.
- **Shot 3 ("a short spring")** — `Cherry-blossom-like petals of light blowing
  across the sanctum steps between the two figures, one gestures gently toward
  the horizon telling the other to go on, dusk turning to first starlight.`
  Camera: slow crane up and away, the two figures growing small. 8 s.

In-game stanzas:
> The Warden fell. I felt my name come back. / Most of it.
> I should be happy. I am happy. — It is only — remembering who I was / means remembering how this ends.
> When the world wakes, everything borrowed goes home. / … Even you, foreigner. Especially you.
> Don't slow down on our account. / A short spring is still a spring.
> Go and wake the world. / … think of us once. — That will be enough. That will be everything.

---

## 7. `epilogue_gravitos` — The Bittersweet Ending  ★★ TOP PRIORITY

*Plays once after Gravitos falls. Ten stanzas — generate all seven shots; the
overlay paces text across them. Mood: the world wakes; you leave. No one says
goodbye. Everyone means it.*

- **Shot 1** — `A colossal titan gently setting down a glowing world it has
  carried for ages, kneeling in relief not defeat, cosmic dust settling like
  snow, tender and monumental.` Camera: slow orbit. 8 s.
- **Shot 2** — `A bronze bell in a pastel bazaar completing its frozen swing
  and ringing, visible soundwave shimmer rippling out over rooftops, morning
  light flooding a candy-coloured town as it stirs awake.` Camera: crash-zoom
  out from bell to full town. 7 s.
- **Shot 3** — `Sleepers all across a dreamworld softly unclenching in their
  beds, a dark mist lifting off them like a hand letting go, windows glowing
  warm one by one across a night valley.` Camera: slow aerial drift. 8 s.
- **Shot 4** — `The hooded figure laughing and crying at once beneath the first
  true sunrise, hood fallen back, light on a face remembering its own name.`
  Camera: locked close-up, sun flare blooming. 6 s.
- **Shot 5** — `The long mountain line of paper lanterns going out one by one
  in the dawn — not blown out, completed — thin ribbons of smoke rising
  peacefully, their vigil over.` Camera: slow pan down the lantern line as
  each gutters out. 8 s.
- **Shot 6 (the wave)** — `Half-translucent beloved figures from a childhood
  memory standing at the edge of a sunlit field, stepping backward into the
  light, the last one raising a hand in a small wave, warm and unbearably
  gentle.` Camera: static; let the wave be the only movement. 8 s.
- **Shot 7 (you wake)** — `The dreamworld folding softly away beneath a
  closing seam of light in the sky, then: an ordinary bedroom in ordinary
  morning light, curtains breathing in a breeze, a single pastel petal of
  light fading on the windowsill.` Camera: slow dissolve between the two
  worlds, end on the petal. 10 s.

In-game stanzas (abridged):
> The Weight-Bearer falls. / Not in defeat — in relief.
> The bell in the bazaar / finishes its swing — / and rings, once, clear.
> The nightmare loosens its grip / like a hand finally trusted / enough to let go.
> He laughs — and then he cries — / and both sound like the same word.
> Not abandoned. Finished. / Their long vigil over.
> One of them waves. / They were never asking you to stay. / They were thanking you for coming.
> No one says goodbye. / Everyone means it.
> And as the world falls, at last, / into its first true dream in twelve ages — / you wake.
> You will think of them once. / That will be enough. / That will be everything. — Thank you for walking with us.

---

## 8. Optional extras (existing beats, same pipeline)

- **`tutorial_intro`** — the seam in the sky opens; the watcher sends you
  falling through into the paused world. 2 shots: the seam splitting open in a
  night sky; a small figure falling gently through clouds toward a frozen,
  glowing world.
- **`first_gate_visit`** — Sage Mira at the gate pillars: a silver-haired woman
  who has watched a gate for three hundred years, finally turning around.
  2 shots: her back to camera before vast pillars; the slow turn, eyes "the
  colour of a sky that hasn't decided what it wants to be".
- **`zodiac_twelve_done`** — the zodiac wheel turning for the first time in
  twelve ages, twelve constellations bowing their burning crowns. 2 shots.

## Delivery checklist

- [ ] Clean plates only — no baked-in text or logos (the game overlays stanzas).
- [ ] 16:9, highest available quality, consistent style prefix across all shots.
- [ ] File naming: `cine_<beat_id>_s<shot#>.mp4` into `steam/higgsfield/cinematics/`.
- [ ] Watch each clip once for stray text/artifacts before dropping it in.

