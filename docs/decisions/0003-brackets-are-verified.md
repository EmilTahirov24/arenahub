# 0003. A bracket is drawn only where the data verifies it

**Status:** Accepted · September 2026

## Context

A playoff bracket is the clearest way to show how a tournament was decided, and
it is also the easiest thing on the site to get quietly wrong. A bracket is a
set of claims — this team beat that one and advanced here — drawn as lines. A
line in the wrong place is a false statement about a real team, and it does not
look like an error. It looks like a bracket.

Two problems had to be solved before anything could be drawn.

**The round is not given.** Liquipedia stores it in two different ways depending
on the wiki. CS2 and Dota 2 carry it as a comment inside the wikitext; VALORANT
and League of Legends do not state it at all — the round has to be recovered
from how deeply the match block is nested in the rendered markup
([lib/liquipedia.ts](../../lib/liquipedia.ts)).

**One tournament page holds several trees.** IEM Kraków has a play-in, two group
brackets and the playoffs, and each has its own quarterfinal. Grouping by round
name puts five quarterfinals in one column.

## Decision

Draw nothing that the data does not support.

**Rounds come from a closed vocabulary.** `normaliseStage` maps the many ways a
round is written onto a fixed set and returns `null` for anything it does not
recognise ([lib/stages.ts](../../lib/stages.ts)). An unrecognised round is left
out rather than guessed at.

**Trees are separated by the source's own bracket id,** not by round name
([components/events/Bracket.tsx](../../components/events/Bracket.tsx)).

**A line is drawn only where a result puts it there.** For each side of a match,
the route in is the last match that team *won* in an earlier column. Nothing is
inferred from position on the page.

**No line is drawn for a loss.** In a lower bracket one team arrives as a winner
and the other drops in having lost; drawing the second would read as a path to
victory. The third-place match is excluded from the edges entirely — teams reach
it by losing.

**The reconstruction has to pass its own check:** each round must be no larger
than the one before it, and at least one winner from a round must appear in the
next. If it fails, the matches keep their results and lose their round, and no
bracket is drawn.

## Consequences

**Accepted cost — some tournaments show no bracket.** A regional event named
".../Playoff" may still show only a flat list, because its round data did not
verify. The name promises a bracket; the data does not support one.

**Gained — every line on screen is backed by a recorded result.** Measured after
the change: 526 matches carried a verified round across 90 brackets, and a
survey of 16 live tournaments found 0 rounds the vocabulary could not read.

**The rule that generalises.** Empty is a statement about the data. Wrong is a
statement about the world, and this project does not make ones it cannot
support.
