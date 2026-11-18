// Weather and the day/night cycle for Solmar City.
// A 24-hour clock drives the sun and moon across the sky; the directional
// light, sky colour and fog all follow the hour, so dusk, night, dawn and
// noon each read differently on screen. Rain and fog roll in on their own
// schedule: rain is a falling point cloud with a patter of darker light,
// fog pulls the fog planes in close and washes the skyline out.
import * as THREE from 'three';
import { WEATHER } from './config.js';
import { pickWeighted, pickInt } from './random.js';

const DAY_LENGTH = WEATHER.dayLengthSeconds; // in-game seconds per full day
const RAIN_DROPS = 700;

// Sky and light keyframes: [hour, sky top, fog colour, sun colour, sun intensity, hemi intensity]
const KEYS = [
  [0, 0x0a1026, 0x0a1026, 0x8fa3d9, 0.25, 0.25],
  [5, 0x0d1533, 0x141a2e, 0x8fa3d9, 0.3, 0.3],
  [6.5, 0x4a3a6b, 0x8a6a72, 0xffb37a, 0.9, 0.5],
  [8, 0x6fa8d8, 0xc7d6e2, 0xffe0b0, 1.7, 0.85],
  [12, 0x2e6fb0, 0xbcd8e8, 0xfff2cf, 2.1, 1.0],
  [16.5, 0x3a6fb0, 0xc7d0d8, 0xffe0a8, 1.9, 0.9],
  [18, 0x2e4a7a, 0xd98a5f, 0xff9d5c, 1.4, 0.6],
  [19.5, 0x8a4a6b, 0x6b4a5e, 0xff7a5c, 0.7, 0.4],
  [21, 0x0d1533, 0x12182b, 0x8fa3d9, 0.3, 0.28],
  [24, 0x0a1026, 0x0a1026, 0x8fa3d9, 0.25, 0.25],
];

function lerpColor(a, b, t) {
  const ca = new THREE.Color(a);
  const cb = new THREE.Color(b);
  return ca.lerp(cb, t);
}

function sampleKeys(hour) {
  let i = 0;
  while (i < KEYS.length - 2 && hour >= KEYS[i + 1][0]) i += 1;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = Math.max(0, Math.min(1, (hour - a[0]) / (b[0] - a[0] || 1)));
  return {
    sky: lerpColor(a[1], b[1], t),
    fog: lerpColor(a[2], b[2], t),
    sun: lerpColor(a[3], b[3], t),
    sunI: a[4] + (b[4] - a[4]) * t,
    hemiI: a[5] + (b[5] - a[5]) * t,
  };
}

function clockLabel(hour) {
  const h = Math.floor(hour) % 24;
  const m = Math.floor((hour % 1) * 60);
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  if (hour >= 5 && hour < 7) return `${hh}:${mm} DAWN`;
  if (hour >= 7 && hour < 17) return `${hh}:${mm} DAY`;
  if (hour >= 17 && hour < 19.5) return `${hh}:${mm} DUSK`;
  return `${hh}:${mm} NIGHT`;
}

