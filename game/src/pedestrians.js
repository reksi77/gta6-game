// Pedestrians: Solara Bay's ordinary walkers. They stroll between sidewalk points, pause to
// look around, and run from gunfire. A pedestrian hit by a car goes down for a while, and the
// driver answers for it.

import { PEDS } from './config.js';
import { clamp } from './util.js';

const SHIRT_COLORS = ['#e8e0c8', '#c2d6e8', '#e8c2c2', '#c8e8c2', '#e8d9a8', '#d8c2e8'];

export function createPedestrian(random, city, index) {
  const point = city.randomSidewalkPoint();
  const target = city.randomSidewalkPoint();
  return {
    x: point.x, y: point.y,
    angle: Math.atan2(target.y - point.y, target.x - point.x),
    target,
    speed: PEDS.walkSpeed * (0.8 + random() * 0.4),
    state: 'walk',
    fleeTimer: 0,
    downTimer: 0,
    pauseTimer: random() * 2,
    health: 50,
    shirt: SHIRT_COLORS[index % SHIRT_COLORS.length],
  };
}

export function createPedestrians(random, city, count) {
  const peds = [];
  for (let i = 0; i < count; i += 1) peds.push(createPedestrian(random, city, i));
  return peds;
}

/** Every pedestrian within `radius` of (x, y) runs away from it. */
export function scarePedestrians(peds, x, y, radius) {
  for (const ped of peds) {
    if (ped.state === 'down') continue;
    const d = Math.hypot(ped.x - x, ped.y - y);
    if (d < radius) {
      ped.state = 'flee';
      ped.fleeTimer = 2.5;
      ped.angle = Math.atan2(ped.y - y, ped.x - x);
    }
  }
}

export function stepPedestrians(peds, city, random, dt) {
  for (const ped of peds) {
    if (ped.state === 'down') {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) {
        ped.state = 'walk';
        ped.health = 50;
        const point = city.randomSidewalkPoint();
        ped.x = point.x;
        ped.y = point.y;
        ped.target = city.randomSidewalkPoint();
      }
      continue;
    }
    if (ped.state === 'flee') {
      ped.fleeTimer -= dt;
      if (ped.fleeTimer <= 0) {
        ped.state = 'walk';
        ped.target = city.randomSidewalkPoint();
      }
      const nx = ped.x + Math.cos(ped.angle) * PEDS.fleeSpeed * dt;
      const ny = ped.y + Math.sin(ped.angle) * PEDS.fleeSpeed * dt;
      const fixed = city.collideCircle(nx, ny, 12);
      ped.x = fixed.x;
      ped.y = fixed.y;
      continue;
    }
    if (ped.pauseTimer > 0) {
      ped.pauseTimer -= dt;
      continue;
    }
    const dx = ped.target.x - ped.x;
    const dy = ped.target.y - ped.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 12) {
      ped.target = city.randomSidewalkPoint();
      ped.pauseTimer = 0.5 + random() * 2.5;
      continue;
    }
    ped.angle = Math.atan2(dy, dx);
    const nx = ped.x + (dx / dist) * ped.speed * dt;
    const ny = ped.y + (dy / dist) * ped.speed * dt;
    const fixed = city.collideCircle(nx, ny, 12);
    // A building in the way: pick a new destination rather than pushing against a wall.
    if (fixed.x === ped.x && fixed.y === ped.y && (nx !== ped.x || ny !== ped.y)) {
      ped.target = city.randomSidewalkPoint();
    }
    ped.x = fixed.x;
    ped.y = fixed.y;
  }
}

/** Knock a pedestrian down: they stay down a while, then get up elsewhere. */
export function knockDownPedestrian(ped) {
  ped.state = 'down';
  ped.downTimer = 3;
  ped.health = 50;
}
