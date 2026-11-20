// The screenshot scenes behind ?shot=chase|drive|mission|street. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a tiny scripted
// driver, so the frame is what a short game really looks like and the same seed always
// gives the same frame. The cover (chase) shows the most at once: a police pursuit, the
// wanted stars, the minimap and a mission objective on the HUD.

import { STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { angleDifference } from './util.js';

/** Steer a car toward `targetAngle`, with the pedal held down. */
function driveControl(car, targetAngle) {
  return {
    move: { x: 0, y: 0 },
    pedal: 1,
    steer: Math.max(-1, Math.min(1, angleDifference(car.angle, targetAngle) * 2.2)),
    aim: null,
    shooting: false,
    enter: false,
    punch: false,
  };
}

function walkControl(angle) {
  return {
    move: { x: Math.cos(angle), y: Math.sin(angle) },
    pedal: 0,
    steer: 0,
    aim: null,
    shooting: false,
    enter: false,
    punch: false,
  };
}

const IDLE = {
  move: { x: 0, y: 0 },
  pedal: 0,
  steer: 0,
  aim: null,
  shooting: false,
  enter: false,
  punch: false,
};

function runSteps(world, seconds, controlFn) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    world.step(STEP, controlFn(i));
  }
}

function stageChase(world) {
  world.reset();
  world.teleportPlayer(1800, 1500);
  world.givePlayerCar('Van', 1800, 1500, Math.PI / 2);
  world.startMissionAt(0);
  world.setWanted(3);
  // Drive clear of the start first, then bring both patrol cars in close behind the
  // player, so the cover shows the van with two pursuers in frame instead of a pile-up.
  // The run is long enough for the mission dialog and banner to fade, leaving the chase.
  runSteps(world, 2.5, () => driveControl(world.state.player.car, Math.PI / 2));
  const player = world.state.player;
  world.spawnPatrolAt(player.x - 90, player.y - 210);
  world.spawnPatrolAt(player.x + 90, player.y - 250);
  // 1.7 s more: the mission dialog (4 s) and banner (2.6 s) have faded, and the patrols,
  // already rolling at pursuit speed, sit just behind the van in the frame.
  runSteps(world, 1.7, () => driveControl(world.state.player.car, Math.PI / 2));
  return { screen: SCREEN_PLAY };
}

function stageDrive(world) {
  world.reset();
  world.teleportPlayer(900, 1000);
  world.givePlayerCar('Sedan', 900, 1000, 0);
  world.startMissionAt(0);
  runSteps(world, 4.5, () => driveControl(world.state.player.car, 0));
  return { screen: SCREEN_PLAY };
}

function stageMission(world) {
  world.reset();
  world.startMissionAt(0);
  // The delivery leg of the first job: the package already in hand, Jesse walking to
  // Delgado's Café with the gold beacon on the door, the banner and Marta's words showing.
  world.state.missions.objective = 2;
  world.state.missions.hasPackage = true;
  world.teleportPlayer(1330, 1410);
  // A short walk toward the café: close enough to see the gold beacon on its door, far
  // enough that the delivery is still in progress when the frame is taken.
  runSteps(world, 0.3, () => walkControl(0.45));
  return { screen: SCREEN_PLAY };
}

function stageStreet(world) {
  world.reset();
  world.teleportPlayer(1600, 1600);
  // Gather a few pedestrians onto the plaza so the street scene is alive: the fountain,
  // the player and the crowd in one frame.
  for (let i = 0; i < 6; i += 1) {
    const ped = world.state.peds[i];
    ped.x = 1480 + i * 52;
    ped.y = 1520 + (i % 2) * 120;
    ped.target = { x: 1600, y: 1600 };
    ped.pauseTimer = 0;
  }
  runSteps(world, 0.6, () => walkControl(0));
  return { screen: SCREEN_PLAY };
}

function stageTitle(world) {
  world.reset();
  runSteps(world, 3, () => IDLE);
  return { screen: SCREEN_TITLE };
}

/**
 * Set `world` to the named scene and return the screen to draw over it. Any other name
 * stages the title screen.
 */
export function stageShot(name, world) {
  if (name === 'chase') return stageChase(world);
  if (name === 'drive') return stageDrive(world);
  if (name === 'mission') return stageMission(world);
  if (name === 'street') return stageStreet(world);
  return stageTitle(world);
}
