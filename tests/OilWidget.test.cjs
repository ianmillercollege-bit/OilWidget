const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'OilWidget.js'), 'utf8');
const goodCache = JSON.stringify({updated: 1700000000000, quotes: ['WTI', 'BRENT', 'LNG'].map(label => ({label, price: 60, change: 1}))});
async function run({ price = 61, offline = false, cache, readError = false, writeError = false, family = 'accessoryRectangular' } = {}) {
  let stored = cache;
  const texts = [];
  let completed = false;
  let rendered = false;
  class Widget {
    addText(s) { texts.push(s); return {centerAlignText() {}, rightAlignText() {}}; }
    addStack() { return new Widget(); }
    addSpacer() {}
    centerAlignContent() {}
    layoutVertically() {}
    setPadding() {}
  }
  class Color { static white() {} static gray() {} }
  const context = vm.createContext({
    FileManager: { local: () => ({ documentsDirectory: () => '/', joinPath: () => '/cache', writeString: (_, s) => { if (writeError) throw Error('write'); stored = s; }, fileExists: () => stored !== undefined, readString: () => { if (readError) throw Error('read'); return stored; } }) },
    Request: class { async loadJSON() { if (offline) throw Error('offline'); return {chart: {result: [{meta: {regularMarketPrice: price, chartPreviousClose: 60}}]}}; } },
    // Deliberately expose only the documented methods used by this widget.
    Font: {semiboldSystemFont() {}, mediumSystemFont() {}, boldSystemFont() {}, systemFont() {}, regularMonospacedSystemFont() {}, semiboldMonospacedSystemFont() {}},
    DateFormatter: class { useShortTimeStyle() {} string() { return '10:00'; } },
    Color, ListWidget: Widget,
    config: {widgetFamily: family, runsInWidget: true},
    Script: {setWidget() { rendered = true; }, complete() { completed = true; }},
  });
  await vm.runInContext('(async () => {\n' + source + '\n})()', context);
  assert.ok(completed && rendered);
  return {texts, cache: stored};
}
for (const family of ['accessoryRectangular', 'accessoryInline', 'accessoryCircular', 'small', 'medium', 'large']) {
  test('renders valid prices: ' + family, async () => {
    const r = await run({family});
    assert.ok(r.texts.includes('WTI') || r.texts.some(s => s.includes('WTI 61.00')));
    assert.equal(JSON.parse(r.cache).quotes[0].price, 61);
    assert.ok(!r.texts.some(s => s.includes('offline')));
  });
  test('marks cached prices offline: ' + family, async () => {
    const r = await run({family, offline: true, cache: goodCache});
    assert.ok(r.texts.some(s => s.includes('offline')));
  });
}
for (const price of [null, '61', NaN, Infinity]) {
  test('invalid price preserves good cache: ' + String(price), async () => {
    const r = await run({price, cache: goodCache});
    assert.equal(r.cache, goodCache);
    assert.ok(r.texts.some(s => s.includes('offline')));
  });
}
for (const cache of [undefined, '{', 'null', '{}', '{"updated":1,"quotes":[]}', JSON.stringify({updated: 1, quotes: [{label: 'WTI', price: null, change: 1}]})]) {
  test('missing or damaged cache safely shows no data: ' + cache, async () => {
    assert.deepEqual((await run({offline: true, cache})).texts, ['No data']);
  });
}
test('unreadable cache safely shows no data', async () => {
  assert.deepEqual((await run({offline: true, cache: goodCache, readError: true})).texts, ['No data']);
});
test('cache write failure still renders fresh prices', async () => {
  const r = await run({writeError: true});
  assert.ok(r.texts.includes('61.00 ▲'));
});
test('invalid price without cache shows no data', async () => {
  assert.deepEqual((await run({price: null})).texts, ['No data']);
});
