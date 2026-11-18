// Solmar City — boot and the one loop. Fixed 1/60 s steps, a third-person
// camera, and four screens: title, play, paused and over (busted / wasted).
// The player walks, steals cars, runs missions and earns heat; the police
// answer the heat. ?seed=N fixes the city. ?shot=name stages a screenshot
// scene instead of running the loop, paints it twice and sets
// window.__shotReady for the screenshot script.
import * as THREE from 'three';
import { STEP, PLAYER, CAR, WANTED, SAVE_KEY } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import { createVehicles, makeCarMesh } from './vehicles.js';
import { createPeds } from './peds.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { createWeather } from './weather.js';
import { createTaxi } from './taxi.js';
import { createPoliceOps } from './police.js';
import { createStats } from './stats.js';
import { ACTION_ENTER, ACTION_PUNCH, ACTION_PAUSE, ACTION_CONFIRM, ACTION_HORN, ACTION_CAMERA, ACTION_STATS, createInput } from './input.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const overlayTitle = document.getElementById('overlay-title');
const overlayPause = document.getElementById('overlay-pause');
const overlayOver = document.getElementById('overlay-over');
const overTitle = document.getElementById('over-title');
const overText = document.getElementById('over-text');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

const random = createRandom(seed);
const world = createWorld(random);
const vehicles = createVehicles(world, random);
const peds = createPeds(world, random);
const missions = createMissions(world, random);
const weather = createWeather(world, random);
const taxi = createTaxi(world, random);
const policeOps = createPoliceOps(world, vehicles, random);
const stats = createStats();
const hud = createHud();
const audio = createAudio();
const input = createInput(canvas);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
world.scene.add(new THREE.AmbientLight(0x604a3a, 0.5));

const state = {
  screen: 'title',
  cash: 0,
  missionsDone: 0,
  health: PLAYER.health,
  heat: 0,
  stars: 0,
  lastCrimeAt: -999,
  time: 0,
  bustedTimer: 0,
  crashCooldown: 0,
  policeCooldown: 0,
  camYaw: Math.PI,
  camPitch: 0.32,
  camMode: 'follow',
  camTarget: new THREE.Vector3(0, 2, 0),
  showStats: true,
  lastFare: 0,
  overReason: '',
  lastX: 24,
  lastZ: 24,
};

// The player on foot: a red-jacket walker, distinct from the pedestrians.
const playerMesh = new THREE.Group();
{
  const jacket = new THREE.MeshLambertMaterial({ color: 0xd83a2e });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x2c3550 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.95, 8), jacket);
  body.position.y = 1.1;
  playerMesh.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), skin);
  head.position.y = 1.85;
  playerMesh.add(head);
  for (const sx of [-0.15, 0.15]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.75, 6), jeans);
    leg.position.set(sx, 0.38, 0);
    playerMesh.add(leg);
  }
}
world.scene.add(playerMesh);

const player = {
  x: 24, z: 24, heading: Math.PI, speed: 0,
  inCar: false, car: null,
};

function readSave() {
  try {
    const save = JSON.parse(window.localStorage.getItem(SAVE_KEY) ?? '{}');
    state.cash = Number(save.cash) || 0;
    state.missionsDone = Number(save.missionsDone) || 0;
  } catch { /* Storage can be off: play without saving. */ }
}

function writeSave() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({ cash: state.cash, missionsDone: state.missionsDone }));
  } catch { /* ignore */ }
}

function starsFromHeat(heat) {
  let stars = 0;
  for (let i = 0; i < WANTED.thresholds.length; i += 1) {
    if (heat >= WANTED.thresholds[i]) stars = i;
  }
  return stars;
}

function addHeat(points, what) {
  state.heat = Math.min(200, state.heat + points);
  state.lastCrimeAt = state.time;
  const next = starsFromHeat(state.heat);
  if (next > state.stars) {
    state.stars = next;
    hud.say(`WANTED LEVEL ${state.stars} — the Solmar PD is on you.`);
  }
  if (what) hud.say(what);
}

function syncPolice() {
  const want = WANTED.maxPoliceCars[state.stars] ?? 0;
  while (vehicles.police.length < want) {
    const angle = random() * Math.PI * 2;
    const p = world.nearestRoadPoint(
      player.x + Math.cos(angle) * 130,
      player.z + Math.sin(angle) * 130,
    );
    vehicles.spawnPolice(p.x, p.z);
  }
  if (want === 0 && vehicles.police.length > 0 && state.time - state.lastCrimeAt > 8) {
    vehicles.removePolice();
  }
}

