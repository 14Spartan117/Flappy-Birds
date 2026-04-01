# Dragon Flight Improvement Plan (April 1, 2026)

This plan is based on a quick codebase scan of `index.html`, `README.md`, and `tests.html`.

## Quick scan findings

1. **Single-file architecture is the biggest risk**
   - The main game file is very large (`index.html` is 2,130 lines).
   - Game logic, rendering, persistence, UI, monetization, and event wiring all live in one script block.
   - This makes regressions more likely and slows feature development.

2. **Tests exist but are disconnected from the runtime game code**
   - `tests.html` includes many pure-logic checks, which is great for speed.
   - However, the tests mostly mirror behavior with helper functions instead of importing/running against production logic.

3. **Feature breadth is strong; operational quality can improve next**
   - You already have many features (combo, progressive difficulty, skins/shop, revive flow, stats).
   - The best next ROI is reliability/performance/refactor work rather than adding more mechanics immediately.

---

## Prioritized roadmap

## P0 — Stabilize and make future work safer (highest priority)

### 1) Extract modules from `index.html`
**Goal:** reduce change risk and enable focused testing.

- Split into lightweight files:
  - `src/core/state.js` (game state + constants)
  - `src/core/update.js` (physics and gameplay update)
  - `src/core/render.js` (drawing)
  - `src/systems/storage.js` (`localStorage` reads/writes and guards)
  - `src/systems/audio.js` (sound creation + mute)
  - `src/ui/dom.js` (DOM querying + view updates)
  - `src/main.js` (bootstrap + loop wiring)
- Keep functionality identical during extraction (no behavior changes in first pass).

**Success criteria:**
- Game behavior unchanged by manual smoke test.
- `index.html` script reduced to bootstrap only.

### 2) Create a true shared logic layer for tests
**Goal:** stop test drift and validate real game logic.

- Move reusable pure functions to `src/core/rules.js` (e.g., combo multiplier, progressive difficulty, medal thresholds, pipe color thresholds).
- Use these functions in runtime and tests.
- Keep `tests.html` simple but import the shared rules module.

**Success criteria:**
- One source of truth for rules.
- Updating a rule requires changing one function, not two copies.

### 3) Add minimal CI checks
**Goal:** catch breakage early.

- Add a lightweight CI workflow to run:
  - basic HTML/JS lint or syntax validation
  - formatting checks (if introduced)
- Optionally add Playwright smoke test later.

**Success criteria:**
- PRs automatically report pass/fail for at least one static check.

---

## P1 — Performance and UX quality

### 4) Performance instrumentation + adaptive effects
- Keep FPS counter (already present) and add internal rolling average.
- If FPS drops under threshold for sustained period, reduce non-essential particle density and effects.

### 5) Input polish and consistency
- Normalize touch/click/key handling through a single input layer.
- Debounce duplicate touch+click triggers on mobile.

### 6) Persistence hardening
- Centralize all `localStorage` schema/versioning.
- Add migration function for future key changes.
- Add fallback/reset path for corrupted JSON.

---

## P2 — Feature work after foundation is stable

### 7) Daily/weekly challenges
- Add rotating goals and coin rewards.

### 8) Accessibility pass
- Add improved text contrast options, reduced motion toggle, larger HUD option.

### 9) Leaderboard improvements
- Add richer local ranking filters and optional backend sync in a future phase.

---

## Suggested execution order

1. **Refactor extraction (P0.1)**
2. **Shared rules + tests realignment (P0.2)**
3. **CI baseline (P0.3)**
4. **Performance/input/storage (P1)**
5. **New feature development (P2)**

---

## “Next PR” recommendation

For the very next implementation PR, I recommend:

1. Create `src/core/rules.js`.
2. Move `getComboMultiplier`, progressive difficulty computation, medal rules, and pipe color thresholds into it.
3. Update both game runtime and `tests.html` to use shared logic.

This gives immediate maintainability and test-accuracy gains with relatively low risk.

