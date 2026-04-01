(function(global) {
  'use strict';

  const SETTINGS_KEY = 'dragonSettings';
  const SETTINGS_VERSION = 1;

  const DEFAULT_SETTINGS = Object.freeze({
    version: SETTINGS_VERSION,
    muted: false,
    showFPS: false,
    reducedMotion: false,
    hudScale: 1,
    vibration: 'off'
  });

  function parseJSON(rawValue) {
    if (!rawValue) return null;
    return JSON.parse(rawValue);
  }

  function safeLoadJSON(storage, key, fallbackValue, onCorrupt) {
    try {
      const parsed = parseJSON(storage.getItem(key));
      return parsed === null ? fallbackValue : parsed;
    } catch (error) {
      if (onCorrupt) onCorrupt(key, error);
      return fallbackValue;
    }
  }

  function safeLoadNumber(storage, key, fallbackValue = 0) {
    try {
      const value = Number(storage.getItem(key));
      return Number.isFinite(value) ? value : fallbackValue;
    } catch (error) {
      return fallbackValue;
    }
  }

  function safeSetJSON(storage, key, value) {
    try {
      storage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  }

  function loadSettings(storage, defaults = DEFAULT_SETTINGS, onCorrupt) {
    const loaded = safeLoadJSON(storage, SETTINGS_KEY, defaults, onCorrupt);
    const merged = { ...defaults, ...(loaded || {}) };
    if (!Number.isInteger(merged.version) || merged.version !== SETTINGS_VERSION) {
      merged.version = SETTINGS_VERSION;
    }
    if (!['off', 'low', 'high'].includes(merged.vibration)) {
      merged.vibration = defaults.vibration;
    }
    return merged;
  }

  function saveSettings(storage, settings) {
    const payload = { ...DEFAULT_SETTINGS, ...settings, version: SETTINGS_VERSION };
    return safeSetJSON(storage, SETTINGS_KEY, payload);
  }

  const api = {
    SETTINGS_KEY,
    SETTINGS_VERSION,
    DEFAULT_SETTINGS,
    safeLoadJSON,
    safeLoadNumber,
    safeSetJSON,
    loadSettings,
    saveSettings
  };

  global.DragonStorage = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
