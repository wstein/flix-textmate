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

/**
 * Returns true if `pattern` can match at end-of-line.
 *
 * A substring search for `$` is not good enough: an `end` of `\$\}`, `[$]`, or `\$` would
 * satisfy it while being anchored to a *literal* dollar sign that may never appear. That
 * matters here — the grammar already handles `${` interpolation, so escaped dollars in an
 * `end` pattern are a realistic near-miss. This scans character by character, tracking
 * escapes and character classes, and counts only a `$` that is genuinely the anchor
 * metacharacter.
 */
function isLineAnchored(pattern) {
  if (pattern.includes('\\n') || pattern.includes('(?!\\G)')) return true;

  let inClass = false;
  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i];
    if (char === '\\') {
      i += 1; // Skip the escaped character.
    } else if (inClass) {
      if (char === ']') inClass = false;
    } else if (char === '[') {
      inClass = true;
    } else if (char === '$') {
      return true;
    }
  }
  return false;
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

  // `while` has the same runaway failure mode as `end`: a rule whose `while` always
  // matches never terminates. Checking only `begin`+`end` exempted it by construction.
  if (typeof node.begin === 'string') {
    const terminator =
      typeof node.end === 'string'
        ? { key: 'end', pattern: node.end }
        : typeof node.while === 'string'
          ? { key: 'while', pattern: node.while }
          : null;

    if (terminator === null) {
      problems.push(`${path}: begin rule has neither an 'end' nor a 'while' pattern.`);
    } else if (!isLineAnchored(terminator.pattern) && !ALLOWED_MULTILINE.has(path)) {
      problems.push(
        `${path}: ${terminator.key} pattern ${JSON.stringify(terminator.pattern)} ` +
          'cannot match at end-of-line. Add a line anchor, or add the rule to ' +
          'ALLOWED_MULTILINE with a reason.',
      );
    }
  }

  // Generic recursion. An earlier version dispatched on a fixed set of key names, which
  // silently skipped rules nested under a capture group: the keys of a `captures` object
  // are "0", "1", "2" …, none of which matched any branch, so a begin/end rule placed in
  // a capture's `patterns` escaped the check entirely.
  for (const [key, value] of Object.entries(node)) {
    if (value === null || typeof value !== 'object') continue;
    if (key === 'repository' || key === 'injections') {
      for (const [name, rule] of Object.entries(value)) {
        walk(rule, path ? `${path}.${key}.${name}` : `${key}.${name}`);
      }
    } else {
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
