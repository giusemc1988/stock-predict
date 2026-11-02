"""Checks for the symbol list (no Kronos, no network): python tools/kronos/test_shadow.py"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import shadow

DAY = 86_400_000
NOW = 100 * DAY
state = {
    'open': [{'symbol': 'CVNA'}, {'symbol': 'KORUB/USDT'}],
    'trades': [
        {'symbol': 'OLD', 'closedAt': NOW - 9 * DAY},
        {'symbol': 'AAPL', 'closedAt': NOW - DAY},      # already in the built-in list
        {'symbol': 'NEW1', 'closedAt': NOW - 2 * DAY},  # not a plain ticker (digit)
        {'symbol': 'ZZ', 'closedAt': NOW - 3 * DAY},
        {'symbol': 'AA', 'closedAt': NOW - 2 * DAY},
    ],
}
out = shadow.atlas_symbols(state, NOW)
assert out[:len(shadow.BASE_SYMBOLS)] == shadow.BASE_SYMBOLS
assert out[len(shadow.BASE_SYMBOLS):] == ['CVNA', 'AA', 'ZZ'], out  # open first, then newest closed; no coin pair, no old trade, no digit
assert len(shadow.atlas_symbols({'open': [{'symbol': c} for c in 'ABCDEFGHIJKLMNOP']}, NOW)) == shadow.MAX_SYMBOLS
assert shadow.atlas_symbols({}, NOW) == shadow.BASE_SYMBOLS
assert shadow.load_atlas_state(None) == {} and shadow.load_atlas_state('/no/such/file') == {}
print('kronos list ok')
