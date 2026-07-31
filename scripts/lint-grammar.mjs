#!/usr/bin/env node
/**
 * Structural lint over the emitted grammar.
 *
 * The check that matters: every `begin`/`end` rule must have an `end` pattern that can
 * match at end-of-line. A `begin` whose `end` never fires leaves the tokenizer inside that
 * rule for the rest of the file, painting everything below it as a string or a comment.
 * That is the most user-visible way a TextMate grammar fails, and the grammar this project
 * replaces has it twice: `literal_char` opens on `'` and closes only on the next `'`,
 * anywhere in the file, and `literal_string` does the same for `"`.
 *
 * `Lexer.acceptString` returns `UnterminatedString` the moment it sees `\n`, so a
 * line-anchored `end` is not a workaround — it is what the reference lexer does.
 *
 * Rules that are genuinely multi-line must be listed in ALLOWED_MULTILINE with a reason.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const grammarPath = join(repoRoot, 'syntaxes', 'flix.tmLanguage.json');

/**
 * Rule paths whose `end` may legitimately fail to match on the opening line.
 * Keyed by the path reported below; the value is the justification.
 */
const ALLOWED_MULTILINE = new Map([
  [
    'repository.block-comment',
    'Block comments span lines and nest (Lexer.acceptBlockComment).',
  ],
]);

/** Patterns that let an `end` match at end-of-line. */
const LINE_ANCHORS = ['$', '\\n', '(?=\\n)', '(?!\\G)'];

/** Returns true if `end` can match at end-of-line. */
function isLineAnchored(end) {
  return LINE_ANCHORS.some((anchor) => end.includes(anchor));
}

const grammar = JSON.parse(readFileSync(grammarPath, 'utf8'));
const problems = [];

/** Walks every rule in the grammar, reporting a dotted path for each. */
function walk(node, path) {
  if (Array.isArray(node)) {
    node.forEach((child, index) => walk(child, `${path}[${index}]`));
    return;
  }
  if (node === null || typeof node !== 'object') return;

  if (typeof node.begin === 'string' && typeof node.end === 'string') {
    if (!isLineAnchored(node.end) && !ALLOWED_MULTILINE.has(path)) {
      problems.push(
        `${path}: end pattern ${JSON.stringify(node.end)} cannot match at end-of-line. ` +
          'Add a line anchor, or add the rule to ALLOWED_MULTILINE with a reason.',
      );
    }
  }

  for (const [key, value] of Object.entries(node)) {
    if (key === 'repository' || key === 'injections') {
      for (const [name, rule] of Object.entries(value)) {
        walk(rule, path ? `${path}.${key}.${name}` : `${key}.${name}`);
      }
    } else if (key === 'patterns' || key === 'captures') {
      walk(value, path ? `${path}.${key}` : key);
    } else if (
      key === 'beginCaptures' ||
      key === 'endCaptures' ||
      key === 'whileCaptures'
    ) {
      walk(value, path ? `${path}.${key}` : key);
    }
  }
}

/** Resolves a dotted `repository.name` path against the grammar. */
function pathExists(root, path) {
  return (
    path
      .split('.')
      .reduce((node, key) => (node == null ? undefined : node[key]), root) !== undefined
  );
}

walk(grammar, '');

// A stale allowlist entry is itself a defect: it grants an exemption nothing uses.
for (const path of ALLOWED_MULTILINE.keys()) {
  if (!pathExists(grammar, path)) {
    problems.push(`ALLOWED_MULTILINE lists ${path}, which no longer exists.`);
  }
}

if (problems.length > 0) {
  console.error('Grammar lint failed:\n');
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

console.log('Grammar lint passed.');
