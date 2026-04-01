(function(global) {
  'use strict';

  function shouldStartGame(gameStarted, countdownActive) {
    return !gameStarted && !countdownActive;
  }

  function shouldFlap(gameRunning, paused) {
    return gameRunning && !paused;
  }

  function toggleBoolean(value) {
    return !value;
  }

  function normalizeJumpKey(code) {
    return code === 'ArrowUp' || code === 'KeyW';
  }

  const api = {
    shouldStartGame,
    shouldFlap,
    toggleBoolean,
    normalizeJumpKey
  };

  global.DragonInput = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
