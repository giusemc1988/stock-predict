# Kronos shadow test

Kronos-small forecasts the next daily candles for Atlas's symbols after each US close. It is only logged and graded here; it never touches Atlas or any order (paper or real).

Updated 2026-10-31T01:03Z · 48 forecasts logged · verdict needs 20+ graded per horizon.

| Horizon | Graded | Kronos direction right | Always-up baseline | Kronos avg miss | No-change avg miss | Verdict |
|---|---|---|---|---|---|---|
| 1 day | 40 | 60% | 45% | 1.49% | 1.18% | no edge |
| 5 day | 8 | 38% | 62% | 4.36% | 1.98% | waiting |

## Latest forecasts

| Symbol | As of | Close | +1 day | +5 days |
|---|---|---|---|---|
| SPY | 2026-10-29 | 769.36 | 765.89 (-0.5%) | 757.68 (-1.5%) |
| AAPL | 2026-10-29 | 348.91 | 344.34 (-1.3%) | 306.46 (-12.2%) |
| NVDA | 2026-10-29 | 213.66 | 217.10 (+1.6%) | 219.08 (+2.5%) |
| TSLA | 2026-10-29 | 403.30 | 408.62 (+1.3%) | 403.88 (+0.1%) |
| MSFT | 2026-10-29 | 530.14 | 530.95 (+0.2%) | 527.90 (-0.4%) |
| AMZN | 2026-10-29 | 243.79 | 240.29 (-1.4%) | 241.96 (-0.8%) |
| BTC-USD | 2026-10-29 | 77,775.11 | 78,366.90 (+0.8%) | 77,632.34 (-0.2%) |
| ETH-USD | 2026-10-29 | 2,249.50 | 2,237.09 (-0.6%) | 2,320.66 (+3.2%) |

Pass rule: direction right at least 3 points above the better of 50% and always-up, and average miss below 98% of the no-change guess. Not financial advice.
