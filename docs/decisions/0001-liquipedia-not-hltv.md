# 0001. Liquipedia as the data source, not HLTV

**Status:** Accepted · August 2026

## Context

The site needs match fixtures, results, rosters and tournaments for four games.
HLTV is the obvious first thought for Counter-Strike: it is the largest source
in the sport and the one every player already reads.

Two things ruled it out.

**It has no public API.** Every package on npm calling itself an "HLTV API" is a
scraper dressed as a client: it fetches the HTML pages and parses them. That is
against HLTV's terms, and the fact that a library exists does not change what
the library does. Using one would mean the project's data supply depended on
quietly violating someone else's rules — and on markup that can change without
notice.

**It is not reachable from Azerbaijan.** Measured on 2026-09-01 from the machine
this project is developed on:

| host | result |
|---|---|
| `hltv.org` | no response, connection timed out after 12s |
| `liquipedia.net` | answered in 0.26s |
| `dotabuff.com` | answered in 0.19s |

The domain resolves — both the ISP's resolver and Google's return the same
Cloudflare addresses — but the TCP connection never completes. So the site is
not slow or down; the route is closed. Why it is closed is not something this
project can establish, and it does not claim to know.

That second point is not only an obstacle. It is part of why the project exists:
for a reader here, the largest source of Counter-Strike data effectively does
not exist.

## Decision

Use the **Liquipedia MediaWiki API** as the sole external source, under
CC BY-SA, with attribution in the site footer.

Respect their published limits in the client rather than in each caller, so a
violation is not one forgotten line away — see
[lib/liquipedia.ts](../../lib/liquipedia.ts): 2.5s between ordinary queries and
31s between `action=parse` calls, throttled separately so cheap calls are not
slowed to the expensive rate.

## Consequences

**Accepted cost — the data is slower.** Liquipedia is edited by volunteers, so a
live score can lag the game by tens of minutes. The importer polls; it is not
pushed to. A live match on the site can therefore be minutes behind reality.

**Accepted cost — some data is not there at all.** Liquipedia publishes match
scores, not per-player kill counts, so `PlayerMatchStat` is empty in production.
The page says so rather than showing zeros.

**Gained — the supply is legitimate and stable.** The API is documented and
public. Nothing breaks because a page's markup changed, and nothing depends on
not being noticed.

**Open.** An application to GRID Open Access is prepared
([grid-open-access-application.md](../grid-open-access-application.md)); it
would add official CS2 and Dota 2 data covering roughly half of the matches
already recorded. It has not been submitted, and until it is, this decision
stands unchanged.
