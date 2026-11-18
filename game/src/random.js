// A small seeded random number generator (mulberry32): the same seed gives the
// same city, traffic and screenshot scenes, which is what makes the shots repeatable.
export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer in [min, max] inclusive, drawn from a seeded rng. */
export function pickInt(rng, min, max) {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  return lo + Math.floor(rng() * (hi - lo + 1));
}

/** One element of an array, drawn from a seeded rng. */
export function pickOne(rng, items) {
  if (!items || items.length === 0) return undefined;
  return items[pickInt(rng, 0, items.length - 1)];
}

/**
 * Weighted pick: entries are [value, weight] pairs (weight > 0). Returns a
 * value with probability proportional to its weight. Used for weather rolls
 * and any other "usually X, sometimes Y" choice that must stay seeded.
 */
export function pickWeighted(rng, entries) {
  let total = 0;
  for (const [, weight] of entries) total += weight;
  let roll = rng() * total;
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return entries[entries.length - 1][0];
}
