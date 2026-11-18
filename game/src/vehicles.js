// Vehicles: the player's car, traffic and the police. Cars are low-poly boxes
// with cabin, wheels and lights — no borrowed models. Driving is arcade: the
// car accelerates, steers by speed and slides a little, and bumps out of
// buildings and other cars instead of getting stuck.
import * as THREE from 'three';
import { CAR, CITY, PALETTE } from './config.js';

export function makeCarMesh(color, police = false) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const dark = new THREE.MeshLambertMaterial({ color: 0x14161a });
  const glass = new THREE.MeshLambertMaterial({ color: 0x9fc4dd });
  const body = new THREE.Mesh(new THREE.BoxGeometry(CAR.width, 0.75, CAR.length), paint);
  body.position.y = 0.65;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(CAR.width - 0.35, 0.65, CAR.length * 0.45), glass);
  cabin.position.set(0, 1.3, -0.2);
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x0c0d0f });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.42, wz);
    group.add(wheel);
    wheels.push(wheel);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const sx of [-0.7, 0.7]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), lightMat);
    head.position.set(sx, 0.7, CAR.length / 2 + 0.02);
    group.add(head);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a22 });
  for (const sx of [-0.7, 0.7]) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), tailMat);
    tail.position.set(sx, 0.7, -CAR.length / 2 - 0.02);
    group.add(tail);
  }
  let beacon = null;
  if (police) {
    beacon = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.22, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xff2233 }),
    );
    beacon.position.set(0, 1.72, -0.2);
    group.add(beacon);
  }
  group.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return { group, wheels, beacon };
}

// Handling per vehicle kind: bikes are quick, twitchy and fast; buses are
// slow, wide and hard to turn; ordinary cars sit in the middle.
export const HANDLING = {
  car: { accel: 26, brake: 42, maxSpeed: 40, maxReverse: 11, steer: 0.55, radius: 1.6, grip: 1 },
  bike: { accel: 34, brake: 38, maxSpeed: 52, maxReverse: 8, steer: 0.9, radius: 1.1, grip: 0.85 },
  bus: { accel: 15, brake: 30, maxSpeed: 26, maxReverse: 7, steer: 0.32, radius: 2.4, grip: 1 },
};

/** A motorcycle: two wheels, a low frame, handlebars, a headlight. */
export function makeMotorcycleMesh(color) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const dark = new THREE.MeshLambertMaterial({ color: 0x14161a });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 2.1), paint);
  frame.position.y = 0.75;
  group.add(frame);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.18, 0.8), dark);
  seat.position.set(0, 0.98, -0.5);
  group.add(seat);
  const tank = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.7), paint);
  tank.position.set(0, 1.0, 0.45);
  group.add(tank);
  const bars = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 6), dark);
  bars.rotation.z = Math.PI / 2;
  bars.position.set(0, 1.15, 0.95);
  group.add(bars);
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.1), new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
  lamp.position.set(0, 0.85, 1.12);
  group.add(lamp);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.18, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x0c0d0f });
  const wheels = [];
  for (const wz of [1.0, -1.0]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(0, 0.36, wz);
    group.add(wheel);
    wheels.push(wheel);
  }
  return { group, wheels, beacon: null };
}

/** A city bus: long, tall, a band of windows and a route number up front. */
export function makeBusMesh(color) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const glass = new THREE.MeshLambertMaterial({ color: 0x9fc4dd });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.2, 10.5), paint);
  body.position.y = 1.55;
  group.add(body);
  const windows = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.8, 9.2), glass);
  windows.position.y = 1.95;
  group.add(windows);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.62, 0.3, 10.55), new THREE.MeshLambertMaterial({ color: 0xf2c230 }));
  stripe.position.y = 0.85;
  group.add(stripe);
  const dest = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 0.1), new THREE.MeshBasicMaterial({ color: 0x222222 }));
  dest.position.set(0, 2.3, 5.28);
  group.add(dest);
  const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x0c0d0f });
  const wheels = [];
  for (const [wx, wz] of [[-1.15, 3.4], [1.15, 3.4], [-1.15, -3.4], [1.15, -3.4]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.5, wz);
    group.add(wheel);
    wheels.push(wheel);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const sx of [-0.9, 0.9]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), lightMat);
    head.position.set(sx, 0.8, 5.28);
    group.add(head);
  }
  return { group, wheels, beacon: null };
}

function roadHeading(x, z) {
  // Traffic follows the road grid: head along the nearer road axis.
  const snap = (v) => CITY.roads.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
  const rx = snap(x);
  const rz = snap(z);
  return Math.abs(rx - x) < Math.abs(rz - z) ? 0 : Math.PI / 2;
}

