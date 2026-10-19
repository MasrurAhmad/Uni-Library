import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReport, checkAll, checkUrl, classify, entriesToCheck, errorKind, isLoginPage, pool, summarize } from '../scripts/lib/link-check.mjs';

const tick = () => new Promise((resolve) => setImmediate(resolve));

test('classify gives a verdict for each kind of answer', () => {
  const at = (status, finalUrl = 'https://example.com/file') => classify({ status, finalUrl }).state;
  assert.equal(at(200), 'ok');
  assert.equal(at(404), 'broken');
  assert.equal(at(410), 'broken');
  assert.equal(at(403), 'unsure');
  assert.equal(at(429), 'unsure');
  assert.equal(at(503), 'unsure');
  assert.equal(at(200, 'https://accounts.google.com/v3/signin'), 'login');
  assert.equal(at(200, 'https://files.example.com/signin'), 'login');
  assert.equal(classify({ error: 'dns' }).state, 'broken');
  assert.equal(classify({ error: 'tls' }).state, 'broken');
  assert.equal(classify({ error: 'silent' }).state, 'silent');
});

test('isLoginPage copes with text that is not a link', () => {
  assert.equal(isLoginPage('not a link'), false);
});

test('errorKind reads the error that fetch throws', () => {
  const failure = (code) => Object.assign(new TypeError('fetch failed'), { cause: { code } });
  assert.equal(errorKind(failure('ENOTFOUND')), 'dns');
  assert.equal(errorKind(failure('CERT_HAS_EXPIRED')), 'tls');
  assert.equal(errorKind(failure('ECONNRESET')), 'silent');
  assert.equal(errorKind(new DOMException('timed out', 'TimeoutError')), 'silent');
});

test('checkUrl asks with HEAD first and stops any download', async () => {
  const calls = [];
  let cancelled = false;
  const fetchFn = async (url, { method }) => {
    calls.push(method);
    return { status: 200, url, body: { cancel: async () => { cancelled = true; } } };
  };
  assert.equal((await checkUrl('https://example.com/a', { fetchFn })).state, 'ok');
  assert.deepEqual(calls, ['HEAD']);
  assert.equal(cancelled, true);
});

test('checkUrl asks again with GET when a site refuses HEAD', async () => {
  const calls = [];
  const fetchFn = async (url, { method }) => {
    calls.push(method);
    return { status: method === 'HEAD' ? 405 : 200, url };
  };
  assert.equal((await checkUrl('https://example.com/a', { fetchFn })).state, 'ok');
  assert.deepEqual(calls, ['HEAD', 'GET']);
});

test('checkUrl reports a login redirect, a missing file and a dead address', async () => {
  const login = async () => ({ status: 200, url: 'https://accounts.google.com/signin' });
  const gone = async (url, { method }) => ({ status: method === 'HEAD' ? 403 : 404, url });
  const dead = async () => { throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } }); };
  const slow = async () => { throw new DOMException('timed out', 'TimeoutError'); };
  assert.equal((await checkUrl('https://drive.example.com/x', { fetchFn: login })).state, 'login');
  assert.equal((await checkUrl('https://drive.example.com/x', { fetchFn: gone })).state, 'broken');
  assert.equal((await checkUrl('https://nowhere.invalid/x', { fetchFn: dead })).state, 'broken');
  assert.equal((await checkUrl('https://slow.example.com/x', { fetchFn: slow })).state, 'silent');
});

test('pool never runs more than the limit at once and keeps the order', async () => {
  let active = 0;
  let most = 0;
  const results = await pool([1, 2, 3, 4, 5, 6, 7, 8], 3, async (n) => {
    active += 1;
    most = Math.max(most, active);
    await tick();
    active -= 1;
    return n * 10;
  });
  assert.ok(most <= 3);
  assert.deepEqual(results, [10, 20, 30, 40, 50, 60, 70, 80]);
});

test('checkAll is polite to each website and retries what failed', async () => {
  const entries = [
    ...Array.from({ length: 6 }, (_, i) => ({ id: `a${i}`, url: `https://a.test/${i}` })),
    { id: 'b0', url: 'https://b.test/0' },
  ];
  const active = new Map();
  const mostPerHost = new Map();
  const calls = new Map();
  const check = async (url) => {
    const host = new URL(url).host;
    active.set(host, (active.get(host) ?? 0) + 1);
    mostPerHost.set(host, Math.max(mostPerHost.get(host) ?? 0, active.get(host)));
    calls.set(url, (calls.get(url) ?? 0) + 1);
    await tick();
    active.set(host, active.get(host) - 1);
    if (url === 'https://a.test/1') return calls.get(url) === 1 ? { state: 'silent', reason: 'x' } : { state: 'ok' };
    if (url === 'https://a.test/2') return { state: 'broken', reason: 'gone' };
    return { state: 'ok' };
  };
  const results = await checkAll(entries, { check, hostLimit: 2, sleep: async () => {} });
  assert.ok(mostPerHost.get('a.test') <= 2);
  assert.equal(results.get('a1').state, 'ok'); // failed once, fine the second time
  assert.equal(results.get('a2').state, 'broken'); // failed both times
  assert.equal(calls.get('https://a.test/0'), 1); // fine the first time, not asked again
  assert.equal(calls.get('https://a.test/2'), 2);
});

test('sample entries are skipped', () => {
  assert.deepEqual(entriesToCheck([{ id: 'a' }, { id: 'b', sample: true }]), [{ id: 'a' }]);
});

test('the report lists problems by id, never by title, and counts the unclear ones', () => {
  const entries = [
    { id: 'ok-one', title: 'Fine', url: 'https://example.com/1' },
    { id: 'gone-one', title: '@everyone look', url: 'https://example.com/2' },
    { id: 'private-one', title: 'Private', url: 'https://example.com/3' },
    { id: 'silent-one', title: 'Silent', url: 'https://example.com/4' },
    { id: 'unsure-one', title: 'Unsure', url: 'https://example.com/5' },
  ];
  const results = new Map([
    ['ok-one', { state: 'ok' }],
    ['gone-one', { state: 'broken', reason: 'the file was not found (404)' }],
    ['private-one', { state: 'login', reason: 'the link asks for a login' }],
    ['silent-one', { state: 'silent', reason: 'the site did not respond' }],
    ['unsure-one', { state: 'unsure', reason: 'the site answered 403' }],
  ]);
  const summary = summarize(entries, results);
  assert.equal(summary.flagged, 3);
  const report = buildReport(summary, { siteUrl: 'https://u.github.io/r', date: '2026-10-19' });
  assert.ok(report.includes('[`gone-one`](https://u.github.io/r/materials/gone-one/)'));
  assert.ok(report.includes('### Broken links (1)'));
  assert.ok(report.includes('### Links that ask for a login (1)'));
  assert.ok(report.includes('1 more links gave an unclear answer'));
  assert.ok(!report.includes('@everyone'));
  assert.ok(!report.includes('ok-one'));
});

test('a huge report stays under the issue size limit', () => {
  const entries = Array.from({ length: 5000 }, (_, i) => ({ id: `entry-${i}`, url: `https://example.com/${i}` }));
  const results = new Map(entries.map((entry) => [entry.id, { state: 'broken', reason: 'the file was not found (404)' }]));
  const report = buildReport(summarize(entries, results), { siteUrl: 'https://u.github.io/r', date: '2026-10-19' });
  assert.ok(report.length < 60000);
  assert.ok(report.includes('…and 4900 more'));
});
