// Taxi fares: hail a cab job by stealing a taxi, pick up the waiting
// passenger, then beat the meter to the drop-off. The fare ticks up with
// distance driven while the passenger is aboard, and a tip scales with how
// much time is left — fast, smooth driving pays best. Crashing hard while
// a passenger is aboard scares them off and ends the fare empty-handed.
import * as THREE from 'three';
import { TAXI } from './config.js';
import { pickOne } from './random.js';

const PICKUP_SPOTS = ['plaza', 'docks', 'motel', 'beach', 'safehouse'];
const FARE_BASE = TAXI.baseFare;
const FARE_PER_METRE = TAXI.perMetre;
const TIP_PER_SECOND = TAXI.tipPerSecond;

export function createTaxi(world, random) {
  const scene = world.scene;

  // The waiting passenger: a yellow-shirt walker with a raised arm.
  const passenger = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: 0xf2c230 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
  const legs = new THREE.MeshLambertMaterial({ color: 0x2c3550 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.9, 8), shirt);
  body.position.y = 1.05;
  passenger.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), skin);
  head.position.y = 1.78;
  passenger.add(head);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.8, 6), skin);
  arm.position.set(0.45, 1.5, 0);
  arm.rotation.z = -0.9; // raised, hailing
  passenger.add(arm);
  for (const sx of [-0.14, 0.14]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.7, 6), legs);
    leg.position.set(sx, 0.35, 0);
    passenger.add(leg);
  }
  passenger.visible = false;
  scene.add(passenger);

  // Pickup marker: a cyan ring so the hailer is findable from the road.
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 3.0, 24),
    new THREE.MeshBasicMaterial({ color: 0x35d0e0, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.12;
  ring.visible = false;
  scene.add(ring);

  // Drop-off beacon, reusing the mission look in cyan instead of gold.
  const beacon = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(2.0, 2.0, 36, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x35d0e0, transparent: true, opacity: 0.4, side: THREE.DoubleSide }),
  );
  beam.position.y = 18;
  beacon.add(beam);
  const gem = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.7),
    new THREE.MeshBasicMaterial({ color: 0x35d0e0 }),
  );
  gem.position.y = 5;
  beacon.add(gem);
  beacon.visible = false;
  scene.add(beacon);

  let phase = 'off'; // off | waiting | riding
  let pickup = null;
  let dropoff = null;
  let fare = 0;
  let timeLeft = 0;
  let timeLimit = 0;
  let waitLeft = 0; // patience while the passenger waits for pickup
  let distanceDriven = 0;
  let lastX = 0;
  let lastZ = 0;
  let message = '';
  let waitBob = 0;
  let faresDone = 0;
  let faresEarned = 0;

  function randomSpot(except) {
    const keys = PICKUP_SPOTS.filter((k) => k !== except);
    const key = pickOne(random, keys);
    const spot = world.spots[key];
    return { x: spot.x, z: spot.z, key };
  }

  function offer() {
    if (phase !== 'off') return false;
    pickup = randomSpot(null);
    const p = world.nearestRoadPoint(pickup.x, pickup.z);
    pickup = { ...pickup, x: p.x, z: p.z };
    phase = 'waiting';
    fare = 0;
    timeLeft = 0;
    waitLeft = TAXI.waitPatienceSeconds; // the hailer waits, then gives up and walks away
    passenger.position.set(pickup.x, 0, pickup.z);
    passenger.visible = true;
    ring.position.set(pickup.x, 0.12, pickup.z);
    ring.visible = true;
    message = `Fare waiting at ${pickup.key.toUpperCase()} — drive up to pick them up.`;
    return true;
  }

  function startRide() {
    dropoff = randomSpot(pickup.key);
    const d = world.nearestRoadPoint(dropoff.x, dropoff.z);
    dropoff = { ...dropoff, x: d.x, z: d.z };
    const dist = Math.hypot(dropoff.x - pickup.x, dropoff.z - pickup.z);
    timeLimit = Math.max(45, dist / 9 + 25);
    timeLeft = timeLimit;
    distanceDriven = 0;
    fare = FARE_BASE;
    phase = 'riding';
    passenger.visible = false;
    ring.visible = false;
    beacon.position.set(dropoff.x, 0, dropoff.z);
    beacon.visible = true;
    message = `Passenger aboard — take them to ${dropoff.key.toUpperCase()} before the meter runs out.`;
  }

  function endRide(completed, reason) {
    beacon.visible = false;
    if (completed) {
      const tip = Math.round(Math.max(0, timeLeft) * TIP_PER_SECOND);
      const total = Math.round(fare) + tip;
      faresDone += 1;
      faresEarned += total;
      phase = 'off';
      message = `Fare complete! Meter $${Math.round(fare)} + $${tip} tip = $${total}.`;
      return { event: 'taxi-complete', reward: total };
    }
    phase = 'off';
    message = reason;
    return { event: 'taxi-failed' };
  }

  function step(dt, player, time) {
    waitBob += dt;
    if (phase === 'waiting') {
      // The hailer waves: bob the raised arm and pulse the ring.
      passenger.position.y = Math.abs(Math.sin(waitBob * 3)) * 0.15;
      ring.scale.setScalar(1 + Math.sin(waitBob * 3) * 0.12);
      waitLeft -= dt;
      if (waitLeft <= 0) {
        phase = 'off';
        passenger.visible = false;
        ring.visible = false;
        message = 'The fare got tired of waiting and walked off.';
        return { event: 'taxi-failed' };
      }
      if (player.inCar) {
        const d = Math.hypot(player.x - pickup.x, player.z - pickup.z);
        if (d < 7) {
          lastX = player.x;
          lastZ = player.z;
          startRide();
          return { event: 'taxi-pickup' };
        }
      }
      return { event: null };
    }
    if (phase === 'riding') {
      timeLeft -= dt;
      // The meter runs on distance, not time: smooth long drives earn more.
      const moved = Math.hypot(player.x - lastX, player.z - lastZ);
      distanceDriven += moved;
      fare += moved * FARE_PER_METRE;
      lastX = player.x;
      lastZ = player.z;
      gem.rotation.y = time * 2.5;
      gem.position.y = 5 + Math.sin(time * 2.5) * 0.5;
      if (!player.inCar) {
        return endRide(false, 'You left the cab — the passenger walked off.');
      }
      if (timeLeft <= 0) {
        return endRide(false, 'Too slow — the passenger got out and hailed another cab.');
      }
      const d = Math.hypot(player.x - dropoff.x, player.z - dropoff.z);
      if (d < 9) {
        return endRide(true, '');
      }
      return { event: null };
    }
    return { event: null };
  }

  /** A hard crash with a passenger aboard ends the fare with no pay. */
  function scareOff() {
    if (phase !== 'riding') return null;
    return endRide(false, 'You crashed with a passenger aboard — they bailed out!');
  }

  function reset() {
    phase = 'off';
    passenger.visible = false;
    ring.visible = false;
    beacon.visible = false;
    message = '';
  }

  return {
    step, offer, scareOff, reset,
    get phase() { return phase; },
    get message() { return message; },
    get fare() { return Math.round(fare); },
    get timeLeft() { return Math.max(0, Math.ceil(timeLeft)); },
    get faresDone() { return faresDone; },
    get faresEarned() { return faresEarned; },
    get target() {
      if (phase === 'waiting') return { x: pickup.x, z: pickup.z, radius: 7, label: 'Pick up the fare', kind: 'taxi' };
      if (phase === 'riding') return { x: dropoff.x, z: dropoff.z, radius: 9, label: 'Drop off the passenger', kind: 'taxi' };
      return null;
    },
    statusText() {
      if (phase === 'waiting') return `TAXI: fare waiting at ${pickup.key.toUpperCase()} — ${Math.ceil(waitLeft)}s patience — drive to the cyan ring`;
      if (phase === 'riding') return `TAXI: meter $${Math.round(fare)} · ${Math.ceil(timeLeft)}s to ${dropoff.key.toUpperCase()}`;
      return '';
    },
  };
}
