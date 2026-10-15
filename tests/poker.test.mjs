import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DCR, hand } from './load-engine.mjs';

const { best, catName, equity } = DCR;
const rank = (...codes) => best(hand(...codes));
const name = (...codes) => catName(rank(...codes));

test('names every hand category', () => {
  assert.equal(name('As', 'Ks', 'Qs', 'Js', '10s'), 'Straight Flush');
  assert.equal(name('9s', '9h', '9d', '9c', '2s'), 'Four of a Kind');
  assert.equal(name('8s', '8h', '8d', '4c', '4s'), 'Full House');
  assert.equal(name('2h', '7h', '9h', 'Jh', 'Kh'), 'Flush');
  assert.equal(name('5s', '6h', '7d', '8c', '9s'), 'Straight');
  assert.equal(name('Qs', 'Qh', 'Qd', '4c', '2s'), 'Three of a Kind');
  assert.equal(name('Js', 'Jh', '3d', '3c', 'As'), 'Two Pair');
  assert.equal(name('10s', '10h', '3d', '7c', 'As'), 'Pair');
  assert.equal(name('2s', '5h', '9d', 'Jc', 'Ks'), 'High Card');
});

test('category order: each beats the one below', () => {
  const ladder = [
    rank('As', 'Ks', 'Qs', 'Js', '10s'), rank('9s', '9h', '9d', '9c', '2s'), rank('8s', '8h', '8d', '4c', '4s'),
    rank('2h', '7h', '9h', 'Jh', 'Kh'), rank('5s', '6h', '7d', '8c', '9s'), rank('Qs', 'Qh', 'Qd', '4c', '2s'),
    rank('Js', 'Jh', '3d', '3c', 'As'), rank('10s', '10h', '3d', '7c', 'As'), rank('2s', '5h', '9d', 'Jc', 'Ks'),
  ];
  for (let i = 0; i < ladder.length - 1; i++) assert.ok(ladder[i] > ladder[i + 1], `rank ${i} should beat ${i + 1}`);
});

test('the wheel (A-2-3-4-5) is the lowest straight', () => {
  assert.equal(name('As', '2h', '3d', '4c', '5s'), 'Straight');
  assert.ok(rank('2s', '3h', '4d', '5c', '6s') > rank('As', '2h', '3d', '4c', '5s'));
});

test('kickers break ties', () => {
  assert.ok(rank('As', 'Ah', 'Kd', '7c', '2s') > rank('Ad', 'Ac', 'Qd', 'Jc', '10s'));
  assert.ok(rank('Ks', 'Kh', '9d', '9c', '4s') > rank('Kd', 'Kc', '9h', '9s', '3s'));
  assert.equal(rank('As', 'Kh', '9d', '7c', '4s'), rank('Ad', 'Kc', '9h', '7s', '4d'));
});

test('best() picks the strongest five of seven cards', () => {
  assert.equal(name('As', 'Ad', 'Kc', 'Ks', 'Kh', '2d', '3c'), 'Full House');
  assert.equal(name('2h', '9h', '4h', 'Jh', 'Qh', 'Kc', 'Kd'), 'Flush');
  assert.equal(name('6s', '7h', '8d', '9c', '10s', 'Jd', '2c'), 'Straight');
});

test('equity: aces are a big favorite heads-up, 7-2 is not', () => {
  assert.ok(equity(hand('As', 'Ah'), [], 1, 1500) > 0.78);
  assert.ok(equity(hand('7s', '2h'), [], 1, 1500) < 0.42);
  assert.equal(equity(hand('As', 'Ks'), hand('Qs', 'Js', '10s'), 1, 200), 1);
});
