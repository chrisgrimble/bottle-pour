# Bottle Pour

A liquid-sorting puzzle that runs in the browser. Pour coloured layers between bottles until every bottle is either empty or full of a single colour.

**Play it:** https://chrisgrimble.github.io/bottle-pour/

- 40 levels, from 3 bottles up to 11, every one checked solvable
- Up to 3 stars per level for solving in the fewest moves, and a Levels screen to replay them
- Hints, undo and restart
- Hidden layers on some later levels: you only see a colour once it reaches the top
- Progress is saved per player name, in this browser
- Sound and celebrations, generated in the browser (no audio files)
- Installs as an app on Android (Chrome menu → Install app) and plays offline

## Rules

- You can pour onto an empty bottle, or onto a bottle with room whose top colour matches.
- Matching layers on top pour together, as many as fit.
- You win when every bottle is empty or full of one colour.

## Running it locally

Open `index.html` in a browser. There's no build step and nothing to install.

## Development

Plain HTML and JavaScript with no dependencies. Node.js is only needed for the tools.

| Command | What it does |
| --- | --- |
| `npm test` | Runs the tests: rules, solver, every level's solvability and par, saving |
| `npm run generate-levels` | Rebuilds `levels.js` (seeded, so the output is the same each run) |
| `npm run build` | Bundles the game into one self-contained file, `dist/bottle-pour.html` |

| File | Contents |
| --- | --- |
| `rules.js` | Pouring, winning, the solver, stars and hidden layers |
| `levels.js` | The generated levels |
| `game.js` | Screens, input and the pour animation |
| `progress.js` | Saving players and progress (cookies, or localStorage when cookies aren't available) |
| `sound.js`, `celebrate.js` | Sound effects and visual celebrations |
| `manifest.webmanifest`, `sw.js`, `icons/` | Installing as an app and offline play; `node tools/make-icons.mjs` redraws the PNGs from `icons/icon.svg` |
