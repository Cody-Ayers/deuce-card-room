import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DCR } from './load-engine.mjs';

const { settleCraps } = DCR;

// A fresh table with a 1,000-chip wallet.
function table() {
  const wallet = { v: 1000, get() { return this.v; }, add(n) { this.v += n; } };
  const s = { w: wallet, bets: {}, come: {}, dc: {}, co: {}, point: null };
  const bet = (key, amount) => { wallet.add(-amount); s.bets[key] = (s.bets[key] || 0) + amount; };
  const roll = (a, b) => settleCraps(s, a, b);
  return { s, wallet, bet, roll };
}

test('pass line: natural wins, craps loses, point is set', () => {
  let t = table(); t.bet('pass', 10); t.roll(3, 4); assert.equal(t.wallet.v, 1010);
  t = table(); t.bet('pass', 10); t.roll(1, 1); assert.equal(t.wallet.v, 990);
  t = table(); t.bet('pass', 10); t.roll(2, 2); assert.equal(t.s.point, 4); assert.equal(t.wallet.v, 990);
});

test('pass line with odds pays true odds on the point', () => {
  const t = table(); t.bet('pass', 10); t.roll(1, 3); // point 4
  t.bet('odds', 30); t.roll(2, 2);                    // point made
  assert.equal(t.wallet.v, 1000 + 10 + 60);           // 1:1 on the line, 2:1 on the odds
  assert.equal(t.s.point, null);
});

test('seven out loses the line and its odds', () => {
  const t = table(); t.bet('pass', 10); t.roll(4, 4); t.bet('odds', 50); t.roll(3, 4);
  assert.equal(t.wallet.v, 940);
});

test('don’t pass: 12 is barred (push), 2 wins, lay odds pay on a 7', () => {
  let t = table(); t.bet('dontpass', 10); t.roll(6, 6); assert.equal(t.s.bets.dontpass, 10); assert.equal(t.wallet.v, 990);
  t = table(); t.bet('dontpass', 10); t.roll(1, 1); assert.equal(t.wallet.v, 1010);
  t = table(); t.bet('dontpass', 10); t.roll(2, 4); t.bet('lay', 30); t.roll(3, 4);
  assert.equal(t.wallet.v, 1000 + 10 + 25);           // 5:6 on a point of 6
});

test('field pays double on 2, triple on 12, loses on 7', () => {
  let t = table(); t.bet('field', 10); t.roll(1, 1); assert.equal(t.wallet.v, 1020);
  t = table(); t.bet('field', 10); t.roll(6, 6); assert.equal(t.wallet.v, 1030);
  t = table(); t.bet('field', 10); t.roll(3, 4); assert.equal(t.wallet.v, 990);
});

test('place bets are off on the come-out and pay their odds once a point is on', () => {
  const t = table(); t.bet('place6', 12); t.roll(3, 3);   // come-out: off
  assert.equal(t.wallet.v, 988); assert.equal(t.s.bets.place6, 12);
  t.roll(2, 2); t.roll(5, 1);                              // point 4, then a 6
  assert.equal(t.wallet.v, 988 + 14);                      // 7:6, bet stays up
});

test('come bet travels to its number and its odds pay', () => {
  const t = table(); t.bet('pass', 10); t.roll(3, 3);      // point 6
  t.bet('come', 10); t.roll(2, 3);                          // come → 5
  assert.equal(t.s.come[5], 10);
  t.s.co[5] = 20; t.wallet.add(-20); t.roll(1, 4);          // 5 hits
  assert.equal(t.wallet.v, 1000 - 10 - 10 - 20 + 20 + 50);  // come 1:1, odds 3:2
});

test('hardways: win the hard way, lose easy or on a 7, off on come-out', () => {
  let t = table(); t.bet('pass', 10); t.roll(2, 2); t.bet('hard8', 5); t.roll(4, 4);
  assert.equal(t.s.bets.hard8, 5); assert.equal(t.wallet.v, 1000 - 10 - 5 + 45);
  t = table(); t.bet('pass', 10); t.roll(2, 2); t.bet('hard8', 5); t.roll(5, 3);
  assert.equal(t.s.bets.hard8, undefined);
  t = table(); t.bet('hard6', 5); t.roll(3, 3); assert.equal(t.s.bets.hard6, 5); assert.equal(t.wallet.v, 995);
});

test('one-roll props: 11, 2, horn and C&E', () => {
  let t = table(); t.bet('p11', 5); t.roll(5, 6); assert.equal(t.wallet.v, 1075);
  t = table(); t.bet('p2', 5); t.roll(1, 1); assert.equal(t.wallet.v, 1150);
  t = table(); t.bet('horn', 4); t.roll(6, 6); assert.equal(t.wallet.v, 1000 + 27);  // 30:1 on one quarter, 3 quarters lose
  t = table(); t.bet('horn', 4); t.roll(5, 6); assert.equal(t.wallet.v, 1000 + 12);  // 15:1 on one quarter
  t = table(); t.bet('ce', 10); t.roll(5, 6); assert.equal(t.wallet.v, 1000 + 70);
  t = table(); t.bet('ce', 10); t.roll(1, 2); assert.equal(t.wallet.v, 1000 + 30);
  t = table(); t.bet('ce', 10); t.roll(3, 4); assert.equal(t.wallet.v, 990);
});

test('don’t come moves to a number and wins on a 7', () => {
  const t = table(); t.bet('pass', 10); t.roll(3, 3); t.bet('dontcome', 10); t.roll(4, 4);
  assert.equal(t.s.dc[8], 10); t.roll(3, 4);
  assert.equal(t.wallet.v, 1000 - 10 - 10 + 20);
});
