# Atlas lessons (losing trades)

Updated by the daily health check, only on days with a losing trade.
XUI = bad luck, process correct. QUY TRINH = process problem.
Tier: Log (1st) / Watch (2nd) / Propose (3+).
Evidence window is the last 8 events of atlas-status, so busy days are only partly covered.
Practice book is $100k from 2026-11-04 (was $10k), so $ amounts before and after are not comparable.
No entry for 2026-11-04: that day's check was lost to an API error.

## Causes

| Cause | Type | Count | Last seen | Tier |
|---|---|---|---|---|
| Hit stop (normal stop-out) | XUI | 3 | 2026-11-02 | Log |
| Loss on end-of-day close | XUI | 6 | 2026-11-05 | Log |
| No move in 12 bars (time exit) | XUI | 3 | 2026-11-05 | Log |
| Entry on very low volume (0.1x normal) | QUY TRINH (weak evidence) | 1 | 2026-10-30 | Log |

Older trades (OLN, VLTO, AZN from 2026-10-30) are folded into the counts above.

## Recent losing trades (newest first)

- 2026-11-05 ADMA -$6.85 (-2.79%): closed before market close, larger than usual. XUI (entry data not in window)
- 2026-11-05 APP -$6.59 (-1.92%): no move in 12 bars. XUI
- 2026-11-05 VRDN -$0.24 (-0.10%): no move in 12 bars. XUI
- 2026-11-03 AMZN -$1.31 (-0.53%): closed before market close. XUI
- 2026-11-03 CADL -$0.38 (-0.38%): closed before market close. XUI
- 2026-11-02 SAM -$2.95 (-0.60%): closed before market close. XUI
- 2026-11-02 TEM -$0.22 (-0.23%): closed before market close. XUI
- 2026-11-02 MHK -$1.62 (-0.81%): no move in 12 bars. XUI
- 2026-11-02 SRAD -$10.02 (-2.26%): hit stop. XUI
- 2026-11-02 CPRI -$3.42 (-1.72%): hit stop. XUI
