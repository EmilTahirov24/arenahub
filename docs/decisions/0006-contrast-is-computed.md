# 0006. Text contrast is computed, not written down

**Status:** Accepted · August 2026

## Context

Each game has an accent colour entered in the admin panel — so it is an
arbitrary colour, not one of four the designer chose. `GameChip` used that
colour both as its text and as its own washed background.

Measured with axe-core on the live site (2026-08-30):

| theme | game | ratio | required |
|---|---|---|---|
| dark | Dota 2 `#dc2626` | 3.39:1 | 4.5 |
| light | CS2 `#f5a524` | **1.90:1** | 4.5 |
| light | LoL `#c9aa71` | 2.07:1 | 4.5 |
| light | VALORANT `#ff4655` | 2.97:1 | 4.5 |
| light | Dota 2 `#dc2626` | 4.13:1 | 4.5 |

In light mode **all four failed**, one of them at less than half the threshold.

Two things had hidden it. The automated checker scans the default theme, so the
light theme was never looked at. And axe skips elements sitting on a gradient —
which is what these badges sit on. The tool that was supposed to catch this was
structurally unable to.

The filter pills had a related bug from the opposite direction: they took the
background from the accent colour and wrote the text in a **fixed** dark value.
That was right for three games and wrong for Dota 2, where dark gives 4.07:1 and
white gives 4.83:1.

## Decision

Do not correct the four colours. Compute the correction
([lib/contrast.ts](../../lib/contrast.ts)).

`readableOn(color, background, min)` lightens or darkens a colour until it
reaches the threshold, preserving the hue and moving only lightness. The
direction is taken from the background: towards white on a dark ground, towards
black on a light one, because going the other way would move the colour *closer*
to the background.

`bestTextOn(background)` picks black or white by measuring both rather than
assuming one.

## Consequences

**Gained — the fix covers colours nobody has chosen yet.** Correcting four
values by hand would have been correct until the day an admin adds a fifth game,
and would then have been silently wrong again. This is the difference between
fixing an instance and fixing the rule.

**Accepted cost — the rendered colour is not exactly the colour entered.** A
badge may be a shade lighter than the brand colour. Readable and slightly off is
better than faithful and unreadable.

**Held down by tests.** [tests/contrast.test.ts](../../tests/contrast.test.ts)
asserts that every real game accent clears 4.5:1 on both grounds, and that
`bestTextOn` returns white for Dota red — the case a fixed value got wrong.

**What is not covered, stated plainly.** The generated avatar badges are
gradients, and an automated checker cannot measure a gradient. Those were
measured by hand (worst case 6.18:1 in light, 5.14:1 in dark), and the tests
assert what *can* be asserted: the ink paired with each theme, and the computed
ink against a team's own solid colour. A test that pretended to measure the
gradient would be worse than none.
