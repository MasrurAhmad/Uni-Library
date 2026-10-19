import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import http from 'node:http';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const script = fileURLToPath(new URL('../scripts/check-links.mjs', import.meta.url));

// A tiny web server on this computer, so the test needs no internet.
function startServer() {
  const server = http.createServer((request, response) => {
    if (request.url === '/ok') { response.writeHead(200); response.end('hello'); }
    else if (request.url === '/gone') { response.writeHead(404); response.end('no'); }
    else if (request.url === '/private') { response.writeHead(302, { location: '/signin' }); response.end(); }
    else if (request.url === '/signin') { response.writeHead(200); response.end('please log in'); }
    else { response.writeHead(500); response.end(); }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function check(entries) {
  const server = await startServer();
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const dir = mkdtempSync(path.join(tmpdir(), 'uni-links-'));
    const materials = entries.map(([id, route, extra = {}]) => ({ id, title: id, url: `${base}${route}`, ...extra }));
    writeFileSync(path.join(dir, 'materials.json'), JSON.stringify(materials));
    const outputFile = path.join(dir, 'out.txt');
    const reportFile = path.join(dir, 'report.md');
    writeFileSync(outputFile, '');
    await run(process.execPath, [script, '--data-dir', dir, '--report-file', reportFile, '--retry-delay-ms', '0'], {
      env: { ...process.env, GITHUB_OUTPUT: outputFile, GITHUB_REPOSITORY: 'Demo/uni-library' },
    });
    const outputs = Object.fromEntries(readFileSync(outputFile, 'utf8').split('\n').filter(Boolean).map((line) => line.split(/=(.*)/s).slice(0, 2)));
    return { outputs, report: readFileSync(reportFile, 'utf8') };
  } finally {
    server.close();
  }
}

test('flags missing files and login pages, ignores fine links, unclear answers and samples', async () => {
  const { outputs, report } = await check([
    ['fine-one', '/ok'],
    ['gone-one', '/gone'],
    ['private-one', '/private'],
    ['teapot-one', '/teapot'],
    ['sample-one', '/gone', { sample: true }],
  ]);
  assert.equal(outputs.status, 'problems');
  assert.equal(outputs.flagged, '2');
  assert.equal(outputs.checked, '4');
  assert.ok(report.includes('gone-one'));
  assert.ok(report.includes('private-one'));
  assert.ok(!report.includes('fine-one'));
  assert.ok(!report.includes('sample-one'));
  assert.ok(report.includes('1 more links gave an unclear answer'));
  assert.ok(report.includes('https://demo.github.io/uni-library/materials/gone-one/'));
});

test('reports ok when every link is fine', async () => {
  const { outputs } = await check([['fine-one', '/ok'], ['fine-two', '/ok']]);
  assert.equal(outputs.status, 'ok');
  assert.equal(outputs.flagged, '0');
});
