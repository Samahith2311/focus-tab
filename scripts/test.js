// Self-check for the pure logic in lib/util.js. Run: node scripts/test.js
const assert = require('assert');
const { normalizeDomain, formatRemaining, dayKey, summarizeStats } = require('../lib/util.js');

assert.strictEqual(normalizeDomain('https://www.YouTube.com/watch?v=1'), 'youtube.com');
assert.strictEqual(normalizeDomain('  m.reddit.com  '), 'm.reddit.com');
assert.strictEqual(normalizeDomain('localhost'), null);
assert.strictEqual(normalizeDomain('not a domain'), null);
assert.strictEqual(normalizeDomain(''), null);

assert.strictEqual(formatRemaining(90000), '1:30');
assert.strictEqual(formatRemaining(59001), '1:00');
assert.strictEqual(formatRemaining(-5), '0:00');

assert.strictEqual(dayKey(new Date(2026, 0, 5)), '2026-01-05');

// 2026-11-16 is a Monday. Sessions on Fri 13, Sun 15, Mon 16, Tue 17, Wed 18.
const stats = {
  '2026-11-13': { sessions: 1, minutes: 25 },
  '2026-11-15': { sessions: 1, minutes: 60 },
  '2026-11-16': { sessions: 1, minutes: 15 },
  '2026-11-17': { sessions: 2, minutes: 50 },
  '2026-11-18': { sessions: 1, minutes: 25 }
};
assert.deepStrictEqual(summarizeStats(stats, new Date(2026, 10, 18, 12)), {
  today: { sessions: 1, minutes: 25 },
  week: { sessions: 4, minutes: 90 },  // Monday to Wednesday; Sunday belongs to last week
  streak: 4                            // Sun, Mon, Tue, Wed; Saturday breaks it
});
// Nothing done yet on Thursday: the streak still stands from yesterday.
assert.deepStrictEqual(summarizeStats(stats, new Date(2026, 10, 19, 9)), {
  today: { sessions: 0, minutes: 0 },
  week: { sessions: 4, minutes: 90 },
  streak: 4
});
assert.strictEqual(summarizeStats(stats, new Date(2026, 10, 20, 9)).streak, 0);
assert.strictEqual(summarizeStats({}).streak, 0);

console.log('util tests passed');
