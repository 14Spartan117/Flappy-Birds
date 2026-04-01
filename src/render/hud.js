(function(global) {
  'use strict';

  function renderComboText(comboDisplayEl, comboCount, multiplier) {
    if (comboCount >= 3) {
      comboDisplayEl.innerText = `Combo x${multiplier}! (${comboCount})`;
      comboDisplayEl.style.opacity = '1';
      return;
    }
    comboDisplayEl.innerText = '';
  }

  function renderFPS(fpsCounterEl, showFPS, fpsValue) {
    if (!showFPS) return;
    fpsCounterEl.innerText = `FPS: ${fpsValue}`;
  }

  function calculateFPS(elapsedMs) {
    if (elapsedMs <= 0) return 0;
    return Math.round(1000 / elapsedMs);
  }

  const api = { renderComboText, renderFPS, calculateFPS };
  global.DragonRenderHUD = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
