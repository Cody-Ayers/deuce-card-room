import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DCR, hand, c } from './load-engine.mjs';

const {
  R_WHEEL, rColor, rouletteBet, settleRoulette,
  TC_CAT, eval3, tcCat, tcQualifies, tcShouldPlay, settleThreeCard, TC_PAIRPLUS,
  bacV, bacTotal, bankerDraws, bacPlay, settleBaccarat,
  vpHand,
} = DCR;
const plain = (o) => JSON.parse(JSON.stringify(o));

/* ---------- roulette ---------- */
test('the roulette wheel has every number once, in single-zero order', () => {
  assert.equal(R_WHEEL.length, 37);
  assert.deepEqual([...R_WHEEL].sort((a, b) => a - b), Array.from({ length: 37 }, (_, i) => i));
  assert.equal(R_WHEEL[0], 0);
  assert.equal(R_WHEEL[1], 32);
});

test('roulette colors match a real wheel', () => {
  assert.equal(rColor(0), 'green');
  assert.equal(rColor(1), 'red');
  assert.equal(rColor(2), 'black');
  assert.equal(rColor(10), 'black');
  assert.equal(rColor(19), 'red');
  assert.equal(rColor(36), 'red');
  const reds = Array.from({ length: 36 }, (_, i) => i + 1).filter((n) => rColor(n) === 'red');
  assert.equal(reds.length, 18);
});

test('every roulette bet has a 1/37 house edge', () => {
  const keys = ['red', 'black', 'odd', 'even', 'low', 'high', 'd1', 'd2', 'd3', 'c1', 'c2', 'c3', 'n0', 'n17', 'n36'];
  for (const k of keys) {
    let back = 0;
    for (let n = 0; n <= 36; n++) back += settleRoulette({ [k]: 1 }, n).back;
    assert.ok(Math.abs(back / 37 - 36 / 37) < 1e-9, `${k}: ${back}/37`);
  }
});

test('recognizes every inside bet and rejects impossible ones', () => {
  const kind = (k) => rouletteBet(k) && rouletteBet(k).kind;
  assert.equal(kind('i:1-2'), 'Split');
  assert.equal(kind('i:2-5'), 'Split');
  assert.equal(kind('i:0-3'), 'Split');
  assert.equal(kind('i:3-4'), null); // different rows
  assert.equal(kind('i:1-5'), null);
  assert.equal(kind('i:34-35'), 'Split');
  assert.equal(kind('i:4-5-6'), 'Street');
  assert.equal(kind('i:5-6-7'), null);
  assert.equal(kind('i:0-1-2'), 'Trio');
  assert.equal(kind('i:0-2-3'), 'Trio');
  assert.equal(kind('i:0-1-3'), null);
  assert.equal(kind('i:1-2-4-5'), 'Corner');
  assert.equal(kind('i:2-3-5-6'), 'Corner');
  assert.equal(kind('i:3-4-6-7'), null); // wraps across rows
  assert.equal(kind('i:32-33-35-36'), 'Corner');
  assert.equal(kind('i:0-1-2-3'), 'First four');
  assert.equal(kind('i:1-2-3-4-5-6'), 'Six line');
  assert.equal(kind('i:31-32-33-34-35-36'), 'Six line');
  assert.equal(kind('i:2-3-4-5-6-7'), null);
  assert.equal(kind('i:2-1'), null); // must be sorted
  assert.equal(kind('i:36-37'), null);
  assert.equal(rouletteBet('i:1-2').pay, 17);
  assert.equal(rouletteBet('i:4-5-6').pay, 11);
  assert.equal(rouletteBet('i:1-2-4-5').pay, 8);
  assert.equal(rouletteBet('i:1-2-3-4-5-6').pay, 5);
});

test('inside bets also carry a 1/37 house edge', () => {
  for (const k of ['i:0-1', 'i:17-20', 'i:0-1-2', 'i:13-14-15', 'i:0-1-2-3', 'i:20-21-23-24', 'i:7-8-9-10-11-12']) {
    let back = 0;
    for (let n = 0; n <= 36; n++) back += settleRoulette({ [k]: 1 }, n).back;
    assert.ok(Math.abs(back / 37 - 36 / 37) < 1e-9, `${k}: ${back}/37`);
  }
  const r = settleRoulette({ 'i:16-17': 10, 'i:13-14-16-17': 10 }, 17);
  assert.equal(r.back, 180 + 90);
});

