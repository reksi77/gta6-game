// A small seeded random generator: the same seed builds the same city, which is what makes
// the screenshot scenes repeatable. Written here from the classic mulberry32 recipe.

export function createRandom(seed) {
  let state = (seed >>> 0) || 0x9e3779b9;
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

/** An integer in [min, max) from a random function. */
export function randomInt(random, min, max) {
  return min + Math.floor(random() * (max - min));
}

/** One element of an array, picked by a random function. */
export function randomPick(random, items) {
  return items[Math.floor(random() * items.length)];
}
