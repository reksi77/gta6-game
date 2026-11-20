// The simulation: one fixed step advances the whole of Solara Bay — the player, the cars,
// the traffic, the pedestrians, the rivals, the police, the bullets, the pickups and the
// missions. step() reads everything from `state`, never from a stale closure, so a reset
// can never leave the world and the rules pointing at different cities.

import { STEP, TRAFFIC, PEDS, PLAYER, WANTED } from './config.js';
import { createCity } from './city.js';
import { createPlayer, stepPlayerOnFoot, nearestEnterableCar, enterCar, exitCar, hurtPlayer, healPlayer } from './player.js';
import { createCar, stepCar, carTypeByName } from './cars.js';
import { createTraffic, stepTraffic } from './traffic.js';
import { createPedestrians, stepPedestrians, scarePedestrians, knockDownPedestrian } from './pedestrians.js';
import { createPolice, stepPolice, addWanted, wantedLevel } from './police.js';
import { createBullets, fireBullet, stepBullets, punchHit, createParticles, spawnParticles, stepParticles } from './combat.js';
import { createMissions, startMission, stepMissions, objectiveTarget, createPickups, spawnRivals } from './missions.js';
import { circlesOverlap } from './util.js';

export const EVENT_SHOT = 1;
export const EVENT_HIT = 2;
export const EVENT_PICKUP = 4;
export const EVENT_MISSION = 8;
export const EVENT_CRIME = 16;
export const EVENT_BUSTED = 32;
export const EVENT_WASTED = 64;
export const EVENT_PUNCH = 128;
export const EVENT_RAMMED = 256;
export const EVENT_OBJECTIVE = 512;

function spawnParkedCars(random, city) {
  const cars = [];
  for (const lot of city.lots) {
    const count = 2 + Math.floor(random() * 3);
    for (let i = 0; i < count; i += 1) {
      const type = carTypeByName(['Hatch', 'Sedan', 'Van', 'Taxi'][Math.floor(random() * 4)]);
      cars.push(createCar(type, lot.x + 44 + i * 62, lot.y + 60 + (i % 2) * 40, Math.PI / 2));
    }
  }
  for (let i = 0; i < 8; i += 1) {
    const vertical = random() < 0.5;
    const lines = vertical ? city.roads.vertical : city.roads.horizontal;
    const line = lines[Math.floor(random() * lines.length)];
    const along = 120 + random() * (city.size - 240);
    const angle = vertical
      ? (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2)
      : (random() < 0.5 ? 0 : Math.PI);
    const type = carTypeByName(['Hatch', 'Sedan', 'Sedan', 'Taxi', 'Van'][Math.floor(random() * 5)]);
    const x = vertical ? line + (random() < 0.5 ? -26 : 26) : along;
    const y = vertical ? along : line + (random() < 0.5 ? -26 : 26);
    cars.push(createCar(type, x, y, angle));
  }
  // The purple Sport for the Hot Wheels job, waiting in the East Lot from the start.
  const lot = city.landmarks.eastlot;
  const sport = createCar(carTypeByName('Sport'), lot.x, lot.y, Math.PI / 2);
  sport.marked = true;
  cars.push(sport);
  return cars;
}

