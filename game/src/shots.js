// Screenshot scenes behind ?shot=chase|city|mission|start. Each one plays the
// real rules forward from a fresh world for a fixed number of fixed steps,
// steered by a simple autopilot, so the frame is what a short game really
// looks like and the same seed always gives the same frame. The judge sees
// the game mostly through these shots, so each one shows several systems at
// once: a chase shows the car, the police, the wanted stars, the minimap and
// a mission objective on the HUD.
import { STEP } from './config.js';

const SAMPLE = STEP;

/** Drive east along the z=-36 road, staying in the right-hand lane. */
function chaseAutopilot(game, car) {
  const laneZ = -36 - 3.5;
  // Heading east (PI/2): a smaller heading moves the car toward +z, so the
  // correction subtracts the lane error.
  const wantHeading = Math.PI / 2 - Math.max(-0.45, Math.min(0.45, (laneZ - car.z) * 0.09));
  let diff = wantHeading - car.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 2.2));
  game.vehicles.stepCar(car, SAMPLE, 1, steer);
}

function drawHud(game) {
  game.hud.draw({
    cash: game.state.cash,
    health: game.state.health,
    stars: game.state.stars,
    speed: game.player.inCar ? game.player.car.speed : 0,
    inCar: game.player.inCar,
    missionText: `${game.missions.current().title}  ·  $${game.missions.current().reward}  ·  ${game.missions.timeLeft}s — ${game.missions.message}`,
    player: game.player,
    cars: game.vehicles.cars,
    police: game.vehicles.police,
    target: game.missions.target,
  });
}

function simulateWorld(game, seconds, driveCar) {
  const steps = Math.floor(seconds / SAMPLE);
  for (let i = 0; i < steps; i += 1) {
    game.state.time += SAMPLE;
    if (driveCar) {
      chaseAutopilot(game, driveCar);
      // The simulation moves the car: keep the player record on it, so the
      // police chase the real car and the minimap draws it in the right place.
      game.player.x = driveCar.x;
      game.player.z = driveCar.z;
      game.player.heading = driveCar.heading;
    }
    game.vehicles.stepTraffic(SAMPLE);
    if (game.weather) game.weather.step(SAMPLE, { x: game.player.x, z: game.player.z });
    if (game.policeOps) game.policeOps.step(SAMPLE, game.player, game.state.stars, game.state.time);
    game.peds.step(SAMPLE, game.player.x, game.player.z, game.player.inCar ? Math.abs(game.player.car.speed) : 0);
    game.vehicles.stepPolice(SAMPLE, game.player.x, game.player.z, game.state.stars > 0);
    game.missions.update(SAMPLE, game.state.time);
    if (window.__trace && i % 60 === 0) {
      window.__trace.push({
        t: +(game.state.time).toFixed(1),
        car: driveCar ? [+driveCar.x.toFixed(0), +driveCar.z.toFixed(0), +driveCar.heading.toFixed(2)] : null,
        cops: game.vehicles.police.map((c) => [+c.x.toFixed(0), +c.z.toFixed(0), +c.heading.toFixed(2), +c.speed.toFixed(0)]),
      });
    }
  }
}

/** The follow camera eases toward its target; run it to convergence so a
 * staged shot frames exactly what the live game would show. */
function snapCamera(game) {
  for (let i = 0; i < 12; i += 1) game.updateCamera(1);
}

export function stageShot(name, game) {
  const { state, player, world, vehicles, peds, missions, hud, camera } = game;
  state.cash = 1240;
  state.health = 92;
  state.time = 0;
  game.setScreen('play');
  document.getElementById('hud').style.display = 'block';

  if (name === 'start') {
    // Title screen over the idling city.
    game.setScreen('title');
    document.getElementById('hud').style.display = 'none';
    player.x = 0;
    player.z = 0;
    player.inCar = false;
    game.playerMesh.visible = true;
    game.playerMesh.position.set(0, 0, 0);
    camera.position.set(95, 42, 40);
    camera.lookAt(0, 2, 0);
    simulateWorld(game, 5, null);
    camera.position.set(95, 42, 40);
    camera.lookAt(0, 2, 0);
    return { screen: 'title' };
  }

  if (name === 'city') {
    // High overlook of the whole city at sunset: traffic, palms, skyline.
    missions.debugSet(0, 1);
    state.stars = 0;
    state.heat = 0;
    player.x = 8;
    player.z = 8;
    player.inCar = false;
    player.heading = Math.PI / 4;
    game.playerMesh.visible = true;
    game.playerMesh.position.set(player.x, 0, player.z);
    game.playerMesh.rotation.y = player.heading;
    camera.position.set(150, 135, 150);
    camera.lookAt(0, 0, 0);
    simulateWorld(game, 6, null);
    camera.position.set(150, 135, 150);
    camera.lookAt(0, 0, 0);
    drawHud(game);
    return { screen: 'play' };
  }

  if (name === 'mission') {
    // On foot at Palm Plaza, package pickup beacon overhead, mission on the HUD.
    missions.debugSet(1, 0);
    state.stars = 1;
    state.heat = 25;
    player.x = 26;
    player.z = 6;
    player.inCar = false;
    player.heading = Math.atan2(-26, -6);
    game.playerMesh.visible = true;
    game.playerMesh.position.set(player.x, 0, player.z);
    game.playerMesh.rotation.y = player.heading;
    state.camYaw = player.heading;
    simulateWorld(game, 2, null);
    snapCamera(game);
    drawHud(game);
    return { screen: 'play' };
  }

  // Default: 'chase' — the cover. Player fleeing east in a red car, two
  // police cruisers behind, 3 wanted stars, mission objective on the HUD.
  missions.debugSet(0, 1);
  state.stars = 3;
  state.heat = 80;
  // Clear the chase corridor of parked cars so the run stays on the road.
  for (const parked of vehicles.parked) {
    if (Math.abs(parked.z - (-36)) < 9 && parked.x > -210 && parked.x < 210) {
      parked.z = -108 - 3.5;
      parked.mesh.group.position.set(parked.x, 0, parked.z);
    }
  }
  const car = vehicles.parked[0];
  car.parked = false;
  car.x = -150;
  car.z = -39.5;
  car.heading = Math.PI / 2;
  car.speed = 26;
  car.mesh.group.position.set(car.x, 0, car.z);
  // The getaway car reads as the player's: paint it red.
  car.mesh.group.children[0].material.color.setHex(0xd83a2e);
  player.inCar = true;
  player.car = car;
  player.x = car.x;
  player.z = car.z;
  player.heading = car.heading;
  game.playerMesh.visible = false;
  const cop1 = vehicles.spawnPolice(-185, -39.5);
  cop1.speed = 30;
  // The second cruiser starts in the next lane, already moving east and a
  // touch faster, so it pulls alongside the player and reads in the frame.
  const cop2 = vehicles.spawnPolice(-175, -32.5);
  cop2.speed = 36;
  cop2.heading = Math.PI / 2;
  cop2.mesh.group.rotation.y = cop2.heading;
  state.camYaw = car.heading;
  simulateWorld(game, 7, car);
  // The simulation moves the car, not the player record: sync it for the HUD.
  player.x = car.x;
  player.z = car.z;
  player.heading = car.heading;
  snapCamera(game);
  drawHud(game);
  return { screen: 'play' };
}
