#!/usr/bin/env node
/**
 * Differential check against `tree-sitter-flix`: no scoped TextMate token may cover a
 * strict sub-range of an atomic tree-sitter token.
 *
 * ## Why this exists
 *
 * Every other gate in this repository answers "does a scope exist" or "does a rule run
 * away". None answers "is this the *right* scope", because none has an independent oracle.
 * The corpus audit cannot tell us `Map$Entry` is one identifier; only the compiler knows
 * that — and `tree-sitter-flix` is a second reading of the same compiler, built in a
 * formalism strong enough to say where tokens begin and end.
 *
 * That gap is not theoretical. A high-effort review of the initial implementation found
 * six grammar defects; five were invisible to 890 corpus files and five green test suites,
 * and four of those five are exactly this shape — a scope applied to a fragment of a token:
 *
 *   - `Map$Entry` split at the `$` into an unscoped `Map` and a scoped `$Entry`
 *   - `a->>b` scoping `->` as struct access and leaving a stray `>`
 *   - `0x1F` scoping `0` as a number and leaving `x1F` bare
 *   - `9x?` scoping `x?` as a hole while the lexer sees one erroneous token
 *
 * ## What it compares
 *
 * Token *boundaries*, never scope names. The two projects use deliberately different
 * taxonomies, so "do we agree what to call this" is not a well-posed question — but "do we
 * agree where this token starts and ends" is, and it is the one that catches real bugs.
 *
 * One divergence is excluded rather than fixed: tree-sitter folds the leading `$` of an
 * escaped name into `name_lower`, while `Lexer.acceptEscapedName` explicitly excludes it
 * ("Don't include the $ sign in the name"). This grammar follows the lexer, so `$` inside
 * `$run` is scoped separately by design. A `$` in the *middle* of a name is an ordinary
 * name character and remains checked — that is the `Map$Entry` case.
 *
 * Only ATOMIC_KINDS are checked: node kinds whose text is a single lexical token, where
 * sub-tokenization is meaningless. Composite nodes are excluded on purpose — a string has
 * delimiters and escapes, a comment has its leading slashes, and `@Test` is deliberately
 * split into sigil and name, so a scope covering part of those is correct, not a defect.
 *
 * ## Running it
 *
 *   npm run check:boundaries -- --tree-sitter ~/github.com/wstein/tree-sitter-flix \
 *                               --corpus ~/github.com/wstein/flix-fork/examples
 *
 * Needs a tree-sitter-flix checkout whose `src/parser.c` is current, so CI does not run it.
 * It shells out to `tree-sitter parse --xml` rather than loading the native binding: the
 * binding goes stale against `grammar.js` edits, and pinning a native build across repos
 * is a cost this check does not need to pay.
 */

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Buffer } from 'node:buffer';
import { homedir } from 'node:os';

import { loadGrammar, tokenize } from './tokenize.mjs';

/**
 * Node kinds whose text is exactly one lexical token.
 *
 * Excluded deliberately: `string`, `char`, `regex` (delimiters and escapes are separate
 * scopes by design), the comment kinds (leading slashes are punctuation), and `annotation`
 * (`@Test` is split into sigil and name on purpose).
 */
const ATOMIC_KINDS = new Set([
  'name_lower',
  'name_upper',
  'name_math',
  'integer',
  'float',
  'boolean',
  'generic_operator',
  'wildcard',
  'modifier',
]);

function argValue(flag, fallback) {
  const index = process.argv.indexOf(flag);
  return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const treeSitterRoot = argValue(
  '--tree-sitter',
  process.env.TREE_SITTER_FLIX ??
    join(homedir(), 'github.com', 'wstein', 'tree-sitter-flix'),
);
const corpusRoot = argValue(
  '--corpus',
  process.env.FLIX_SOURCE ?? join(homedir(), 'github.com', 'wstein', 'flix-fork'),
);

/** Collects `.flix` files, skipping dot-directories. */
function collectFlixFiles(dir, found = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) collectFlixFiles(path, found);
    else if (entry.name.endsWith('.flix')) found.push(path);
  }
  return found;
}

/**
 * Maps byte offsets within a line to JavaScript string indices.
 *
 * tree-sitter reports columns in bytes; `vscode-textmate` indexes UTF-16 code units. The
 * two agree only on ASCII, and Flix admits identifiers in U+2200–U+22FF.
 */
function byteToCharIndex(line) {
  const map = new Map();
  let byte = 0;
  for (let charIndex = 0; charIndex < line.length;) {
    const codePoint = line.codePointAt(charIndex);
    const width = codePoint > 0xffff ? 2 : 1;
    map.set(byte, charIndex);
    byte += Buffer.byteLength(line.slice(charIndex, charIndex + width), 'utf8');
    charIndex += width;
  }
  map.set(byte, line.length);
  return map;
}

