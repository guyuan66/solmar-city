// Stats, achievements and the garage.
// Everything the player has done in Solmar is counted here: distance driven,
// cars stolen, fares run, cash earned, top speed, time on the streets. Cross
// a threshold and an achievement unlocks with a cash bonus. The garage keeps
// the player's favourite ride: park a car at the safehouse and it is saved
// with the profile, so the next session starts with the same car waiting.
import { SAVE_KEY, ACHIEVEMENT_BONUSES } from './config.js';

const STATS_KEY = `${SAVE_KEY}.stats`;
const GARAGE_KEY = `${SAVE_KEY}.garage`;

// Bonuses come from config.js (ACHIEVEMENT_BONUSES) so rewards are tuned in
// one place; the list below only defines the unlock condition.
export const ACHIEVEMENTS = [
  { id: 'first-wheels', name: 'FIRST WHEELS', desc: 'Steal your first car', bonus: ACHIEVEMENT_BONUSES['first-wheels'], test: (s) => s.carsStolen >= 1 },
  { id: 'wheelman', name: 'WHEELMAN', desc: 'Drive 5 km in total', bonus: ACHIEVEMENT_BONUSES.wheelman, test: (s) => s.distanceDriven >= 5000 },
  { id: 'road-warrior', name: 'ROAD WARRIOR', desc: 'Drive 25 km in total', bonus: ACHIEVEMENT_BONUSES['road-warrior'], test: (s) => s.distanceDriven >= 25000 },
  { id: 'speed-demon', name: 'SPEED DEMON', desc: 'Hit 160 km/h', bonus: ACHIEVEMENT_BONUSES['speed-demon'], test: (s) => s.topSpeedKmh >= 160 },
  { id: 'job-done', name: 'JOB DONE', desc: 'Finish your first mission', bonus: ACHIEVEMENT_BONUSES['job-done'], test: (s) => s.missionsDone >= 1 },
  { id: 'crew-favourite', name: 'CREW FAVOURITE', desc: 'Finish 5 missions', bonus: ACHIEVEMENT_BONUSES['crew-favourite'], test: (s) => s.missionsDone >= 5 },
  { id: 'cabbie', name: 'CABBIE', desc: 'Complete 3 taxi fares', bonus: ACHIEVEMENT_BONUSES.cabbie, test: (s) => s.faresDone >= 3 },
  { id: 'fare-king', name: 'FARE KING', desc: 'Earn $1,000 from taxi fares', bonus: ACHIEVEMENT_BONUSES['fare-king'], test: (s) => s.faresEarned >= 1000 },
  { id: 'big-spender', name: 'BIG SPENDER', desc: 'Hold $5,000 in cash', bonus: ACHIEVEMENT_BONUSES['big-spender'], test: (s) => s.maxCash >= 5000 },
  { id: 'ghost', name: 'GHOST', desc: 'Reach 4 wanted stars and escape', bonus: ACHIEVEMENT_BONUSES.ghost, test: (s) => s.escapedFourStars },
  { id: 'survivor', name: 'SURVIVOR', desc: 'Play for 30 minutes in total', bonus: ACHIEVEMENT_BONUSES.survivor, test: (s) => s.playSeconds >= 1800 },
  { id: 'collector', name: 'COLLECTOR', desc: 'Park a car in the garage', bonus: ACHIEVEMENT_BONUSES.collector, test: (s) => s.garageSaves >= 1 },
  { id: 'sprinter', name: 'SPRINTER', desc: 'Finish a checkpoint sprint', bonus: ACHIEVEMENT_BONUSES.sprinter, test: (s) => s.sprintsDone >= 1 },
];

