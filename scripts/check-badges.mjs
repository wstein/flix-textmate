#!/usr/bin/env node
/**
 * Fails if a README badge states a number that its source file no longer says.
 *
 * Shields' static badges hardcode their value, so `scopes-64` and `corpus%20coverage-66.32%`
 * are prose asserting facts that are recorded elsewhere — the same shape of drift that
 * `check-scopes-documented.mjs` exists to prevent, one file further out. A badge nobody
 * verifies is worse than no badge: it is a confident wrong number on the landing page, and
 * it is the first thing a visitor reads.
 *
 * Only badges carrying a value from a committed file belong here. The CI badge is rendered
 * live by GitHub and the licence badge restates `LICENSE.md`, which does not change.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

/** The percent-escapes Shields requires in a badge label or value. */
const ESCAPES = { '%20': ' ', '%25': '%', '%E2%89%A5': '≥' };

/** Reverses Shields' escaping so a badge value can be compared as plain text. */
export function decodeBadgeValue(value) {
  return Object.entries(ESCAPES).reduce(
    (decoded, [escape, character]) => decoded.replaceAll(escape, character),
    value,
  );
}

/**
 * Renders `engines.node` the way the badge states it: `>=22.18.0` becomes `≥ 22.18` and
 * `>=24.0.0` becomes `≥ 24`, since a zero floor on a trailing segment carries no
 * information. Throws on any other range, because silently accepting one would make the
 * badge unverifiable exactly when it starts being wrong.
 */
export function minimumNodeVersion(range) {
  const match = /^>=\s*(\d+)\.(\d+)\.(\d+)$/.exec(range);
  if (match === null) {
    throw new Error(
      `Cannot derive a badge value from engines.node "${range}". ` +
        'check-badges.mjs understands only a ">=major.minor.patch" floor.',
    );
  }
  const segments = match.slice(1);
  while (segments.length > 1 && segments.at(-1) === '0') segments.pop();
  return `≥ ${segments.join('.')}`;
}

/** Every README badge whose value duplicates a fact stored in a committed file. */
export function badgeSpecs({ engines, baseline }) {
  return [
    {
      label: 'node',
      source: 'package.json engines.node',
      expected: minimumNodeVersion(engines),
      pattern: /badge\/node-([^-]+)-/,
    },
    {
      label: 'scopes',
      source: 'tests/corpus-baseline.json distinctScopes',
      expected: String(baseline.distinctScopes),
      pattern: /badge\/scopes-([^-]+)-/,
    },
    {
      label: 'corpus coverage',
      source: 'tests/corpus-baseline.json coveragePercent',
      expected: `${baseline.coveragePercent}%`,
      pattern: /badge\/corpus%20coverage-([^-]+)-/,
    },
  ];
}

/**
 * Compares each badge spec against the README. Returns one human-readable line per
 * mismatch, empty when the README is accurate.
 */
export function collectBadgeFailures(readme, specs) {
  return specs.flatMap((badge) => {
    const match = readme.match(badge.pattern);
    if (match === null) {
      return [`the "${badge.label}" badge is missing from README.md`];
    }
    const actual = decodeBadgeValue(match[1]);
    if (actual === badge.expected) return [];
    return [
      `the "${badge.label}" badge says ${actual}, but ${badge.source} says ${badge.expected}`,
    ];
  });
}

function main() {
  const read = (...parts) => readFileSync(join(repoRoot, ...parts), 'utf8');
  const specs = badgeSpecs({
    engines: JSON.parse(read('package.json')).engines.node,
    baseline: JSON.parse(read('tests', 'corpus-baseline.json')),
  });
  const failures = collectBadgeFailures(read('README.md'), specs);

  if (failures.length > 0) {
    console.error('README badges are stale:\n');
    for (const failure of failures) console.error(`  ${failure}`);
    console.error(
      '\nUpdate the badge URL in README.md, or the source if the badge is right.',
    );
    process.exit(1);
  }

  console.log(`Badge check passed (${specs.length} value badges).`);
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) main();
