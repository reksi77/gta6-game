// Traffic: ordinary Solara Bay drivers. Each one owns a lane on a road — right-hand traffic,
// so a southbound car rides the east side of its road — cruises at its own speed, brakes
// behind whatever is ahead of it in the same lane, and sometimes turns at an intersection.
// A traffic car the player steals stops being traffic: it leaves this list's care.

import { TRAFFIC } from './config.js';
import { createCar, stepCar, carTypeByName } from './cars.js';
import { clamp } from './util.js';
import { randomPick } from './random.js';

const LANE_OFFSET = 26;
const CAR_NAMES = ['Hatch', 'Sedan', 'Sedan', 'Taxi', 'Van', 'Hatch'];

/**
 * A traffic driver: the car it drives, the road it is on (axis 'v' or 'h', line coordinate),
 * its direction along that road, and the speed it cruises at when the road is clear.
 */
export function createTrafficDriver(random, city) {
  const vertical = random() < 0.5;
  const lines = vertical ? city.roads.vertical : city.roads.horizontal;
  const line = randomPick(random, lines);
  const dir = random() < 0.5 ? 1 : -1;
  const along = random() * city.size;
  const lane = line + dir * LANE_OFFSET;
  const x = vertical ? lane : along;
  const y = vertical ? along : lane;
  const angle = vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
  const car = createCar(carTypeByName(randomPick(random, CAR_NAMES)), x, y, angle);
  car.traffic = true;
  car.speed = TRAFFIC.cruiseMin + random() * 40;
  return {
    car,
    axis: vertical ? 'v' : 'h',
    line,
    dir,
    cruise: TRAFFIC.cruiseMin + random() * (TRAFFIC.cruiseMax - TRAFFIC.cruiseMin),
  };
}

export function createTraffic(random, city, count) {
  const drivers = [];
  for (let i = 0; i < count; i += 1) drivers.push(createTrafficDriver(random, city));
  return drivers;
}

/** The car ahead of `driver` in its lane, if one is close enough to matter. */
function carAhead(driver, cars, playerCar) {
  const car = driver.car;
  const forwardX = Math.cos(car.angle);
  const forwardY = Math.sin(car.angle);
  let nearest = Infinity;
  const pool = playerCar !== null ? [...cars, playerCar] : cars;
  for (const other of pool) {
    if (other === car) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const ahead = dx * forwardX + dy * forwardY;
    if (ahead < 10 || ahead > TRAFFIC.lookAhead) continue;
    const side = Math.abs(dx * -forwardY + dy * forwardX);
    if (side < 34 && ahead < nearest) nearest = ahead;
  }
  return nearest;
}

/**
 * One step for every traffic driver. `cars` is every car in the world (for the car-ahead
 * check), `playerCar` the player's car or null. The throttle is always defined: full cruise
 * when the lane is clear, easing off as a car draws near, zero with a hard brake when one
 * is right ahead. Drivers far from the player are respawned on a road near them.
 */
export function stepTraffic(drivers, cars, player, playerCar, city, random, dt) {
  for (const driver of drivers) {
    const car = driver.car;
    if (car === playerCar) continue;
    const ahead = carAhead(driver, cars, playerCar);
    let throttle;
    if (ahead === Infinity) throttle = 1;
    else if (ahead > 70) throttle = 0.55;
    else if (ahead > 42) throttle = 0.15;
    else throttle = 0;
    const pedal = throttle === 0 ? -1 : throttle;
    // Steer back onto the lane line: the car's nose drifts toward its lane, never away.
    const lanePos = driver.axis === 'v' ? car.x : car.y;
    const offLane = lanePos - (driver.line + driver.dir * LANE_OFFSET);
    const wantAngle = driver.axis === 'v'
      ? (driver.dir > 0 ? Math.PI / 2 : -Math.PI / 2)
      : (driver.dir > 0 ? 0 : Math.PI);
    let angleDiff = wantAngle - car.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    const steer = clamp(angleDiff * 2.2 - offLane * 0.02 * Math.sign(car.speed || 1), -1, 1);
    stepCar(car, pedal, steer, dt, (x, y, r) => city.collideCircle(x, y, r));

    // At an intersection, sometimes turn onto the crossing road.
    const onVertical = driver.axis === 'v';
    const crossLines = onVertical ? city.roads.horizontal : city.roads.vertical;
    const along = onVertical ? car.y : car.x;
    for (const cross of crossLines) {
      if (Math.abs(along - cross) < 6 && random() < TRAFFIC.turnChance) {
        const newDir = random() < 0.5 ? 1 : -1;
        driver.axis = onVertical ? 'h' : 'v';
        driver.line = cross;
        driver.dir = newDir;
        if (driver.axis === 'v') car.x = cross + newDir * LANE_OFFSET;
        else car.y = cross + newDir * LANE_OFFSET;
        break;
      }
    }

    // Too far from the action: come back on a road near the player, on that road's lane.
    const far = Math.hypot(car.x - player.x, car.y - player.y) > 1500;
    if (far) {
      const vertical = random() < 0.5;
      const lines = vertical ? city.roads.vertical : city.roads.horizontal;
      let line = lines[0];
      let best = Infinity;
      for (const candidate of lines) {
        const d = Math.abs((vertical ? player.x : player.y) - candidate);
        if (d < best) { best = d; line = candidate; }
      }
      const dir = random() < 0.5 ? 1 : -1;
      const along = clamp((vertical ? player.y : player.x) + (random() - 0.5) * 800, 80, city.size - 80);
      const fresh = createTrafficDriver(random, city);
      fresh.axis = vertical ? 'v' : 'h';
      fresh.line = line;
      fresh.dir = dir;
      fresh.car.x = vertical ? line + dir * LANE_OFFSET : along;
      fresh.car.y = vertical ? along : line + dir * LANE_OFFSET;
      fresh.car.angle = vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
      fresh.car.speed = fresh.cruise * 0.7;
      drivers[drivers.indexOf(driver)] = fresh;
    }
  }
}
