// Keyboard and pointer input. Held keys steer; one-shot presses (enter a car, punch, pause,
// confirm) are queued as bit flags and taken exactly once by the loop, so a press between two
// frames is never lost and never counted twice. The mouse aims the player's shots.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_MUTE = 16;
export const ACTION_NEWGAME = 32;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const SHOOT_KEYS = new Set(['Space']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER = new Set(['KeyE']);
const PUNCH = new Set(['KeyF']);
const MUTE = new Set(['KeyM']);
const NEWGAME = new Set(['KeyN']);

export function createInput(target) {
  const held = { up: false, down: false, left: false, right: false, shoot: false };
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseSeen = false;

  function mark(code, down) {
    if (UP.has(code)) held.up = down;
    else if (DOWN.has(code)) held.down = down;
    else if (LEFT.has(code)) held.left = down;
    else if (RIGHT.has(code)) held.right = down;
    else return false;
    return true;
  }

  window.addEventListener('keydown', (event) => {
    if (mark(event.code, true)) { event.preventDefault(); return; }
    // Space is both the held trigger and a one-shot confirm: held shooting is only read
    // while playing, the confirm flag only on the menu screens, so they never clash.
    if (SHOOT_KEYS.has(event.code)) held.shoot = true;
    if (event.repeat) return;
    if (CONFIRM.has(event.code)) actions |= ACTION_CONFIRM;
    else if (PAUSE.has(event.code)) actions |= ACTION_PAUSE;
    else if (ENTER.has(event.code)) actions |= ACTION_ENTER;
    else if (PUNCH.has(event.code)) actions |= ACTION_PUNCH;
    else if (MUTE.has(event.code)) actions |= ACTION_MUTE;
    else if (NEWGAME.has(event.code)) actions |= ACTION_NEWGAME;
    else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (SHOOT_KEYS.has(event.code)) held.shoot = false;
    mark(event.code, false);
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    held.up = false;
    held.down = false;
    held.left = false;
    held.right = false;
    held.shoot = false;
  });

  target.addEventListener('pointerdown', (event) => {
    held.shoot = true;
    mouseX = event.clientX;
    mouseY = event.clientY;
    mouseSeen = true;
  });
  window.addEventListener('pointerup', () => {
    held.shoot = false;
  });
  target.addEventListener('pointermove', (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
    mouseSeen = true;
  });

  return {
    /** -1/0/1 steering on each axis, from the held movement keys. */
    steer() {
      return {
        x: (held.right ? 1 : 0) - (held.left ? 1 : 0),
        y: (held.down ? 1 : 0) - (held.up ? 1 : 0),
      };
    },
    /** True while Space or the mouse button is held. */
    shooting() {
      return held.shoot;
    },
    /** The mouse position in canvas CSS pixels, or null before the mouse moves. */
    mouse() {
      return mouseSeen ? { x: mouseX, y: mouseY } : null;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