---

## 16 New Updates to Implement (Post-Rules Extraction)

> Below are **16 additional updates** to continue improving gameplay quality, maintainability, and player retention.

### Update 1: Split rendering into dedicated modules
Create `src/render/background.js`, `src/render/pipes.js`, `src/render/bird.js`, and `src/render/hud.js` so each render concern can be changed independently.

### Update 2: Add deterministic RNG for challenge mode
Introduce a seeded RNG utility (`src/core/rng.js`) so challenge runs can be replayed and debugged consistently.

### Update 3: Add pause overlay + countdown resume
Show a full pause overlay and use a 3-2-1 countdown before unpausing to reduce accidental deaths after resume.

### Update 4: Add frame-time graph for debug mode
Expand FPS debug UI with a tiny frame-time sparkline to detect spikes, not just average FPS.

### Update 5: Add “safe start” spawn logic
Guarantee first two pipe sets are easier (larger gap + slower speed) so early-game failure feels less punishing.

### Update 6: Add combo decay indicator
Display a visual timer ring/bar showing remaining combo window (`COMBO_WINDOW_MS`) to make combo strategy readable.

### Update 7: Add near-miss bonus system
Award small bonus coins for tight passes (distance threshold between bird hitbox and pipe edge) to reward skillful play.

### Update 8: Add skin preview in shop modal
Render a live animated mini-canvas preview for selected skins (including premium skins) before purchase.

### Update 9: Add settings panel persistence
Persist player preferences (mute, reduced motion, HUD scale, debug toggles) in a single versioned `settings` storage key.

### Update 10: Add storage corruption recovery UX
If parsing fails for coins/leaderboard/stats, prompt user to reset corrupted data instead of silently failing.

### Update 11: Add touch haptic feedback hooks
Use `navigator.vibrate` (when available) for flap, score milestone, and collision feedback with graceful fallback.

### Update 12: Add keyboard remapping support
Create configurable key binds (`jump`, `pause`, `mute`, `shop`) with defaults and local persistence.

### Update 13: Add game-state finite state machine
Replace scattered booleans with an explicit state machine (`boot`, `menu`, `countdown`, `running`, `paused`, `gameover`, `shop`).

### Update 14: Add smoke tests for state transitions
Extend `tests.html` to verify legal/illegal state transitions and ensure UI visibility aligns with each state.

### Update 15: Add CI workflow for static checks
Add `.github/workflows/ci.yml` to run JS syntax checks and a lightweight HTML validation pass on PRs.

### Update 16: Add release checklist + changelog process
Create `RELEASE_CHECKLIST.md` and `CHANGELOG.md` conventions so feature rollout and regression checks are consistent.

---

## Recommended next implementation slice (small, high ROI)

1. Implement **Update 13** (finite state machine) with no gameplay mechanic changes.
2. Implement **Update 14** to lock behavior with tests.
3. Implement **Update 3** (pause overlay + resume countdown) leveraging the new state machine.


---

## 100 Additional App Improvements (Batch 2)

### Update 17: Tutorial prompts for first-run onboarding
[Gameplay] Implement tutorial prompts for first-run onboarding.

### Update 18: Adaptive difficulty easing after repeated short runs
[Gameplay] Implement adaptive difficulty easing after repeated short runs.

### Update 19: Safe-start pipe generation for first 10 seconds
[Gameplay] Implement safe-start pipe generation for first 10 seconds.

### Update 20: Near-miss bonus coins based on hitbox distance
[Gameplay] Implement near-miss bonus coins based on hitbox distance.

### Update 21: Custom challenge seeds for repeatable runs
[Gameplay] Implement custom challenge seeds for repeatable runs.

### Update 22: Hardcore mode with no continue option
[Gameplay] Implement hardcore mode with no continue option.

### Update 23: Zen mode without collision for practice
[Gameplay] Implement zen mode without collision for practice.

