# QuantViz Strategy Simulator

## Current State

The app has a Divergence-Decay Exit Protocol implemented but NOT as a proper state machine. The current code:
- Uses a ref (`alphaPeakRef`) to track peak, no explicit `system_state` variable
- Rule Alpha only fires once (first peak locked), but does NOT allow the peak to be updated if RSI/MFI push higher WITHIN the TRACKING state
- Rule Beta uses `prev` (the prior DayData row) for ROC21 comparison, which works but is not an explicit `prev_roc21` memory variable
- AVOID state is computed ad-hoc rather than as a persistent machine state
- The backtest.ts loop has similar issues
- Entry is always auto-taken on day 0 regardless of Rule Zero

## Requested Changes (Diff)

### Add
- Explicit `system_state: "AVOID" | "TRACKING"` variable in both `backtest.ts` and `App.tsx`
- `prev_roc21` memory variable updated at end of each day
- `peak_price`, `peak_rsi`, `peak_macd` memory variables
- Step B logic: when in AVOID, check if RSI > T_RSI_upper OR MFI > T_MFI_upper before any other rules
- Step C logic: when entering TRACKING (or already TRACKING), UPDATE peak if current RSI or MFI is pushing higher (i.e., current RSI > peak_rsi OR current MFI is better)
- Rule Zero blocks initial auto-entry: first entry only happens once Rule Alpha fires (system_state transitions to TRACKING)

### Modify
- `runBacktest` in `backtest.ts`: full rewrite as sequential state machine loop following steps A→F
- `evaluateDay` in `App.tsx`: full rewrite as sequential state machine following steps A→F
- `ExitModulesTab`: display `system_state` (AVOID/TRACKING/EXIT) driven by the prop, not recomputed
- Rolling threshold window changed from 50-bar to 20-bar per user spec ("last 20 days")

### Remove
- All ad-hoc `alphaPeakRef === null` first-peak locking logic
- The `void (...)` AVOID computation in backtest.ts that does nothing

## Implementation Plan

1. Rewrite `backtest.ts` `runBacktest` as a strict state machine with `system_state`, `peak_price/rsi/macd`, `prev_roc21` variables following Steps A-F exactly
2. Rewrite `evaluateDay` in `App.tsx` as a strict state machine with the same variables stored in refs
3. Add `systemState` ref + state (`"AVOID" | "TRACKING"`) to App.tsx, pass to ExitModulesTab
4. Update `ExitModulesTab` to accept and display `systemState` prop instead of recomputing it
5. Validate and deploy
