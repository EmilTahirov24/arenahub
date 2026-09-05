# 0005. Every date goes through one formatter, pinned to one zone

**Status:** Accepted · August 2026

## Context

`Intl.DateTimeFormat` formats in the host's time zone unless told otherwise. The
site runs on Vercel, where that zone is UTC. Azerbaijan is UTC+04:00.

So every time on the site was **four hours early**. A match starting at 13:00 in
Baku was published as 09:00.

Nothing threw. Nothing appeared in a log. The pages rendered, the tests passed,
the times looked like times. On a site whose entire purpose is telling people
when a match starts, this is the worst possible failure: the reader trusts the
number, arrives late, and never finds out why.

It was found by comparing two things that should have agreed. Measured on the
live site (2026-08-29), a match at `2026-08-29T09:00:00.000Z` showed as **09:00**
on the page and **13:00** in the site's own share image — because
`opengraph-image.tsx` had already made this decision once, correctly, and wrote
`Asia/Baku`. One file was right and every other was wrong, and the disagreement
was the only visible symptom.

## Decision

One constant, one formatter, one place to change it
([lib/dates.ts](../../lib/dates.ts)).

`siteFormat(locale, options)` is used instead of constructing
`Intl.DateTimeFormat` directly, so that forgetting `timeZone` is not possible —
which is exactly how the bug arose.

Day boundaries follow the same rule. `dayRange` spans a Baku day expressed as
UTC instants: taking the bounds from UTC midnight put matches played between
00:00 and 04:00 local time into the previous day, so someone clicking "today"
did not see the match they had stayed up for.

The screen says **"Baku time"** next to the time. A number alone cannot say
which zone it is in, and a visitor elsewhere would reasonably read it as local.

## Consequences

**Gained — the class of bug is closed, not the instance.** The fix is not "this
page now formats correctly"; it is that a page cannot format incorrectly without
bypassing the shared helper.

**Held down by tests.** [tests/dates.test.ts](../../tests/dates.test.ts) pins the
zone, the four-hour case that started this, the day boundary at 00:00–04:00, and
the rejection of `2026-02-31` — a date JavaScript silently slides to 3 March.

**A note kept deliberately.** Azerbaijan has not observed daylight saving since
2016, so the offset is +04:00 year-round and a fixed number would work today.
The code still formats through `timeZone`, because a rule that happens to be
constant is not the same as a constant.

**The general lesson,** and the reason this record exists: *no error* is not the
same as *correct*. The site was working. It was working wrongly.