### Update 24: Speedrun timer mode with PB tracking
[Gameplay] Implement speedrun timer mode with PB tracking.

### Update 25: Daily missions with rotating constraints
[Gameplay] Implement daily missions with rotating constraints.

### Update 26: Weekly boss challenge pattern set
[Gameplay] Implement weekly boss challenge pattern set.

### Update 27: Pause overlay with countdown resume
[UX] Implement pause overlay with countdown resume.

### Update 28: Game-over tips based on recent mistakes
[UX] Implement game-over tips based on recent mistakes.

### Update 29: Combo decay progress bar indicator
[UX] Implement combo decay progress bar indicator.

### Update 30: Skin preview mini-canvas in shop
[UX] Implement skin preview mini-canvas in shop.

### Update 31: Shop filters for owned/affordable/premium
[UX] Implement shop filters for owned/affordable/premium.

### Update 32: Purchase confirmation for high-cost items
[UX] Implement purchase confirmation for high-cost items.

### Update 33: Undo purchase grace period
[UX] Implement undo purchase grace period.

### Update 34: Post-run analytics summary card
[UX] Implement post-run analytics summary card.

### Update 35: Leaderboard filter by mode and difficulty
[UX] Implement leaderboard filter by mode and difficulty.

### Update 36: In-game roadmap panel for upcoming features
[UX] Implement in-game roadmap panel for upcoming features.

### Update 37: High-contrast color preset
[Accessibility] Implement high-contrast color preset.

### Update 38: Reduced-motion toggle for effects
[Accessibility] Implement reduced-motion toggle for effects.

### Update 39: Large-text HUD option
[Accessibility] Implement large-text HUD option.

### Update 40: Color-blind-safe pipe palette
[Accessibility] Implement color-blind-safe pipe palette.

### Update 41: Caption cues for critical events
[Accessibility] Implement caption cues for critical events.

### Update 42: Left-handed UI layout option
[Accessibility] Implement left-handed UI layout option.

### Update 43: Keyboard-only menu navigation
[Accessibility] Implement keyboard-only menu navigation.

### Update 44: Gamepad support for core actions
[Accessibility] Implement gamepad support for core actions.

### Update 45: Haptic intensity settings
[Accessibility] Implement haptic intensity settings.

### Update 46: Remappable key bindings UI
[Accessibility] Implement remappable key bindings UI.

### Update 47: Particle object pooling
[Performance] Implement particle object pooling.

### Update 48: Dynamic particle throttling under low FPS
[Performance] Implement dynamic particle throttling under low FPS.

### Update 49: Frame-time sparkline debug panel
[Performance] Implement frame-time sparkline debug panel.

### Update 50: Offscreen rendering for backgrounds
[Performance] Implement offscreen rendering for backgrounds.

### Update 51: Debounced resize recalculation
[Performance] Implement debounced resize recalculation.

### Update 52: Fixed-step simulation mode
[Performance] Implement fixed-step simulation mode.

### Update 53: Render interpolation at variable FPS
[Performance] Implement render interpolation at variable FPS.

### Update 54: Lazy init for non-critical systems
[Performance] Implement lazy init for non-critical systems.

### Update 55: Memory snapshot debug utility
[Performance] Implement memory snapshot debug utility.

### Update 56: Performance budget alerts in debug mode
[Performance] Implement performance budget alerts in debug mode.

### Update 57: Versioned settings storage key
[Data] Implement versioned settings storage key.

### Update 58: Storage schema migration utility
[Data] Implement storage schema migration utility.

### Update 59: Save-data export as JSON
[Data] Implement save-data export as JSON.

### Update 60: Save-data import with validation
[Data] Implement save-data import with validation.

### Update 61: Corruption recovery reset flow
[Data] Implement corruption recovery reset flow.

### Update 62: Profile slots for multi-user devices
[Data] Implement profile slots for multi-user devices.

### Update 63: Per-profile progression separation
[Data] Implement per-profile progression separation.

