#!/usr/bin/env node
/**
 * Extracts Flix's lexical inventory from the reference compiler into
 * `src/typescript/lexicon.generated.ts`.
 *
 * The grammar must never enumerate keywords or annotations from memory. The incumbent
 * `source.flix` grammar does, and as a result declares seven keywords the lexer has never
 * had (`dbg`, `typematch`, `resume`, `branch`, `jumpto`, `without`, `opaque`) while missing
 * sixteen it does (`Array#`, `Static`, `Univ`, `open_variant`, …). See docs/DEFECTS.md.
 *
 * The generated file is committed, so CI does not need a compiler checkout. Re-run this
 * after updating the Flix source and commit the result:
 *
 *   npm run extract:lexicon -- --flix-source ~/github.com/wstein/flix-fork
 *
 * Because `Keyword` is emitted as a union of string literals and the grammar maps it with
 * `Record<Keyword, ...>`, a keyword added to or removed from Flix turns into a type error
 * until someone classifies it. That is the whole point: drift becomes a build failure
 * rather than a silently missing colour.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const flagIndex = process.argv.indexOf('--flix-source');
const flixSource =
  flagIndex !== -1 && process.argv[flagIndex + 1]
    ? process.argv[flagIndex + 1]
    : (process.env.FLIX_SOURCE ?? join(homedir(), 'github.com', 'wstein', 'flix-fork'));

const languageDir = join(
  flixSource,
  'main',
  'src',
  'ca',
  'uwaterloo',
  'flix',
  'language',
);
const lexerPath = join(languageDir, 'phase', 'Lexer.scala');
const weederPath = join(languageDir, 'phase', 'Weeder2.scala');
const resolverPath = join(languageDir, 'phase', 'Resolver.scala');

/** Undoes the Scala string escapes that appear in the token tables. */
function unescapeScala(literal) {
  return literal.replace(/\\(.)/g, (_, char) => {
    if (char === 'n') return '\n';
    if (char === 't') return '\t';
    return char;
  });
}

/**
 * Reads one `PrefixTree` table out of Lexer.scala.
 *
 * Each table is an `Array(("text", TokenKind.Kind), …)` assigned to a `private val`.
 */
function readTokenTable(source, valName) {
  const start = source.indexOf(`private val ${valName}`);
  if (start === -1) throw new Error(`Lexer.scala has no 'private val ${valName}'`);

  const end = source.indexOf('PrefixTree.mk(', start);
  if (end === -1) throw new Error(`No PrefixTree.mk after '${valName}'`);

  const entries = [];
  const entry = /\("((?:[^"\\]|\\.)*)",\s*TokenKind\.(\w+)\)/g;
  for (const match of source.slice(start, end).matchAll(entry)) {
    entries.push({ text: unescapeScala(match[1]), kind: match[2] });
  }
  if (entries.length === 0) throw new Error(`Table '${valName}' parsed as empty`);
  return entries;
}

/** Reads the annotation names accepted by `Weeder2.visitAnnotation`. */
function readAnnotations(source) {
  const start = source.indexOf('private def visitAnnotation');
  if (start === -1) throw new Error('Weeder2.scala has no visitAnnotation');

  const end = source.indexOf('case other =>', start);
  if (end === -1) throw new Error('visitAnnotation has no fallthrough case');

  const names = [];
  for (const match of source.slice(start, end).matchAll(/case "@(\w+)" =>/g)) {
    names.push(match[1]);
  }
  if (names.length === 0) throw new Error('Annotation table parsed as empty');
  return names;
}

/**
 * Reads the builtin type names from `Resolver.visitType`.
 *
 * These are the types resolved structurally, before any name lookup — the closest thing
 * Flix has to primitives. Everything after the table's `case _` is an ordinary library or
 * user type and must not be scoped as builtin.
 */
