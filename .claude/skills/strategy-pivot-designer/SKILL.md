---
name: strategy-pivot-designer
description: Detect backtest iteration stagnation and generate structurally different strategy pivot proposals when parameter tuning reaches a local optimum.
---

<!-- Source: github.com/tradermonty/claude-trading-skills @ c03eafba52ef4821fbabe55479eb0ec796be53c0 | License: MIT | vetted 2026-11-01 -->
<!-- Local edit: upstream scripts removed (guidance only); script references stripped. -->

# Strategy Pivot Designer

## Overview

Detect when a strategy's backtest iteration loop has stalled and propose structurally different strategy architectures, redesigning the strategy skeleton rather than tweaking parameters. Guidance only: apply the references manually.

## When to Use

- Backtest scores have plateaued despite multiple refinement iterations.
- A strategy shows signs of overfitting (high in-sample, low robustness).
- Transaction costs defeat the strategy's thin edge.
- Tail risk or drawdown exceeds acceptable thresholds.
- You want to explore fundamentally different strategy architectures for the same market hypothesis.

## Workflow

1. Keep a log of each backtest evaluation (scores, changes made) per strategy iteration.
2. Check the log against the triggers in `references/stagnation_triggers.md` (plateau, overfitting, cost defeat, insufficient profit factor, tail risk). A no-loss profit factor is not cost defeat; an undefined or overflowed ratio requires review of the metrics first.
3. If stagnation is confirmed, generate pivot proposals using the three techniques in `references/pivot_techniques.md`: assumption inversion, archetype switch, objective reframe. Archetypes are in `references/strategy_archetypes.md`.
4. Rank proposals by quality potential and novelty; record them using `references/pivot_proposal_schema.md` and `assets/pivot_report_template.md`.
5. Feed the selected pivot back into the backtest-expert skill for the next iteration.

## Resources

- `references/stagnation_triggers.md`
- `references/strategy_archetypes.md`
- `references/pivot_techniques.md`
- `references/pivot_proposal_schema.md`
- `assets/pivot_report_template.md`