function nearestCar(maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of vehicles.cars) {
    if (car === player.car) continue;
    const d = Math.hypot(car.x - player.x, car.z - player.z);
    if (d < bestD) { best = car; bestD = d; }
  }
  return best;
}

function enterCar(car) {
  player.inCar = true;
  player.car = car;
  car.parked = false;
  playerMesh.visible = false;
  stats.data.carsStolen += 1;
  if (car.marked) {
    car.marked = false;
    addHeat(60, 'The alarm is screaming — that car was marked!');
  } else if (car.kind === 'bike') {
    addHeat(25, 'You stole a motorcycle. Quick, twitchy, fast — lean into the turns.');
  } else if (car.kind === 'bus') {
    addHeat(25, 'You stole a city bus. Slow, wide, and impossible to miss.');
  } else {
    addHeat(25, 'You stole a car.');
  }
  if (car.isTaxi && taxi.offer()) hud.say(taxi.message);
  hud.say(car.kind === 'bike' ? 'You are riding. E to get off, F to punch on foot.'
    : 'You are driving. E to get out, F to punch on foot.');
  audio.unlock();
}

function exitCar() {
  const car = player.car;
  if (!car) return;
  car.speed = 0;
  player.x = car.x - Math.sin(car.heading + Math.PI / 2) * 3;
  player.z = car.z - Math.cos(car.heading + Math.PI / 2) * 3;
  const hit = world.collide(player.x, player.z, PLAYER.radius);
  player.x = hit.x;
  player.z = hit.z;
  player.heading = car.heading;
  player.inCar = false;
  player.car = null;
  playerMesh.visible = true;
  // Park at the safehouse and the car goes into the garage for next time.
  if (Math.hypot(car.x - world.spots.safehouse.x, car.z - world.spots.safehouse.z) < 14) {
    if (stats.saveGarage(car)) hud.say('Car parked in the garage — it will be here next session.');
  }
}

function stepPlayer(dt) {
  const orbit = input.takeOrbit();
  state.camYaw -= orbit.dx * 0.005;
  state.camPitch = Math.max(0.08, Math.min(1.0, state.camPitch + orbit.dy * 0.003));
  if (player.inCar) {
    const car = player.car;
    const throttle = input.moveY();
    const steer = -input.moveX();
    const before = car.speed;
    vehicles.stepCar(car, dt, throttle, steer);
    player.x = car.x;
    player.z = car.z;
    player.heading = car.heading;
    // Hitting a pedestrian in a car is a crime the police notice.
    if (Math.abs(car.speed) > 5 && peds.hitAt(car.x, car.z, 2.4)) {
      stats.data.pedsHit += 1;
      addHeat(30, 'You hit a pedestrian!');
    }
    // Hard crash into a building hurts.
    if (state.crashCooldown <= 0 && Math.abs(before) - Math.abs(car.speed) > 12) {
      state.health -= 8;
      state.crashCooldown = 1;
      audio.crash();
      hud.say('You slammed into a building.');
    }
    state.crashCooldown = Math.max(0, state.crashCooldown - dt);
    return;
  }
  const speed = input.run() ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const mx = input.moveX();
  const my = input.moveY();
  if (mx !== 0 || my !== 0) {
    // Move relative to the camera, and turn to face the movement.
    // Camera yaw is the direction the camera looks: forward is (sin, cos),
    // right is (cos, -sin).
    const sin = Math.sin(state.camYaw);
    const cos = Math.cos(state.camYaw);
    const dx = (mx * cos + my * sin) * speed * dt;
    const dz = (-mx * sin + my * cos) * speed * dt;
    const hit = world.collide(player.x + dx, player.z + dz, PLAYER.radius);
    player.x = hit.x;
    player.z = hit.z;
    player.heading = Math.atan2(dx, dz);
    player.speed = speed;
    // Bump pedestrians aside on foot.
    peds.hitAt(player.x, player.z, 1.0);
  } else {
    player.speed = 0;
  }
  playerMesh.position.set(player.x, 0, player.z);
  playerMesh.rotation.y = player.heading;
}

