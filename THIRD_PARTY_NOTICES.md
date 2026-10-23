# Third-party notices

Arc Analyst adapts scoring rubrics, risk-gate rules and backtest metrics from the
open-source projects below. They were rewritten in TypeScript for this app; no live
trading, exchange or VPS code was copied. Paper trading only.

| Project | Used for | File(s) here |
|---|---|---|
| [AI Trading Analyst for Claude Code](https://github.com/zubair-trabzada/ai-trading-claude) | Five-part Trade Score, weights, grade bands, risk-score position sizing | `src/lib/tradeScore.ts`, `src/lib/analyst.ts` |
| [CBT Framework](https://github.com/Trade-With-Claude/cbt-framework) | Profit factor, expectancy, losing streak, look-ahead red flags | `src/lib/metrics.ts` |
| [CloddsBot](https://github.com/alsk1992/cloddsbot) | Pre-trade check order, kill switch, volatility regime | `src/lib/riskGates.ts`, `src/lib/tradeScore.ts` |
| [MetaHarness](https://github.com/ruvnet/metaharness) | Idea only: paper by default with circuit breakers on | `src/lib/riskGates.ts` |

The first three are MIT licensed; their notices follow.

## ai-trading-claude

```
MIT License

Copyright (c) 2026 Zubair Trabzada

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## cbt-framework

```
MIT License

Copyright (c) 2026 TradeWithAI

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## cloddsbot

```
MIT License

Copyright (c) 2026 alsk1992

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```


## Media tools run in GitHub Actions

These are not part of the app bundle. The workflows download them at a pinned version when they run.

| Project | License | Used for | File(s) here |
|---|---|---|---|
| [explainroo](https://github.com/vincentsch/explainroo) | MIT | Viraltech English explainer videos; the sample `how-dns-works` comes from its examples | `.github/workflows/explainer.yml`, `viraltech/explainers/` (notice in `LICENSE-explainroo`) |
| [VieNeu-TTS](https://github.com/pnnbao97/VieNeu-TTS) | Apache-2.0 (code and v3 Turbo model) | Vietnamese and English narration on CPU | `tools/vieneu/`, `.github/actions/vieneu-voice/` |
| [Kronos](https://github.com/shiyu-coder/Kronos) | MIT (code and Kronos-small weights) | Shadow test of candle forecasts for Atlas's symbols; logged and graded only, never traded | `tools/kronos/`, `.github/workflows/kronos-shadow.yml` |
| [airplanes.live](https://airplanes.live) | free public API, non-commercial | Argus third aircraft feed after adsb.lol and adsb.fi | `argus/worker.ts`, `argus/snapshot.ts`, `agent/jarvis-agent.ts` |
