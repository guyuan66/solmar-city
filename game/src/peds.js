// Pedestrians: sidewalk walkers who stroll, scatter when a car comes at them,
// and fall over when hit (which the police notice). Simple capsule people in
// bright clothes so the streets read as alive from the minimap and the air.
import * as THREE from 'three';
import { CITY } from './config.js';

const SHIRTS = [0xe14b7a, 0x2fb3a3, 0xf2a541, 0x7a4fd0, 0xe8e8e8, 0x4fae62, 0xd83a2e];

export function createPeds(world, random) {
  const peds = [];
  const group = new THREE.Group();
  world.scene.add(group);

  function makePed() {
    const person = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({ color: SHIRTS[Math.floor(random() * SHIRTS.length)] });
    const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
    const legs = new THREE.MeshLambertMaterial({ color: 0x2c3550 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.9, 8), shirt);
    body.position.y = 1.05;
    person.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), skin);
    head.position.y = 1.78;
    person.add(head);
    for (const sx of [-0.14, 0.14]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.7, 6), legs);
      leg.position.set(sx, 0.35, 0);
      person.add(leg);
    }
    // Hailers get a raised arm they wave when a taxi fare is waiting.
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.8, 6), skin);
    arm.position.set(0.45, 1.5, 0);
    arm.rotation.z = -0.9;
    arm.visible = false;
    person.add(arm);
    return { person, arm };
  }

  function sidewalkPoint() {
    // Walk on a sidewalk edge: just outside a block, along a road.
    const bx = CITY.blocks[Math.floor(random() * CITY.blocks.length)];
    const bz = CITY.blocks[Math.floor(random() * CITY.blocks.length)];
    const edge = Math.floor(random() * 4);
    const off = 30 + random() * 4;
    if (edge === 0) return { x: bx + (random() - 0.5) * 56, z: bz - off };
    if (edge === 1) return { x: bx + (random() - 0.5) * 56, z: bz + off };
    if (edge === 2) return { x: bx - off, z: bz + (random() - 0.5) * 56 };
    return { x: bx + off, z: bz + (random() - 0.5) * 56 };
  }

  for (let i = 0; i < 18; i += 1) {
    const { person: mesh, arm } = makePed();
    group.add(mesh);
    const p = sidewalkPoint();
    // Three of the walkers are hailers: when a taxi fare is waiting they
    // hurry toward the pickup and wave it down (see step()).
    const hailer = i < 3;
    if (hailer) arm.visible = true;
    peds.push({
      mesh, arm, hailer, x: p.x, z: p.z,
      heading: random() * Math.PI * 2,
      speed: 1.1 + random() * 0.9,
      down: false, downTime: 0, retarget: 0, waving: false,
    });
  }

  function step(dt, playerX, playerZ, playerSpeed, opts = {}) {
    const wanted = opts.wanted ?? 0;
    const taxiWaiting = !!opts.taxiWaiting;
    for (const ped of peds) {
      if (ped.down) {
        ped.downTime += dt;
        ped.mesh.rotation.x = Math.min(Math.PI / 2, ped.mesh.rotation.x + dt * 6);
        if (ped.downTime > 6) {
          ped.down = false;
          ped.downTime = 0;
          ped.mesh.rotation.x = 0;
          const p = sidewalkPoint();
          ped.x = p.x;
          ped.z = p.z;
        }
        continue;
      }
      // Scatter from a fast car or player running at them.
      const dx = ped.x - playerX;
      const dz = ped.z - playerZ;
      const d = Math.hypot(dx, dz);
      ped.waving = false;
      if (wanted >= 3 && d < 25) {
        // High heat: nearby pedestrians flee the player in a panic.
        ped.heading = Math.atan2(dx, dz);
        ped.speed = 4.2;
      } else if (ped.hailer && taxiWaiting && opts.taxiX !== undefined) {
        // Hailer: hurry toward the waiting fare's pickup and wave.
        const tdx = opts.taxiX - ped.x;
        const tdz = opts.taxiZ - ped.z;
        const td = Math.hypot(tdx, tdz);
        if (td > 5) {
          ped.heading = Math.atan2(tdx, tdz);
          ped.speed = 2.2;
        } else {
          ped.speed = 0;
          ped.waving = true;
        }
      } else if (d < 7 && playerSpeed > 4) {
        ped.heading = Math.atan2(dx, dz);
        ped.speed = 3.2;
      } else {
        ped.speed = 1.1 + Math.sin(ped.retarget) * 0.3 + 0.4;
      }
      ped.retarget += dt;
      if (ped.retarget > 6 + Math.sin(ped.x) * 2) {
        ped.retarget = 0;
        ped.heading += (random() - 0.5) * 1.6;
      }
      ped.x += Math.sin(ped.heading) * ped.speed * dt;
      ped.z += Math.cos(ped.heading) * ped.speed * dt;
      const hit = world.collide(ped.x, ped.z, 0.5);
      ped.x = hit.x;
      ped.z = hit.z;
      ped.mesh.position.set(ped.x, 0, ped.z);
      ped.mesh.rotation.y = ped.heading;
      ped.mesh.position.y = Math.abs(Math.sin(ped.retarget * 6)) * 0.06;
      // Waving arm: sweep while the hailer waits at the pickup.
      if (ped.hailer) ped.arm.rotation.z = ped.waving ? -0.9 + Math.sin(ped.retarget * 9) * 0.45 : -0.9;
    }
  }

  /** Knock a pedestrian down; returns true when one was hit. */
  function hitAt(x, z, radius) {
    for (const ped of peds) {
      if (ped.down) continue;
      if (Math.hypot(ped.x - x, ped.z - z) < radius) {
        ped.down = true;
        ped.downTime = 0;
        return true;
      }
    }
    return false;
  }

  return { peds, step, hitAt };
}
