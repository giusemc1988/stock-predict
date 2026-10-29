# Kronos shadow test

Kronos-small forecasts the next daily candles for Atlas's symbols after each US close. It is only logged and graded here; it never touches Atlas or any order (paper or real).

Updated 2026-10-29T01:14Z · 32 forecasts logged · verdict needs 20+ graded per horizon.

| Horizon | Graded | Kronos direction right | Always-up baseline | Kronos avg miss | No-change avg miss | Verdict |
|---|---|---|---|---|---|---|
| 1 day | 24 | 75% | 54% | 1.19% | 1.08% | no edge |
| 5 day | 2 | 50% | 0% | 4.39% | 1.12% | waiting |

## Latest forecasts

| Symbol | As of | Close | +1 day | +5 days |
|---|---|---|---|---|
| SPY | 2026-10-27 | 769.66 | 766.81 (-0.4%) | 759.07 (-1.4%) |
| AAPL | 2026-10-27 | 347.10 | 341.31 (-1.7%) | 311.37 (-10.3%) |
| NVDA | 2026-10-27 | 217.94 | 217.42 (-0.2%) | 218.85 (+0.4%) |
| TSLA | 2026-10-27 | 407.46 | 404.89 (-0.6%) | 412.81 (+1.3%) |
| MSFT | 2026-10-27 | 531.33 | 536.40 (+1.0%) | 545.57 (+2.7%) |
| AMZN | 2026-10-27 | 253.10 | 251.71 (-0.6%) | 248.02 (-2.0%) |
| BTC-USD | 2026-10-27 | 80,805.08 | 78,881.66 (-2.4%) | 78,708.70 (-2.6%) |
| ETH-USD | 2026-10-27 | 2,347.73 | 2,380.71 (+1.4%) | 2,433.67 (+3.7%) |

Pass rule: direction right at least 3 points above the better of 50% and always-up, and average miss below 98% of the no-change guess. Not financial advice.