function step(dt, frameActions = 0) {
  state.time += dt;
  // Actions arrive from frame(): it already took them once, so the first
  // fixed step of a frame owns them and later steps in the same frame get 0
  // — otherwise one E press would enter and exit the car in the same frame.
  const actions = frameActions;
  if (actions & ACTION_ENTER) {
    if (player.inCar) exitCar();
    else {
      const car = nearestCar(5.5);
      if (car) enterCar(car);
    }
  }
  if ((actions & ACTION_PUNCH) && !player.inCar) {
    const px = player.x + Math.sin(player.heading) * 1.6;
    const pz = player.z + Math.cos(player.heading) * 1.6;
    if (peds.hitAt(px, pz, 1.8)) {
      stats.data.pedsHit += 1;
      addHeat(30, 'You knocked someone down!');
    }
  }
  if (actions & ACTION_HORN) {
    if (player.inCar) {
      audio.horn();
      stats.data.hornsHonks += 1;
      // A honk makes nearby hailers look up: they hurry to the cab faster.
      hud.say('Honk! Nearby hailers turn toward the cab.');
    }
  }
  if (actions & ACTION_CAMERA) {
    const modes = ['follow', 'close', 'high'];
    state.camMode = modes[(modes.indexOf(state.camMode) + 1) % modes.length];
    hud.say(`Camera: ${state.camMode.toUpperCase()} view (C to change).`);
  }
  if (actions & ACTION_STATS) {
    state.showStats = !state.showStats;
    hud.say(state.showStats ? 'Stats panel on (M to hide).' : 'Stats panel hidden (M to show).');
  }
  stepPlayer(dt);
  weather.step(dt, { x: player.x, z: player.z });
  // Stats: distance, top speed and play time, tracked every step.
  const moved = Math.hypot(player.x - state.lastX, player.z - state.lastZ);
  state.lastX = player.x;
  state.lastZ = player.z;
  stats.addDistance(moved);
  stats.notePlay(dt);
  if (player.inCar) stats.noteTopSpeed(Math.abs(player.car.speed) * 3.6);
  stats.noteCash(state.cash);
  stats.noteFourStars(state.stars >= 4);
  // Roadblocks are solid: hitting one at speed hurts and slows the car.
  if (player.inCar && state.crashCooldown <= 0) {
    const block = policeOps.hitBlock(player.x, player.z);
    if (block && Math.abs(player.car.speed) > 6) {
      player.car.speed *= 0.25;
      state.health -= 10;
      state.crashCooldown = 1;
      stats.data.crashes += 1;
      audio.crash();
      hud.say('You smashed into a police roadblock!');
      const scared = taxi.scareOff();
      if (scared) hud.say(taxi.message);
    }
  }
  // Taxi fares run alongside the story missions.
  const fare = taxi.step(dt, player, state.time);
  // The meter ticks: a blip each time the fare crosses another $5.
  if (taxi.phase === 'riding' && Math.floor(taxi.fare / 5) > Math.floor(state.lastFare / 5)) {
    audio.meterBlip();
  }
  state.lastFare = taxi.phase === 'riding' ? taxi.fare : 0;
  if (fare.event === 'taxi-pickup') {
    audio.pickup();
    hud.say(taxi.message);
  } else if (fare.event === 'taxi-complete') {
    state.cash += fare.reward;
    stats.data.faresDone += 1;
    stats.data.faresEarned += fare.reward;
    stats.addCash(fare.reward);
    writeSave();
    audio.missionDone();
    hud.say(taxi.message);
  } else if (fare.event === 'taxi-failed') {
    hud.say(taxi.message);
  }
  // Police escalation: roadblocks and the helicopter.
  const ops = policeOps.step(dt, player, state.stars, state.time);
  if (ops.event === 'heli') audio.heliAlert();
  if (ops.event) hud.say(ops.message);
  for (const unlocked of stats.check()) {
    state.cash += unlocked.bonus;
    audio.achievement();
    hud.say(`🏆 ${unlocked.name} — ${unlocked.desc} (+$${unlocked.bonus})`);
  }
  vehicles.stepTraffic(dt);
  const taxiTarget = taxi.target;
  peds.step(dt, player.x, player.z, player.inCar ? Math.abs(player.car.speed) : player.speed, {
    wanted: state.stars,
    taxiWaiting: taxi.phase === 'waiting',
    taxiX: taxiTarget?.x,
    taxiZ: taxiTarget?.z,
  });
  // Wanted decay: lay low and the heat cools off.
  if (state.time - state.lastCrimeAt > WANTED.decayDelay && state.heat > 0) {
    state.heat = Math.max(0, state.heat - WANTED.decayPerSecond * dt);
    const next = starsFromHeat(state.heat);
    if (next < state.stars) {
      state.stars = next;
      hud.say(state.stars === 0 ? 'You lost them. Heat is off.' : `Heat down to ${state.stars} star${state.stars > 1 ? 's' : ''}.`);
    }
  }
  syncPolice();
  const closestCop = vehicles.stepPolice(dt, player.x, player.z, state.stars > 0, player.inCar);
  // Police ram the player; on foot, a close cop busts them.
  state.policeCooldown = Math.max(0, state.policeCooldown - dt);
  if (closestCop < 3.2 && state.policeCooldown <= 0) {
    state.policeCooldown = 1.2;
    if (player.inCar) {
      state.health -= 6;
      audio.crash();
      hud.say('A police cruiser rammed you!');
    } else {
      state.bustedTimer += 1.2 * policeOps.bustPressure;
    }
  } else if (!player.inCar) {
    // The timer drains half as fast as it fills: a cop that keeps contact
    // will make the arrest, but breaking away still saves the player.
    state.bustedTimer = Math.max(0, state.bustedTimer - dt * 0.5);
  }
  if (!player.inCar && state.bustedTimer > 2) return endGame('BUSTED', 'The Solmar PD caught you on foot. The job is over — for now.');
  if (state.health <= 0) return endGame('WASTED', 'You took too much damage in the streets of Solmar.');
  const mission = missions.step(dt, player);
  if (mission.event === 'mission-complete') {
    state.cash += mission.reward;
    state.missionsDone += 1;
    stats.data.missionsDone += 1;
    if (mission.sprint) stats.data.sprintsDone += 1;
    stats.addCash(mission.reward);
    writeSave();
    audio.missionDone();
    hud.say(missions.message);
    missions.start();
  } else if (mission.event === 'checkpoint') {
    stats.data.checkpointsHit += 1;
    audio.pickup();
    hud.say(missions.message);
  } else if (mission.event === 'alarm') {
    addHeat(60, 'The alarm is screaming — that car was marked!');
  } else if (mission.event) {
    if (mission.event === 'picked-up') audio.pickup();
    hud.say(missions.message);
  }
  missions.update(dt, state.time);
  audio.setDriving(player.inCar ? Math.abs(player.car.speed) : 0, state.stars);
  updateCamera(dt);
  hud.draw({
    cash: state.cash,
    health: state.health,
    stars: state.stars,
    speed: player.inCar ? player.car.speed : 0,
    inCar: player.inCar,
    missionText: `${missions.current().title}  ·  $${missions.current().reward}  ·  ${missions.timeLeft}s — ${missions.message}`,
    weatherLabel: weather.label(),
    taxiText: taxi.statusText(),
    statsText: state.showStats ? stats.panelLines().join('  ·  ') : '',
    taxiTarget,
    heli: policeOps.heliPos,
    roadblocks: policeOps.blocks,
    player,
    cars: vehicles.cars,
    police: vehicles.police,
    target: missions.target,
  });
}

