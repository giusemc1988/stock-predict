"""Atlas scanner candidates from TradingView's free screener (library tradingview-screener, no key).

One call returns today's real, liquid movers: price >= $5, market cap >= $300M, relative volume >= 1.5,
NASDAQ/NYSE/AMEX stocks only (no OTC), average volume >= 500k, up at least 1% today. The Worker reads the
JSON from the `scanner-data` branch and falls back to its own Yahoo movers when the file is missing or stale.
Writes scanner-data/candidates.json. Paper trading only; nothing here places an order.
"""
import json
import sys
import time

from tradingview_screener import Query, col

OUT = sys.argv[1] if len(sys.argv) > 1 else 'candidates.json'

q = (
    Query()
    .select('name', 'close', 'market_cap_basic', 'relative_volume_10d_calc', 'change', 'exchange')
    .where(
        col('close') >= 5,
        col('market_cap_basic') >= 300e6,
        col('relative_volume_10d_calc') >= 1.5,
        col('exchange').isin(['NASDAQ', 'NYSE', 'AMEX']),
        col('type') == 'stock',
        col('average_volume_30d_calc') >= 500_000,
        col('change') >= 1,
    )
    .order_by('relative_volume_10d_calc', ascending=False)
    .limit(40)
)
total, df = q.get_scanner_data()
rows = [
    {
        'symbol': r['name'],
        'price': round(float(r['close']), 2),
        'marketCap': int(r['market_cap_basic']),
        'rvol': round(float(r['relative_volume_10d_calc']), 2),
        'changePct': round(float(r['change']), 2),
        'exchange': r['exchange'],
    }
    for _, r in df.iterrows()
]
with open(OUT, 'w') as f:
    json.dump({'source': 'tradingview-screener', 'generatedAt': int(time.time() * 1000), 'matched': int(total), 'rows': rows}, f, indent=1)
print(f'{len(rows)} candidates of {total} matches')
