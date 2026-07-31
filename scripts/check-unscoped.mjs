#!/usr/bin/env node
/**
 * Asserts that identifiers which are *not* Flix keywords receive no scope at all.
 *
 * `vscode-tmgrammar-test` cannot express this. Its negative assertions compare with
 * `token.scopes.includes(scope)` — exact string equality — so `- keyword` passes against a
 * token scoped `keyword.control.flix` and proves nothing. A hand-written exclusion list of
 * every scope the grammar assigns would work, but would silently weaken each time a scope
 * is added.
 *
 * This check instead asserts the real property: the token carries `source.flix` and nothing
 * else. It cannot go stale.
 *
 * The subjects are the seven keywords the incumbent grammar declares that
 * `Lexer.Keywords` has never contained, plus name forms that a `\b`-anchored keyword rule
 * would wrongly match. See docs/DEFECTS.md.
 */

import { loadGrammar, tokenize } from './tokenize.mjs';

/** Identifiers that must tokenize as ordinary names. */
const MUST_BE_UNSCOPED = [
  // Phantom keywords carried by the incumbent grammar.
  { text: 'dbg', why: 'not in Lexer.Keywords' },
  { text: 'typematch', why: 'not in Lexer.Keywords' },
  { text: 'resume', why: 'not in Lexer.Keywords' },
  { text: 'branch', why: 'not in Lexer.Keywords' },
  { text: 'jumpto', why: 'not in Lexer.Keywords' },
  { text: 'without', why: 'not in Lexer.Keywords' },
  { text: 'opaque', why: 'not in Lexer.Keywords' },
  // Names that merely start with, or extend, a keyword. Lexer.acceptIfKeyword rejects a
  // keyword when the next character is a name character (Lexer.isNameChar).
  { text: 'let!', why: '`!` is a name character, so this is one name' },
  { text: 'def$', why: '`$` is a name character' },
  { text: 'case_', why: '`_` is a name character' },
  { text: 'xor1', why: 'a digit is a name character' },
  { text: 'defer', why: 'merely starts with `def`' },
  { text: 'iffy', why: 'merely starts with `if`' },
  { text: 'newtype', why: 'merely starts with `new`' },
  // Malformed literals. `Lexer.isNumberLikeChar` folds any trailing `[0-9A-Za-z_.]` into
  // the same erroneous token, so the grammar must not scope the valid-looking prefix.
  { text: '32q', why: 'an invalid suffix is part of the same number token' },
  { text: '1__2', why: 'the digit separator is `[0-9]+(_[0-9]+)*`, not `(_*[0-9])*`' },
  { text: '0xZZ', why: 'no hex digits follow `0x`' },
  { text: '1.0.5', why: 'a second `.` continues the same erroneous number token' },
];

const grammar = await loadGrammar();
const problems = [];

for (const { text, why } of MUST_BE_UNSCOPED) {
  const tokens = [...tokenize(grammar, text)].filter((token) => token.text.trim() !== '');
  for (const token of tokens) {
    const extra = token.scopes.filter((scope) => scope !== 'source.flix');
    if (extra.length > 0) {
      problems.push(
        `${JSON.stringify(text)} (${why}): ` +
          `token ${JSON.stringify(token.text)} unexpectedly scoped ${extra.join(', ')}`,
      );
    }
  }
}

if (problems.length > 0) {
  console.error('Unscoped-identifier check failed:\n');
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

console.log(`Unscoped-identifier check passed (${MUST_BE_UNSCOPED.length} subjects).`);
