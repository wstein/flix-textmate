#!/usr/bin/env node
/**
 * Generates `docs/SCOPE-MAPPING.md`, relating this grammar's TextMate scopes to the
 * tree-sitter captures in the sibling project `tree-sitter-flix`.
 *
 * The two projects share a source of truth (the Flix compiler) but not a formalism, and
 * the standing risk is that they drift into disagreeing about what a token *is*. Copying
 * `queries/highlights.scm` here would not help: it is coupled to node names in that
 * repository's `grammar.js` and cannot be validated without its parser.
 *
 * So this documents the correspondence instead, and — the part that matters — reports
 * both inventories mechanically. `CORRESPONDENCE` below is hand-authored, but neither the
 * scope list nor the capture list is, so an addition on either side shows up as
 * unmapped rather than silently going unnoticed.
 *
 *   npm run docs:mapping -- --tree-sitter ~/github.com/wstein/tree-sitter-flix
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

import { GRAMMAR_PATH } from './tokenize.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = join(repoRoot, 'docs', 'SCOPE-MAPPING.md');

const flagIndex = process.argv.indexOf('--tree-sitter');
const treeSitterRoot =
  flagIndex !== -1 && process.argv[flagIndex + 1]
    ? process.argv[flagIndex + 1]
    : (process.env.TREE_SITTER_FLIX ??
      join(homedir(), 'github.com', 'wstein', 'tree-sitter-flix'));

/**
 * Hand-authored correspondence, TextMate scope to tree-sitter capture(s).
 *
 * A scope may answer to several captures: this grammar folds `spawn`, `foreach`, and
 * `throw` into one `keyword.control.flix`, where tree-sitter distinguishes
 * `@keyword.coroutine`, `@keyword.repeat`, and `@keyword.exception`. That is a deliberate
 * taxonomy choice, not a gap — stock TextMate themes key on `keyword.control`, and the
 * finer captures have no themable counterpart.
 *
 * An empty list means the scope has no counterpart at all, which is normal for the
 * `punctuation.definition.*` scopes: tree-sitter scopes a comment or string as one node
 * and does not separate its delimiters.
 */
