## Emil Tahirov

I build and run [**ArenaHub**](https://arenahub-wheat.vercel.app) — a bilingual esports statistics platform. Solo, in production, with real data.

One project, run properly, rather than many started.

---

### ArenaHub

**Live → [arenahub-wheat.vercel.app](https://arenahub-wheat.vercel.app)**  ·  **Source → [github.com/EmilTahirov24/arenahub](https://github.com/EmilTahirov24/arenahub)**

Esports results and statistics in Azerbaijani and English.

There is almost no esports coverage in Azerbaijani, and the largest source for
Counter-Strike — HLTV — is not reachable from where I live: the domain resolves,
but the connection never completes. So the data existed and was simply out of
reach. ArenaHub closes that gap: fixtures and live scores, playoff brackets
drawn from recorded results, team and player pages, tournament prize
breakdowns, and an Elo ranking recomputed from match history.

| | |
|---|---|
| **Matches** | 3,265 |
| **Teams** | 960 |
| **Players** | 1,392 |
| **Tournaments** | 180 |
| **Games** | CS2 · Dota 2 · VALORANT · League of Legends |
| **Languages** | Azerbaijani · English |

<sub>Measured from the live site, September 2026. The importer runs on a schedule, so these grow daily.</sub>

**TypeScript · Next.js 16 · React 19 · Prisma 7 · PostgreSQL · Tailwind CSS 4 · Playwright · Vercel**

---

### How I work

**I don't publish numbers I can't source.**
Every result comes from the Liquipedia API — credited under CC BY-SA, as the
licence requires — or is computed from matches already recorded. Where the
source holds nothing, the page says so instead of filling the gap. A blank
column reads as missing data; an invented one reads as a fact. The playoff
bracket follows the same rule: if the round data does not verify, no bracket is
drawn, because a guessed round is an invented claim about a real team.

**I respect other people's systems.**
The importer waits 2.6 seconds between requests because that is what the
source's terms ask for. HLTV is not used: it has no public API, and every
"HLTV API" package is a scraper that works against their terms. Player
photographs come only from freely licensed sources, with the photographer named
on the player's page and listed in full on a dedicated credits page — that is a
condition of the licence, not a courtesy.

**"No error" is not the same as "correct".**
The three worst bugs I have shipped all ran without throwing anything:

- a **timezone** bug that formatted times in the server's zone, so a match
  starting at 13:00 in Baku was published as 09:00 — four hours early, for
  everyone, silently;
- a **self-feeding duplicate** bug where name matching rejected a team as
  ambiguous, so the importer could not find it and created a new one on every
  pass — one organisation had grown to 42 rows;
- a **contrast** bug that left every game badge below the WCAG threshold in
  light mode (one measured 1.90:1 against a required 4.5:1), invisible to the
  automated checker because it skips gradient backgrounds.

Each is now held down by a test. That lesson shaped how I work more than any
feature I have built.

---

### What I'm looking for

A master's degree in computer science in Switzerland, starting in 2027.

Building ArenaHub taught me which problems I actually enjoy, and they were not
the ones I expected. The interesting part was never adding another page — it was
everything around getting the data right: reading a source that was never meant
to be machine-read, deciding what may and may not be inferred from it, and
keeping a system honest as it changes. I would like to study that properly —
data-intensive and distributed systems, and the correctness questions that come
with them.

<!-- REVIEW-REQUIRED
     The paragraph above is drawn from this codebase, not invented — but it is
     still a reading of you, not a sentence you wrote. Read it once and decide
     whether you recognise yourself in it; rewrite it in your own words if not.
     The year 2027 is an assumption. Delete this whole comment when you are
     happy with it: the setup script refuses to publish while it is here. -->

---

### Contact

**emil.tahirov24@gmail.com**
