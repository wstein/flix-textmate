/**
 * Minimal tokenizer harness over the emitted grammar.
 *
 * Shared by `check-unscoped.mjs` and the corpus audit. Uses the same engine as VS Code
 * (`vscode-textmate` over `vscode-oniguruma`), so results match what an editor renders.
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const require = createRequire(import.meta.url);

// Both packages are CommonJS; `import * as` yields a namespace wrapper rather than the
// exports object, so require them directly.
const oniguruma = require('vscode-oniguruma');
const textmate = require('vscode-textmate');

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

export const GRAMMAR_PATH = join(repoRoot, 'syntaxes', 'flix.tmLanguage.json');
export const SCOPE_NAME = 'source.flix';

/** Loads the grammar and returns a tokenizer for it. */
export async function loadGrammar() {
  const wasm = readFileSync(require.resolve('vscode-oniguruma/release/onig.wasm'));
  await oniguruma.loadWASM(wasm.buffer);

  const registry = new textmate.Registry({
    onigLib: Promise.resolve({
      createOnigScanner: (sources) => new oniguruma.OnigScanner(sources),
      createOnigString: (text) => new oniguruma.OnigString(text),
    }),
    loadGrammar: (scopeName) => {
      if (scopeName !== SCOPE_NAME) return Promise.resolve(null);
      const raw = readFileSync(GRAMMAR_PATH, 'utf8');
      return Promise.resolve(textmate.parseRawGrammar(raw, GRAMMAR_PATH));
    },
  });

  const grammar = await registry.loadGrammar(SCOPE_NAME);
  if (!grammar) throw new Error(`Failed to load ${SCOPE_NAME} from ${GRAMMAR_PATH}`);
  return grammar;
}

/**
 * Tokenizes `text`, yielding one entry per token.
 *
 * `ruleStack` is threaded across lines, so a rule left open at end-of-line stays open —
 * which is exactly what the end-of-file cleanliness check needs to observe.
 */
export function* tokenize(grammar, text) {
  let ruleStack = textmate.INITIAL;
  const lines = text.split('\n');
  for (const [lineNumber, line] of lines.entries()) {
    const result = grammar.tokenizeLine(line, ruleStack);
    ruleStack = result.ruleStack;
    for (const token of result.tokens) {
      yield {
        line: lineNumber + 1,
        text: line.slice(token.startIndex, token.endIndex),
        startIndex: token.startIndex,
        endIndex: token.endIndex,
        scopes: token.scopes,
      };
    }
  }
  return ruleStack;
}

/** Tokenizes `text` and returns the rule stack left open at end-of-file. */
export function finalRuleStack(grammar, text) {
  let ruleStack = textmate.INITIAL;
  for (const line of text.split('\n')) {
    ruleStack = grammar.tokenizeLine(line, ruleStack).ruleStack;
  }
  return ruleStack;
}
