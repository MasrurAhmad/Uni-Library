import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { parse } from 'yaml';

const dir = new URL('../.github/workflows/', import.meta.url);
const files = readdirSync(dir).filter((name) => name.endsWith('.yml'));
const read = (name) => readFileSync(new URL(name, dir), 'utf8');

// Text that anyone can write. It must never be pasted into a workflow, where it could run as a command.
const UNTRUSTED = ['github.event.issue.title', 'github.event.issue.body', 'github.event.comment', 'github.head_ref', 'github.event.pull_request.title'];

test('every workflow is valid YAML', () => {
  for (const name of files) assert.doesNotThrow(() => parse(read(name)), name);
});

test('no workflow uses text from issues, comments or pull requests directly', () => {
  for (const name of files) {
    for (const risky of UNTRUSTED) assert.ok(!read(name).includes(risky), `${name} uses ${risky}`);
  }
});

test('the approval workflow only reacts to the approved label', () => {
  const workflow = parse(read('add-approved.yml'));
  assert.deepEqual(workflow.on.issues.types, ['labeled']);
  assert.match(workflow.jobs.add.if, /label\.name == 'approved'/);
});

test('every action is pinned to a version', () => {
  for (const name of files) {
    for (const [, action] of read(name).matchAll(/uses:\s*(\S+)/g)) assert.match(action, /@v\d+/, `${name}: ${action}`);
  }
});

test('every job runs on a pinned runner, so a change in GitHub’s default image cannot surprise us', () => {
  for (const name of files) assert.ok(!read(name).includes('ubuntu-latest'), `${name} uses ubuntu-latest`);
});

test('the link check runs every week and can only read the code and write issues', () => {
  const workflow = parse(read('check-links.yml'));
  assert.ok(workflow.on.schedule[0].cron);
  assert.ok('workflow_dispatch' in workflow.on);
  assert.deepEqual(workflow.permissions, { contents: 'read', issues: 'write' });
});