export function createVehicles(world, random) {
  const cars = [];
  const palette = [0x3a6fd8, 0xe8e8e8, 0x2e2e33, 0x7a4fd0, 0x4fae62, PALETTE.taxi, 0xc77b2d];

  function spawnCar(x, z, color, police = false, kind = 'car') {
    const mesh = kind === 'bike' ? makeMotorcycleMesh(color)
      : kind === 'bus' ? makeBusMesh(color)
        : makeCarMesh(color, police);
    mesh.group.position.set(x, 0, z);
    world.scene.add(mesh.group);
    const car = {
      mesh, x, z, heading: roadHeading(x, z), speed: 0, police,
      kind, color, isTaxi: color === PALETTE.taxi && kind === 'car',
      handling: HANDLING[kind] || HANDLING.car,
      lean: 0,
      target: null, stuck: 0, sirenPhase: random() * Math.PI * 2,
    };
    cars.push(car);
    return car;
  }

  function spawnBike(x, z, color) {
    const bike = spawnCar(x, z, color, false, 'bike');
    bike.parked = true;
    return bike;
  }

  function spawnBus(x, z, color) {
    const bus = spawnCar(x, z, color, false, 'bus');
    bus.parked = true;
    return bus;
  }

  // Parked cars along the roads, free to steal.
  const parked = [];
  for (let i = 0; i < 14; i += 1) {
    const road = CITY.roads[Math.floor(random() * CITY.roads.length)];
    const along = -200 + random() * 400;
    const horizontal = random() < 0.5;
    const x = horizontal ? along : road + (random() < 0.5 ? -5 : 5);
    const z = horizontal ? road + (random() < 0.5 ? -5 : 5) : along;
    const color = palette[Math.floor(random() * palette.length)];
    const car = spawnCar(x, z, color);
    car.parked = true;
    car.heading = horizontal ? (random() < 0.5 ? 0 : Math.PI) : (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    parked.push(car);
  }

  // Motorcycles and a city bus, parked and stealable like the cars.
  const bikes = [];
  for (let i = 0; i < 3; i += 1) {
    const road = CITY.roads[Math.floor(random() * CITY.roads.length)];
    const along = -180 + random() * 360;
    const horizontal = random() < 0.5;
    const x = horizontal ? along : road + (random() < 0.5 ? -5 : 5);
    const z = horizontal ? road + (random() < 0.5 ? -5 : 5) : along;
    const bike = spawnBike(x, z, [0xd83a2e, 0x2fb3a3, 0x1a1a1a][i % 3]);
    bike.heading = horizontal ? (random() < 0.5 ? 0 : Math.PI) : (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    bike.mesh.group.rotation.y = bike.heading;
    bikes.push(bike);
  }
  const buses = [];
  const cityBus = spawnBus(36 + (random() < 0.5 ? -5 : 5), -120, 0x2f7a9e);
  cityBus.heading = Math.PI / 2;
  cityBus.mesh.group.rotation.y = cityBus.heading;
  buses.push(cityBus);

  // Moving traffic, looping the road grid.
  const traffic = [];
  for (let i = 0; i < 10; i += 1) {
    const road = CITY.roads[Math.floor(random() * CITY.roads.length)];
    const along = -200 + random() * 400;
    const horizontal = random() < 0.5;
    const x = horizontal ? along : road + (random() < 0.5 ? -3.5 : 3.5);
    const z = horizontal ? road + (random() < 0.5 ? -3.5 : 3.5) : along;
    const car = spawnCar(x, z, palette[Math.floor(random() * palette.length)]);
    car.parked = false;
    car.speed = 7 + random() * 5;
    car.heading = horizontal ? (random() < 0.5 ? 0 : Math.PI) : (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    traffic.push(car);
  }

  // One bus runs a slow loop on the avenue, part of the traffic.
  const routeBus = spawnBus(-180, 36 + 3.5, 0x2f7a9e);
  routeBus.parked = false;
  routeBus.speed = 9;
  routeBus.heading = Math.PI / 2;
  routeBus.mesh.group.rotation.y = routeBus.heading;
  traffic.push(routeBus);
  buses.push(routeBus);

  const police = [];
  function spawnPolice(x, z) {
    const car = spawnCar(x, z, 0x101418, true);
    car.parked = false;
    car.speed = 0;
    police.push(car);
    return car;
  }

  function stepCar(car, dt, throttle, steer, turnScale = 1) {
    const h = car.handling || HANDLING.car;
    const accel = throttle > 0 ? h.accel * throttle : throttle < 0 ? -h.brake : 0;
    car.speed += accel * dt;
    if (throttle === 0) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
    car.speed = Math.max(-h.maxReverse, Math.min(h.maxSpeed, car.speed));
    const turn = steer * h.steer * turnScale * dt * (car.speed >= 0 ? 1 : -1) * Math.min(1, Math.abs(car.speed) / 8 + 0.25);
    car.heading += turn * Math.sign(car.speed || 1);
    // Bikes lean into the turn and slide a little; buses stay flat and wide.
    if (car.kind === 'bike') {
      const wantLean = -steer * Math.min(1, Math.abs(car.speed) / 20) * 0.45;
      car.lean += (wantLean - car.lean) * Math.min(1, dt * 8);
    } else {
      car.lean = 0;
    }
    const nx = car.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.z + Math.cos(car.heading) * car.speed * dt;
    const hit = world.collide(nx, nz, h.radius);
    if (hit.x !== nx || hit.z !== nz) car.speed *= car.kind === 'bike' ? 0.4 : 0.55;
    car.x = hit.x;
    car.z = hit.z;
    car.mesh.group.position.set(car.x, 0, car.z);
    car.mesh.group.rotation.y = car.heading;
    car.mesh.group.rotation.z = car.lean || 0;
    const wheelR = car.kind === 'bike' ? 0.36 : car.kind === 'bus' ? 0.5 : 0.42;
    for (const wheel of car.mesh.wheels) wheel.rotation.x += (car.speed * dt) / wheelR;
    if (car.mesh.beacon) {
      car.sirenPhase += dt * 10;
      car.mesh.beacon.material.color.setHex(Math.sin(car.sirenPhase) > 0 ? 0xff2233 : 0x2266ff);
    }
  }

  function stepTraffic(dt) {
    for (const car of traffic) {
      // At an intersection, sometimes turn onto the crossing road.
      const nearX = CITY.roads.some((r) => Math.abs(car.x - r) < 1.2);
      const nearZ = CITY.roads.some((r) => Math.abs(car.z - r) < 1.2);
      if (nearX && nearZ && random() < 0.02) {
        car.heading += (random() < 0.5 ? 1 : -1) * Math.PI / 2;
      }
      stepCar(car, dt, 0.5, 0);
      // Gentle separation so traffic does not pile up.
      for (const other of cars) {
        if (other === car || other.parked) continue;
        const dx = car.x - other.x;
        const dz = car.z - other.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < 25 && d2 > 0.01) {
          const d = Math.sqrt(d2);
          car.x += (dx / d) * 0.6 * dt * 10;
          car.z += (dz / d) * 0.6 * dt * 10;
        }
      }
    }
  }

  /**
   * Police pursuit, road-following: a cruiser drives straight along its road
   * and only turns at intersections, where it picks the outgoing road that
   * most reduces its Manhattan distance to the target — then brakes for the
   * turn so it does not overshoot into the blocks. Cruisers are dumb but
   * they stay on the roads instead of beelining through buildings.
   * Exception: a cruiser that catches the player on foot brakes to a crawl
   * and turns straight at them to make the arrest, instead of driving past.
   */
  function stepPolice(dt, tx, tz, active, targetInCar = true) {
    let closest = Infinity;
    const snap = (v) => CITY.roads.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
    const headings = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
    for (const car of police) {
      if (!active) {
        car.speed = Math.max(0, car.speed - 20 * dt);
        stepCar(car, dt, 0, 0);
        continue;
      }
      const dx = tx - car.x;
      const dz = tz - car.z;
      const dist = Math.hypot(dx, dz);
      closest = Math.min(closest, dist);
      if (!targetInCar && dist < 12) {
        // Arrest: brake to a crawl and face the player.
        const wantH = Math.atan2(dx, dz);
        let dh = wantH - car.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        const steer = Math.max(-1, Math.min(1, dh * 2));
        const throttle = car.speed > 3 ? -1 : 0.15;
        stepCar(car, dt, throttle, steer, 2.2);
        continue;
      }
      const rx = snap(car.x);
      const rz = snap(car.z);
      const atJunction = Math.abs(car.x - rx) < 6 && Math.abs(car.z - rz) < 6;
      const junctionKey = `${rx},${rz}`;
      if (atJunction && car.lastJunction !== junctionKey) {
        car.lastJunction = junctionKey;
        let best = car.heading;
        let bestScore = Infinity;
        for (const h of headings) {
          // Never reverse on the spot; every other road out is fair game.
          let dd = h - car.heading;
          while (dd > Math.PI) dd -= Math.PI * 2;
          while (dd < -Math.PI) dd += Math.PI * 2;
          if (Math.abs(dd) > Math.PI * 0.9) continue;
          const nx = rx + Math.sin(h) * 12;
          const nz = rz + Math.cos(h) * 12;
          const score = Math.abs(nx - tx) + Math.abs(nz - tz);
          if (score < bestScore) { bestScore = score; best = h; }
        }
        car.nextHeading = best;
      }
      if (car.nextHeading === undefined) car.nextHeading = car.heading;
      let diff = car.nextHeading - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const turning = Math.abs(diff) > 0.15;
      const throttle = turning ? (car.speed > 9 ? -1 : 0.3) : (dist > 6 ? 1 : 0.4);
      const steer = Math.max(-1, Math.min(1, diff * 2));
      stepCar(car, dt, throttle, steer, 2.2);
    }
    return closest;
  }

  return {
    cars, parked, traffic, police, bikes, buses, spawnCar, spawnPolice, spawnBike, spawnBus,
    stepCar, stepTraffic, stepPolice,
    removePolice() {
      for (const car of police) world.scene.remove(car.mesh.group);
      police.length = 0;
      for (let i = cars.length - 1; i >= 0; i -= 1) {
        if (cars[i].police) cars.splice(i, 1);
      }
    },
  };
}
