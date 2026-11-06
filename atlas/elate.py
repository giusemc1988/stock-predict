"""E-LATE: are Atlas day-trade entries at/after 15:30 ET worse? Read-only on a practice.json backup."""
import datetime as dt
import json
import random
import statistics
import sys

sys.stdout.reconfigure(encoding="utf-8")
CUT = dt.time(15, 30)


def nth_sunday(y, m, n):
    d = dt.date(y, m, 1)
    d += dt.timedelta(days=(6 - d.weekday()) % 7)
    return d + dt.timedelta(weeks=n - 1)


def to_et(ms):
    u = dt.datetime.fromtimestamp(ms / 1000, dt.timezone.utc).replace(tzinfo=None)
    y = u.year
    start = dt.datetime.combine(nth_sunday(y, 3, 2), dt.time(7))   # 2:00 EST = 07:00 UTC
    end = dt.datetime.combine(nth_sunday(y, 11, 1), dt.time(6))    # 2:00 EDT = 06:00 UTC
    return u - dt.timedelta(hours=4 if start <= u < end else 5)


def boot_ci(xs, n=10000, seed=19):
    r = random.Random(seed)
    ms = sorted(statistics.fmean(r.choices(xs, k=len(xs))) for _ in range(n))
    return ms[int(0.025 * n)], ms[int(0.975 * n)]


def pf(xs):
    g = sum(x for x in xs if x > 0)
    l = -sum(x for x in xs if x < 0)
    return g / l if l else float("inf")


def summary(name, ts):
    r = [t["retPct"] for t in ts]
    p = [t["pnl"] for t in ts]
    lo, hi = boot_ci(r) if len(r) > 1 else (float("nan"), float("nan"))
    byt = sum(t["exitReason"] in ("close", "time") for t in ts)
    reasons = {}
    for t in ts:
        reasons[t["exitReason"]] = reasons.get(t["exitReason"], 0) + 1
    print(f"{name}: n={len(ts)} mean={statistics.fmean(r):+.3f}%/trade 95%CI[{lo:+.3f},{hi:+.3f}] "
          f"median={statistics.median(r):+.3f}% WR={sum(x > 0 for x in r) / len(r) * 100:.1f}% "
          f"PF={pf(p):.2f} pnl=${sum(p):+.2f} timeExit={byt / len(ts) * 100:.1f}% reasons={reasons}")
    return statistics.fmean(r), hi, byt / len(ts)


s = json.loads(json.load(open(sys.argv[1], encoding="utf-8"))["state"])
T = [t for t in s["trades"] if t.get("kind") == "day" and "retPct" in t]
print(f"closed trades total {len(s['trades'])}, day trades {len(T)}, kinds "
      f"{sorted({t.get('kind') for t in s['trades']}, key=str)}")
for t in T:
    t["_et"] = to_et(t["openedAt"])
print(f"date range {min(t['_et'] for t in T):%Y-%m-%d} to {max(t['_et'] for t in T):%Y-%m-%d}")

late = [t for t in T if t["_et"].time() >= CUT]
early = [t for t in T if t["_et"].time() < CUT]
ml, hil, tl = summary("LATE  (>=15:30 ET)", late)
me, _, _ = summary("EARLY (<15:30 ET) ", early)
summary("ALL day trades     ", T)

print("\nBy entry hour (ET):")
hours = {}
for t in T:
    hours.setdefault(t["_et"].hour, []).append(t)
for h in sorted(hours):
    summary(f"  {h:02d}:00", hours[h])

checks = [("n(LATE) >= 30", len(late) >= 30),
          ("LATE mean < 0 and CI upper < 0", ml < 0 and hil < 0),
          (">= 70% of LATE exit by time", tl >= 0.70),
          ("LATE mean < EARLY mean", ml < me)]
print()
for c, ok in checks:
    print(("PASS " if ok else "FAIL ") + c)
print("E-LATE VERDICT:", "PASS" if all(ok for _, ok in checks) else "FAIL")
