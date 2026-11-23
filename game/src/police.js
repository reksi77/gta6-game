// The Solara Bay police. Wanted stars 0-5: foot cops walk up and arrest the player on foot,
// patrol cars ram the player's car, and from two stars the cops shoot. Heat cools off when
// the player stays clean, and the force stands down when the wanted level reaches zero.

import { POLICE, WANTED, PLAYER } from './config.js';
import { createCar, stepCar } from './cars.js';
import { fireBullet } from './combat.js';
import { angleDifference, circlesOverlap } from './util.js';

export function createPolice() {
  return {
    wanted: 0,
    cops: [],
    patrols: [],
    spawnTimer: 0,
    decayTimer: 0,
    crimeTimer: 0,
    sinceCrime: 999,
  };
}

function footCop(x, y) {
  return { x, y, angle: 0, health: 100, shootTimer: 0, state: 'chase', kind: 'cop' };
}

function patrolCar(city, x, y, angle) {
  const car = createCar({ name: 'Patrol', length: 76, width: 34, topSpeed: POLICE.carSpeed, accel: 340, brake: 500, turn: 2.9, color: '#2c4f9e', roof: '#7ba7dd' }, x, y, angle);
  return { car, ramTimer: 0, kind: 'patrol' };
}

/** Raise the wanted level by `stars`, and restart the heat clock. */
export function addWanted(police, stars) {
  police.wanted = Math.min(WANTED.max, (police.wanted || 0) + stars);
  police.sinceCrime = 0;
}

/** The current wanted level, 0 to 5. */
export function wantedLevel(police) {
  return police.wanted || 0;
}

/** How many foot cops and patrol cars the current wanted level calls for. */
function wantedDispatchForce(wanted) {
  return {
    cops: wanted >= 1 ? Math.min(3, wanted) : 0,
    patrols: wanted >= 2 ? Math.min(3, wanted - 1) : 0,
  };
}

function spawnPointNear(city, player, distance) {
  const angle = Math.random() * Math.PI * 2;
  const point = city.nearestRoadPoint(
    player.x + Math.cos(angle) * distance,
    player.y + Math.sin(angle) * distance,
  );
  return point;
}

/**
 * One step of the whole police response. `onBusted` fires when a cop holds the player long
 * enough to arrest them; `onShot` fires when a cop shoots, so the world can play the sound.
 * Returns nothing; the police object is updated in place.
 */
export function stepPolice(police, state, bullets, particles, dt) {
  const player = state.player;
  const city = state.city;
  police.sinceCrime += dt;
  police.crimeTimer = Math.max(0, police.crimeTimer - dt);

  // Cool off: after a quiet stretch, the stars tick down one at a time.
  if (police.wanted > 0 && police.sinceCrime > WANTED.decayDelay) {
    police.decayTimer += dt;
    if (police.decayTimer >= WANTED.decayEvery) {
      police.decayTimer = 0;
      police.wanted -= 1;
    }
  } else {
    police.decayTimer = 0;
  }

  const wanted = police.wanted || 0;
  const want = wantedDispatchForce(wanted);
  police.spawnTimer -= dt;
  if (police.spawnTimer <= 0) {
    police.spawnTimer = POLICE.spawnEvery;
    if (police.cops.length < want.cops) {
      const point = spawnPointNear(city, player, 420);
      police.cops.push(footCop(point.x, point.y));
    } else if (police.patrols.length < want.patrols) {
      const point = spawnPointNear(city, player, 520);
      police.patrols.push(patrolCar(city, point.x, point.y, 0));
    }
  }
  // Stood down: everyone goes home when the wanted level is gone.
  if (wanted === 0) {
    police.cops.length = 0;
    police.patrols.length = 0;
  }

  // Foot cops: run the player down, hold them to arrest, shoot from two stars up.
  let arresting = false;
  for (const cop of police.cops) {
    const dx = player.x - cop.x;
    const dy = player.y - cop.y;
    const dist = Math.hypot(dx, dy) || 1;
    cop.angle = Math.atan2(dy, dx);
    if (player.car === null && dist < 26) {
      arresting = true;
      continue;
    }
    if (dist > 30) {
      const fixed = city.collideCircle(cop.x + (dx / dist) * POLICE.footSpeed * dt, cop.y + (dy / dist) * POLICE.footSpeed * dt, 12);
      cop.x = fixed.x;
      cop.y = fixed.y;
    }
    if (wanted >= 2 && dist < POLICE.shootRange) {
      cop.shootTimer -= dt;
      if (cop.shootTimer <= 0) {
        cop.shootTimer = POLICE.shootCooldown * (0.9 + Math.random() * 0.4);
        const wobble = (Math.random() - 0.5) * 0.22;
        fireBullet(bullets, cop.x, cop.y, cop.angle + wobble, false, 12);
        state.shotFired = true;
      }
    }
  }
  if (arresting && player.car === null) {
    player.arrestTimer += dt;
    if (player.arrestTimer >= PLAYER.arrestSeconds) {
      state.endReason = 'busted';
    }
  } else {
    player.arrestTimer = 0;
  }

  // Patrol cars: steer at the player's car and ram it; on foot, they park and send a cop.
  for (const patrol of police.patrols) {
    const car = patrol.car;
    const dx = player.x - car.x;
    const dy = player.y - car.y;
    const dist = Math.hypot(dx, dy) || 1;
    const wantAngle = Math.atan2(dy, dx);
    const steer = Math.max(-1, Math.min(1, angleDifference(car.angle, wantAngle) * 2.4));
    stepCar(car, 1, steer, dt, (x, y, r) => city.collideCircle(x, y, r));
    patrol.ramTimer -= dt;
    if (player.car !== null && circlesOverlap(car.x, car.y, car.radius, player.car.x, player.car.y, player.car.radius)) {
      if (patrol.ramTimer <= 0) {
        patrol.ramTimer = POLICE.ramCooldown;
        player.car.speed *= 0.55;
        state.rammed = true;
      }
    }
    if (player.car === null && dist < 120 && police.cops.length < want.cops + 1) {
      police.cops.push(footCop(car.x + 20, car.y + 20));
    }
  }
}
