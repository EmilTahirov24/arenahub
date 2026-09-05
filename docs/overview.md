# ArenaHub — technical overview

A bilingual esports results and statistics platform, built and operated by one
person. Live at **[arenahub-wheat.vercel.app](https://arenahub-wheat.vercel.app)**.

This document is the two-page version: what the system does, how it is put
together, what holds it correct, what has been measured, and where it stops.
The decisions behind it are written up separately in
[decisions/](decisions/).

---

## 1. The problem

There is almost no esports coverage in Azerbaijani. Beyond language there is a
harder barrier: HLTV, the largest Counter-Strike source, is not reachable from
Azerbaijan — the domain resolves, the connection never completes, while
Liquipedia answers in 0.26s from the same machine (measured 2026-09-01).

So the data exists and is simply out of reach for the readers this site is for.
ArenaHub closes that gap in both languages, from sources that are legally usable
and that publish their terms.

---

## 2. Architecture

```
Liquipedia MediaWiki API
        │  CC BY-SA · 2.5s between queries, 31s between parses
        ▼
8 import scripts ──────────► PostgreSQL (Neon) ──────► Next.js 16 ──────► Vercel
matches · maps · rosters       19 models                server-rendered     CDN
teams · logos · tournaments    13 migrations            + cached            auto-migrate
locations · weekly roundup
        ▲
        │ 7 GitHub Actions workflows (schedule + manual dispatch)
```

**Ingestion is scripted, not manual.** Each import script runs headless from CI,
writes through a shared throttled client ([lib/liquipedia.ts](../lib/liquipedia.ts)),
and reports whether it changed anything so downstream work can be skipped when
it did not.

**Reading is server-rendered and cached.** Next.js Cache Components let the page
shell prerender while the parts that depend on query parameters stream in.
Admin routes opt out of that deliberately: they must always read fresh.

**Two languages, one codebase.** Locale is carried in the URL (`/az`, `/en`);
translations live in JSON, not in code; `hreflang` is emitted so search engines
resolve the right one. Switching language keeps the reader on the page they were
on.

---

## 3. Data model

19 models, 13 hand-written SQL migrations. The parts that carry the design:

| Model | Note |
|---|---|
| `Match` | The centre. Carries `stage` and `bracketKey` — the round, and which tree on the source page it came from |
| `MatchMap` | Per-map result; the series score is derived from these, not typed |
| `Team` | `rating` and `previousRating` are **derived columns**, never inputs |
| `TournamentPrize` | A prize belongs to a place RANGE, not a team; a team's prize follows from where its placement falls |
| `Player` | One account type only. A team has no login; `Team.ownerId` points at a Player |
| `ImportRun` | Every import records what it wrote, so "ran green but fetched nothing" is visible |

Two design choices are worth naming.

**Prizes are stored by range, not per team.** "5–8th places, $60,000" is one
row. A team's prize is computed from its placement, so the published breakdown
and the per-team figure cannot disagree — there is only one number.

**Ratings are derived, never stored as input.** See §4.

---

## 4. What keeps it correct

Four invariants, each enforced in one place and pinned by a test.

**Ratings are replayed, not adjusted.** Elo is order-dependent: how much a match
moves a rating depends on every match before it. Correcting a two-week-old
result incrementally would leave every later rating permanently wrong. So any
change replays the full history from 1000
([lib/elo.ts](../lib/elo.ts) · [0002](decisions/0002-ratings-are-replayed.md)).

**Rounds come from a closed vocabulary.** Anything unrecognised returns `null`
and the match keeps its result while losing its round. A bracket that fails its
own consistency check is not drawn at all
([lib/stages.ts](../lib/stages.ts) · [0003](decisions/0003-brackets-are-verified.md)).

**One time zone, one formatter.** Formatting used to run in the server's zone —
UTC on Vercel — publishing a 13:00 match as 09:00. Every date now goes through
one helper so forgetting the zone is not possible
([lib/dates.ts](../lib/dates.ts) · [0005](decisions/0005-one-time-zone.md)).

**Contrast is computed, not written down.** Game colours are admin-entered, so
correcting today's four would be wrong the day a fifth is added
([lib/contrast.ts](../lib/contrast.ts) · [0006](decisions/0006-contrast-is-computed.md)).

Underneath all four is one rule: **the system may show less, and may not show
what it cannot support.** An empty column is a statement about the data. A
filled one is a claim about the world.

---

## 5. What has been measured

Numbers here were measured, not estimated.

**Scale** (live site, September 2026): 3,265 matches · 960 teams · 1,392 players
· 180 tournaments · 6,100 indexed URLs · 4 games · 2 languages.

**Code**: ~30,500 lines of first-party TypeScript, SQL, schema and CI
definitions. 86% TypeScript.

**Verification**: 79 unit tests (under a second) · 157 end-to-end checks in real
Chromium across 6 suites · 0 axe-core contrast violations in both themes · 0
dependency vulnerabilities · `docker compose up` executed and the served page
checked on every push.

**Three bugs that ran without throwing**, each now pinned by a test named after
it: a four-hour timezone error; a duplicate-detection loop that fed itself until
one organisation existed as **42 rows**; a light-theme contrast failure where one
badge measured **1.90:1** against a required 4.5:1 and the automated checker
could not see it, because axe skips gradients.

**Reconstruction**: 526 matches carry a verified round across 90 brackets. A
survey of 16 live tournaments found 0 rounds the vocabulary could not read.

---

## 6. Limitations

Stated because they are real, and because a system whose limits are unstated
cannot be trusted about anything else.

**Live scores lag.** Liquipedia is edited by volunteers and the importer polls
it; a live score can be tens of minutes behind the game. The site shows a live
badge and a series score, not round-by-round state — because it does not have
round-by-round state.

**Player statistics are empty in production.** Liquipedia publishes match
scores, not per-player kill counts. The page says so rather than showing zeros.
Closing this needs a different source; an application to GRID Open Access is
prepared and unsent.

**Photograph coverage is thin and uneven.** 56 photographs across 1,392 players,
and zero for VALORANT — the source's esports archive is largely 2015–2019
Counter-Strike, Dota and League. Established by searching and finding nothing,
not assumed ([0004](decisions/0004-player-photographs.md)).

**Rate limiting is in memory.** One counter per instance, so it is approximate
across a multi-instance deployment. Adequate at this scale; Redis is the fix if
that changes ([lib/rateLimit.ts](../lib/rateLimit.ts)).

**Scheduled workflows are unreliable, and the schedule is not the fix.** Measured
against a `*/20` cron, actual gaps between runs were 45 minutes to 5 hours —
GitHub queues scheduled work behind everything else. An external trigger calling
`workflow_dispatch` is the honest solution and only runs while that machine is
on.

---

## 7. Reproducing it

```bash
docker compose up
```

Postgres starts, migrations apply, the database seeds, the site serves on
:3000. CI runs this exact command on every push and checks the page it serves,
so the claim is verified rather than asserted
([.github/workflows/ci.yml](../.github/workflows/ci.yml)).

The build runs at container start rather than image build, because `next build`
prerenders pages that read from the database and there is no database during
`docker build` — established by testing it, not assumed.
