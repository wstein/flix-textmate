/**
 * Tests for scripts/check-badges.mjs.
 *
 * A gate that never fails is indistinguishable from no gate, and this one can only fail on
 * a README that nobody has broken yet. So the cases below break it deliberately: each
 * asserts the exact drift the check exists to catch.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  badgeSpecs,
  collectBadgeFailures,
  decodeBadgeValue,
  minimumNodeVersion,
} from '../../scripts/check-badges.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...parts) => readFileSync(join(repoRoot, ...parts), 'utf8');

const SOURCES = {
  engines: '>=22.18.0',
  baseline: { distinctScopes: 64, coveragePercent: 66.32 },
};

/** A README containing exactly the badges the check knows about, all accurate. */
const ACCURATE_README = [
  '[![Node](https://img.shields.io/badge/node-%E2%89%A5%2022.18-5FA04E.svg)](package.json)',
  '[![Scopes](https://img.shields.io/badge/scopes-64-blue.svg)](docs/SCOPES.md)',
  '[![Corpus coverage](https://img.shields.io/badge/corpus%20coverage-66.32%25-blue.svg)](x)',
].join('\n');

test('an accurate README produces no failures', () => {
  assert.deepEqual(collectBadgeFailures(ACCURATE_README, badgeSpecs(SOURCES)), []);
});

test('a scope count that no longer matches the baseline is reported', () => {
  const readme = ACCURATE_README.replace('scopes-64-', 'scopes-63-');
  const failures = collectBadgeFailures(readme, badgeSpecs(SOURCES));

  assert.deepEqual(failures, [
    'the "scopes" badge says 63, but tests/corpus-baseline.json distinctScopes says 64',
  ]);
});

test('a coverage percentage that no longer matches the baseline is reported', () => {
  const readme = ACCURATE_README.replace('66.32%25', '70%25');
  const failures = collectBadgeFailures(readme, badgeSpecs(SOURCES));

  assert.deepEqual(failures, [
    'the "corpus coverage" badge says 70%, but tests/corpus-baseline.json coveragePercent says 66.32%',
  ]);
});

test('a Node floor that no longer matches engines.node is reported', () => {
  const failures = collectBadgeFailures(
    ACCURATE_README,
    badgeSpecs({ ...SOURCES, engines: '>=24.0.0' }),
  );

  assert.deepEqual(failures, [
    'the "node" badge says ≥ 22.18, but package.json engines.node says ≥ 24',
  ]);
});

test('a deleted badge is reported rather than silently passing', () => {
  const readme = ACCURATE_README.split('\n')
    .filter((line) => !line.includes('/scopes-'))
    .join('\n');

  assert.deepEqual(collectBadgeFailures(readme, badgeSpecs(SOURCES)), [
    'the "scopes" badge is missing from README.md',
  ]);
});

test('every mismatch is reported, not just the first', () => {
  const readme = ACCURATE_README.replace('scopes-64-', 'scopes-63-').replace(
    '66.32%25',
    '70%25',
  );

  assert.equal(collectBadgeFailures(readme, badgeSpecs(SOURCES)).length, 2);
});

test('minimumNodeVersion drops zero floors and keeps real ones', () => {
  assert.equal(minimumNodeVersion('>=22.18.0'), '≥ 22.18');
  assert.equal(minimumNodeVersion('>=22.18.3'), '≥ 22.18.3');
  assert.equal(minimumNodeVersion('>= 24.0.0'), '≥ 24');
  assert.equal(minimumNodeVersion('>=24.0.1'), '≥ 24.0.1');
});

test('minimumNodeVersion rejects a range it cannot render', () => {
  // Widening engines.node to a form the badge cannot state must fail loudly here rather
  // than quietly stop checking the badge.
  assert.throws(() => minimumNodeVersion('^22.18.0'), /understands only/);
  assert.throws(() => minimumNodeVersion('22.x'), /understands only/);
});

test('decodeBadgeValue reverses the escapes Shields requires', () => {
  assert.equal(decodeBadgeValue('corpus%20coverage'), 'corpus coverage');
  assert.equal(decodeBadgeValue('66.32%25'), '66.32%');
  assert.equal(decodeBadgeValue('%E2%89%A5%2022.18'), '≥ 22.18');
});

test('the committed README passes its own check', () => {
  const specs = badgeSpecs({
    engines: JSON.parse(read('package.json')).engines.node,
    baseline: JSON.parse(read('tests', 'corpus-baseline.json')),
  });

  assert.deepEqual(collectBadgeFailures(read('README.md'), specs), []);
});