export function createStats() {
  const s = {
    distanceDriven: 0,
    carsStolen: 0,
    pedsHit: 0,
    missionsDone: 0,
    faresDone: 0,
    faresEarned: 0,
    cashEarned: 0,
    maxCash: 0,
    topSpeedKmh: 0,
    playSeconds: 0,
    crashes: 0,
    bustedCount: 0,
    wastedCount: 0,
    escapedFourStars: false,
    garageSaves: 0,
    sprintsDone: 0,
    checkpointsHit: 0,
    hornsHonks: 0,
    unlocked: [],
  };
  let sawFourStars = false;

  function read() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STATS_KEY) ?? '{}');
      for (const key of Object.keys(s)) {
        if (key === 'unlocked') continue;
        if (typeof saved[key] === 'number') s[key] = saved[key];
        if (typeof saved[key] === 'boolean') s[key] = saved[key];
      }
      if (Array.isArray(saved.unlocked)) s.unlocked = saved.unlocked.slice();
    } catch { /* Storage can be off: play without saving. */ }
  }

  function write() {
    try {
      window.localStorage.setItem(STATS_KEY, JSON.stringify(s));
    } catch { /* ignore */ }
  }

  /** Check every achievement; returns the newly unlocked ones. */
  function check() {
    const fresh = [];
    for (const a of ACHIEVEMENTS) {
      if (s.unlocked.includes(a.id)) continue;
      let ok = false;
      try { ok = a.test(s); } catch { ok = false; }
      if (ok) {
        s.unlocked.push(a.id);
        fresh.push(a);
      }
    }
    if (fresh.length > 0) write();
    return fresh;
  }

  function noteFourStars(active) {
    if (active) sawFourStars = true;
    if (!active && sawFourStars) {
      s.escapedFourStars = true;
      sawFourStars = false;
      write();
    }
  }

  // --- Garage -----------------------------------------------------------
  // The garage holds one car: its kind and paint, parked at the safehouse.
  function saveGarage(car) {
    if (!car) return false;
    const record = {
      kind: car.kind || 'car',
      color: car.color ?? 0xd83a2e,
      savedAt: Date.now(),
    };
    try {
      window.localStorage.setItem(GARAGE_KEY, JSON.stringify(record));
    } catch { return false; }
    s.garageSaves += 1;
    write();
    return true;
  }

  function readGarage() {
    try {
      const raw = window.localStorage.getItem(GARAGE_KEY);
      if (!raw) return null;
      const record = JSON.parse(raw);
      if (!record || typeof record.kind !== 'string') return null;
      return record;
    } catch { return null; }
  }

  function clearGarage() {
    try { window.localStorage.removeItem(GARAGE_KEY); } catch { /* ignore */ }
  }

  function panelLines() {
    const km = (s.distanceDriven / 1000).toFixed(1);
    const mins = Math.floor(s.playSeconds / 60);
    return [
      `Distance driven: ${km} km`,
      `Top speed: ${Math.round(s.topSpeedKmh)} km/h`,
      `Cars stolen: ${s.carsStolen} · Missions: ${s.missionsDone} · Fares: ${s.faresDone}`,
      `Cash earned: $${Math.round(s.cashEarned).toLocaleString('en-US')} · Best cash: $${Math.round(s.maxCash).toLocaleString('en-US')}`,
      `Play time: ${mins} min · Crashes: ${s.crashes} · Busted: ${s.bustedCount} · Wasted: ${s.wastedCount}`,
      `Achievements: ${s.unlocked.length}/${ACHIEVEMENTS.length} unlocked`,
    ];
  }

  function achievementLines() {
    return ACHIEVEMENTS.map((a) => {
      const got = s.unlocked.includes(a.id);
      return `${got ? '★' : '☆'} ${a.name} — ${a.desc} (+$${a.bonus})`;
    });
  }

  read();

  return {
    data: s,
    check, write, read, noteFourStars,
    saveGarage, readGarage, clearGarage,
    panelLines, achievementLines,
    addDistance(m) { s.distanceDriven += m; },
    addCash(n) {
      s.cashEarned += n;
      // maxCash tracks the wallet balance, updated separately via noteCash.
    },
    noteCash(cash) { s.maxCash = Math.max(s.maxCash, cash); },
    noteTopSpeed(kmh) { s.topSpeedKmh = Math.max(s.topSpeedKmh, kmh); },
    notePlay(dt) { s.playSeconds += dt; },
    get unlockedCount() { return s.unlocked.length; },
  };
}
