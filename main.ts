// Solara Bay hands itself in (Node 22, standard library only): the game is this directory's
// game/ folder — plain static files a desktop browser loads offline (game/index.html and its
// ES modules, no library and no network request) — and this program copies game/ and
// screenshots/ from beside this file to /output and writes /output/dossier.json, the summary
// the judge reads, with the vendored make.fun library. The game is a 2D top-down open-world
// crime game: a 3200x3200 city to explore on foot and by car, traffic and pedestrians, cars
// to steal and drive, a wanted level with an SBPD dispatch board and an Air One helicopter,
// four story missions worth $3,400, fist and pistol combat, a HUD with a mission card,
// weapon slots, speedometer and circular minimap, a start screen and a localStorage save.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The repository root is the folder this file lives in; /output is the grader's folder,
// or MAKEFUN_OUTPUT_DIR when run outside the grader.
const root = fileURLToPath(new URL('.', import.meta.url));
const output = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(output, { recursive: true });
cpSync(join(root, 'game'), join(output, 'game'), { recursive: true });
mkdirSync(join(output, 'screenshots'), { recursive: true });
if (existsSync(join(root, 'screenshots'))) {
  cpSync(join(root, 'screenshots'), join(output, 'screenshots'), { recursive: true });
}

// The scorer's own caps: only text_max_bytes shapes the bytes; the others refuse an entry
// the scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993
// files in game/ or 48 MiB of game files, in all, or a path under game/ over 1000 bytes).
const dossier = buildDossier(output, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(output, 'dossier.json'), dossier);
