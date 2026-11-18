// Solmar City — tuning numbers, palette and city layout in one place.
// The city is a 5x5 grid of blocks ringed by roads; road centre lines sit on a
// 72 m pitch, so the whole playable city is about 460 m across.
export const STEP = 1 / 60;
export const CITY = {
  pitch: 72,
  roadWidth: 16,
  roads: [-180, -108, -36, 36, 108, 180],
  blocks: [-144, -72, 0, 72, 144],
  ground: 470,
};

export const PLAYER = {
  walkSpeed: 7,
  runSpeed: 11,
  radius: 0.6,
  health: 100,
};

export const CAR = {
  accel: 26,
  brake: 42,
  reverseAccel: 16,
  maxSpeed: 40,
  maxReverse: 11,
  steer: 0.55,
  length: 4.4,
  width: 2.0,
};

export const WANTED = {
  // Heat points -> stars. Stealing a car +25, hitting a pedestrian +30,
  // ramming a police car +40. Heat decays when no police can see the player.
  thresholds: [0, 20, 45, 75, 110, 150],
  decayPerSecond: 3,
  decayDelay: 12,
  maxPoliceCars: [0, 1, 2, 3, 4, 5],
};

// Weather and day/night tuning, read by weather.js. Weights are the odds of
// each kind when the current spell ends; durations are in-game seconds.
export const WEATHER = {
  dayLengthSeconds: 360, // one full day/night cycle
  kindDurationMin: 50,
  kindDurationMax: 120,
  weights: { clear: 0.55, rain: 0.25, fog: 0.2 },
  firstKindSeconds: 45,
};

// Taxi fares, read by taxi.js. The meter ticks per metre driven with a
// passenger aboard; the tip is per second left on the clock at drop-off.
export const TAXI = {
  baseFare: 25,
  perMetre: 0.35,
  tipPerSecond: 2,
  waitPatienceSeconds: 90,
};

// Police escalation, read by police.js.
export const POLICE = {
  roadblockStars: 2,
  heliStars: 4,
  maxBlocks: 2,
  blockIntervalMinSeconds: 14,
  blockIntervalMaxSeconds: 24,
  heliBustPressure: 1.6, // on-foot bust timer multiplier while the heli is up
};

// Achievement cash bonuses, read by stats.js (single source of truth for
// rewards; the achievement list itself lives in stats.js).
export const ACHIEVEMENT_BONUSES = {
  'first-wheels': 50,
  wheelman: 100,
  'road-warrior': 250,
  'speed-demon': 150,
  'job-done': 100,
  'crew-favourite': 300,
  cabbie: 150,
  'fare-king': 250,
  'big-spender': 200,
  ghost: 400,
  survivor: 200,
  collector: 100,
  sprinter: 200,
};

export const MISSIONS = [
  {
    id: 'first-wheels',
    title: 'FIRST WHEELS',
    brief: 'Steal a car, then drive to the docks before the clock runs out.',
    reward: 400,
    timeLimit: 100,
  },
  {
    id: 'the-package',
    title: 'THE PACKAGE',
    brief: 'Pick up the package at Palm Plaza, then deliver it to the south motel.',
    reward: 600,
    timeLimit: 130,
  },
  {
    id: 'heat-run',
    title: 'HEAT RUN',
    brief: 'The marked car is alarmed. Take it, lose the 3-star heat, reach the safehouse.',
    reward: 1000,
    timeLimit: 200,
  },
];

export const PALETTE = {
  sky: 0xffb36b,
  skyTop: 0x2e4a7a,
  sun: 0xffd9a0,
  ground: 0x3a3f46,
  road: 0x23262b,
  roadLine: 0xd8c95a,
  sidewalk: 0x8d9299,
  building: [0x9a7b5f, 0x7f8ea3, 0xb08a6a, 0x6f7f8c, 0xa67c52, 0x8a6f7d],
  glass: 0x2b3f55,
  palm: 0x2f7a3d,
  trunk: 0x6b4a2f,
  police: 0x1c4fd6,
  taxi: 0xf2c230,
  playerCar: 0xd83a2e,
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const SAVE_KEY = 'solmar.save.v1';
