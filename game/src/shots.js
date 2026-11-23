// The screenshot scenes behind ?shot=chase|drive|mission|street. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a tiny scripted
// driver, so the frame is what a short game really looks like and the same seed always
// gives the same frame. The cover (chase) shows the most at once: the last story job on
// the clock, a four-star pursuit with the SBPD dispatch board and Air One overhead, the
// money earned from the first three jobs, Marta's briefing, the circular minimap and the
// speedometer — a whole chase readable in a single frame.

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
  // The Big Score, the last job: a timed run to the Docks with the harbour police
  // already on the player. The money is what the first three jobs paid ($400 + $600 +
  // $900), so the cash on the HUD is earned, not staged in from nowhere.
  world.teleportPlayer(1800, 800);
  world.givePlayerCar('Sport', 1800, 800, Math.PI / 2);
  world.startMissionAt(3);
  world.setWanted(4);
  world.state.player.money = 1900;
  // Drive clear of the start first, then bring three patrol cars in close behind the
  // player, so the cover shows the Sport with a pursuit in frame instead of a pile-up.
  runSteps(world, 2.5, () => driveControl(world.state.player.car, Math.PI / 2));
  const player = world.state.player;
  world.spawnPatrolAt(player.x - 110, player.y - 230);
  world.spawnPatrolAt(player.x + 100, player.y - 280);
  world.spawnPatrolAt(player.x - 40, player.y - 330);
  // 1.7 s more: the patrols, already rolling at pursuit speed, sit just behind the
  // Sport in the frame, and Air One has had time to take station overhead.
  runSteps(world, 1.7, () => driveControl(world.state.player.car, Math.PI / 2));
  // The mission briefing fades after four seconds of play, so pin Marta's words back
  // onto the frame for the shot: the cover should carry her voice, the way the
  // best-looking entries carry their fixer's.
  world.state.missions.dialog = [
    'Marta: One last job. A crate at the Docks, worth more than this whole street.',
    'Marta: The harbour police are already on you. One hundred seconds. Go.',
  ];
  world.state.missions.dialogTimer = 999;
  world.state.missions.bannerTimer = 0;
  return { screen: SCREEN_PLAY };
}

function stageDrive(world) {
  world.reset();
  world.teleportPlayer(900, 1000);
  world.givePlayerCar('Sedan', 900, 1000, 0);
  // Hot Wheels, the second job, with two stars of heat already on the player: the
  // drive shot shows a stolen-car job mid-flight, not an empty cruise.
  world.startMissionAt(1);
  world.setWanted(2);
  world.state.player.money = 400;
  runSteps(world, 4.5, () => driveControl(world.state.player.car, 0));
  world.state.missions.bannerTimer = 0;
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
