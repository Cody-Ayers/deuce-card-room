import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DCR, c, hand } from './load-engine.mjs';

const { isBJ, strategy } = DCR;
// copy into this realm so deepEqual compares values, not prototypes
const val = (cards) => ({ ...DCR.val(cards) });

test('hand totals count aces as 11 until that would bust', () => {
  assert.deepEqual(val(hand('As', '6h')), { t: 17, soft: true });
  assert.deepEqual(val(hand('As', '6h', '9d')), { t: 16, soft: false });
  assert.deepEqual(val(hand('As', 'Ad', '9c')), { t: 21, soft: true });
  assert.deepEqual(val(hand('Ks', 'Qh', '5d')), { t: 25, soft: false });
});

test('blackjack is exactly two cards totaling 21', () => {
  assert.equal(isBJ(hand('As', 'Kd')), true);
  assert.equal(isBJ(hand('7s', '7d', '7c')), false);
});

// Basic strategy for 6 decks, dealer stands on soft 17, double after split.
const play = (cards, up, { canDouble = true, canSplit = true } = {}) =>
  strategy({ cards: hand(...cards) }, c(up), canDouble, canSplit).a;

const chart = [
  // pairs
  [['9s', '9d'], '6h', 'P'], [['9s', '9d'], '7h', 'S'], [['9s', '9d'], 'Kh', 'S'], [['9s', '9d'], '8h', 'P'],
  [['8s', '8d'], 'Kh', 'P'], [['As', 'Ad'], 'Ah', 'P'], [['Ks', 'Qd'], '6h', 'S'], [['5s', '5d'], '9h', 'D'],
  [['7s', '7d'], '7h', 'P'], [['7s', '7d'], '8h', 'H'], [['4s', '4d'], '5h', 'P'], [['4s', '4d'], '4h', 'H'],
  // hard totals
  [['10s', '6d'], 'Kh', 'H'], [['10s', '6d'], '6h', 'S'], [['10s', '2d'], '3h', 'H'], [['10s', '2d'], '4h', 'S'],
  [['6s', '5d'], 'Ah', 'H'], [['6s', '5d'], '10h', 'D'], [['4s', '5d'], '3h', 'D'], [['4s', '5d'], '2h', 'H'],
  [['10s', '7d'], 'Ah', 'S'],
  // soft totals
  [['As', '7d'], '2h', 'S'], [['As', '7d'], '9h', 'H'], [['As', '7d'], '5h', 'D'], [['As', '6d'], '3h', 'D'],
  [['As', '2d'], '4h', 'H'], [['As', '8d'], '6h', 'S'],
];
for (const [cards, up, expected] of chart) {
  test(`strategy: ${cards.join(' ')} vs ${up} → ${expected}`, () => {
    assert.equal(play(cards, up), expected);
  });
}

test('strategy falls back when doubling or splitting is not allowed', () => {
  assert.equal(play(['6s', '5d'], '6h', { canDouble: false }), 'H');
  assert.equal(play(['As', '7d'], '4h', { canDouble: false }), 'S');
  assert.equal(play(['9s', '9d'], '6h', { canSplit: false }), 'S');
  assert.equal(play(['8s', '8d'], '10h', { canSplit: false }), 'H');
});
