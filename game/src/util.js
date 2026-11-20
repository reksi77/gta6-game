// Small geometry and number helpers shared by the city, the cars and the combat. Nothing
// here knows about the screen or the game state; it only moves numbers around.

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function distanceSquared(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

/** The shortest signed turn from `from` to `to`, in radians, in (-PI, PI]. */
export function angleDifference(from, to) {
  let diff = (to - from) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff <= -Math.PI) diff += Math.PI * 2;
  return diff;
}

/** True when a circle overlaps an axis-aligned rectangle. */
export function circleHitsRect(cx, cy, radius, rect) {
  const nearX = clamp(cx, rect.x, rect.x + rect.w);
  const nearY = clamp(cy, rect.y, rect.y + rect.h);
  const dx = cx - nearX;
  const dy = cy - nearY;
  return dx * dx + dy * dy < radius * radius;
}

/**
 * Push a circle out of a rectangle it overlaps, returning the corrected centre. When the
 * circle's centre is inside the rectangle, push it out along the shallowest side.
 */
export function pushCircleOutOfRect(cx, cy, radius, rect) {
  const nearX = clamp(cx, rect.x, rect.x + rect.w);
  const nearY = clamp(cy, rect.y, rect.y + rect.h);
  const dx = cx - nearX;
  const dy = cy - nearY;
  const distSq = dx * dx + dy * dy;
  if (distSq >= radius * radius) return { x: cx, y: cy };
  if (distSq > 0.0001) {
    const dist = Math.sqrt(distSq);
    const push = (radius - dist) / dist;
    return { x: cx + dx * push, y: cy + dy * push };
  }
  const left = cx - rect.x;
  const right = rect.x + rect.w - cx;
  const top = cy - rect.y;
  const bottom = rect.y + rect.h - cy;
  const min = Math.min(left, right, top, bottom);
  if (min === left) return { x: rect.x - radius, y: cy };
  if (min === right) return { x: rect.x + rect.w + radius, y: cy };
  if (min === top) return { x: cx, y: rect.y - radius };
  return { x: cx, y: rect.y + rect.h + radius };
}

/** True when two circles overlap. */
export function circlesOverlap(ax, ay, ar, bx, by, br) {
  const r = ar + br;
  return distanceSquared(ax, ay, bx, by) < r * r;
}