### Update 64: Purchase history ledger
[Data] Implement purchase history ledger.

### Update 65: Backup reminder after major unlocks
[Data] Implement backup reminder after major unlocks.

### Update 66: Startup data integrity checks
[Data] Implement startup data integrity checks.

### Update 67: Unit tests for shared rules module
[Testing] Implement unit tests for shared rules module.

### Update 68: Unit tests for score popup lifecycle
[Testing] Implement unit tests for score popup lifecycle.

### Update 69: Unit tests for continue eligibility logic
[Testing] Implement unit tests for continue eligibility logic.

### Update 70: Integration test for pause/resume transitions
[Testing] Implement integration test for pause/resume transitions.

### Update 71: Integration test for shop modal focus handling
[Testing] Implement integration test for shop modal focus handling.

### Update 72: Integration test for keyboard shortcuts
[Testing] Implement integration test for keyboard shortcuts.

### Update 73: Replay-based regression harness
[Testing] Implement replay-based regression harness.

### Update 74: State machine transition table tests
[Testing] Implement state machine transition table tests.

### Update 75: Snapshot tests for HUD visibility states
[Testing] Implement snapshot tests for HUD visibility states.

### Update 76: Deterministic seed replay test set
[Testing] Implement deterministic seed replay test set.

### Update 77: GitHub Actions syntax validation workflow
[CI/CD] Implement GitHub Actions syntax validation workflow.

### Update 78: Lint and formatting checks on PR
[CI/CD] Implement lint and formatting checks on PR.

### Update 79: Artifact upload for test logs
[CI/CD] Implement artifact upload for test logs.

### Update 80: Release checklist gate before tagging
[CI/CD] Implement release checklist gate before tagging.

### Update 81: Changelog generation automation
[CI/CD] Implement changelog generation automation.

### Update 82: Semantic version bump helper
[CI/CD] Implement semantic version bump helper.

### Update 83: PR template for gameplay-impact notes
[CI/CD] Implement PR template for gameplay-impact notes.

### Update 84: Automated dependency update schedule
[CI/CD] Implement automated dependency update schedule.

### Update 85: Security headers validation for static hosting
[CI/CD] Implement security headers validation for static hosting.

### Update 86: Deployment smoke check script
[CI/CD] Implement deployment smoke check script.

### Update 87: Event bus for decoupled subsystems
[Architecture] Implement event bus for decoupled subsystems.

### Update 88: Finite state machine for game lifecycle
[Architecture] Implement finite state machine for game lifecycle.

### Update 89: Split renderer into feature modules
[Architecture] Implement split renderer into feature modules.

### Update 90: Split input handling into dedicated module
[Architecture] Implement split input handling into dedicated module.

### Update 91: Split storage into typed service layer
[Architecture] Implement split storage into typed service layer.

### Update 92: Split audio into standalone service
[Architecture] Implement split audio into standalone service.

### Update 93: Central constants/config file
[Architecture] Implement central constants/config file.

### Update 94: Rules API documentation page
[Architecture] Implement rules API documentation page.

### Update 95: Architecture decision record template
[Architecture] Implement architecture decision record template.

### Update 96: Error boundary for boot failures
[Architecture] Implement error boundary for boot failures.

### Update 97: Daily free coin chest cooldown
[Monetization] Implement daily free coin chest cooldown.

### Update 98: Reward multiplier for mission completion
[Monetization] Implement reward multiplier for mission completion.

### Update 99: Preview before premium skin purchase
[Monetization] Implement preview before premium skin purchase.

### Update 100: Ad opt-out purchase confirmation guard
[Monetization] Implement ad opt-out purchase confirmation guard.

### Update 101: Coin sink cosmetic trail upgrades
[Monetization] Implement coin sink cosmetic trail upgrades.

### Update 102: Special event shop rotation
[Monetization] Implement special event shop rotation.

