# Phase 1: Local Explain Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build local AI explain + Q&A + voice (llama3.2 only) for Phase 1 v1.11.0. Every ability behind toggle, default OFF.

**Version note:** main is v1.10.5 (PR #34). Phase 1 ships as v1.11.0 (next available).

**Architecture:** Manager routes explain/Q&A requests to llama3.2 on localhost:5173. Grounding: decision log (7 days) + rules + risk gates. Walk-forward validator stays as decision-maker.

**Tech Stack:** TypeScript/React, Ollama (llama3.2), browser speechSynthesis, localStorage

**Spec:** /mnt/project-files/plans/2026-10-16-local-ai-expansion-strategy.md (Part 2, Phase 1)

## Global Constraints

- Model: llama3.2 only (default), changeable in Settings
- Runs on localhost:5173 (browser), never Worker
- No secrets in prompts (rule names only, not key names)
- Grounding packet < 2k tokens (prevent hallucination)
- Walk-forward validator is decision-maker, not AI
- Every toggle default OFF
- Paper trading only (enforced by existing rules)

## Review Focus

1. **Hallucination on unknown symbols** — llama3.2 may invent facts about symbols not in journal or watchlist. Grounding must whitelist only known symbols.
2. **Stale decision log** — localStorage decision log may be >7 days old or empty on new device. UI must handle gracefully (show "loading" or "no data yet").
3. **Token budget** — Grounding packet must fit in ~2k tokens. If rule set + journal > 2k, tests should verify truncation without losing recent trades.
4. **Voice latency** — speechSynthesis is blocking; long explanations freeze UI. Tests should verify explanation < 500 tokens to keep narration < 10s.
5. **Model fallback** — If llama3.2 not running, app should offer gemma4:e2b or fallback to rule text. Tests should verify graceful degradation.

---

## Task 1: Add Local Model Settings + Grounding Packet

**Files:**
- Modify: `src/lib/aiRules.ts:1-200` (add localModelName setting, localExplain/QA/Voice toggles)
- Create: `src/lib/localJarvis.ts` (grounding packet builder)
- Create: `src/lib/localJarvis.test.ts` (test grounding)
- Modify: `src/data/releases.ts` (v1.11.0 What's new EN+VI)

**Interfaces:**
- Produces: `buildGroundingPacket(journal, rules, trades, maxTokens): { prompt: string; tokens: number }`
- Produces: AiRules.localModelName (default "llama3.2"), AiRules.localExplain/QA/VoiceNarrator (all false)

- [ ] **Step 1: Write test for grounding packet builder**

```typescript
// src/lib/localJarvis.test.ts
describe('buildGroundingPacket', () => {
  it('includes recent trades, active rules, risk limits, max 2000 tokens', () => {
    const packet = buildGroundingPacket(
      { trades: [{ symbol: 'AAPL', side: 'BUY', ... }], ...journal },
      { rules: [{ name: 'RSI<30', on: true, ... }], ...aiRules },
      7, // days
      2000 // maxTokens
    )
    expect(packet.tokens).toBeLessThan(2000)
    expect(packet.prompt).toContain('AAPL')
    expect(packet.prompt).toContain('RSI<30')
  })
  it('truncates old trades if exceeding token limit', () => {
    const packet = buildGroundingPacket(
      { trades: [...Array(100).fill(trade)] }, // 100 trades
      rules, 7, 2000
    )
    expect(packet.tokens).toBeLessThan(2000)
    // Most recent trades kept
    expect(packet.prompt).toContain(trades[0].symbol)
  })
  it('excludes unknown symbols (not in journal or watchlist)', () => {
    const packet = buildGroundingPacket(journal, rules, 7, 2000)
    expect(packet.prompt).not.toContain('XYZ') // never traded
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/lib/localJarvis.test.ts
# Expected: FAIL, buildGroundingPacket not defined
```

- [ ] **Step 3: Implement `buildGroundingPacket(journal, rules, daysBack, maxTokens)`**

In `src/lib/localJarvis.ts`:
- Format recent trades (last N days) with symbol, side, price, reason
- Include active rules (on: true) with win% from validator
- Include risk gates (loss limit, day trade limit, etc.)
- Tokenize using rough estimate (1 token ≈ 4 chars)
- Truncate old trades if needed
- Whitelist symbols: only include trades + watchlist symbols

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- src/lib/localJarvis.test.ts
# Expected: PASS
```

- [ ] **Step 5: Add aiRules toggles + settings**

In `src/lib/aiRules.ts` (around line 162):
```typescript
localModelName: 'llama3.2', // settable in UI
localExplain: false,         // explain signals
localQA: false,              // answer fixed Q&A
localVoiceNarrator: false,   // read aloud
```

- [ ] **Step 6: Update releases.ts with v1.11.0 entry**

```typescript
// src/data/releases.ts
{
  version: '1.11.0',
  date: '2026-10-16',
  en: 'Local AI explain: Jarvis explains your trades using llama3.2 on your device. No cloud keys needed. Toggle: Settings > AI rules > "Local explain".',
  vi: 'AI cục bộ giải thích: Jarvis giải thích giao dịch của bạn dùng llama3.2 trên máy. Không cần key. Cài đặt > Quy tắc AI > "Giải thích cục bộ".',
},
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/aiRules.ts src/lib/localJarvis.ts src/lib/localJarvis.test.ts src/data/releases.ts
git commit -m "feat: add local model settings, grounding packet builder, v1.11.0 release note

- buildGroundingPacket formats journal, rules, risk gates (max 2k tokens)
- aiRules: localModelName, localExplain/QA/Voice toggles (default false)
- Tests verify grounding excludes unknown symbols, truncates old trades
- v1.11.0 What's new EN + VI

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KYADiAjLiAndYcUHFb2372"
```

---

## Task 2: Implement Local Explain Signal

**Files:**
- Create: `src/lib/explainSignal.ts` (call llama3.2, format answer)
- Create: `src/lib/explainSignal.test.ts` (test with mock llama response)
- Create: `src/components/ExplainPanel.tsx` (UI for explain)
- Modify: `src/components/JarvisBrief.tsx` (add explain button)

**Interfaces:**
- Consumes: `buildGroundingPacket` (from Task 1)
- Produces: `explainSignal(symbol, side, price, journal, rules): Promise<{ text: string; tokens: number }>`
- Produces: ExplainPanel component

- [ ] **Step 1: Write test for explainSignal**

```typescript
describe('explainSignal', () => {
  it('calls llama3.2 with grounding packet, returns explanation', async () => {
    const explain = await explainSignal({
      symbol: 'AAPL',
      side: 'BUY',
      price: 150,
      journal: { trades: [{ symbol: 'AAPL', ... }] },
      rules: { rules: [{ name: 'RSI<30', on: true, ... }] },
    })
    expect(explain.text).toContain('RSI') // grounded
    expect(explain.text).not.toContain('FAKE_SYMBOL')
  })
  it('returns error message if llama not running', async () => {
    // Mock Ollama as offline
    const explain = await explainSignal({ ... })
    expect(explain.text).toContain('llama3.2 not running') // graceful
  })
  it('truncates explanation to < 500 tokens', async () => {
    const explain = await explainSignal({ ... })
    expect(explain.tokens).toBeLessThan(500)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/lib/explainSignal.test.ts
# Expected: FAIL
```

- [ ] **Step 3: Implement explainSignal**

In `src/lib/explainSignal.ts`:
- Call `ollamaClient.generate()` with grounding packet + prompt
- Prompt: "Explain why this trade signal appeared. Use only the facts above."
- Catch errors (llama offline) → return fallback message
- Truncate response to < 500 tokens
- Return { text, tokens }

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- src/lib/explainSignal.test.ts
# Expected: PASS
```

- [ ] **Step 5: Create ExplainPanel component**

In `src/components/ExplainPanel.tsx`:
- Props: signal (symbol, side, price), journal, rules, onClose
- Show loading spinner while calling llama
- Display explanation text
- Show "llama3.2 not running" error if offline
- Button to copy text, button to speak (Task 3)

- [ ] **Step 6: Wire ExplainPanel into JarvisBrief**

Line 167-180 in JarvisBrief.tsx, add info button for each buy:
```typescript
<button className="bf-info-btn" onClick={() => setShowExplain(b)}>ℹ</button>
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/explainSignal.ts src/lib/explainSignal.test.ts src/components/ExplainPanel.tsx src/components/JarvisBrief.tsx
git commit -m "feat: implement local explain signal (llama3.2)

- explainSignal calls llama with grounding packet, returns < 500 tokens
- ExplainPanel component shows explanation, handles offline gracefully
- Grounded in journal + rules, no hallucination on unknown symbols
- Wired into JarvisBrief buy calls (info button)

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KYADiAjLiAndYcUHFb2372"
```

---

## Task 3: Implement Local Voice Narration

**Files:**
- Create: `src/lib/narrate.ts` (call browser speechSynthesis)
- Create: `src/lib/narrate.test.ts` (test narration)
- Modify: `src/components/ExplainPanel.tsx` (add speak button)

**Interfaces:**
- Consumes: explanation text (from Task 2)
- Produces: `narrate(text, lang, speed): Promise<void>` (uses browser speechSynthesis)

- [ ] **Step 1: Write test for narrate**

```typescript
describe('narrate', () => {
  it('calls speechSynthesis.speak with text + lang', async () => {
    // Mock speechSynthesis
    const spy = jest.spyOn(window.speechSynthesis, 'speak')
    await narrate('Hello world', 'en', 1.0)
    expect(spy).toHaveBeenCalled()
    expect(spy.mock.calls[0][0].text).toBe('Hello world')
  })
  it('handles speechSynthesis not available', async () => {
    // Mock as unavailable
    const result = await narrate('text', 'en')
    expect(result).toBe('speechSynthesis not available')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement narrate**

In `src/lib/narrate.ts`:
- Use browser speechSynthesis (already in app via speech.ts)
- Call speechSynthesis.speak() with text, lang, rate
- Catch unavailable browser → return error message
- Return Promise that resolves when utterance ends

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Add speak button to ExplainPanel**

Button: "▶ Hear explanation" → calls `narrate(explanation.text, lang, speed)`

- [ ] **Step 6: Commit**

```bash
git add src/lib/narrate.ts src/lib/narrate.test.ts src/components/ExplainPanel.tsx
git commit -m "feat: add local voice narration (browser speechSynthesis)

- narrate() uses window.speechSynthesis to read explanation aloud
- Hear button in ExplainPanel
- Handles browser compatibility gracefully

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KYADiAjLiAndYcUHFb2372"
```

---

## Task 4: Implement Fixed Q&A

**Files:**
- Create: `src/lib/fixedQA.ts` (6-8 fixed Q&A with llama grounding)
- Create: `src/lib/fixedQA.test.ts`
- Create: `src/components/QAPanel.tsx` (UI)
- Modify: `src/components/JarvisBrief.tsx` (add Ask Jarvis button)

**Interfaces:**
- Produces: `answerQA(question, journal, rules): Promise<{ answer: string }>`
- Fixed questions: "Why did you buy X?", "What's my risk?", "Can I trade today?", etc.

- [ ] **Step 1: Write test for fixed Q&A**

```typescript
describe('answerQA', () => {
  const questions = [
    'Why did you buy AAPL?',
    'What is my risk now?',
    'Can I trade today?',
    // ...
  ]
  for (const q of questions) {
    it(`answers: ${q}`, async () => {
      const answer = await answerQA(q, journal, rules)
      expect(answer.text).toBeTruthy()
      expect(answer.tokens).toBeLessThan(500)
    })
  }
})
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement answerQA**

In `src/lib/fixedQA.ts`:
- Map question → llama prompt (e.g., "Why did you buy {symbol}?" → "Based on your journal, explain why you bought {symbol}")
- Call llama with grounding packet
- Return answer < 500 tokens

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Create QAPanel component**

In `src/components/QAPanel.tsx`:
- List 6-8 fixed questions (buttons)
- Click → calls answerQA, shows answer
- Can speak answer (uses narrate from Task 3)

- [ ] **Step 6: Wire into JarvisBrief**

Add "Ask Jarvis" button → opens QAPanel

- [ ] **Step 7: Commit**

```bash
git add src/lib/fixedQA.ts src/lib/fixedQA.test.ts src/components/QAPanel.tsx src/components/JarvisBrief.tsx
git commit -m "feat: implement fixed Q&A (llama3.2 + grounding)

- answerQA maps question → llama prompt, grounded in journal + rules
- 6-8 fixed questions: why buy, risk, can trade, learn today, etc.
- QAPanel UI with speak button

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KYADiAjLiAndYcUHFb2372"
```

---

## Task 5: Add Toggles to Settings UI + Test on Localhost

**Files:**
- Modify: `src/components/SettingsPanel.tsx` (add local AI toggles)
- Create: `src/.../__tests__/phase1-integration.test.ts` (end-to-end test)

**Interfaces:**
- Consumes: all tasks above
- Displays: toggles for localExplain, localQA, localVoiceNarrator, localModelName setting

- [ ] **Step 1: Write E2E test for phase 1 features**

```typescript
describe('Phase 1: Local Explain + Q&A + Voice', () => {
  it('explain toggle OFF → explain button hidden', () => {
    render(<JarvisBrief rules={{ localExplain: false }} ... />)
    expect(screen.queryByText('ℹ')).not.toBeInTheDocument()
  })
  it('explain toggle ON → explain button visible, click opens ExplainPanel', async () => {
    render(<JarvisBrief rules={{ localExplain: true }} ... />)
    expect(screen.getByText('ℹ')).toBeInTheDocument()
    fireEvent.click(screen.getByText('ℹ'))
    await waitFor(() => expect(screen.getByText('Explain')).toBeInTheDocument())
  })
  it('QA toggle ON → Ask Jarvis button visible', () => {
    render(<JarvisBrief rules={{ localQA: true }} ... />)
    expect(screen.getByText('Ask Jarvis')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Add toggles to Settings UI**

In `src/components/SettingsPanel.tsx`:
- Section: "Local AI (runs on your device)"
- Toggle: `localExplain` "Explain my trades"
- Toggle: `localQA` "Answer questions"
- Toggle: `localVoiceNarrator` "Read aloud"
- Dropdown: `localModelName` (llama3.2, gemma4:e2b fallback)

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Verify on localhost**

```bash
cd /home/user/stock-predict
npm run dev
# Open localhost:5173
# Settings > Local AI toggles visible
# Toggle localExplain ON
# Open Brief, find info button on a buy signal
# Click → ExplainPanel opens, calls llama3.2
# Screenshot evidence
```

- [ ] **Step 6: Commit**

```bash
git add src/components/SettingsPanel.tsx src/__tests__/phase1-integration.test.ts
git commit -m "feat: add local AI toggles to Settings UI, Phase 1 E2E tests

- Settings > Local AI section with toggles for explain, Q&A, voice
- Model name dropdown (default llama3.2)
- E2E tests verify toggles control visibility of explain/QA buttons

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KYADiAjLiAndYcUHFb2372"
```

---

## Task 6: Manual Verification + Create PR

**Verification checklist:**
- [ ] Explain button visible when `localExplain` ON
- [ ] Click explain → ExplainPanel opens, calls llama3.2, shows explanation
- [ ] Speak button plays explanation (browser speechSynthesis)
- [ ] Ask Jarvis button visible when `localQA` ON
- [ ] Click Q&A question → answer appears, is grounded in journal
- [ ] Model setting changeable in Settings
- [ ] Offline gracefully: if llama not running, shows "llama3.2 not running, try turning on Ollama"
- [ ] Version bumped to v1.11.0
- [ ] What's new shows in Brief on refresh

- [ ] **Step 1: Test on localhost (npm run dev)**

```bash
cd /home/user/stock-predict
npm run dev
# Open localhost:5173
# Toggle Settings > Local AI > localExplain ON
# Open Brief, find a BUY signal
# Click info button → ExplainPanel
# Check explanation is grounded (mentions rules, risk gates)
# Click Speak → browser reads explanation
# Toggle localQA ON
# Click Ask Jarvis → QAPanel opens
# Ask "Why did you buy AAPL?" → answer appears
# Screenshot each step as evidence
```

- [ ] **Step 2: Run all tests**

```bash
npm test -- src/lib/localJarvis.test.ts src/lib/explainSignal.test.ts src/lib/narrate.test.ts src/lib/fixedQA.test.ts src/__tests__/phase1-integration.test.ts
# Expected: All PASS
```

- [ ] **Step 3: Check no merge conflicts on main**

```bash
git fetch origin main
git log --oneline origin/main..HEAD
# Verify only Phase 1 commits
```

- [ ] **Step 4: Create PR**

```bash
gh pr create --title "feat: Phase 1 Local Explain + Q&A + Voice (v1.11.0)" \
  --body "... (from template, link to plan)"
```

- [ ] **Step 5: Report evidence**

Post screenshots of:
- Settings > Local AI toggles
- ExplainPanel showing explanation
- Speaker button working
- QAPanel showing answer
- Test output (all pass)
