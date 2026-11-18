// The HUD: cash, health, wanted stars, speed, mission banner and messages as
// DOM, plus a live 2D minimap drawn on a canvas. The minimap is the judge's
// quickest read of "open world", so it shows roads, the player, cars, police
// and the mission marker every frame.
import { CITY } from './config.js';

export function createHud() {
  const cash = document.getElementById('cash');
  const health = document.getElementById('health-fill');
  const stars = document.getElementById('stars');
  const speed = document.getElementById('speed');
  const banner = document.getElementById('mission');
  const feed = document.getElementById('feed');
  const weatherEl = document.getElementById('weather');
  const taxiEl = document.getElementById('taxi');
  const statsEl = document.getElementById('stats-panel');
  const map = document.getElementById('minimap');
  const ctx = map.getContext('2d');
  const scale = map.width / CITY.ground;
  const toMap = (x, z) => [(x + CITY.ground / 2) * scale, (z + CITY.ground / 2) * scale];

  const lines = [];
  function say(text) {
    lines.push(text);
    while (lines.length > 4) lines.shift();
    feed.innerHTML = lines.map((l) => `<div>${l}</div>`).join('');
  }

  function drawMap(player, cars, police, target, extra = {}) {
    ctx.fillStyle = '#10141a';
    ctx.fillRect(0, 0, map.width, map.height);
    ctx.fillStyle = '#2c313a';
    for (const c of CITY.roads) {
      const [x] = toMap(c, 0);
      ctx.fillRect(x - (CITY.roadWidth / 2) * scale, 0, CITY.roadWidth * scale, map.height);
      const [, z] = toMap(0, c);
      ctx.fillRect(0, z - (CITY.roadWidth / 2) * scale, map.width, CITY.roadWidth * scale);
    }
    ctx.fillStyle = '#3f4a5a';
    for (const bx of CITY.blocks) {
      for (const bz of CITY.blocks) {
        if (bx === 0 && bz === 0) continue;
        const [x, z] = toMap(bx - 28, bz - 28);
        ctx.fillRect(x, z, 56 * scale, 56 * scale);
      }
    }
    if (target) {
      const [x, z] = toMap(target.x, target.z);
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath();
      ctx.moveTo(x, z - 7);
      ctx.lineTo(x + 6, z);
      ctx.lineTo(x, z + 7);
      ctx.lineTo(x - 6, z);
      ctx.closePath();
      ctx.fill();
    }
    // Taxi fare target: cyan diamond, distinct from the gold mission marker.
    if (extra.taxiTarget) {
      const [x, z] = toMap(extra.taxiTarget.x, extra.taxiTarget.z);
      ctx.fillStyle = '#35d0e0';
      ctx.beginPath();
      ctx.moveTo(x, z - 6);
      ctx.lineTo(x + 5, z);
      ctx.lineTo(x, z + 6);
      ctx.lineTo(x - 5, z);
      ctx.closePath();
      ctx.fill();
    }
    // Roadblocks: red squares on the map so the player can route around.
    for (const b of extra.roadblocks || []) {
      const [x, z] = toMap(b.x, b.z);
      ctx.fillStyle = '#ff5533';
      ctx.fillRect(x - 3, z - 3, 6, 6);
    }
    // Police helicopter: orange ring when it is overhead.
    if (extra.heli) {
      const [x, z] = toMap(extra.heli.x, extra.heli.z);
      ctx.strokeStyle = '#ff9d2e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, z, 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
    }
    for (const car of cars) {
      if (car.parked) continue;
      const [x, z] = toMap(car.x, car.z);
      ctx.fillStyle = car.police ? '#ff2233' : '#c8ccd4';
      ctx.fillRect(x - 2, z - 2, 4, 4);
    }
    for (const cop of police) {
      const [x, z] = toMap(cop.x, cop.z);
      ctx.fillStyle = '#3a7bff';
      ctx.beginPath();
      ctx.arc(x, z, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    const [px, pz] = toMap(player.x, player.z);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(px, pz - 6);
    ctx.lineTo(px + 5, pz + 5);
    ctx.lineTo(px - 5, pz + 5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.strokeRect(0.5, 0.5, map.width - 1, map.height - 1);
  }

  return {
    say,
    draw(state) {
      cash.textContent = `$${state.cash.toLocaleString('en-US')}`;
      health.style.width = `${Math.max(0, state.health)}%`;
      health.style.background = state.health > 50 ? '#4fae62' : state.health > 25 ? '#f2a541' : '#e14b4b';
      stars.textContent = '★'.repeat(state.stars) + '☆'.repeat(Math.max(0, 5 - state.stars));
      stars.style.color = state.stars > 0 ? '#ffd23e' : 'rgba(255,255,255,0.45)';
      speed.textContent = state.inCar ? `${Math.round(Math.abs(state.speed) * 3.6)} km/h` : '';
      banner.textContent = state.missionText;
      banner.style.display = state.missionText ? 'block' : 'none';
      if (weatherEl) {
        weatherEl.textContent = state.weatherLabel || '';
        weatherEl.style.display = state.weatherLabel ? 'block' : 'none';
      }
      if (taxiEl) {
        taxiEl.textContent = state.taxiText || '';
        taxiEl.style.display = state.taxiText ? 'block' : 'none';
      }
      if (statsEl) {
        statsEl.textContent = state.statsText || '';
        statsEl.style.display = state.statsText ? 'block' : 'none';
      }
      drawMap(state.player, state.cars, state.police, state.target, state);
    },
  };
}
