// Missions and story: three jobs in order, then repeat delivery jobs.
// Each mission is a chain of stages (reach a marker, do a thing, reach the
// next marker) with a timer and a cash reward. The beacon in the world and
// the HUD arrow both point at the current stage.
import * as THREE from 'three';
import { MISSIONS } from './config.js';
import { pickInt } from './random.js';

// Checkpoint sprint: a repeat-job variant (every other repeat job, decided
// by the seeded rng). Three checkpoints across the city, +20 s per gate, one
// payout at the end — a timed race instead of a single drop-off.
const SPRINT_CHECKPOINTS = 3;
const SPRINT_TIME_LIMIT = 150;
const SPRINT_REWARD = 700;
const SPRINT_CHECKPOINT_BONUS_SECONDS = 20;
const SPRINT_SPOTS = ['docks', 'motel', 'beach', 'safehouse', 'plaza'];

export function createMissions(world, random) {
  const beacon = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(2.4, 2.4, 42, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.45, side: THREE.DoubleSide }),
  );
  beam.position.y = 21;
  beacon.add(beam);
  const gem = new THREE.Mesh(
    new THREE.OctahedronGeometry(2.0),
    new THREE.MeshBasicMaterial({ color: 0xffd23e }),
  );
  gem.position.y = 6;
  beacon.add(gem);
  beacon.visible = false;
  world.scene.add(beacon);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.4, 3.2, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.1;
  ring.visible = false;
  world.scene.add(ring);

  let index = 0;
  let stage = 0;
  let timeLeft = 0;
  let target = null;
  let done = false;
  let message = '';
  let def = MISSIONS[0];
  let sprint = null; // null, or { points: [{x, z, key}], at: 0 }

  function repeatDef() {
    return { title: `DELIVERY JOB ${index - 2}`, reward: 300 + (index - 3) * 100, timeLimit: 120 };
  }

  function sprintDef() {
    return { title: `CHECKPOINT SPRINT ${index - 2}`, reward: SPRINT_REWARD, timeLimit: SPRINT_TIME_LIMIT, brief: 'Hit all 3 checkpoints before the clock runs out — each gate adds 20 s.' };
  }

  function stageTarget() {
    const spot = world.spots;
    if (sprint) {
      const p = sprint.points[sprint.at];
      return { x: p.x, z: p.z, radius: 8, label: `Checkpoint ${sprint.at + 1}/${sprint.points.length} — ${p.key.toUpperCase()}` };
    }
    if (index === 0) {
      // M1: steal a car, then drive to the docks.
      return stage === 0 ? null : { x: spot.docks.x, z: spot.docks.z, radius: 8, label: 'Drive to the DOCKS' };
    }
    if (index === 1) {
      // M2: plaza pickup, then the south motel.
      return stage === 0
        ? { x: spot.plaza.x, z: spot.plaza.z, radius: 6, label: 'Pick up the package at PALM PLAZA' }
        : { x: spot.motel.x, z: spot.motel.z, radius: 8, label: 'Deliver to the SOUTH MOTEL' };
    }
    if (index === 2) {
      // M3: take the marked car (alarm), lose the heat, reach the safehouse.
      return stage === 0 ? null : { x: spot.safehouse.x, z: spot.safehouse.z, radius: 8, label: 'Reach the SAFEHOUSE' };
    }
    // Repeat jobs: random delivery runs.
    const keys = ['docks', 'motel', 'beach', 'safehouse', 'plaza'];
    const dest = spot[keys[Math.floor(random() * keys.length)]];
    return { x: dest.x, z: dest.z, radius: 8, label: 'Deliver to the marked spot' };
  }

  function start() {
    stage = 0;
    sprint = null;
    if (index < MISSIONS.length) {
      def = MISSIONS[index];
    } else if (random() < 0.5) {
      // Checkpoint sprint variant: 3 distinct spots in a random order.
      const keys = SPRINT_SPOTS.slice();
      const points = [];
      for (let i = 0; i < SPRINT_CHECKPOINTS; i += 1) {
        const k = pickInt(random, 0, keys.length - 1);
        const key = keys.splice(k, 1)[0];
        const s = world.spots[key];
        points.push({ x: s.x, z: s.z, key });
      }
      sprint = { points, at: 0 };
      def = sprintDef();
    } else {
      def = repeatDef();
    }
    timeLeft = def.timeLimit;
    done = false;
    target = stageTarget();
    message = `${def.title} — ${def.brief ?? 'Drop the goods at the marker before the clock runs out.'}`;
    return def;
  }

  function current() {
    return def;
  }

  /** Advance mission logic; returns { event } where event is a string or null. */
  function step(dt, player) {
    if (done) return { event: null };
    timeLeft -= dt;
    if (timeLeft <= 0) {
      message = 'Too slow — the job fell through. Try again.';
      timeLeft = current().timeLimit;
      stage = 0;
      if (sprint) sprint.at = 0;
      target = stageTarget();
      return { event: 'mission-failed' };
    }
    // Stage 0 of M1/M3 completes when the player is in a car.
    if (target === null) {
      if (player.inCar) {
        stage = 1;
        target = stageTarget();
        message = target.label;
        if (index === 2) return { event: 'alarm' };
        return { event: 'stage' };
      }
      return { event: null };
    }
    const d = Math.hypot(player.x - target.x, player.z - target.z);
    if (d < target.radius) {
      if (index === 1 && stage === 0) {
        stage = 1;
        target = stageTarget();
        message = target.label;
        return { event: 'picked-up' };
      }
      if (sprint && sprint.at < sprint.points.length - 1) {
        sprint.at += 1;
        timeLeft += SPRINT_CHECKPOINT_BONUS_SECONDS;
        target = stageTarget();
        message = `Checkpoint! +${SPRINT_CHECKPOINT_BONUS_SECONDS}s — ${target.label}`;
        return { event: 'checkpoint' };
      }
      done = true;
      const reward = current().reward;
      const wasSprint = sprint !== null;
      sprint = null;
      index += 1;
      message = `Job done. +$${reward}`;
      return { event: 'mission-complete', reward, sprint: wasSprint };
    }
    return { event: null };
  }

  function update(dt, time) {
    beacon.visible = target !== null && !done;
    ring.visible = beacon.visible;
    if (target) {
      beacon.position.set(target.x, 0, target.z);
      ring.position.set(target.x, 0.1, target.z);
      gem.rotation.y = time * 2;
      gem.position.y = 6 + Math.sin(time * 2.5) * 0.6;
    }
  }

  return {
    start, step, update, current,
    /** Staging hook for screenshots: put the mission at an exact index/stage. */
    debugSet(missionIndex, stageIndex) {
      index = missionIndex;
      stage = stageIndex;
      sprint = null;
      def = index < MISSIONS.length ? MISSIONS[index] : repeatDef();
      timeLeft = current().timeLimit;
      done = false;
      target = stageTarget();
      message = target ? target.label : current().title;
    },
    get target() { return target; },
    get sprint() { return sprint; },
    get timeLeft() { return Math.max(0, Math.ceil(timeLeft)); },
    get message() { return message; },
    get done() { return done; },
    get index() { return index; },
  };
}
