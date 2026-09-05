# 0004. Player photographs come only from freely licensed sources

**Status:** Accepted · August 2026

## Context

Of 1,392 players, one had a photograph. Everyone else appeared as coloured
initials, which is fine but makes the site feel like a database rather than a
place about people.

Liquipedia has photographs of most professional players, and the site already
uses Liquipedia for match data. Reusing them looks like the same decision.

It is not. Checked on 2026-08-31:

- their API returns **empty `extmetadata`** for these files — no licence
  statement at all
- the file description pages are empty too
- their own note on one file says the copyright holder must send the photo and
  permission to `photos@liquipedia.net`

That last line settles it. Permission was granted **to them**, not onward. A
photograph is a specific photographer's copyrighted work, and no licence being
published is not the same as there being no licence.

Team logos are a different case and are treated differently: a logo is a
trademark used nominatively to identify the team it belongs to.

## Decision

Player photographs come **only** from Wikimedia Commons, and only under CC BY,
CC BY-SA or CC0 — licences that are machine-readable and explicitly permit
reuse.

Naming the photographer is a condition of the first two, not a courtesy, so it
is done in two places: beside the picture on the player's page, and in full on a
[credits page](https://arenahub-wheat.vercel.app/az/credits) reachable from the
footer.

The pictures are cropped square for avatars. A crop is a derivative work, so
share-alike ones stay under the same licence, and those rows say so
([lib/playerPhotos.ts](../../lib/playerPhotos.ts)).

**No photograph is accepted automatically.** Search finds candidates; a human
looks at every one before it is committed. Two searches showed why: "donk"
returned a church in the Netherlands, and one candidate for a player named
Martinez was a Catholic priest. Both would have attached a stranger's face to a
real person.

A photograph a player uploads themselves is theirs and is never overwritten
([scripts/apply-player-photos.ts](../../scripts/apply-player-photos.ts)).

## Consequences

**Accepted cost — coverage is low and unevenly distributed.** 56 photographs
across 1,392 players. VALORANT is at **zero**, and the reason is the source, not
the search: Wikimedia's esports photography comes largely from 2015–2019
Counter-Strike, Dota and League events. Deepening the search returned nothing
extra, which is how the limit was established rather than assumed.

**Accepted cost — it is slow.** Every accepted photograph was reviewed by eye.
Of 18 candidates in one pass, 9 were rejected.

**Gained — every picture on the site can be traced to a licence and an author.**

**Open.** Asking Liquipedia for permission is the one remaining legitimate route
to wider coverage. It has not been done.