/** Extracts single-line atomic leaves from `tree-sitter parse --xml` output. */
function parseAtomicLeaves(xml) {
  const bySource = new Map();
  let current = null;

  const element =
    /<source name="([^"]+)">|<(\w+)(?:\s+field="\w+")?\s+srow="(\d+)" scol="(\d+)" erow="(\d+)" ecol="(\d+)">([^<]*)<\/\2>/g;

  for (const match of xml.matchAll(element)) {
    if (match[1] !== undefined) {
      current = match[1];
      bySource.set(current, []);
      continue;
    }
    const [, , kind, srow, scol, erow, ecol] = match;
    if (!ATOMIC_KINDS.has(kind)) continue;
    if (srow !== erow) continue; // Atomic tokens never span lines.
    bySource.get(current)?.push({
      kind,
      text: match[7],
      row: Number(srow),
      startByte: Number(scol),
      endByte: Number(ecol),
    });
  }
  return bySource;
}

if (!statSync(corpusRoot, { throwIfNoEntry: false })?.isDirectory()) {
  console.error(`Corpus not found: ${corpusRoot}`);
  process.exit(2);
}

const files = collectFlixFiles(corpusRoot);
if (files.length === 0) {
  console.error(`No .flix files under ${corpusRoot}`);
  process.exit(2);
}

let xml;
try {
  xml = execFileSync('npx', ['tree-sitter', 'parse', '--xml', ...files], {
    cwd: treeSitterRoot,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 512,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
} catch (error) {
  // A non-zero exit means some file failed to parse; the XML on stdout is still usable.
  xml = error.stdout ?? '';
  if (!xml) {
    console.error(`tree-sitter parse failed in ${treeSitterRoot}`);
    console.error('Is src/parser.c current? Run `tree-sitter generate` there.');
    process.exit(2);
  }
}

const leavesBySource = parseAtomicLeaves(xml);
const grammar = await loadGrammar();
const problems = [];
let leafCount = 0;

for (const file of files) {
  const key = [...leavesBySource.keys()].find((name) => file.endsWith(name));
  const leaves = key ? leavesBySource.get(key) : undefined;
  if (!leaves || leaves.length === 0) continue;

  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');

  // Index the grammar's scoped tokens by line.
  const scopedByLine = new Map();
  for (const token of tokenize(grammar, text)) {
    if (token.scopes.length <= 1) continue;
    if (token.text.trim() === '') continue;
    if (!scopedByLine.has(token.line - 1)) scopedByLine.set(token.line - 1, []);
    scopedByLine.get(token.line - 1).push(token);
  }

  for (const leaf of leaves) {
    const line = lines[leaf.row];
    if (line === undefined) continue;
    const offsets = byteToCharIndex(line);
    const start = offsets.get(leaf.startByte);
    const end = offsets.get(leaf.endByte);
    if (start === undefined || end === undefined) continue;

    // A *leading* `$` is an escape sigil, and Lexer.acceptEscapedName calls resetStart()
    // with the comment "Don't include the $ sign in the name" — so the lexer's token
    // begins after it, and scoping the sigil separately is faithful to the lexer.
    // tree-sitter folds the sigil into name_lower, which is the divergence here.
    // A `$` *inside* a name is an ordinary name character (`Map$Entry`) and stays checked.
    if (leaf.text.startsWith('$')) continue;

    leafCount += 1;

    for (const token of scopedByLine.get(leaf.row) ?? []) {
      const coversStrictSubRange =
        token.startIndex >= start &&
        token.endIndex <= end &&
        token.endIndex - token.startIndex < end - start;
      if (!coversStrictSubRange) continue;

      problems.push(
        `${file.slice(corpusRoot.length + 1)}:${leaf.row + 1}: ` +
          `${leaf.kind} ${JSON.stringify(line.slice(start, end))} is one token, but ` +
          `${JSON.stringify(token.text)} within it is scoped ` +
          `${token.scopes.slice(1).join(', ')}`,
      );
    }
  }
}

console.log(`Corpus:  ${corpusRoot}`);
console.log(`Files:   ${files.length}`);
console.log(`Checked: ${leafCount} atomic tree-sitter tokens`);

if (problems.length > 0) {
  const unique = [...new Set(problems)];
  console.error(`\nToken-boundary check failed (${unique.length} site(s)):\n`);
  for (const problem of unique.slice(0, 25)) console.error(`  ${problem}`);
  if (unique.length > 25) console.error(`  … and ${unique.length - 25} more`);
  process.exit(1);
}

console.log('\nToken-boundary check passed. No scope covers a fragment of a token.');