test('roulette settles a mix of bets', () => {
  const r = settleRoulette({ n17: 10, black: 20, d1: 5, c2: 5 }, 17);
  // 17 is black, 2nd dozen, column 2 (17 % 3 === 2)
  assert.equal(r.staked, 40);
  assert.equal(r.back, 10 + 350 + 20 + 20 + 5 + 10);
  assert.equal(r.net, r.back - 40);
  assert.equal(rouletteBet('n37'), null);
  assert.equal(rouletteBet('bogus'), null);
  // zero loses every outside bet
  assert.equal(settleRoulette({ red: 10, black: 10, odd: 10, even: 10, low: 10, high: 10 }, 0).back, 0);
});

/* ---------- three card poker ---------- */
const cat3 = (...codes) => TC_CAT[tcCat(eval3(hand(...codes)))];

test('ranks three-card hands, with straights above flushes', () => {
  assert.equal(cat3('Qs', 'Ks', 'As'), 'Straight flush');
  assert.equal(cat3('7s', '7h', '7d'), 'Three of a kind');
  assert.equal(cat3('As', '2h', '3d'), 'Straight');
  assert.equal(cat3('2s', '9s', 'Js'), 'Flush');
  assert.equal(cat3('8s', '8h', 'Kd'), 'Pair');
  assert.equal(cat3('Ks', '2h', '3d'), 'High card');
  assert.equal(cat3('Ks', 'Ah', '2d'), 'High card'); // K-A-2 doesn't wrap
  assert.ok(eval3(hand('4s', '5h', '6d')) > eval3(hand('2h', '9h', 'Ah')));
  assert.ok(eval3(hand('As', '2h', '3d')) < eval3(hand('2s', '3h', '4d'))); // A-2-3 is the lowest straight
  assert.ok(eval3(hand('9s', '9h', 'Ad')) > eval3(hand('9c', '9d', 'Kh'))); // kicker counts
});

test('the dealer qualifies with queen high or better', () => {
  assert.equal(tcQualifies(eval3(hand('Qs', '4h', '2d'))), true);
  assert.equal(tcQualifies(eval3(hand('Js', '10h', '8d'))), false);
  assert.equal(tcQualifies(eval3(hand('2s', '2h', '3d'))), true);
});

test('Q-6-4 is the play-or-fold line', () => {
  assert.equal(tcShouldPlay(eval3(hand('Qs', '6h', '4d'))), true);
  assert.equal(tcShouldPlay(eval3(hand('Qs', '6h', '3d'))), false);
  assert.equal(tcShouldPlay(eval3(hand('Ks', '3h', '2d'))), true);
  assert.equal(tcShouldPlay(eval3(hand('Js', '10h', '8d'))), false);
});

test('Pair Plus pays 1-4-6-30-40 for a 2.32% house edge', () => {
  const deck = [];
  for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) deck.push({ r, s });
  let ret = 0, n = 0;
  for (let a = 0; a < 52; a++) for (let b = a + 1; b < 52; b++) for (let d = b + 1; d < 52; d++) {
    const m = TC_PAIRPLUS[tcCat(eval3([deck[a], deck[b], deck[d]]))] || -1;
    ret += m; n++;
  }
  assert.equal(n, 22100);
  assert.ok(Math.abs(ret / n - -0.0232) < 0.0005, String(ret / n));
});

test('settles ante, play, bonus and pair plus', () => {
  // Player straight beats a qualifying dealer: ante 1:1, play 1:1, bonus 1:1, pair plus 6:1
  let r = settleThreeCard({ ante: 10, pp: 5 }, hand('5s', '6h', '7d'), hand('Ks', '9h', '2d'));
  assert.equal(r.out, 'win');
  assert.equal(r.back, 35 + 20 + 20 + 10);
  // Dealer doesn't qualify: ante wins, play pushes
  r = settleThreeCard({ ante: 10, pp: 0 }, hand('2s', '5h', '9d'), hand('Js', '10h', '8d'));
  assert.equal(r.out, 'dq');
  assert.equal(r.back, 30);
  // Dealer wins: lose ante and play, but the ante bonus still pays
  r = settleThreeCard({ ante: 10, pp: 0 }, hand('2s', '3h', '4d'), hand('8s', '8h', '8d'));
  assert.equal(r.out, 'lose');
  assert.equal(r.back, 10);
  // Fold: ante lost, pair plus still settles
  r = settleThreeCard({ ante: 10, pp: 5, fold: true }, hand('4s', '4h', '9d'), hand('Ks', '9h', '2d'));
  assert.equal(r.out, 'fold');
  assert.equal(r.back, 10);
  assert.deepEqual(plain(r.L.map((l) => l.win)), [5, -10]);
});

