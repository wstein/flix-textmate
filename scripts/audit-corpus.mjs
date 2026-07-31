#!/usr/bin/env node
/**
 * Tokenizes a tree of `.flix` files and reports how the grammar behaves at scale.
 *
 * Two measurements, with very different standing:
 *
 *   1. **End-of-file cleanliness — a hard gate.** No file may finish with a rule still
 *      open. A `begin` whose `end` never fires paints everything after it as a string or
 *      comment, which is the most user-visible way a TextMate grammar fails. There is no
 *      acceptable non-zero value here.
 *
 *   2. **Scope coverage — a ratchet, not a target.** The share of non-whitespace
 *      characters that receive any scope. It may not fall below the committed baseline,
 *      but raising it is *not* automatically good: this grammar deliberately leaves
 *      expression-position identifiers bare, because TextMate cannot tell a call from a
 *      constructor from a variable. Chasing the number would mean inventing exactly the
 *      heuristics this project refuses to ship. Raise the baseline only when a phase
 *      legitimately covers new constructs, and say which in the commit message.
 *
 * CI does not run this: it needs a Flix source tree, which is not vendored here. Run it
 * locally when changing rules, and commit the refreshed baseline with the change.
 *
 *   npm run audit -- --corpus ~/github.com/wstein/flix-fork
 */

import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

import { loadGrammar, tokenize, finalRuleStack } from './tokenize.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const baselinePath = join(repoRoot, 'tests', 'corpus-baseline.json');

const flagIndex = process.argv.indexOf('--corpus');
const corpusRoot =
  flagIndex !== -1 && process.argv[flagIndex + 1]
    ? process.argv[flagIndex + 1]
    : (process.env.FLIX_SOURCE ?? join(homedir(), 'github.com', 'wstein', 'flix-fork'));

const shouldUpdate = process.argv.includes('--update-baseline');

/** Collects every `.flix` file under `dir`, skipping VCS and build directories. */
function collectFlixFiles(dir, found = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) collectFlixFiles(path, found);
    else if (entry.name.endsWith('.flix')) found.push(path);
  }
  return found;
}

if (!statSync(corpusRoot, { throwIfNoEntry: false })?.isDirectory()) {
  console.error(`Corpus not found: ${corpusRoot}`);
  console.error('Pass --corpus <path> or set FLIX_SOURCE.');
  process.exit(2);
}

const files = collectFlixFiles(corpusRoot);
if (files.length === 0) {
  console.error(`No .flix files under ${corpusRoot}`);
  process.exit(2);
}

const grammar = await loadGrammar();

const unclosed = [];
const scopeChars = new Map();
let totalChars = 0;
let scopedChars = 0;

for (const file of files) {
  const text = readFileSync(file, 'utf8');

  // `depth > 1` means a rule pushed onto the stack was never popped.
  if (finalRuleStack(grammar, text).depth > 1) {
    unclosed.push(file.slice(corpusRoot.length + 1));
  }

  for (const token of tokenize(grammar, text)) {
    const width = token.text.replace(/\s/g, '').length;
    if (width === 0) continue;
    totalChars += width;
    if (token.scopes.length > 1) {
      scopedChars += width;
      for (const scope of token.scopes.slice(1)) {
        scopeChars.set(scope, (scopeChars.get(scope) ?? 0) + width);
      }
    }
  }
}

const coverage = Number(((100 * scopedChars) / totalChars).toFixed(2));

console.log(`Corpus:   ${corpusRoot}`);
console.log(`Files:    ${files.length}`);
console.log(`Coverage: ${coverage}% of ${totalChars} non-whitespace characters`);
console.log(`Scopes:   ${scopeChars.size} distinct`);

const baseline = shouldUpdate ? null : JSON.parse(readFileSync(baselinePath, 'utf8'));

if (shouldUpdate) {
  writeFileSync(
    baselinePath,
    `${JSON.stringify(
      {
        comment:
          'Baseline for scripts/audit-corpus.mjs. Coverage is a ratchet, not a target ' +
          '— see the header of that script before raising it.',
        corpusFiles: files.length,
        nonWhitespaceChars: totalChars,
        coveragePercent: coverage,
        distinctScopes: scopeChars.size,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  console.log(`\nBaseline written to ${baselinePath}`);
  process.exit(0);
}

const problems = [];

if (unclosed.length > 0) {
  problems.push(
    `${unclosed.length} file(s) end with a rule still open:\n` +
      unclosed
        .slice(0, 10)
        .map((file) => `    ${file}`)
        .join('\n'),
  );
}

if (coverage < baseline.coveragePercent) {
  problems.push(
    `Coverage fell to ${coverage}% from a baseline of ${baseline.coveragePercent}%. ` +
      'If the drop is intended, re-run with --update-baseline and explain it in the ' +
      'commit message.',
  );
}

if (problems.length > 0) {
  console.error('\nCorpus audit failed:\n');
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

console.log(
  `\nCorpus audit passed. No rules left open; coverage >= ${baseline.coveragePercent}%.`,
);
