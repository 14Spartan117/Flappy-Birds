# Merge / Conflict Notes

If your branch conflicts with `main`, use this order:

1. Rebase feature branch on `main`.
2. Resolve `index.html` manually (module script tags + helper wiring first).
3. Keep additive plan entries from both branches in `IMPROVEMENTS_PLAN.md` (union merge enabled via `.gitattributes`).
4. Re-run:
   - `node tests/rules_and_state.test.js`
   - `node tests/deconflict.test.js`
   - all `node --check` commands from CI.

This repository now has a union-merge rule for `IMPROVEMENTS_PLAN.md` to reduce plan-only conflicts.