/* ---------- baccarat ---------- */
test('baccarat card values and totals', () => {
  assert.equal(bacV(c('As')), 1);
  assert.equal(bacV(c('Kd')), 0);
  assert.equal(bacV(c('10h')), 0);
  assert.equal(bacTotal(hand('7s', '8h')), 5);
  assert.equal(bacTotal(hand('9s', 'Kh')), 9);
});

test('the banker follows the third-card table', () => {
  assert.equal(bankerDraws(5, null), true);
  assert.equal(bankerDraws(6, null), false);
  assert.equal(bankerDraws(2, c('9s')), true);
  assert.equal(bankerDraws(3, c('8s')), false);
  assert.equal(bankerDraws(3, c('9s')), true);
  assert.equal(bankerDraws(4, c('2s')), true);
  assert.equal(bankerDraws(4, c('As')), false);
  assert.equal(bankerDraws(5, c('4s')), true);
  assert.equal(bankerDraws(5, c('3s')), false);
  assert.equal(bankerDraws(6, c('7s')), true);
  assert.equal(bankerDraws(6, c('5s')), false);
  assert.equal(bankerDraws(7, c('7s')), false);
});

test('deals a baccarat coup in the right order', () => {
  // Cards go Player, Banker, Player, Banker: P 2+3 = 5, B 3+K = 3.
  // Player draws a 5 (total 0); banker on 3 draws against a 5 and gets a 6.
  const shoe = hand('2s', '3h', '3d', 'Kc', '5s', '6h');
  const r = bacPlay(() => shoe.shift());
  assert.deepEqual(plain(r.p.map((x) => x.r)), [2, 3, 5]);
  assert.deepEqual(plain(r.b.map((x) => x.r)), [3, 13, 6]);
  assert.equal(r.pt, 0);
  assert.equal(r.bt, 9);
  assert.equal(r.win, 'banker');
  const nat = bacPlay(((s) => () => s.shift())(hand('9s', '2h', 'Kd', '3c')));
  assert.equal(nat.natural, true);
  assert.equal(nat.p.length, 2);
  assert.equal(nat.b.length, 2);
});

test('baccarat pays banker less commission and pushes on a tie', () => {
  assert.equal(settleBaccarat({ player: 20, banker: 0, tie: 0 }, 'player').back, 40);
  assert.equal(settleBaccarat({ banker: 20 }, 'banker').back, 39);
  assert.equal(settleBaccarat({ player: 20, tie: 5 }, 'tie').back, 20 + 45);
  assert.equal(settleBaccarat({ player: 20 }, 'banker').back, 0);
});

/* ---------- video poker ---------- */
test('names every Jacks or Better payout', () => {
  const n = (...codes) => vpHand(hand(...codes)).n;
  assert.equal(n('10s', 'Js', 'Qs', 'Ks', 'As'), 'Royal flush');
  assert.equal(n('9s', '10s', 'Js', 'Qs', 'Ks'), 'Straight flush');
  assert.equal(n('As', '2s', '3s', '4s', '5s'), 'Straight flush');
  assert.equal(n('7s', '7h', '7d', '7c', '2s'), 'Four of a kind');
  assert.equal(n('7s', '7h', '7d', '2c', '2s'), 'Full house');
  assert.equal(n('2h', '7h', '9h', 'Jh', 'Kh'), 'Flush');
  assert.equal(n('As', '2h', '3d', '4c', '5s'), 'Straight');
  assert.equal(n('5s', '5h', '5d', 'Kc', '2s'), 'Three of a kind');
  assert.equal(n('3s', '3h', '9d', '9c', 'As'), 'Two pair');
  assert.equal(n('Js', 'Jh', '3d', '7c', '9s'), 'Jacks or better');
  assert.equal(n('10s', '10h', '3d', '7c', 'As'), 'No win');
  assert.equal(vpHand(hand('Qs', 'Qh', '3d', '7c', '9s')).mult, 1);
  assert.equal(vpHand(hand('7s', '7h', '7d', '2c', '2s')).mult, 9);
});
