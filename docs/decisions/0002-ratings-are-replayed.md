# 0002. Ratings are replayed from history, never adjusted in place

**Status:** Accepted · August 2026

## Context

Teams are ranked with an Elo-style rating: everyone starts at 1000, and each
decided match moves both sides by an amount that depends on how unexpected the
result was and on the tournament's tier ([lib/elo.ts](../../lib/elo.ts)).

The obvious implementation is incremental. A match finishes, you look up the two
teams, apply the formula, write the two new numbers. It is one read and one
write, and it is what most systems do.

It is also wrong here, for a reason specific to Elo: **the formula is
order-dependent.** How much a match moves a rating depends on what the ratings
were at that moment, which depends on every match before it. That is fine while
results only ever arrive in order — and results do not.

Match data on this site is imported from a wiki that people edit. A score
entered wrongly is corrected days later. A match recorded as finished turns out
to have been postponed. An admin fixes a map score by hand. Every one of those
changes the input to a calculation that has already been applied.

With incremental updates, correcting a two-week-old result fixes that one match
and leaves every rating computed after it wrong — permanently, and invisibly,
because nothing about the numbers looks broken.

## Decision

Treat ratings as **derived, never stored as input**. Every time a result
changes, replay the entire decided match history in order and recompute all
ratings from 1000.

The maths lives in [lib/elo.ts](../../lib/elo.ts) with no database imports, so
the site and the maintenance scripts share one implementation and cannot drift
apart. The database side is [lib/rating.ts](../../lib/rating.ts).

A unit test pins the property that motivates all of this: the same two results
applied in a different order produce different ratings
([tests/elo.test.ts](../../tests/elo.test.ts)).

## Consequences

**Accepted cost — it is expensive, and the cost grows.** Measured across two CI
runs, the replay took 108s and 278s of jobs lasting 387s and 475s: between a
quarter and well over half. It gets slower with every match added.

**Mitigation, not a fix.** The importer now reports whether it actually changed
anything, and the replay is skipped when it did not
([scripts/import-live.ts](../../scripts/import-live.ts)). Most passes write
nothing, and replaying an unchanged history cannot change a rating, so that time
was pure waste. The cost when a result *does* change is unchanged and accepted.

**Gained — the table is always a function of the recorded results.** There is no
state to drift, no repair script, and no class of bug where the ranking is
subtly wrong because of something that happened weeks ago. If the matches are
right, the table is right.
