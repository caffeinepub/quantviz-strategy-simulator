# QuantViz Strategy Simulator

## Current State
The Divergence-Decay Exit Protocol is implemented with three rules (Alpha, Beta, Gamma) plus Final Execution. The algorithm starts in a position (auto-entry at first bar), monitors for Rule Alpha to fire (RSI or MFI breaches rolling 85th percentile), then watches for Beta + Gamma to align for the exit. There is no active AVOID signal — the system is simply silent until Alpha fires.

## Requested Changes (Diff)

### Add
- **Rule Zero (Capital Preservation / AVOID signal):** A new preliminary rule added before Rule Alpha.
  - Condition: `I_avoid(t) = 1 iff RSI(t) <= T_RSI_upper(t) AND MFI(t) <= T_MFI_upper(t)`
  - While Rule Zero is active (both RSI and MFI are at or below their rolling adaptive upper thresholds), the algorithm outputs a continuous AVOID signal.
  - Rule Zero is mutually exclusive with Rule Alpha: when Alpha fires, AVOID is lifted.
- **Algorithm state machine** with three explicit states:
  1. `AVOID` — Rule Zero is active (neither RSI nor MFI has breached threshold)
  2. `TRACKING` — Rule Alpha has fired at least once; system is monitoring for Beta+Gamma
  3. `EXIT` — Rule Alpha previously fired AND Beta+Gamma both true on the same day
- **AVOID banner** in ExitModulesTab: a prominent yellow/amber panel shown when state is AVOID
- **TRACKING banner** shown when state is TRACKING (Alpha has fired)
- Rule Zero card displayed as the first card in ExitModulesTab

### Modify
- `backtest.ts`: Add Rule Zero computation alongside existing Alpha/Beta/Gamma. The backtest result should include the algorithm state per bar (avoid/tracking/exit) so the execution log can reflect it.
- `App.tsx` (`evaluateDay`): Add Rule Zero check. When state is AVOID, log the AVOID status. When transitioning from AVOID → TRACKING (Alpha fires), log the state change. The existing Alpha/Beta/Gamma/Exit logic is unchanged.
- `ExitModulesTab.tsx`: Add a Rule Zero card at the top. Update the algorithm state banner to show AVOID / TRACKING / EXIT as distinct states instead of just the Final Execution banner.
- Alerts: add alert when AVOID state is entered or persists.

### Remove
- Nothing removed — all existing logic is preserved. Rule Zero is additive.

## Implementation Plan
1. Update `App.tsx` `evaluateDay`: compute Rule Zero (same dynamic thresholds as Alpha), add AVOID state to `useState`, log AVOID when both RSI and MFI are below thresholds, lift AVOID when Alpha fires.
2. Update `ExitModulesTab.tsx`: add Rule Zero card at top showing AVOID state with current vs threshold values. Update the bottom banner to show three states: AVOID (amber), TRACKING (blue/cyan), EXIT (red).
3. Update `backtest.ts`: compute Rule Zero per bar and annotate execution in the result.
4. The algorithm output matrix is now: AVOID → TRACKING → EXIT, strictly per the user's spec.