export function createWeather(world, random) {
  const scene = world.scene;
  const sunLight = world.sun;
  const hemi = world.hemi;

  // The visible sun and moon: bright discs that track the clock.
  const sunDisc = new THREE.Mesh(
    new THREE.SphereGeometry(9, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8, fog: false }),
  );
  scene.add(sunDisc);
  const moonDisc = new THREE.Mesh(
    new THREE.SphereGeometry(6, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xdfe8f5, fog: false }),
  );
  scene.add(moonDisc);

  // Rain: a box of streaks centred on the camera target, recycled as they fall.
  const rainGeo = new THREE.BufferGeometry();
  const rainPos = new Float32Array(RAIN_DROPS * 3);
  const rainSpeed = new Float32Array(RAIN_DROPS);
  for (let i = 0; i < RAIN_DROPS; i += 1) {
    rainPos[i * 3] = (random() - 0.5) * 220;
    rainPos[i * 3 + 1] = random() * 60;
    rainPos[i * 3 + 2] = (random() - 0.5) * 220;
    rainSpeed[i] = 38 + random() * 22;
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rainMat = new THREE.PointsMaterial({
    color: 0x9fb8cc, size: 0.55, transparent: true, opacity: 0.55, sizeAttenuation: true,
  });
  const rain = new THREE.Points(rainGeo, rainMat);
  rain.visible = false;
  rain.frustumCulled = false;
  scene.add(rain);

  // Street lamps glow after dark: collect the lamp bulbs world built.
  const lampBulbs = [];
  scene.traverse((o) => {
    if (o.isMesh && o.material && o.material.isMeshBasicMaterial && o.geometry
      && o.geometry.type === 'SphereGeometry' && o.position.y > 5.5 && o.position.y < 6.5) {
      lampBulbs.push(o);
    }
  });

  let hour = 17.4; // start at golden dusk, the city's best light
  let kind = 'clear'; // clear | rain | fog
  let kindTimer = WEATHER.firstKindSeconds;
  let rainAmount = 0; // 0..1 fades in/out
  let fogAmount = 0;
  let flash = 0; // lightning flash, 0..1, decays fast
  let flashTimer = 6 + pickInt(random, 0, 8);
  let centre = { x: 0, z: 0 };

  function pickNextKind() {
    return pickWeighted(random, [
      ['clear', WEATHER.weights.clear],
      ['rain', WEATHER.weights.rain],
      ['fog', WEATHER.weights.fog],
    ]);
  }

  function apply(dt) {
    const k = sampleKeys(hour);
    // Daytime sun arcs east to west; at night the moon takes its place.
    const dayFrac = (hour - 6) / 12; // 0 at dawn, 1 at dusk
    const sunAngle = Math.PI * Math.max(0, Math.min(1, dayFrac));
    const isDay = hour >= 6 && hour < 19;
    const elev = Math.sin(sunAngle);
    const az = Math.cos(sunAngle);
    if (isDay) {
      sunLight.position.set(az * 160, 30 + elev * 130, -60 + az * 40);
      sunDisc.position.set(az * 320, 40 + elev * 260, -120 + az * 60);
      sunDisc.visible = true;
      moonDisc.visible = false;
    } else {
      const nightFrac = hour >= 19 ? (hour - 19) / 11 : (hour + 5) / 11;
      const mAngle = Math.PI * nightFrac;
      sunLight.position.set(Math.cos(mAngle) * 120, 60 + Math.sin(mAngle) * 90, 80);
      moonDisc.position.set(Math.cos(mAngle) * 300, 60 + Math.sin(mAngle) * 220, 140);
      moonDisc.visible = true;
      sunDisc.visible = false;
    }
    const rainDim = 1 - rainAmount * 0.45;
    const fogDim = 1 - fogAmount * 0.25;
    sunLight.color.copy(k.sun);
    // A lightning flash briefly floods the scene with cold white light.
    if (flash > 0) sunLight.color.lerp(new THREE.Color(0xeaf2ff), flash * 0.8);
    sunLight.intensity = k.sunI * rainDim * fogDim + flash * 3.5;
    hemi.intensity = k.hemiI * rainDim;
    scene.background = k.sky;
    // Fog: clear days see far, rain shortens the view, fog closes it in.
    const fogNear = 180 - rainAmount * 60 - fogAmount * 130;
    const fogFar = 520 - rainAmount * 190 - fogAmount * 380;
    scene.fog.color.copy(k.fog);
    scene.fog.near = Math.max(30, fogNear);
    scene.fog.far = Math.max(90, fogFar);
    // Lamps burn bright at night, dim by day.
    const nightGlow = isDay ? 0.25 : 1;
    for (const bulb of lampBulbs) {
      bulb.material.color.setHex(nightGlow > 0.6 ? 0xffe9b0 : 0x8a7a55);
    }
  }

  function step(dt, focus) {
    if (focus) centre = focus;
    hour = (hour + (dt / DAY_LENGTH) * 24) % 24;
    kindTimer -= dt;
    if (kindTimer <= 0) {
      kind = pickNextKind();
      kindTimer = pickInt(random, WEATHER.kindDurationMin, WEATHER.kindDurationMax);
    }
    const wantRain = kind === 'rain' ? 1 : 0;
    const wantFog = kind === 'fog' ? 1 : 0;
    rainAmount += Math.max(-dt * 0.4, Math.min(dt * 0.4, wantRain - rainAmount));
    fogAmount += Math.max(-dt * 0.25, Math.min(dt * 0.25, wantFog - fogAmount));
    // Lightning only in real rain: a flash every few seconds, gone in a blink.
    flash = Math.max(0, flash - dt * 4);
    if (kind === 'rain' && rainAmount > 0.6) {
      flashTimer -= dt;
      if (flashTimer <= 0) {
        flash = 1;
        flashTimer = pickInt(random, 4, 13);
      }
    }
    rain.visible = rainAmount > 0.03;
    if (rain.visible) {
      rain.position.set(centre.x, 0, centre.z);
      const pos = rainGeo.attributes.position.array;
      for (let i = 0; i < RAIN_DROPS; i += 1) {
        pos[i * 3 + 1] -= rainSpeed[i] * dt;
        pos[i * 3] -= 6 * dt; // slant: wind from the east
        if (pos[i * 3 + 1] < 0) {
          pos[i * 3 + 1] = 45 + random() * 15;
          pos[i * 3] = (random() - 0.5) * 220;
          pos[i * 3 + 2] = (random() - 0.5) * 220;
        }
      }
      rainGeo.attributes.position.needsUpdate = true;
      rainMat.opacity = 0.55 * rainAmount;
    }
    apply(dt);
  }

  apply(0);

  return {
    step,
    get hour() { return hour; },
    get kind() { return kind; },
    get isRaining() { return kind === 'rain' && rainAmount > 0.5; },
    get isNight() { return hour < 6 || hour >= 19; },
    get rainAmount() { return rainAmount; },
    get fogAmount() { return fogAmount; },
    label() {
      const weather = kind === 'rain' ? 'RAIN' : kind === 'fog' ? 'FOG' : 'CLEAR';
      return `${clockLabel(hour)} · ${weather}`;
    },
    /** Staging hook: pin the clock and weather for a screenshot. */
    debugSet(h, k) {
      hour = h;
      kind = k;
      kindTimer = 9999;
      rainAmount = k === 'rain' ? 1 : 0;
      fogAmount = k === 'fog' ? 1 : 0;
      apply(0);
    },
  };
}