const CORRESPONDENCE = new Map([
  ['comment.line.double-slash.flix', ['@comment']],
  ['comment.block.flix', ['@comment']],
  ['comment.line.documentation.flix', ['@comment.documentation']],
  ['constant.language.boolean.flix', ['@boolean']],
  ['constant.language.null.flix', ['@constant.builtin']],
  ['constant.language.hole.flix', ['@comment.error']],
  ['constant.numeric.flix', ['@number', '@number.float']],
  ['constant.numeric.hex.flix', ['@number']],
  ['string.quoted.double.flix', ['@string']],
  ['string.quoted.single.flix', ['@character']],
  ['string.regexp.flix', ['@string.regexp']],
  ['constant.character.escape.flix', ['@string']],
  ['storage.type.annotation.flix', ['@attribute']],
  ['storage.type.flix', ['@keyword']],
  ['storage.modifier.flix', ['@keyword.modifier']],
  [
    'keyword.control.flix',
    ['@keyword', '@keyword.repeat', '@keyword.exception', '@keyword.coroutine'],
  ],
  ['keyword.control.conditional.flix', ['@keyword.conditional']],
  ['keyword.control.import.flix', ['@keyword.import']],
  ['keyword.control.datalog.flix', ['@keyword']],
  ['keyword.operator.flix', ['@operator']],
  ['keyword.operator.logical.flix', ['@keyword.operator']],
  ['keyword.operator.word.flix', ['@keyword.operator']],
  ['keyword.operator.cast.flix', ['@keyword.operator']],
  ['keyword.operator.datalog.flix', ['@operator']],
  ['keyword.operator.new.flix', ['@keyword.operator']],
  ['keyword.operator.arrow.flix', ['@operator']],
  ['keyword.operator.accessor.flix', ['@operator']],
  ['keyword.operator.effect.flix', ['@operator']],
  ['keyword.other.debug.flix', ['@keyword.debug']],
  ['entity.name.function.flix', ['@function']],
  ['entity.name.type.flix', ['@type']],
  ['entity.name.namespace.flix', ['@module']],
  ['support.type.primitive.flix', ['@type.builtin']],
  ['support.type.builtin.flix', ['@type.builtin']],
  ['support.function.builtin.flix', ['@function.builtin']],
  ['variable.language.wildcard.flix', ['@variable.builtin']],
  ['variable.other.member.flix', ['@variable.member']],
  // Only these two forms reach `@variable`. Expression-position identifiers are left
  // bare on purpose, so most of what tree-sitter captures as `@variable` is unscoped here.
  ['variable.other.math.flix', ['@variable']],
  ['variable.other.escaped.flix', ['@variable']],
  ['keyword.other.flix', ['@keyword']],
  ['keyword.other.regexp.flix', ['@string.regexp']],
  ['punctuation.section.braces.flix', ['@punctuation.bracket']],
  ['punctuation.section.parens.flix', ['@punctuation.bracket']],
  ['punctuation.section.brackets.flix', ['@punctuation.bracket']],
  ['punctuation.section.datalog.begin.flix', ['@punctuation.bracket']],
  ['punctuation.section.extensible.begin.flix', ['@punctuation.bracket']],
  ['punctuation.section.extensible.end.flix', ['@punctuation.bracket']],
  ['punctuation.separator.comma.flix', ['@punctuation.delimiter']],
  ['punctuation.separator.colon.flix', ['@punctuation.delimiter']],
  ['punctuation.terminator.flix', ['@punctuation.delimiter']],
  ['punctuation.accessor.flix', ['@punctuation.delimiter']],
  ['punctuation.definition.infix.flix', ['@punctuation.delimiter']],
  ['punctuation.definition.annotation.flix', ['@attribute']],
  ['punctuation.definition.variable.flix', []],
  ['punctuation.definition.comment.flix', []],
  ['punctuation.definition.comment.begin.flix', []],
  ['punctuation.definition.comment.end.flix', []],
  ['punctuation.definition.string.begin.flix', []],
  ['punctuation.definition.string.end.flix', []],
  ['punctuation.definition.builtin.begin.flix', []],
  ['punctuation.definition.builtin.end.flix', []],
  ['punctuation.definition.template-expression.begin.flix', []],
  ['punctuation.definition.template-expression.end.flix', []],
  ['meta.embedded.line.flix', []],
]);

/** Captures with no TextMate counterpart, and why. */
const UNREACHABLE = new Map([
  ['@function.call', 'A call site is not lexically distinguishable from a variable.'],
  [
    '@constructor',
    'Requires knowing an uppercase name is being applied, not referenced.',
  ],
  ['@variable.parameter', 'Requires the parameter list to be parsed.'],
  ['@type.parameter', 'Requires the type parameter list to be parsed.'],
  [
    '@keyword.function',
    'Distinguishing `def` in a signature from elsewhere needs a parser.',
  ],
  [
    '@punctuation.special',
    'Applies to the Datalog constraint terminator `.`, which cannot be told from a ' +
      'qualified-name separator without tracking whether a constraint is open.',
  ],
]);

/** Every scope the emitted grammar can assign. */
function collectScopes(node, found = new Set()) {
  if (Array.isArray(node)) {
    for (const child of node) collectScopes(child, found);
    return found;
  }
  if (node === null || typeof node !== 'object') return found;
  for (const [key, value] of Object.entries(node)) {
    if ((key === 'name' || key === 'contentName') && typeof value === 'string') {
      found.add(value);
    } else if (typeof value === 'object') {
      collectScopes(value, found);
    }
  }
  return found;
}

