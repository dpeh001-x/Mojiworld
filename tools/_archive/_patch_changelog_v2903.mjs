// v0.29.3 changelog entry — inserted above the v0.29.2 section (newest on top).
import fs from 'node:fs';
const P = 'CHANGELOG.html';
let s = fs.readFileSync(P, 'utf8');
const anchor = '<h2>v0.29.2 <span class="tag"><span class="pill polish">polish</span>';
const c = s.split(anchor).length - 1;
if (c !== 1) throw new Error('anchor x' + c);
const entry = [
'<h2>v0.29.3 <span class="tag"><span class="pill feat">feat</span> Everdawn questline hardening &mdash; THE LONG DAWN chain, enforced pilgrimage, 6th Dawn Fragment</h2>',
'',
'<p>Per user &ldquo;improve the questline and quests to make sure it is not too easy&hellip; make it substantial and contribute to parts of the storyline&rdquo;. The Everdawn Cycle saga had three soft spots: the finale accepted a petition carrying <b>1 of 5</b> Dawn Fragments, Act&nbsp;4 was a 20-level silence (nothing between the Twelve Houses at Lv&nbsp;70 and the Singularity at Lv&nbsp;90), and the Sundered Smith &mdash; an Act&nbsp;2 story fragment &mdash; unlocked as a floating one-off.</p>',
'<ul>',
'<li><b>THE LONG DAWN (new Act&nbsp;4 questline).</b> <i>Chapter I &mdash; What Refusal Leaves</i> (Lv&nbsp;76, after the Twelve fall): the opened sky sheds twelve ages of residue onto the Wayfarer&rsquo;s road &mdash; a heavy elite cull of 30 wraiths, 24 mournshades, 20 lantern-wisps and 14 echo-knights (88 elites, the longest single quest in the game). <i>Chapter II &mdash; The Three Tyrants</i> (Lv&nbsp;82): a three-boss pilgrimage &mdash; Legosaurus, King Krook and Octobaby each re-tightened their loops; end all three refusals in one quest. Grants the new 6th Dawn Fragment, <b>The Unrefused Hour</b>.</li>',
'<li><b>The Singularity now demands the full pilgrimage.</b> <i>Petition the Weight-Bearer</i> requires the Warden, the First-Born, the Twelve Houses, the Sundered Smith, Hourglass&nbsp;V <em>and</em> The Long Dawn&nbsp;II &mdash; i.e. every Dawn Fragment &mdash; before it unlocks. Its reward rises 20000/10000 &rarr; 26000/13000 to stay the single-quest apex. Existing saves migrate: a new unlock-prune re-locks journal entries whose prereq chain is no longer satisfied (accepted/completed quests are never touched).</li>',
'<li><b>The Forge That Broke is earned, not stumbled into.</b> Brok&rsquo;s two errands (Recover the Forge-Key, Reef Toll) are now prerequisites &mdash; his ledger only opens to someone who ran them, tying the Act&nbsp;2 fragment into a three-quest arc.</li>',
'<li><b>Endless Express floor raised.</b> The random manifest now rolls 45&ndash;99 (was 10&ndash;99) &mdash; a lucky minimum roll used to pay ~60% of ceiling rewards for ~10% of the work.</li>',
'</ul>',
'<div class="callout"><b>Design intent.</b> The saga&rsquo;s four acts now read as an actual pilgrimage: every fragment is mandatory, every act has a spine, and the last 30 levels are paced by story beats instead of a single boss gate.</div>',
'',
''].join('\r\n');
s = s.replace(anchor, entry + anchor);
fs.writeFileSync(P + '.tmp', s); fs.renameSync(P + '.tmp', P);
console.log('changelog entry inserted');
