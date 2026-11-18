// Keyboard and mouse input. Held keys give movement; one-shot presses (enter a
// car, punch, pause, confirm) are queued as bit flags and taken once by the loop,
// so a press between two frames is never lost and never counted twice.
export const ACTION_ENTER = 1;
export const ACTION_PUNCH = 2;
export const ACTION_PAUSE = 4;
export const ACTION_CONFIRM = 8;
export const ACTION_HORN = 16;
export const ACTION_CAMERA = 32;
export const ACTION_STATS = 64;

const FORWARD = new Set(['KeyW', 'ArrowUp']);
const BACK = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);
const ENTER = new Set(['KeyE']);
const PUNCH = new Set(['KeyF']);
const PAUSE = new Set(['KeyP', 'Escape']);
const CONFIRM = new Set(['Space', 'Enter']);
const HORN = new Set(['KeyH']);
const CAMERA = new Set(['KeyC']);
const STATS = new Set(['KeyM']);

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let orbitDX = 0;
  let orbitDY = 0;
  let dragging = false;

  window.addEventListener('keydown', (event) => {
    if (FORWARD.has(event.code) || BACK.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
      keys.add(event.code);
    } else if (ENTER.has(event.code)) {
      if (!event.repeat) actions |= ACTION_ENTER;
    } else if (PUNCH.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PUNCH;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (HORN.has(event.code)) {
      if (!event.repeat) actions |= ACTION_HORN;
    } else if (CAMERA.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CAMERA;
    } else if (STATS.has(event.code)) {
      if (!event.repeat) actions |= ACTION_STATS;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('pointerdown', (event) => {
    dragging = true;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    orbitDX += event.movementX;
    orbitDY += event.movementY;
  });
  canvas.addEventListener('pointerup', () => { dragging = false; });

  const has = (set) => [...set].some((code) => keys.has(code));
  return {
    moveX() { return (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0); },
    moveY() { return (has(FORWARD) ? 1 : 0) - (has(BACK) ? 1 : 0); },
    run() { return keys.has('ShiftLeft') || keys.has('ShiftRight'); },
    handbrake() { return keys.has('Space'); },
    takeOrbit() {
      const out = { dx: orbitDX, dy: orbitDY };
      orbitDX = 0;
      orbitDY = 0;
      return out;
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Drive the game without a keyboard: used by the screenshot autopilot. */
    inject(action) { actions |= action; },
  };
}
