// Loads the game engine straight out of index.html, so the tests always
// check the exact code the app runs.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const html = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');
const match = html.match(/<script id="engine">([\s\S]*?)<\/script>/);
if (!match) throw new Error('Could not find <script id="engine"> in index.html');

const sandbox = { window: {} };
vm.runInNewContext(match[1], sandbox);
export const DCR = sandbox.window.DCR;

// Card helpers: c('As'), c('10h'), c('Kd') ...
const RANKS = { J: 11, Q: 12, K: 13, A: 14 };
const SUITS = { s: 0, h: 1, d: 2, c: 3 };
export const c = (code) => {
  const rank = code.slice(0, -1), suit = code.slice(-1);
  return { r: RANKS[rank] ?? Number(rank), s: SUITS[suit] };
};
export const hand = (...codes) => codes.map(c);
