#!/usr/bin/env bash
set -euo pipefail

MAIN_REF="${1:-origin/main}"

echo "[1/6] Fetching latest refs..."
git fetch --all --prune

echo "[2/6] Enabling rerere for repeated conflict reuse..."
git config rerere.enabled true

echo "[3/6] Rebasing onto ${MAIN_REF}..."
if ! git rebase "${MAIN_REF}"; then
  echo
  echo "Rebase stopped due to conflicts."
  echo "Resolve conflicts (especially index.html), then run:"
  echo "  git add <resolved-files>"
  echo "  git rebase --continue"
  exit 2
fi

echo "[4/6] Running deconflict marker scan..."
! rg -n "^(<<<<<<<|=======|>>>>>>>)" index.html tests.html src tests .github/workflows/ci.yml MERGE_NOTES.md .gitattributes

echo "[5/6] Running regression checks..."
node tests/rules_and_state.test.js
node tests/deconflict.test.js

node --check src/core/rules.js
node --check src/core/stateMachine.js
node --check src/core/storage.js
node --check src/core/loop.js
node --check src/core/input.js
node --check src/render/background.js
node --check src/render/pipes.js
node --check src/render/bird.js
node --check src/render/hud.js
node --check src/render/ground.js
node --check src/render/effects.js

echo "[6/6] Done. Branch is rebased and validated."