function updateCamera(dt) {
  const follow = player.inCar ? player.car : player;
  const heading = player.inCar ? player.car.heading : player.heading;
  // The camera trails behind the heading; dragging orbits it, and it eases back.
  const wantYaw = heading;
  let diff = wantYaw - state.camYaw;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  state.camYaw += diff * Math.min(1, dt * 1.2);
  const dist = player.inCar ? { follow: 12, close: 7, high: 18 }[state.camMode] ?? 12 : 8.5;
  const height = player.inCar ? { follow: 4.6, close: 3.0, high: 10 }[state.camMode] ?? 4.6 : 4.2;
  const tx = follow.x - Math.sin(state.camYaw) * dist;
  const tz = follow.z - Math.cos(state.camYaw) * dist;
  const ty = height;
  const k = 1 - Math.exp(-dt * 7);
  camera.position.x += (tx - camera.position.x) * k;
  camera.position.y += (ty - camera.position.y) * k;
  camera.position.z += (tz - camera.position.z) * k;
  state.camTarget.set(follow.x, 1.6, follow.z);
  camera.lookAt(state.camTarget);
}

function setScreen(name) {
  state.screen = name;
  overlayTitle.style.display = name === 'title' ? 'flex' : 'none';
  overlayPause.style.display = name === 'paused' ? 'flex' : 'none';
  overlayOver.style.display = name === 'over' ? 'flex' : 'none';
}

