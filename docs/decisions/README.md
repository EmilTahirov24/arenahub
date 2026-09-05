# Decision records

Short notes on the decisions that shaped this project. Each one states what the
situation was, what was decided, and what following that decision costs.

They exist because the reasoning is the part worth keeping. Features can be read
off the site; the arguments behind them cannot, and they are what a reader has
to reconstruct otherwise.

Every claim here is either linked to the code that implements it or to a
measurement recorded when the decision was made. Where a number appears, it was
measured, not estimated.

| # | Decision |
|---|---|
| [0001](0001-liquipedia-not-hltv.md) | Liquipedia as the data source, not HLTV |
| [0002](0002-ratings-are-replayed.md) | Ratings are replayed from history, never adjusted in place |
| [0003](0003-brackets-are-verified.md) | A bracket is drawn only where the data verifies it |
| [0004](0004-player-photographs.md) | Player photographs come only from freely licensed sources |
| [0005](0005-one-time-zone.md) | Every date goes through one formatter, pinned to one zone |
| [0006](0006-contrast-is-computed.md) | Text contrast is computed, not written down |

A theme runs through all six: **the system is allowed to show less, and never
allowed to show something it cannot support.** An empty column is missing data;
a filled one is a claim.
