(function(global) {
  'use strict';

  const GAME_STATES = Object.freeze({
    BOOT: 'boot',
    MENU: 'menu',
    COUNTDOWN: 'countdown',
    RUNNING: 'running',
    PAUSED: 'paused',
    GAME_OVER: 'gameover',
    SHOP: 'shop'
  });

  const ALLOWED_STATE_TRANSITIONS = Object.freeze({
    [GAME_STATES.BOOT]: [GAME_STATES.MENU],
    [GAME_STATES.MENU]: [GAME_STATES.COUNTDOWN, GAME_STATES.SHOP],
    [GAME_STATES.COUNTDOWN]: [GAME_STATES.RUNNING, GAME_STATES.MENU],
    [GAME_STATES.RUNNING]: [GAME_STATES.PAUSED, GAME_STATES.GAME_OVER, GAME_STATES.SHOP],
    [GAME_STATES.PAUSED]: [GAME_STATES.RUNNING, GAME_STATES.MENU],
    [GAME_STATES.GAME_OVER]: [GAME_STATES.COUNTDOWN, GAME_STATES.SHOP, GAME_STATES.MENU],
    [GAME_STATES.SHOP]: [GAME_STATES.MENU, GAME_STATES.GAME_OVER, GAME_STATES.RUNNING]
  });

  function createStateMachine(initialState = GAME_STATES.BOOT) {
    let state = initialState;

    function canTransition(fromState, toState) {
      const allowed = ALLOWED_STATE_TRANSITIONS[fromState] || [];
      return allowed.includes(toState);
    }

    function transition(nextState, force = false) {
      if (!force && !canTransition(state, nextState)) return false;
      state = nextState;
      return true;
    }

    function getState() {
      return state;
    }

    return { canTransition, transition, getState };
  }

  const api = {
    GAME_STATES,
    ALLOWED_STATE_TRANSITIONS,
    createStateMachine
  };

  global.DragonStateMachine = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
