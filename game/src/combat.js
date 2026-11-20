// Combat: bullets, fists and the sparks they leave. Bullets are a small pool, allocated once;
// a bullet dies on a building, on a person, or when its life runs out. Particles are the
// same idea: short-lived sparks, puffs and skid dust that never allocate mid-frame.

import { PLAYER } from './config.js';
import { circlesOverlap } from './util.js';

export const BULLET_SPEED = 640;
export const BULLET_LIFE = 1.1;

export function createBullets() {
  const bullets = [];
  for (let i = 0; i < 48; i += 1) {
    bullets.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, friendly: true, damage: 0 });
  }
  return bullets;
}

export function fireBullet(bullets, x, y, angle, friendly, damage) {
  for (const bullet of bullets) {
    if (bullet.active) continue;
    bullet.active = true;
    bullet.x = x;
    bullet.y = y;
    bullet.vx = Math.cos(angle) * BULLET_SPEED;
    bullet.vy = Math.sin(angle) * BULLET_SPEED;
    bullet.life = BULLET_LIFE;
    bullet.friendly = friendly;
    bullet.damage = damage;
    return true;
  }
  return false;
}

export function createParticles() {
  const particles = [];
  for (let i = 0; i < 96; i += 1) {
    particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, color: '#ffffff', size: 2 });
  }
  return particles;
}

export function spawnParticles(particles, x, y, count, color, speed) {
  let spawned = 0;
  for (const particle of particles) {
    if (spawned >= count) break;
    if (particle.active) continue;
    const angle = Math.random() * Math.PI * 2;
    const velocity = speed * (0.4 + Math.random() * 0.6);
    particle.active = true;
    particle.x = x;
    particle.y = y;
    particle.vx = Math.cos(angle) * velocity;
    particle.vy = Math.sin(angle) * velocity;
    particle.life = 0.35 + Math.random() * 0.35;
    particle.maxLife = particle.life;
    particle.color = color;
    particle.size = 2 + Math.random() * 3;
    spawned += 1;
  }
}

export function stepParticles(particles, dt) {
  for (const particle of particles) {
    if (!particle.active) continue;
    particle.life -= dt;
    if (particle.life <= 0) {
      particle.active = false;
      continue;
    }
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= 0.94;
    particle.vy *= 0.94;
  }
}

/**
 * Move every bullet and resolve its hits. `targets` are the people a friendly bullet can
 * hurt (pedestrians, rivals, cops); a hostile bullet can only hurt the player. Returns the
 * list of hits as {bullet, target} pairs for the world to score.
 */
export function stepBullets(bullets, city, player, targets, dt) {
  const hits = [];
  for (const bullet of bullets) {
    if (!bullet.active) continue;
    bullet.life -= dt;
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    if (bullet.life <= 0 || bullet.x < 0 || bullet.y < 0 || bullet.x > city.size || bullet.y > city.size) {
      bullet.active = false;
      continue;
    }
    if (city.pointInsideBuilding(bullet.x, bullet.y, 2)) {
      bullet.active = false;
      hits.push({ bullet, kind: 'wall', x: bullet.x, y: bullet.y });
      continue;
    }
    if (bullet.friendly) {
      for (const target of targets) {
        if (target.health <= 0 || target.state === 'down') continue;
        if (circlesOverlap(bullet.x, bullet.y, 3, target.x, target.y, 13)) {
          bullet.active = false;
          hits.push({ bullet, kind: 'person', target, x: bullet.x, y: bullet.y });
          break;
        }
      }
    } else if (player.car === null && circlesOverlap(bullet.x, bullet.y, 3, player.x, player.y, PLAYER.radius)) {
      bullet.active = false;
      hits.push({ bullet, kind: 'player', x: bullet.x, y: bullet.y });
    }
  }
  return hits;
}

/**
 * A punch in front of the player: the nearest person within range and a wide arc in front
 * of the fist takes the hit and is knocked back a step.
 */
export function punchHit(player, targets) {
  let best = null;
  let bestDist = PLAYER.punchRange + 13;
  for (const target of targets) {
    if (target.health <= 0 || target.state === 'down') continue;
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist > bestDist) continue;
    const angleTo = Math.atan2(dy, dx);
    let diff = angleTo - player.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) > 1.1) continue;
    bestDist = dist;
    best = target;
  }
  if (best === null) return null;
  best.health -= PLAYER.punchDamage;
  const away = Math.atan2(best.y - player.y, best.x - player.x);
  best.x += Math.cos(away) * 26;
  best.y += Math.sin(away) * 26;
  return best;
}
