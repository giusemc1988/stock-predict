"""Kronos shadow test: forecast, never trade.

Each run (after the US close) does two things:
  1. grades every earlier forecast whose day has arrived, against the real close and two
     baselines: "no change" (tomorrow = today) and "always up" (for direction);
  2. asks Kronos-small for the next 5 daily candles of each symbol and logs the forecast.

Nothing here reaches Atlas or places an order. The log is public/kronos-shadow.json and the
readable report docs/kronos-shadow.md. Kronos only earns a place in Atlas's filters if, after
at least MIN_GRADED graded forecasts per horizon, it beats both baselines (see verdict()).

  python tools/kronos/shadow.py --kronos <path to a Kronos checkout> [--dry-run]
"""
import argparse
import json
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

# Atlas's stocks plus the two big coins; Yahoo symbols
SYMBOLS = ['SPY', 'AAPL', 'NVDA', 'TSLA', 'MSFT', 'AMZN', 'BTC-USD', 'ETH-USD']
HORIZONS = [1, 5]          # trading bars ahead
CONTEXT = 400              # bars fed to the model (Kronos-small reads at most 512)
SAMPLES = 5                # forecasts averaged per symbol, to tame sampling noise
MIN_GRADED = 20            # graded forecasts per horizon before any verdict
EDGE = 0.03                # direction hit rate must beat the better baseline by 3 points
LOG = Path('public/kronos-shadow.json')
REPORT = Path('docs/kronos-shadow.md')


def bars(symbol: str) -> pd.DataFrame:
    """Daily OHLCV from Yahoo's public chart API (no key). The last bar is dropped while its day is still open."""
    url = f'https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?range=3y&interval=1d'
    req = urllib.request.Request(url, headers={'user-agent': 'Mozilla/5.0 (kronos-shadow; +https://github.com/giusemc1988/stock-predict)'})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                res = json.load(r)['chart']['result'][0]
            break
        except Exception:
            if attempt == 2:
                raise
            time.sleep(3 * (attempt + 1))
    q = res['indicators']['quote'][0]
    df = pd.DataFrame({
        'timestamps': pd.to_datetime(res['timestamp'], unit='s', utc=True).tz_convert(None).normalize(),
        'open': q['open'], 'high': q['high'], 'low': q['low'], 'close': q['close'], 'volume': q['volume'],
    }).dropna(subset=['open', 'high', 'low', 'close'])
    df['volume'] = df['volume'].fillna(0.0)
    df['amount'] = df['volume'] * df[['open', 'high', 'low', 'close']].mean(axis=1)
    df = df.drop_duplicates('timestamps', keep='last').reset_index(drop=True)
    period = res['meta'].get('currentTradingPeriod', {}).get('regular', {})
    if period and res['timestamp'][-1] >= period.get('start', 0) and time.time() < period.get('end', 0):
        df = df.iloc[:-1]  # the bar of the session still trading is not final yet
    return df


def future_days(last: pd.Timestamp, n: int, crypto: bool) -> pd.Series:
    days = pd.date_range(last + pd.Timedelta(days=1), periods=n, freq='D') if crypto else pd.bdate_range(last + pd.Timedelta(days=1), periods=n)
    return pd.Series(days)


def grade(log: dict, closes: dict[str, pd.DataFrame]) -> None:
    """Fill in the actual close for forecasts whose target bar now exists."""
    for f in log['forecasts']:
        df = closes.get(f['symbol'])
        if df is None:
            continue
        idx = df.index[df['timestamps'] == pd.Timestamp(f['asOf'])]
        if not len(idx):
            continue
        for h in HORIZONS:
            key = str(h)
            if key in f['actual']:
                continue
            j = idx[0] + h
            if j < len(df):
                f['actual'][key] = round(float(df['close'].iloc[j]), 6)


def score(log: dict) -> dict:
    out = {}
    for h in HORIZONS:
        rows = [f for f in log['forecasts'] if str(h) in f['actual']]
        n = len(rows)
        if not n:
            out[str(h)] = {'graded': 0}
            continue
        last = np.array([f['lastClose'] for f in rows])
        pred = np.array([f['pred'][str(h)] for f in rows])
        act = np.array([f['actual'][str(h)] for f in rows])
        moved = act != last
        hit = float(np.mean(np.sign(pred - last)[moved] == np.sign(act - last)[moved])) if moved.any() else 0.0
        up = float(np.mean(act[moved] > last[moved])) if moved.any() else 0.0
        mae_k = float(np.mean(np.abs(pred - act) / last))
        mae_n = float(np.mean(np.abs(act - last) / last))
        out[str(h)] = {
            'graded': n,
            'hitRate': round(hit, 4),          # Kronos direction right
            'alwaysUp': round(up, 4),           # baseline: always say up
            'maePct': round(mae_k * 100, 3),    # Kronos average miss, % of price
            'naiveMaePct': round(mae_n * 100, 3),  # baseline: tomorrow = today
            'verdict': verdict(n, hit, up, mae_k, mae_n),
        }
    return out


def verdict(n: int, hit: float, up: float, mae_k: float, mae_n: float) -> str:
    if n < MIN_GRADED:
        return 'waiting'
    if hit >= max(0.5, up) + EDGE and mae_k < mae_n * 0.98:
        return 'beats baselines'
    return 'no edge'


