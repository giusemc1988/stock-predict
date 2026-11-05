"""Atlas Leaders, step 1: fetch the whole liquid US market from TradingView's free screener (no key).

One call returns every NASDAQ/NYSE/AMEX stock with price >= $5 and market cap >= $300M (about 3,300 names) with the
columns the ranking needs. The ranking itself lives in src/lib/leaders.ts (scripts/leaders.ts writes
public/leaders.json). Paper only; nothing here places an order.
"""
import json
import sys

from tradingview_screener import Query, col

OUT = sys.argv[1] if len(sys.argv) > 1 else 'leaders-raw.json'


def f(x):
    try:
        v = float(x)
    except (TypeError, ValueError):
        return None
    return v if v == v else None  # NaN -> None


q = (
    Query()
    .select(
        'name', 'close', 'market_cap_basic', 'average_volume_30d_calc', 'sector',
        'Perf.1M', 'Perf.3M', 'Perf.6M', 'Perf.Y', 'SMA50', 'SMA150', 'SMA200',
        'price_52_week_high', 'price_52_week_low', 'relative_volume_10d_calc',
    )
    .where(
        col('close') >= 5,
        col('market_cap_basic') >= 300e6,
        col('exchange').isin(['NASDAQ', 'NYSE', 'AMEX']),
        col('type') == 'stock',
    )
    .limit(10000)
)
total, df = q.get_scanner_data()
rows = [
    {
        'symbol': r['name'], 'close': f(r['close']), 'marketCap': f(r['market_cap_basic']), 'avgVol30': f(r['average_volume_30d_calc']),
        'sector': r['sector'] if isinstance(r['sector'], str) else None,
        'p1m': f(r['Perf.1M']), 'p3m': f(r['Perf.3M']), 'p6m': f(r['Perf.6M']), 'py': f(r['Perf.Y']),
        'sma50': f(r['SMA50']), 'sma150': f(r['SMA150']), 'sma200': f(r['SMA200']),
        'high52': f(r['price_52_week_high']), 'low52': f(r['price_52_week_low']), 'rvol': f(r['relative_volume_10d_calc']),
    }
    for _, r in df.iterrows()
]
if len(rows) < 1500:
    sys.exit(f'only {len(rows)} rows (matched {total}): the feed looks broken, keeping the old file')
with open(OUT, 'w') as fh:
    json.dump(rows, fh)
print(f'{len(rows)} rows of {total} matches')