function readPrimitiveTypes(source) {
  const anchor = source.indexOf('// Basic Types');
  if (anchor === -1) throw new Error("Resolver.scala has no '// Basic Types' table");

  const end = source.indexOf('case _ =>', anchor);
  if (end === -1) throw new Error('Basic Types table has no fallthrough case');

  const names = [];
  for (const match of source.slice(anchor, end).matchAll(/case "(\w+)" =>/g)) {
    names.push(match[1]);
  }
  if (names.length === 0) throw new Error('Basic Types table parsed as empty');
  return names;
}

/** Best-effort provenance so a stale manifest is identifiable. */
function describeSource() {
  try {
    return execFileSync('git', ['-C', flixSource, 'rev-parse', '--short', 'HEAD'], {
      encoding: 'utf8',
    }).trim();
  } catch {
    return 'unknown';
  }
}

const lexer = readFileSync(lexerPath, 'utf8');
const weeder = readFileSync(weederPath, 'utf8');
const resolver = readFileSync(resolverPath, 'utf8');

const keywords = readTokenTable(lexer, 'Keywords');
const simpleTokens = readTokenTable(lexer, 'SimpleTokens');
const operators = readTokenTable(lexer, 'Operators');
const annotations = readAnnotations(weeder);
const primitiveTypes = readPrimitiveTypes(resolver);

/** Renders a `string[]` as a `readonly` tuple whose element type is a literal union. */
function renderTuple(name, values, doc) {
  const items = values.map((value) => `  ${JSON.stringify(value)},`).join('\n');
  return `${doc}\nexport const ${name} = [\n${items}\n] as const;\n`;
}

const output = `// Generated by scripts/extract-lexicon.mjs. Do not edit.
//
// Source: ${flixSource} @ ${describeSource()}
//   keywords     Lexer.scala, 'private val Keywords'
//   simpleTokens Lexer.scala, 'private val SimpleTokens'
//   operators    Lexer.scala, 'private val Operators'
//   annotations  Weeder2.scala, 'visitAnnotation'
//   primitives   Resolver.scala, the '// Basic Types' table
//
// Regenerate with: npm run extract:lexicon

${renderTuple(
  'KEYWORDS',
  keywords.map((entry) => entry.text),
  `/** Every keyword the lexer recognises (${keywords.length}). */`,
)}
/** A keyword spelling. Mapping this with \`Record\` makes an unclassified keyword a type error. */
export type Keyword = (typeof KEYWORDS)[number];

${renderTuple(
  'SIMPLE_TOKENS',
  simpleTokens.map((entry) => entry.text),
  `/** Tokens consumed regardless of the following character (${simpleTokens.length}). */`,
)}
${renderTuple(
  'OPERATORS',
  operators.map((entry) => entry.text),
  `/** Tokens consumed as long as no operator character follows (${operators.length}). */`,
)}
${renderTuple(
  'PRIMITIVE_TYPES',
  primitiveTypes,
  `/**
 * Types \`Resolver\` resolves structurally, before any name lookup (${primitiveTypes.length}).
 *
 * The closest thing Flix has to primitive types. Unlike library names such as \`Some\` or
 * \`Nil\` -- which the incumbent grammar wrongly scopes as \`constant.language\` -- these
 * cannot be shadowed by a user declaration.
 */`,
)}
${renderTuple(
  'ANNOTATIONS',
  annotations,
  `/**
 * Annotations \`Weeder2\` accepts (${annotations.length}), without the leading \`@\`.
 *
 * The grammar deliberately does NOT enumerate these: \`Lexer.acceptAnnotation\` consumes
 * \`@\` followed by ASCII letters, so one rule covers every annotation that exists or will.
 * This list exists so the tests can prove each accepted annotation is scoped.
 */`,
)}`;

writeFileSync(
  join(repoRoot, 'src', 'typescript', 'lexicon.generated.ts'),
  output,
  'utf8',
);

console.log(
  `Wrote src/typescript/lexicon.generated.ts: ` +
    `${keywords.length} keywords, ${simpleTokens.length} simple tokens, ` +
    `${operators.length} operators, ${annotations.length} annotations, ` +
    `${primitiveTypes.length} primitive types.`,
);