const grammar = JSON.parse(readFileSync(GRAMMAR_PATH, 'utf8'));
// The top-level `name` is the grammar's display name, not a scope it assigns.
const { scopeName } = grammar;
const rules = { patterns: grammar.patterns, repository: grammar.repository };
const scopes = [...collectScopes(rules)].filter((s) => s !== scopeName).sort();

const highlightsPath = join(treeSitterRoot, 'queries', 'highlights.scm');
let captures;
try {
  const highlights = readFileSync(highlightsPath, 'utf8');
  captures = [...new Set(highlights.match(/@[a-z][a-z0-9._]*/g) ?? [])].sort();
} catch {
  console.error(`Cannot read ${highlightsPath}`);
  console.error('Pass --tree-sitter <path> or set TREE_SITTER_FLIX.');
  process.exit(2);
}

const mapped = new Set([...CORRESPONDENCE.values()].flat());
const unmappedScopes = scopes.filter((scope) => !CORRESPONDENCE.has(scope));
const unmappedCaptures = captures.filter(
  (capture) => !mapped.has(capture) && !UNREACHABLE.has(capture),
);

const rows = scopes
  .map((scope) => {
    const found = CORRESPONDENCE.get(scope);
    if (found === undefined) return `| \`${scope}\` | **unmapped** |`;
    if (found.length === 0) return `| \`${scope}\` | _no counterpart_ |`;
    return `| \`${scope}\` | ${found.map((c) => `\`${c}\``).join(', ')} |`;
  })
  .join('\n');

const unreachableRows = [...UNREACHABLE]
  .map(([capture, why]) => `| \`${capture}\` | ${why} |`)
  .join('\n');

const drift = [
  unmappedScopes.length > 0
    ? `> **${unmappedScopes.length} scope(s) have no recorded counterpart:** ` +
      `${unmappedScopes.map((s) => `\`${s}\``).join(', ')}. Add them to ` +
      '`CORRESPONDENCE` in `scripts/generate-scope-mapping.mjs`.'
    : null,
  unmappedCaptures.length > 0
    ? `> **${unmappedCaptures.length} tree-sitter capture(s) are unaccounted for:** ` +
      `${unmappedCaptures.map((c) => `\`${c}\``).join(', ')}. Either map them or record ` +
      'why they are unreachable.'
    : null,
]
  .filter(Boolean)
  .join('\n>\n');

writeFileSync(
  outputPath,
  `<!-- Generated by scripts/generate-scope-mapping.mjs. Do not edit. -->

# Scope mapping

How this grammar's TextMate scopes relate to the tree-sitter captures in
[\`tree-sitter-flix\`](https://github.com/wstein/tree-sitter-flix).

The two projects share a source of truth — the Flix compiler — but not a formalism. This
document exists so that a disagreement between them is visible rather than silent.
\`queries/highlights.scm\` is deliberately **not** copied into this repository: it is coupled
to node names in that project's \`grammar.js\` and could not be validated here.

The scope column and the capture inventory are both read mechanically, from
\`syntaxes/flix.tmLanguage.json\` and \`queries/highlights.scm\` respectively. Only the
correspondence itself is hand-authored, so an addition on either side surfaces below as
unmapped.

${drift || '> Both inventories are fully accounted for.'}

## Scopes

${scopes.length} scopes, ${captures.length} captures.

| TextMate scope | tree-sitter capture |
| -------------- | ------------------- |
${rows}

## Captures with no TextMate counterpart

These are not gaps to be closed. Each needs syntactic context that a regex stack machine
does not have, and guessing at them is the class of heuristic this grammar refuses to ship.

| Capture | Why it is unreachable here |
| ------- | -------------------------- |
${unreachableRows}
`,
  'utf8',
);

console.log(
  `Wrote ${outputPath} (${scopes.length} scopes, ${captures.length} captures).`,
);
if (unmappedScopes.length > 0 || unmappedCaptures.length > 0) {
  console.log(
    `Unmapped: ${unmappedScopes.length} scope(s), ${unmappedCaptures.length} capture(s).`,
  );
}
