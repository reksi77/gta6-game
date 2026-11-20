// Cars: the five kinds Solara Bay drives, and how one moves. A car has a speed along its
// nose, steering that bites harder the faster it goes, and skid marks when it slides. A car's
// collision shape is a single circle at its centre, wide enough to cover its length.

import { CAR_TYPES } from './config.js';
import { clamp } from './util.js';

export function carTypeByName(name) {
  for (const type of CAR_TYPES) if (type.name === name) return type;
  return CAR_TYPES[1];
}

/** A fresh car of `type` (a CAR_TYPES entry) at (x, y), facing `angle` radians. */
export function createCar(type, x, y, angle) {
  return {
    type,
    x, y, angle,
    speed: 0,
    traffic: false,
    marked: false,
    skidding: false,
    radius: (type.length / 2) * 0.92,
  };
}

/**
 * Drive one step. `pedal` is -1 (brake/reverse) to 1 (throttle), `steer` -1 to 1. Returns
 * true when the car slid hard enough to leave a skid mark this step.
 */
export function stepCar(car, pedal, steer, dt, collide) {
  const type = car.type;
  if (pedal > 0) car.speed += type.accel * pedal * dt;
  else if (pedal < 0) {
    if (car.speed > 5) car.speed -= type.brake * dt;
    else car.speed -= type.accel * 0.45 * dt;
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 140 * dt);
  }
  car.speed = clamp(car.speed, -type.topSpeed * 0.32, type.topSpeed);
  const grip = clamp(Math.abs(car.speed) / type.topSpeed, 0, 1);
  car.angle += steer * type.turn * grip * dt * (car.speed < 0 ? -1 : 1);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const fixed = collide(nx, ny, car.radius);
  if (fixed.x !== nx || fixed.y !== ny) {
    // A wall took the car's speed: a hard hit stops it, a graze just slows it.
    const lost = Math.abs(car.speed) > 240 ? 1 : 0.45;
    car.speed *= (1 - lost);
  }
  car.x = fixed.x;
  car.y = fixed.y;
  const sliding = Math.abs(steer) > 0.7 && Math.abs(car.speed) > type.topSpeed * 0.55;
  car.skidding = sliding;
  return sliding;
}

/** The nose of the car, where the headlights and the bumper live. */
export function carNose(car) {
  return {
    x: car.x + Math.cos(car.angle) * (car.type.length / 2),
    y: car.y + Math.sin(car.angle) * (car.type.length / 2),
  };
}

/** The rear of the car, where the player climbs in. */
export function carTail(car) {
  return {
    x: car.x - Math.cos(car.angle) * (car.type.length / 2),
    y: car.y - Math.sin(car.angle) * (car.type.length / 2),
  };
}