export function createWorld(random) {
  const city = createCity(random);
  const state = {
    random, city,
    player: null, cars: [], traffic: [], peds: [], rivals: [],
    police: null, bullets: null, particles: null, pickups: [],
    missions: null, skids: [],
    time: 0, endReason: null, objectiveTarget: null, nearCar: null,
    audioMuted: false, shotFired: false, rammed: false, crimeTimer: 0,
  };

  function reset() {
    state.player = createPlayer(city.spawn.x, city.spawn.y);
    state.cars = spawnParkedCars(random, city);
    state.traffic = createTraffic(random, city, TRAFFIC.count);
    for (const driver of state.traffic) state.cars.push(driver.car);
    state.peds = createPedestrians(random, city, PEDS.count);
    state.rivals = [];
    state.police = createPolice();
    state.bullets = createBullets();
    state.particles = createParticles();
    state.missions = createMissions();
    state.pickups = createPickups(state);
    state.skids = [];
    state.time = 0;
    state.endReason = null;
    state.objectiveTarget = null;
    state.nearCar = null;
    state.shotFired = false;
    state.rammed = false;
    state.crimeTimer = 0;
  }

  /** A crime the police would care about: raises wanted, throttled so one brawl is not five stars. */
  function commitCrime(stars) {
    if (state.crimeTimer > 0) return;
    state.crimeTimer = WANTED.crimeCooldown;
    addWanted(state.police, stars);
  }

  function stepRivals(dt) {
    const player = state.player;
    for (const rival of state.rivals) {
      if (rival.health <= 0) {
        if (!rival.counted) {
          rival.counted = true;
          state.missions.defeated += 1;
          spawnParticles(state.particles, rival.x, rival.y, 12, '#b08ae8', 160);
        }
        continue;
      }
      const dx = player.x - rival.x;
      const dy = player.y - rival.y;
      const dist = Math.hypot(dx, dy) || 1;
      rival.angle = Math.atan2(dy, dx);
      if (dist > 34) {
        const fixed = state.city.collideCircle(rival.x + (dx / dist) * 180 * dt, rival.y + (dy / dist) * 180 * dt, 12);
        rival.x = fixed.x;
        rival.y = fixed.y;
      } else if (rival.punchTimer <= 0) {
        rival.punchTimer = 1.0;
        if (player.car === null && hurtPlayer(player, 10)) {
          state.endReason = 'wasted';
        }
      }
      if (rival.punchTimer > 0) rival.punchTimer -= dt;
    }
  }

  function stepPickups() {
    let events = 0;
    const player = state.player;
    for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
      const pickup = state.pickups[i];
      if (Math.hypot(player.x - pickup.x, player.y - pickup.y) > 30) continue;
      state.pickups.splice(i, 1);
      if (pickup.kind === 'cash') player.money += pickup.value;
      else if (pickup.kind === 'ammo') player.ammo += pickup.value;
      else healPlayer(player, pickup.value);
      spawnParticles(state.particles, pickup.x, pickup.y, 10, '#7dff9e', 120);
      events |= EVENT_PICKUP;
    }
    return events;
  }

  /**
   * One fixed step. `control` carries what the player is doing this step: move {x, y} on
   * foot, pedal and steer while driving, aim (a world point, or null), shooting, enter and
   * punch as one-shot flags. Returns what happened, as EVENT_* flags.
   */
  function step(dt, control) {
    let events = 0;
    const player = state.player;
    const city = state.city;
    state.time += dt;
    state.crimeTimer = Math.max(0, state.crimeTimer - dt);
    state.objectiveTarget = objectiveTarget(state.missions, city);
    state.shotFired = false;
    state.rammed = false;

    // Getting in and out of cars. Stealing one in sight of a cop is a crime.
    if (control.enter) {
      if (player.car !== null) {
        exitCar(player);
      } else {
        const car = nearestEnterableCar(player, state.cars);
        if (car !== null) {
          const witnessed = state.police.cops.some((cop) => Math.hypot(cop.x - player.x, cop.y - player.y) < 500) ||
            state.police.patrols.length > 0;
          enterCar(player, car);
          if (car.traffic) {
            car.traffic = false;
            state.traffic = state.traffic.filter((driver) => driver.car !== car);
          }
          if (witnessed) {
            commitCrime(1);
            events |= EVENT_CRIME;
          }
        }
      }
    }

    if (player.car !== null) {
      const car = player.car;
      const beforeX = car.x;
      const beforeY = car.y;
      const sliding = stepCar(car, control.pedal, control.steer, dt, (x, y, r) => city.collideCircle(x, y, r));
      if (sliding) {
        state.skids.push({ x: beforeX, y: beforeY, x2: car.x, y2: car.y });
        if (state.skids.length > 160) state.skids.shift();
      }
      player.x = car.x;
      player.y = car.y;
      player.angle = car.angle;
      // Running over pedestrians is a crime, and they go down.
      for (const ped of state.peds) {
        if (ped.state === 'down') continue;
        if (circlesOverlap(car.x, car.y, car.radius, ped.x, ped.y, 12)) {
          knockDownPedestrian(ped);
          spawnParticles(state.particles, ped.x, ped.y, 10, '#e8e0c8', 140);
          commitCrime(1);
          events |= EVENT_CRIME;
        }
      }
      // Bumping other cars shoves them aside and scrubs speed off both.
      for (const other of state.cars) {
        if (other === car || other === player.car) continue;
        if (circlesOverlap(car.x, car.y, car.radius, other.x, other.y, other.radius)) {
          const dx = other.x - car.x;
          const dy = other.y - car.y;
          const dist = Math.hypot(dx, dy) || 1;
          const push = (car.radius + other.radius - dist) / 2;
          other.x += (dx / dist) * push;
          other.y += (dy / dist) * push;
          car.speed *= 0.92;
        }
      }
    } else {
      let aimAngle = null;
      if (control.aim !== null) aimAngle = Math.atan2(control.aim.y - player.y, control.aim.x - player.x);
      stepPlayerOnFoot(player, control.move, control.shooting ? aimAngle : null, dt, (x, y, r) => city.collideCircle(x, y, r));
      if (control.punch && player.punchTimer <= 0) {
        player.punchTimer = PLAYER.punchCooldown;
        events |= EVENT_PUNCH;
        const targets = [...state.peds, ...state.rivals, ...state.police.cops];
        const hit = punchHit(player, targets);
        if (hit !== null) {
          spawnParticles(state.particles, hit.x, hit.y, 8, '#ffd94c', 130);
          if (hit.kind === 'cop') {
            commitCrime(2);
            events |= EVENT_CRIME;
            if (hit.health <= 0) state.police.cops = state.police.cops.filter((cop) => cop !== hit);
          } else if (hit.kind === 'rival') {
            // Mission combat: settling a score is not a crime the police chase.
          } else {
            commitCrime(1);
            events |= EVENT_CRIME;
            if (hit.health <= 0) knockDownPedestrian(hit);
          }
        }
      }
      if (control.shooting && player.shootTimer <= 0 && player.ammo > 0) {
        player.shootTimer = PLAYER.shootCooldown;
        player.ammo -= 1;
        const angle = aimAngle !== null ? aimAngle : player.angle;
        const muzzleX = player.x + Math.cos(angle) * (PLAYER.radius + 6);
        const muzzleY = player.y + Math.sin(angle) * (PLAYER.radius + 6);
        fireBullet(state.bullets, muzzleX, muzzleY, angle, true, 34);
        scarePedestrians(state.peds, player.x, player.y, 260);
        commitCrime(1);
        events |= EVENT_SHOT | EVENT_CRIME;
      }
    }

    stepTraffic(state.traffic, state.cars, player, player.car, city, random, dt);
    stepPedestrians(state.peds, city, random, dt);
    stepRivals(dt);
    stepPolice(state.police, state, state.bullets, state.particles, dt);

    // Bullets and what they hit.
    const targets = [...state.peds, ...state.rivals, ...state.police.cops];
    const hits = stepBullets(state.bullets, city, player, targets, dt);
    for (const hit of hits) {
      if (hit.kind === 'wall') {
        spawnParticles(state.particles, hit.x, hit.y, 5, '#ffd94c', 120);
      } else if (hit.kind === 'person') {
        const target = hit.target;
        target.health -= hit.bullet.damage;
        spawnParticles(state.particles, hit.x, hit.y, 8, '#ff8a7a', 150);
        if (target.health <= 0) {
          if (target.kind === 'cop') {
            state.police.cops = state.police.cops.filter((cop) => cop !== target);
            commitCrime(2);
            events |= EVENT_CRIME;
          } else if (target.kind === 'rival') {
            commitCrime(1);
            events |= EVENT_CRIME;
          } else {
            knockDownPedestrian(target);
            commitCrime(1);
            events |= EVENT_CRIME;
          }
        }
      } else if (hit.kind === 'player') {
        if (hurtPlayer(player, hit.bullet.damage)) {
          state.endReason = 'wasted';
          events |= EVENT_WASTED;
        } else {
          events |= EVENT_HIT;
        }
      }
    }

    // A patrol car ramming the player's car hurts.
    if (state.rammed) {
      if (player.ramTimer <= 0) {
        player.ramTimer = 1.0;
        player.health = Math.max(0, player.health - 6);
        events |= player.health === 0 ? EVENT_WASTED : EVENT_HIT;
        if (player.health === 0) state.endReason = 'wasted';
      }
    }

    events |= stepPickups();
    const missionEvents = stepMissions(state, dt);
    if (missionEvents.includes('mission') || missionEvents.includes('objective')) events |= EVENT_MISSION;
    if (missionEvents.includes('objective')) events |= EVENT_OBJECTIVE;
    if (missionEvents.includes('alldone')) events |= EVENT_MISSION;

    stepParticles(state.particles, dt);
    state.nearCar = player.car === null ? nearestEnterableCar(player, state.cars) : null;

    if (state.endReason === 'busted') events |= EVENT_BUSTED;
    if (state.endReason === 'wasted') events |= EVENT_WASTED;
    return events;
  }

  reset();

  return {
    state,
    reset,
    step,
    // Staging helpers for the screenshot scenes and the playtests.
    teleportPlayer(x, y) {
      state.player.x = x;
      state.player.y = y;
      if (state.player.car !== null) {
        state.player.car.x = x;
        state.player.car.y = y;
      }
    },
    givePlayerCar(typeName, x, y, angle) {
      const car = createCar(carTypeByName(typeName), x, y, angle || 0);
      state.cars.push(car);
      enterCar(state.player, car);
      return car;
    },
    setWanted(stars) {
      state.police.wanted = Math.min(WANTED.max, stars);
      state.police.sinceCrime = 0;
    },
    spawnPatrolAt(x, y) {
      const car = createCar(
        { name: 'Patrol', length: 76, width: 34, topSpeed: 330, accel: 340, brake: 500, turn: 2.9, color: '#2c4f9e', roof: '#7ba7dd' },
        x, y, 0,
      );
      // Already rolling at pursuit speed, so a staged chase is in full flight at once.
      car.speed = 300;
      state.police.patrols.push({ car, ramTimer: 0, kind: 'patrol' });
      return car;
    },
    startMissionAt(index) {
      startMission(state.missions, index);
    },
    spawnRivals(count) {
      return spawnRivals(state, count);
    },
  };
}
