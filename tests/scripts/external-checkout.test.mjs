import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
function resolve(path, revision) {
  return spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
    import { resolveCheckout } from './scripts/external-checkout.mjs';
    resolveCheckout(${JSON.stringify({ flag: '--source', env: 'UNUSED_CHECKOUT_TEST', what: 'fixture', repository: 'fixture', argv: ['--source', path], revision })});
  `,
    ],
    { cwd: root, encoding: 'utf8' },
  );
}

test('external oracle accepts the exact pinned Git revision', () => {
  assert.equal(resolve(root, head).status, 0);
});
test('external oracle rejects a different Git revision', () => {
  const result = resolve(root, '0'.repeat(40));
  assert.equal(result.status, 2);
  assert.match(result.stderr, /revision mismatch/);
});
test('external oracle rejects an unversioned directory', () => {
  const dir = mkdtempSync(join(tmpdir(), 'textmate-oracle-'));
  try {
    const result = resolve(dir, head);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Cannot read/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