def forecast(kronos_dir: str, frames: dict[str, pd.DataFrame], as_of_run: str) -> list[dict]:
    sys.path.insert(0, kronos_dir)
    import torch
    from model import Kronos, KronosPredictor, KronosTokenizer

    torch.manual_seed(8)
    tok = KronosTokenizer.from_pretrained('NeoQuasar/Kronos-Tokenizer-base')
    model = Kronos.from_pretrained('NeoQuasar/Kronos-small')
    pred = KronosPredictor(model, tok, device='cpu', max_context=512)
    out = []
    for sym, df in frames.items():
        x = df.tail(CONTEXT).reset_index(drop=True)
        y_ts = future_days(x['timestamps'].iloc[-1], max(HORIZONS), sym.endswith('-USD'))
        p = pred.predict(df=x[['open', 'high', 'low', 'close', 'volume', 'amount']], x_timestamp=x['timestamps'], y_timestamp=y_ts,
                         pred_len=max(HORIZONS), T=1.0, top_p=0.9, sample_count=SAMPLES, verbose=False)
        out.append({
            'symbol': sym,
            'asOf': x['timestamps'].iloc[-1].strftime('%Y-%m-%d'),
            'lastClose': round(float(x['close'].iloc[-1]), 6),
            'pred': {str(h): round(float(p['close'].iloc[h - 1]), 6) for h in HORIZONS},
            # every predicted close, so the Hub can draw the whole forecast line
            'path': [round(float(c), 6) for c in p['close'].iloc[:max(HORIZONS)]],
            'actual': {},
            'run': as_of_run,
        })
        print(f"{sym}: last {x['close'].iloc[-1]:.2f} -> " + ', '.join(f"+{h}d {p['close'].iloc[h - 1]:.2f}" for h in HORIZONS))
    return out


def report(log: dict) -> str:
    s = log['score']
    lines = [
        '# Kronos shadow test',
        '',
        'Kronos-small forecasts the next daily candles for Atlas\'s symbols after each US close. '
        'It is only logged and graded here; it never touches Atlas or any order (paper or real).',
        '',
        f"Updated {log['updated']} · {len(log['forecasts'])} forecasts logged · verdict needs {MIN_GRADED}+ graded per horizon.",
        '',
        '| Horizon | Graded | Kronos direction right | Always-up baseline | Kronos avg miss | No-change avg miss | Verdict |',
        '|---|---|---|---|---|---|---|',
    ]
    for h in HORIZONS:
        r = s.get(str(h), {})
        if not r.get('graded'):
            lines.append(f'| {h} day | 0 | – | – | – | – | waiting |')
            continue
        lines.append(f"| {h} day | {r['graded']} | {r['hitRate']:.0%} | {r['alwaysUp']:.0%} | {r['maePct']:.2f}% | {r['naiveMaePct']:.2f}% | {r['verdict']} |")
    lines += ['', '## Latest forecasts', '', '| Symbol | As of | Close | +1 day | +5 days |', '|---|---|---|---|---|']
    latest = {}
    for f in log['forecasts']:
        latest[f['symbol']] = f
    for f in latest.values():
        c = f['lastClose']
        p1, p5 = f['pred']['1'], f['pred']['5']
        lines.append(f"| {f['symbol']} | {f['asOf']} | {c:,.2f} | {p1:,.2f} ({(p1 / c - 1):+.1%}) | {p5:,.2f} ({(p5 / c - 1):+.1%}) |")
    lines += ['', 'Pass rule: direction right at least 3 points above the better of 50% and always-up, '
              'and average miss below 98% of the no-change guess. Not financial advice.', '']
    return '\n'.join(lines)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--kronos', required=True, help='path to a Kronos checkout (its model/ package)')
    ap.add_argument('--dry-run', action='store_true', help='print, do not write files')
    a = ap.parse_args()

    log = json.loads(LOG.read_text()) if LOG.exists() else {'forecasts': []}
    frames = {}
    for sym in SYMBOLS:
        try:
            frames[sym] = bars(sym)
        except Exception as e:
            print(f'{sym}: no data ({e})')
    if not frames:
        print('No market data at all; nothing done.')
        return 1
    grade(log, frames)
    run = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%MZ')
    seen = {(f['symbol'], f['asOf']) for f in log['forecasts']}
    fresh = {k: v for k, v in frames.items() if (k, v['timestamps'].iloc[-1].strftime('%Y-%m-%d')) not in seen}
    if fresh:
        log['forecasts'] += forecast(a.kronos, fresh, run)
    else:
        print('Every symbol already has a forecast for its latest bar.')
    log['updated'] = run
    # the last 30 closes per symbol, for the price line the Hub draws before the forecast
    log['recent'] = {k: [round(float(c), 6) for c in v['close'].tail(30)] for k, v in frames.items()}
    log['score'] = score(log)
    print(json.dumps(log['score'], indent=1))
    if not a.dry_run:
        LOG.parent.mkdir(parents=True, exist_ok=True)
        LOG.write_text(json.dumps(log, indent=1) + '\n')
        REPORT.parent.mkdir(parents=True, exist_ok=True)
        REPORT.write_text(report(log))
    return 0


if __name__ == '__main__':
    sys.exit(main())
