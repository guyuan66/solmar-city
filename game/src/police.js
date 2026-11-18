// Police escalation: roadblocks and the helicopter.
// At 2 stars the Solmar PD starts throwing roadblocks across the roads ahead
// of the player — striped barriers with a cruiser parked behind them, hard to
// pass at speed. At 4 stars a helicopter joins the hunt: it hovers over the
// player, sweeps a spotlight across the ground, and its crew calls in the
// cruisers' positions, so on-foot busts come faster while it is overhead.
// Both stand down as the heat cools off.
import * as THREE from 'three';
import { CITY, POLICE } from './config.js';
import { pickOne, pickInt } from './random.js';

const ROADBLOCK_STARS = POLICE.roadblockStars;
const HELI_STARS = POLICE.heliStars;
const MAX_BLOCKS = POLICE.maxBlocks;

export function createPoliceOps(world, vehicles, random) {
  const scene = world.scene;

  // --- Roadblocks -------------------------------------------------------
  const blocks = [];
  const stripeMatA = new THREE.MeshLambertMaterial({ color: 0xf2c230 });
  const stripeMatB = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const coneMat = new THREE.MeshLambertMaterial({ color: 0xe14b2a });

  function makeBarrier() {
    const group = new THREE.Group();
    // Striped sawhorse barrier, wide enough to close a lane and a half.
    for (let i = 0; i < 3; i += 1) {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(5.4, 0.35, 0.18),
        i % 2 === 0 ? stripeMatA : stripeMatB,
      );
      stripe.position.set(0, 0.55 + i * 0.42, 0);
      group.add(stripe);
    }
    for (const sx of [-2.4, 2.4]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.6, 0.9), stripeMatB);
      leg.position.set(sx, 0.8, 0);
      group.add(leg);
    }
    // Cones funnel traffic toward the gap.
    for (let i = 0; i < 4; i += 1) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 8), coneMat);
      cone.position.set(-6 + i * 1.6, 0.45, 2.6);
      group.add(cone);
    }
    return group;
  }

  function intersectionsAhead(px, pz, heading) {
    // Intersections roughly ahead of the player, so the block is a surprise
    // on the road the player is actually driving down.
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    const scored = [];
    for (const x of CITY.roads) {
      for (const z of CITY.roads) {
        const dx = x - px;
        const dz = z - pz;
        const along = dx * fx + dz * fz;
        const across = Math.abs(dx * fz - dz * fx);
        if (along > 45 && along < 190 && across < 26) {
          scored.push({ x, z, along });
        }
      }
    }
    scored.sort((a, b) => a.along - b.along);
    return scored;
  }

  function spawnBlock(x, z, heading) {
    const group = makeBarrier();
    // Face across the road the player is travelling: if the player moves
    // mostly along x, the barrier must span z, and vice versa.
    const alongX = Math.abs(Math.sin(heading)) > Math.abs(Math.cos(heading));
    group.rotation.y = alongX ? Math.PI / 2 : 0;
    group.position.set(x, 0, z);
    scene.add(group);
    const block = { group, x, z, life: 45 };
    blocks.push(block);
    return block;
  }

  function clearBlocks() {
    for (const b of blocks) scene.remove(b.group);
    blocks.length = 0;
  }

  /** True when the player is inside a roadblock's footprint. */
  function hitBlock(x, z) {
    for (const b of blocks) {
      if (Math.hypot(x - b.x, z - b.z) < 3.4) return b;
    }
    return null;
  }

  // --- Helicopter -------------------------------------------------------
  const heli = new THREE.Group();
  const heliBody = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 1.4, 5.2),
    new THREE.MeshLambertMaterial({ color: 0x1c4fd6 }),
  );
  heliBody.position.y = 0;
  heli.add(heliBody);
  const heliGlass = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 0.9, 1.6),
    new THREE.MeshLambertMaterial({ color: 0x9fc4dd }),
  );
  heliGlass.position.set(0, 0.15, 2.0);
  heli.add(heliGlass);
  const tail = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.7, 4.4),
    new THREE.MeshLambertMaterial({ color: 0x1c4fd6 }),
  );
  tail.position.set(0, 0.2, -4.4);
  heli.add(tail);
  const rotorGeo = new THREE.BoxGeometry(11, 0.08, 0.7);
  const rotorMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const rotor = new THREE.Mesh(rotorGeo, rotorMat);
  rotor.position.y = 1.05;
  heli.add(rotor);
  const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.2, 0.5), rotorMat);
  tailRotor.position.set(0.4, 0.3, -6.2);
  heli.add(tailRotor);
  // The searchlight: a cone of pale light aimed at the ground below.
  const spot = new THREE.SpotLight(0xfff2b0, 60, 90, 0.32, 0.5, 1.2);
  const spotTarget = new THREE.Object3D();
  heli.add(spot);
  heli.add(spotTarget);
  spot.target = spotTarget;
  spotTarget.position.set(0, -40, 0);
  const beamCone = new THREE.Mesh(
    new THREE.ConeGeometry(7, 38, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }),
  );
  beamCone.position.y = -19;
  beamCone.rotation.x = Math.PI;
  heli.add(beamCone);
  heli.visible = false;
  scene.add(heli);

  let heliActive = false;
  let heliHeading = 0;
  let blockTimer = 0;
  let announcedHeli = false;
  let announcedBlock = false;

  function step(dt, player, stars, time) {
    // --- Roadblocks ---
    blockTimer -= dt;
    if (stars >= ROADBLOCK_STARS && blocks.length < MAX_BLOCKS && blockTimer <= 0) {
      const ahead = intersectionsAhead(player.x, player.z, player.heading);
      if (ahead.length > 0) {
        const spot = pickOne(random, ahead.slice(0, 2));
        const p = world.nearestRoadPoint(spot.x, spot.z);
        const tooClose = blocks.some((b) => Math.hypot(b.x - p.x, b.z - p.z) < 40);
        if (!tooClose) {
          spawnBlock(p.x, p.z, player.heading);
          blockTimer = pickInt(random, POLICE.blockIntervalMinSeconds, POLICE.blockIntervalMaxSeconds);
          if (!announcedBlock) {
            announcedBlock = true;
            return { event: 'roadblock', message: 'Roadblock ahead! The PD is closing the streets.' };
          }
        }
      }
    }
    if (stars < ROADBLOCK_STARS) {
      if (blocks.length > 0) clearBlocks();
      announcedBlock = false;
    }
    for (let i = blocks.length - 1; i >= 0; i -= 1) {
      blocks[i].life -= dt;
      if (blocks[i].life <= 0) {
        scene.remove(blocks[i].group);
        blocks.splice(i, 1);
      }
    }

    // --- Helicopter ---
    const wantHeli = stars >= HELI_STARS;
    if (wantHeli && !heliActive) {
      heliActive = true;
      heli.visible = true;
      heli.position.set(player.x - 30, 42, player.z - 30);
      if (!announcedHeli) {
        announcedHeli = true;
        return { event: 'heli', message: 'POLICE HELICOPTER overhead — lose it or lose the streets.' };
      }
    }
    if (!wantHeli && heliActive) {
      heliActive = false;
      heli.visible = false;
      announcedHeli = false;
    }
    if (heliActive) {
      // Chase the player from 40 m up, easing in so it feels like pursuit.
      const tx = player.x + Math.sin(time * 0.4) * 6;
      const tz = player.z + Math.cos(time * 0.4) * 6;
      const k = 1 - Math.exp(-dt * 0.9);
      heli.position.x += (tx - heli.position.x) * k;
      heli.position.z += (tz - heli.position.z) * k;
      heli.position.y += (42 + Math.sin(time * 1.3) * 2 - heli.position.y) * k;
      heliHeading += dt * 0.8;
      heli.rotation.y = Math.atan2(player.x - heli.position.x, player.z - heli.position.z);
      rotor.rotation.y += dt * 22;
      tailRotor.rotation.x += dt * 30;
      spotTarget.position.set(
        player.x - heli.position.x,
        -heli.position.y,
        player.z - heli.position.z,
      );
    }
    return { event: null };
  }

  function reset() {
    clearBlocks();
    heliActive = false;
    heli.visible = false;
    announcedHeli = false;
    announcedBlock = false;
    blockTimer = 0;
  }

  return {
    step, reset, hitBlock,
    get blocks() { return blocks; },
    get heliActive() { return heliActive; },
    get heliPos() { return heliActive ? { x: heli.position.x, z: heli.position.z } : null; },
    /** While the helicopter is overhead, on-foot busts come faster (see POLICE.heliBustPressure). */
    get bustPressure() { return heliActive ? POLICE.heliBustPressure : 1; },
  };
}
