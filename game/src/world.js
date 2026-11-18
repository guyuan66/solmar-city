// Solmar City: the open world itself. A 5x5 grid of blocks ringed by roads, with
// procedural buildings (canvas window textures, no image assets), palms, lamps,
// a plaza, a dock corner and a motel corner — all original, no borrowed map.
// The world also owns the collision boxes and the road graph traffic drives on.
import * as THREE from 'three';
import { CITY, PALETTE } from './config.js';

function facadeTexture(random, base) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = `#${base.toString(16).padStart(6, '0')}`;
  ctx.fillRect(0, 0, 128, 256);
  // Slight vertical shading so flat boxes read as towers.
  const shade = ctx.createLinearGradient(0, 0, 0, 256);
  shade.addColorStop(0, 'rgba(255,255,255,0.14)');
  shade.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, 128, 256);
  // Lit and dark windows.
  for (let row = 0; row < 12; row += 1) {
    for (let col = 0; col < 6; col += 1) {
      const lit = random() < 0.42;
      ctx.fillStyle = lit ? '#ffd98a' : '#22384f';
      ctx.fillRect(10 + col * 19, 12 + row * 20, 12, 12);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makePalm() {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.3, 5, 6),
    new THREE.MeshLambertMaterial({ color: PALETTE.trunk }),
  );
  trunk.position.y = 2.5;
  group.add(trunk);
  const leafMat = new THREE.MeshLambertMaterial({ color: PALETTE.palm });
  for (let i = 0; i < 6; i += 1) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.7, 3.2, 4), leafMat);
    const angle = (i / 6) * Math.PI * 2;
    leaf.position.set(Math.cos(angle) * 1.1, 5.2, Math.sin(angle) * 1.1);
    leaf.rotation.z = Math.cos(angle) * 1.1;
    leaf.rotation.x = -Math.sin(angle) * 1.1;
    group.add(leaf);
  }
  return group;
}

function makeLamp() {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.12, 6, 6),
    new THREE.MeshLambertMaterial({ color: 0x2c2f36 }),
  );
  pole.position.y = 3;
  group.add(pole);
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffe9b0 }),
  );
  bulb.position.y = 6.1;
  group.add(bulb);
  return group;
}

