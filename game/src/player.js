// Jesse Kane on foot: walking between the buildings, punching, shooting, and climbing in and
// out of cars. On foot the player faces where they walk, or where they aim while shooting.
// The player object also carries the run's money, health and ammo.

import { PLAYER } from './config.js';
import { clamp, circlesOverlap } from './util.js';
import { carTail } from './cars.js';

export function createPlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,
    health: PLAYER.health,
    ammo: PLAYER.ammoStart,
    money: 0,
    car: null,
    punchTimer: 0,
    shootTimer: 0,
    arrestTimer: 0,
    ramTimer: 0,
    invulnerable: 0,
  };
}

/**
 * Walk one step. `move` is a unit-ish {x, y} direction, `aimAngle` the direction the player
 * faces while shooting (or null to face the walk direction). Returns nothing; the position
 * is already pushed out of buildings by `collide`.
 */
export function stepPlayerOnFoot(player, move, aimAngle, dt, collide) {
  const moving = move.x !== 0 || move.y !== 0;
  if (moving) {
    const length = Math.hypot(move.x, move.y);
    const nx = player.x + (move.x / length) * PLAYER.walkSpeed * dt;
    const ny = player.y + (move.y / length) * PLAYER.walkSpeed * dt;
    const fixed = collide(nx, ny, PLAYER.radius);
    player.x = fixed.x;
    player.y = fixed.y;
  }
  if (aimAngle !== null && aimAngle !== undefined) player.angle = aimAngle;
  else if (moving) player.angle = Math.atan2(move.y, move.x);
  if (player.punchTimer > 0) player.punchTimer -= dt;
  if (player.shootTimer > 0) player.shootTimer -= dt;
  if (player.invulnerable > 0) player.invulnerable -= dt;
  if (player.ramTimer > 0) player.ramTimer -= dt;
}

/** The nearest car the player could climb into, within 56 px of its body or tail. */
export function nearestEnterableCar(player, cars) {
  let best = null;
  let bestDist = 56;
  for (const car of cars) {
    if (Math.abs(car.speed) > 60) continue;
    const d = Math.hypot(car.x - player.x, car.y - player.y);
    if (d < bestDist + car.radius * 0.5) {
      bestDist = d;
      best = car;
    }
  }
  return best;
}

/** Climb into `car`: the player rides at its centre from now on. */
export function enterCar(player, car) {
  player.car = car;
  player.x = car.x;
  player.y = car.y;
}

/** Climb out at the car's tail, facing away from it. */
export function exitCar(player) {
  const car = player.car;
  if (car === null) return;
  const tail = carTail(car);
  player.x = tail.x;
  player.y = tail.y;
  player.angle = car.angle + Math.PI;
  player.car = null;
}

/** True when the player is hurt and still standing. */
export function hurtPlayer(player, damage) {
  if (player.invulnerable > 0 || player.health <= 0) return false;
  player.health = Math.max(0, player.health - damage);
  player.invulnerable = 0.5;
  return player.health === 0;
}

/** Heal the player, up to full health. */
export function healPlayer(player, amount) {
  player.health = clamp(player.health + amount, 0, PLAYER.health);
}
