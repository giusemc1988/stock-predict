# Atlas sleeves: kill and keep rules (set 2026-11-12, before the data)

Rules are fixed in advance so a lucky or unlucky streak cannot move the goalposts. All sleeves are paper only. Numbers come from atlas-status and `ledger/LEDGER.md` on the `backups` branch.

| Sleeve | What | Keep if | Turn off if |
|---|---|---|---|
| Core | Live practice trades with the volume 1.5x + stop 2% filters (v2.0.27) | PF >= 1.2 after 50 trades with the filters on | PF < 0.9 after 50 trades: go back to the ledger, do not add rules |
| L1 | Reversal when VIX >= its 252-day median | >= 30 closed trades and PF >= 1.2 | >= 30 trades and PF < 1.0 |
| L2 | Hold intraday winners overnight | >= 30 trades and delta vs closing > 0 | >= 30 trades and delta <= 0 |
| L3 | ETF trend core | Beats SPY drawdown after 3 months | Worse return AND drawdown than SPY after 3 months |
| L4 | Overnight winners (high-vol names excluded) | Average > 0 after 30 trades | Average < 0 after 30 trades. At 16 trades live it is -0.39% per trade: expect to retire it. Record-only, so it costs nothing to wait |

No new idea rounds in the replay labs (400+ ideas, none passed). A new idea may enter only as a shadow tag on live trades and goes through the same rows above.

## Go-live gate (paper to real money)
Printed in every ledger. Real money stays off unless ALL pass: at least 200 trades, PF >= 1.3, 5% bootstrap lower bound of PF above 1, at least 90 days, max drawdown under $3,000. Rules changed since a trade was made make older trades weaker evidence: re-baseline after any rule change. If the Core sleeve cannot pass, the realistic plan is a low-cost ETF trend sleeve for drawdown control, not beating the market.