### Update 103: Limited-time bundle offers
[Monetization] Implement limited-time bundle offers.

### Update 104: Transparent price breakdown labels
[Monetization] Implement transparent price breakdown labels.

### Update 105: Restore purchases local simulation flow
[Monetization] Implement restore purchases local simulation flow.

### Update 106: Economy balancing dashboard values
[Monetization] Implement economy balancing dashboard values.

### Update 107: Shareable run summary card image
[Community] Implement shareable run summary card image.

### Update 108: Friend challenge links with encoded seeds
[Community] Implement friend challenge links with encoded seeds.

### Update 109: Local tournament bracket mode
[Community] Implement local tournament bracket mode.

### Update 110: Weekly highlight reel export
[Community] Implement weekly highlight reel export.

### Update 111: Feedback link in pause menu
[Community] Implement feedback link in pause menu.

### Update 112: Credits page for contributors/assets
[Community] Implement credits page for contributors/assets.

### Update 113: Localization scaffolding for strings
[Community] Implement localization scaffolding for strings.

### Update 114: Right-to-left layout readiness
[Community] Implement right-to-left layout readiness.

### Update 115: Privacy notice modal for data handling
[Community] Implement privacy notice modal for data handling.

### Update 116: Feature flag panel for beta toggles
[Community] Implement feature flag panel for beta toggles.


---

## Execution Loop Tracker

To execute the plan iteratively and safely, run updates in fixed batches and mark status below.

- [x] **Batch 1 executed**: Shared rules extraction (`src/core/rules.js`) and runtime/test wiring.
- [x] **Batch 2 executed**: Added game-state-machine scaffolding in runtime (`boot/menu/countdown/running/paused/gameover/shop`).
- [x] **Batch 3 executed**: Added pause-resume countdown flow (3-2-1 resume) for safer unpause behavior.
- [x] **Batch 4 executed**: Added state-transition smoke tests in `tests.html`.
- [x] **Batch 5 executed**: Extracted reusable state machine into `src/core/stateMachine.js` and added Node test coverage (`tests/rules_and_state.test.js`).
- [x] **Batch 6 executed**: Added versioned settings persistence and storage corruption recovery utilities via `src/core/storage.js`, wired into runtime and tests.
- [x] **Batch 7 executed**: Added CI workflow (`.github/workflows/ci.yml`) for syntax checks and Node regression tests.
- [x] **Batch 8 executed**: Split core render helpers into `src/render/background.js`, `src/render/pipes.js`, `src/render/bird.js`, and `src/render/hud.js`, then wired runtime usage.
- [x] **Batch 9 executed**: Expanded render-focused regression tests and extracted additional render math/helpers (day-night blend/sky color/celestial alpha, warning alpha, FPS calc) into render modules.
- [x] **Batch 10 executed**: Extracted ground rendering/offset logic into `src/render/ground.js` and wired runtime/tests/CI.
- [x] **Batch 11 executed**: Extracted parallax/cloud background routines into `src/render/background.js` and wired runtime/tests.
- [x] **Batch 12 executed**: Extracted particle/fire/score-popup effects routines into `src/render/effects.js` and wired runtime/tests/CI.
- [x] **Batch 13 executed**: Extracted game-loop timing/camera/shake helpers into `src/core/loop.js` and wired runtime/tests/CI.
- [x] **Batch 14 executed**: Extracted input gating/toggle helpers into `src/core/input.js` and wired runtime/tests/CI.
- [x] **Batch 15 executed**: Added deconflict guardrails (merge-marker checks + namespace conflict checks) and wired them into CI.
- [x] **Batch 16 executed**: Added conflict-mitigation docs and `.gitattributes` union-merge rule for additive planning content.
- [ ] Next: Continue extracting remaining UI flow orchestration concerns from `index.html`.

### Loop policy
1. Pick 1–3 updates.
2. Implement with no unrelated changes.
3. Add/adjust tests.
4. Ship and mark completion.
5. Repeat.
