#!/usr/bin/env node
/**
 * Fails if the grammar emits a scope that `docs/SCOPES.md` does not mention.
 *
 * Scope names are the theme-facing contract: a theme keys off them, and once one is in the
 * wild it cannot be renamed. A scope the contract does not list is one no theme author can
 * discover — the grammar's `///` doc-comment scope existed for four commits without being
 * documented anywhere, which made the headline fix invisible to the only audience that
 * could use it.
 *
 * CLAUDE.md already required this. Requiring it in prose is what let it drift, so it is
 * checked here instead.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { GRAMMAR_PATH } from './tokenize.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const docPath = join(repoRoot, 'docs', 'SCOPES.md');

/** Collects every scope the grammar can assign. */
function collectScopes(node, found = new Set()) {
  if (Array.isArray(node)) {
    for (const child of node) collectScopes(child, found);
    return found;
  }
  if (node === null || typeof node !== 'object') return found;
  for (const [key, value] of Object.entries(node)) {
    if ((key === 'name' || key === 'contentName') && typeof value === 'string') {
      if (value.endsWith('.flix')) found.add(value);
    } else if (typeof value === 'object') {
      collectScopes(value, found);
    }
  }
  return found;
}

const grammar = JSON.parse(readFileSync(GRAMMAR_PATH, 'utf8'));
const scopes = collectScopes({
  patterns: grammar.patterns,
  repository: grammar.repository,
});

const doc = readFileSync(docPath, 'utf8');
const undocumented = [...scopes].filter((scope) => !doc.includes(scope)).sort();

if (undocumented.length > 0) {
  console.error(`docs/SCOPES.md is missing ${undocumented.length} emitted scope(s):\n`);
  for (const scope of undocumented) console.error(`  ${scope}`);
  console.error(
    '\nAdd them to the complete scope index, and to a section if they need one.',
  );
  process.exit(1);
}

console.log(`Scope documentation check passed (${scopes.size} scopes).`);