function startGame() {
  player.x = 24;
  player.z = 24;
  player.heading = Math.PI;
  player.inCar = false;
  player.car = null;
  playerMesh.visible = true;
  playerMesh.position.set(player.x, 0, player.z);
  state.health = PLAYER.health;
  state.heat = 0;
  state.stars = 0;
  state.bustedTimer = 0;
  state.time = 0;
  state.lastX = player.x;
  state.lastZ = player.z;
  vehicles.removePolice();
  taxi.reset();
  policeOps.reset();
  missions.start();
  // The garage car waits at the safehouse when one was parked there.
  // Restored once per page load so restarts do not clone it.
  const garaged = !garageRestored && stats.readGarage();
  if (garaged) {
    garageRestored = true;
    const spot = world.spots.safehouse;
    const restored = garaged.kind === 'bike'
      ? vehicles.spawnBike(spot.x + 6, spot.z + 6, garaged.color)
      : garaged.kind === 'bus'
        ? vehicles.spawnBus(spot.x + 6, spot.z + 6, garaged.color)
        : vehicles.spawnCar(spot.x + 6, spot.z + 6, garaged.color);
    restored.parked = true;
    hud.say('Your garage car is waiting at the safehouse.');
  }
  hud.say('Welcome to Solmar City. Steal a car — E — and mind the police.');
  setScreen('play');
  audio.unlock();
}

function endGame(reason, text) {
  state.overReason = reason;
  if (reason === 'BUSTED') stats.data.bustedCount += 1;
  if (reason === 'WASTED') stats.data.wastedCount += 1;
  stats.write();
  overTitle.textContent = reason;
  overText.textContent = `${text} Cash kept: $${state.cash.toLocaleString('en-US')} · Jobs done: ${state.missionsDone}.`;
  audio.busted();
  writeSave();
  setScreen('over');
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const actions = input.takeActions();
  if (state.screen === 'title' && (actions & ACTION_CONFIRM)) startGame();
  else if (state.screen === 'over' && (actions & ACTION_CONFIRM)) startGame();
  else if (state.screen === 'play' && (actions & ACTION_PAUSE)) setScreen('paused');
  else if (state.screen === 'paused' && (actions & (ACTION_PAUSE | ACTION_CONFIRM))) setScreen('play');
  if (state.screen === 'play') {
    acc += dt;
    let firstStep = true;
    while (acc >= STEP) {
      step(STEP, firstStep ? actions : 0);
      firstStep = false;
      acc -= STEP;
      if (state.screen !== 'play') break;
    }
  } else if (state.screen === 'title') {
    // The city idles behind the title: traffic and pedestrians keep moving.
    state.time += dt;
    weather.step(dt, { x: 0, z: 0 });
    vehicles.stepTraffic(dt);
    peds.step(dt, player.x, player.z, 0);
    state.camYaw += dt * 0.05;
    camera.position.set(Math.sin(state.camYaw) * 90, 42, Math.cos(state.camYaw) * 90);
    camera.lookAt(0, 0, 0);
  }
  renderer.render(world.scene, camera);
}

let last = performance.now();
let acc = 0;
let garageRestored = false;

readSave();
if (shot) {
  window.__trace = [];
  const scene = stageShot(shot, { state, player, playerMesh, world, vehicles, peds, missions, hud, input, camera, renderer, step, startGame, setScreen, addHeat, syncPolice, updateCamera, endGame, weather, taxi, policeOps, stats });
  window.__debug = () => JSON.stringify({
    x: +player.x.toFixed(1), z: +player.z.toFixed(1), heading: +player.heading.toFixed(2),
    speed: player.car ? +player.car.speed.toFixed(1) : 0, stars: state.stars,
    cops: vehicles.police.map((c) => [Math.round(c.x), Math.round(c.z)]),
  });
  // Two paints, then the screenshot script may shoot.
  let painted = 0;
  (function paint() {
    renderer.render(world.scene, camera);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  })();
  status.textContent = `Shot ${shot} staged.`;
} else {
  setScreen('title');
  status.textContent = 'Solmar City. Press Space or click to start.';
  // Debug handle for automated smoke tests: read state, teleport the player,
  // and enter the nearest car. Invisible in normal play.
  window.__solmar = {
    state, player, vehicles, missions, taxi, weather, policeOps, stats,
    teleport(x, z) {
      player.x = x;
      player.z = z;
      playerMesh.position.set(x, 0, z);
      state.lastX = x;
      state.lastZ = z;
      return { x: player.x, z: player.z };
    },
    enterNearestCar() {
      const car = nearestCar(8);
      if (car) enterCar(car);
      return !!car;
    },
    setStars(n) {
      state.heat = WANTED.thresholds[Math.max(0, Math.min(5, n))] || 0;
      state.stars = n;
      state.lastCrimeAt = state.time;
      syncPolice();
      return state.stars;
    },
  };
  requestAnimationFrame(frame);
}