export function createWorld(random) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.skyTop);
  scene.fog = new THREE.Fog(0xd98a5f, 180, 520);

  const hemi = new THREE.HemisphereLight(0xffd9b0, 0x3a3f4a, 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(PALETTE.sun, 1.9);
  sun.position.set(-120, 90, -60);
  scene.add(sun);

  // Ground and roads.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.ground, CITY.ground),
    new THREE.MeshLambertMaterial({ color: PALETTE.ground }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const roadMat = new THREE.MeshLambertMaterial({ color: PALETTE.road });
  const lineMat = new THREE.MeshBasicMaterial({ color: PALETTE.roadLine });
  const sideMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  for (const c of CITY.roads) {
    const h = new THREE.Mesh(new THREE.PlaneGeometry(CITY.ground, CITY.roadWidth), roadMat);
    h.rotation.x = -Math.PI / 2;
    h.position.set(0, 0.02, c);
    scene.add(h);
    const v = new THREE.Mesh(new THREE.PlaneGeometry(CITY.roadWidth, CITY.ground), roadMat);
    v.rotation.x = -Math.PI / 2;
    v.position.set(c, 0.02, 0);
    scene.add(v);
    // Dashed centre lines along each road.
    for (let t = -CITY.ground / 2 + 8; t < CITY.ground / 2; t += 12) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.5), lineMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(t, 0.04, c);
      scene.add(dash);
      const dashV = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 4), lineMat);
      dashV.rotation.x = -Math.PI / 2;
      dashV.position.set(c, 0.04, t);
      scene.add(dashV);
    }
  }

  // Sidewalk slabs on every block.
  const colliders = [];
  const facadeMats = PALETTE.building.map(
    (color) => new THREE.MeshLambertMaterial({ map: facadeTexture(random, color) }),
  );
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x4a4d55 });
  for (const bx of CITY.blocks) {
    for (const bz of CITY.blocks) {
      // The centre block is Palm Plaza: open, no buildings.
      if (bx === 0 && bz === 0) continue;
      const slab = new THREE.Mesh(new THREE.BoxGeometry(56, 0.3, 56), sideMat);
      slab.position.set(bx, 0.15, bz);
      scene.add(slab);
      const count = 1 + Math.floor(random() * 2);
      for (let i = 0; i < count; i += 1) {
        const w = 14 + random() * 16;
        const d = 14 + random() * 16;
        const h = 12 + random() * 36;
        const ox = (random() - 0.5) * (56 - w - 4);
        const oz = (random() - 0.5) * (56 - d - 4);
        const x = bx + ox;
        const z = bz + oz;
        const mat = facadeMats[Math.floor(random() * facadeMats.length)];
        const tower = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        tower.position.set(x, h / 2 + 0.3, z);
        scene.add(tower);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.8, d + 0.6), roofMat);
        roof.position.set(x, h + 0.7, z);
        scene.add(roof);
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
      }
    }
  }

  // Palm Plaza at the centre: palms, lamps and a small fountain.
  const plaza = new THREE.Mesh(
    new THREE.CylinderGeometry(9, 9, 0.4, 24),
    new THREE.MeshLambertMaterial({ color: 0x7fb2d9 }),
  );
  plaza.position.set(0, 0.2, 0);
  scene.add(plaza);
  for (let i = 0; i < 10; i += 1) {
    const angle = (i / 10) * Math.PI * 2;
    const palm = makePalm();
    palm.position.set(Math.cos(angle) * 22, 0, Math.sin(angle) * 22);
    scene.add(palm);
  }

  // Lamps along the main avenue and palms along the south road.
  for (const c of CITY.roads) {
    for (const t of [-160, -80, 80, 160]) {
      const lamp = makeLamp();
      lamp.position.set(t, 0, c + CITY.roadWidth / 2 + 1.2);
      scene.add(lamp);
    }
  }
  for (let t = -200; t <= 200; t += 40) {
    const palm = makePalm();
    palm.position.set(t, 0, 180 + CITY.roadWidth / 2 + 2);
    scene.add(palm);
  }

  // A few billboards for colour on the skyline.
  const billboards = [
    { x: -144, z: -144, color: 0xe14b7a, text: 'SOLMAR' },
    { x: 144, z: -72, color: 0x2fb3a3, text: 'PALM PLAZA' },
    { x: 72, z: 144, color: 0xf2a541, text: 'DOCKS 24H' },
  ];
  for (const b of billboards) {
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(18, 7, 0.6),
      new THREE.MeshBasicMaterial({ color: b.color }),
    );
    board.position.set(b.x, 26, b.z);
    scene.add(board);
  }

  const half = CITY.ground / 2;
  return {
    scene, sun, hemi,
    colliders,
    /** Push a circle (x, z, radius) out of buildings and the city edge. */
    collide(x, z, radius) {
      let px = x;
      let pz = z;
      for (const b of colliders) {
        const cx = Math.max(b.minX, Math.min(px, b.maxX));
        const cz = Math.max(b.minZ, Math.min(pz, b.maxZ));
        const dx = px - cx;
        const dz = pz - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 < radius * radius) {
          if (d2 < 1e-6) {
            px = b.maxX + radius;
          } else {
            const d = Math.sqrt(d2);
            px = cx + (dx / d) * radius;
            pz = cz + (dz / d) * radius;
          }
        }
      }
      px = Math.max(-half + 2, Math.min(half - 2, px));
      pz = Math.max(-half + 2, Math.min(half - 2, pz));
      return { x: px, z: pz };
    },
    /** True when (x, z) is on a road (not inside a block). */
    onRoad(x, z) {
      const near = (v) => CITY.roads.some((r) => Math.abs(v - r) < CITY.roadWidth / 2 + 1);
      return near(x) || near(z);
    },
    /** Nearest point on the road grid, for spawning traffic and placing markers. */
    nearestRoadPoint(x, z) {
      const snap = (v) => CITY.roads.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
      const rx = snap(x);
      const rz = snap(z);
      return Math.abs(rx - x) < Math.abs(rz - z) ? { x: rx, z } : { x, z: rz };
    },
    intersections: CITY.roads.flatMap((x) => CITY.roads.map((z) => ({ x, z }))),
    spots: {
      plaza: { x: 0, z: 0 },
      docks: { x: 196, z: -196 },
      motel: { x: -196, z: 196 },
      safehouse: { x: -196, z: -196 },
      beach: { x: 196, z: 196 },
    },
  };
}
