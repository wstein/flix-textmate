/**
 * TextMate grammar for the Flix programming language (https://flix.dev).
 *
 * ## Source of truth
 *
 * Nothing here is written from memory. Every token class is derived from the reference
 * compiler in `flix-fork/main/src/ca/uwaterloo/flix/language/`:
 *
 * | File                 | What it decides                                             |
 * | -------------------- | ----------------------------------------------------------- |
 * | `phase/Lexer.scala`  | tokenization: literals, escapes, comments, character classes |
 * | `ast/TokenKind.scala`| the exhaustive token list                                    |
 * | `phase/Parser2.scala`| where a name may appear and in which case                    |
 * | `phase/Weeder2.scala`| the annotation table                                         |
 *
 * The grammar follows the *lexer*, not the weeder. Flix deliberately lexes more than it
 * accepts and rejects the remainder in a later phase; staying permissive is what keeps
 * highlighting stable inside a file that does not yet compile.
 *
 * ## Compatibility
 *
 * This is a drop-in replacement for `syntaxes/flix.tmLanguage.json` in
 * https://github.com/flix/textmate, which GitHub Linguist vendors as the provider of
 * `source.flix`. The scope name, file name, and the non-standard `copyright_notice` /
 * `license` keys are preserved so the emitted file can be dropped into that repository.
 */

import type { Rule, ScopeName, TmLanguage } from './TmLanguage.ts';
import { KEYWORDS, type Keyword } from './lexicon.generated.ts';

/**
 * Characters that may appear inside a name, from `Lexer.isNameChar`:
 * a letter, a digit, `_`, `!`, or `$`.
 *
 * `Lexer.acceptIfKeyword` only accepts a keyword when the *following* character is not one
 * of these, so `let!` is the name `let!` rather than the keyword `let` followed by `!`.
 * A `\b` boundary gets that wrong in both directions, which is why the keyword rules below
 * are guarded by explicit lookaround instead.
 */
const NAME_CHAR = '[A-Za-z0-9_!$]';

/** Escapes the Oniguruma metacharacters that occur in Flix keyword spellings. */
function escapeRegex(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Builds one alternation rule for a set of keywords sharing a scope.
 *
 * Alternatives are sorted longest-first because Oniguruma alternation returns the first
 * match, not the longest: with `choose` before `choose*`, the trailing `*` would be left
 * unscoped. Sorting is also what keeps the emitted JSON stable across builds.
 */
function keywordRule(name: ScopeName, keywords: readonly string[]): Rule {
  const alternatives = [...keywords]
    .sort((a, b) => b.length - a.length || a.localeCompare(b))
    .map(escapeRegex)
    .join('|');
  return {
    match: `(?<!${NAME_CHAR})(?:${alternatives})(?!${NAME_CHAR})`,
    name,
  };
}

/**
 * Every keyword in `Lexer.Keywords`, classified.
 *
 * Typed as `Record<Keyword, ScopeName>`, so adding or removing a keyword in the Flix lexer
 * and re-running `npm run extract:lexicon` turns into a type error until it is classified
 * here. That is the mechanism that keeps this grammar from drifting the way the incumbent
 * one did — see docs/DEFECTS.md.
 *
 * The taxonomy is the mainstream VS Code one, so a Flix file colours like any other
 * language under a stock theme. One extension is deliberate: `keyword.control.datalog.flix`
 * marks the fixpoint sub-language, which a documentation site may reasonably want to tint.
 * It is applied only to keywords with no other role — `select` is excluded because Flix also
 * uses it for channel select, and `where` / `with` because they appear in trait and instance
 * constraints.
 */
const KEYWORD_SCOPES: Record<Keyword, ScopeName> = {
  // Literals the lexer treats as keywords.
  true: 'constant.language.boolean.flix',
  false: 'constant.language.boolean.flix',
  null: 'constant.language.null.flix',

  // `Static` is the static region and `Univ` the universal effect set. Both are in
  // Parser2's NAME_TYPE / TYPE_CONSTANT sets, so they read as builtin types.
  Static: 'support.type.builtin.flix',
  Univ: 'support.type.builtin.flix',

  // Collection literal prefixes: `List#{1, 2, 3}`, `Map#{k => v}`.
  'Array#': 'keyword.operator.new.flix',
  'List#': 'keyword.operator.new.flix',
  'Map#': 'keyword.operator.new.flix',
  'Set#': 'keyword.operator.new.flix',
  'Vector#': 'keyword.operator.new.flix',
  new: 'keyword.operator.new.flix',

  // Declaration introducers and binders.
  def: 'storage.type.flix',
  redef: 'storage.type.flix',
  enum: 'storage.type.flix',
  struct: 'storage.type.flix',
  trait: 'storage.type.flix',
  instance: 'storage.type.flix',
  eff: 'storage.type.flix',
  law: 'storage.type.flix',
  type: 'storage.type.flix',
  alias: 'storage.type.flix',
  mod: 'storage.type.flix',
  restrictable: 'storage.type.flix',
  let: 'storage.type.flix',

  pub: 'storage.modifier.flix',
  sealed: 'storage.modifier.flix',
  lawful: 'storage.modifier.flix',
  mut: 'storage.modifier.flix',

  if: 'keyword.control.conditional.flix',
  else: 'keyword.control.conditional.flix',

  match: 'keyword.control.flix',
  ematch: 'keyword.control.flix',
  choose: 'keyword.control.flix',
  'choose*': 'keyword.control.flix',
  case: 'keyword.control.flix',
  try: 'keyword.control.flix',
  catch: 'keyword.control.flix',
  throw: 'keyword.control.flix',
  yield: 'keyword.control.flix',
  foreach: 'keyword.control.flix',
  forA: 'keyword.control.flix',
  forM: 'keyword.control.flix',
  spawn: 'keyword.control.flix',
  par: 'keyword.control.flix',
  run: 'keyword.control.flix',
  handler: 'keyword.control.flix',
  region: 'keyword.control.flix',
  select: 'keyword.control.flix',

  use: 'keyword.control.import.flix',
  import: 'keyword.control.import.flix',

  solve: 'keyword.control.datalog.flix',
  psolve: 'keyword.control.datalog.flix',
  query: 'keyword.control.datalog.flix',
  pquery: 'keyword.control.datalog.flix',
  inject: 'keyword.control.datalog.flix',
  project: 'keyword.control.datalog.flix',
  fix: 'keyword.control.datalog.flix',

  not: 'keyword.operator.logical.flix',
  and: 'keyword.operator.logical.flix',
  or: 'keyword.operator.logical.flix',
  xor: 'keyword.operator.logical.flix',

  as: 'keyword.operator.word.flix',
  instanceof: 'keyword.operator.word.flix',
  open_variant: 'keyword.operator.word.flix',
  open_variant_as: 'keyword.operator.word.flix',
  rvadd: 'keyword.operator.word.flix',
  rvand: 'keyword.operator.word.flix',
  rvnot: 'keyword.operator.word.flix',
  rvsub: 'keyword.operator.word.flix',

  checked_cast: 'keyword.operator.cast.flix',
  checked_ecast: 'keyword.operator.cast.flix',
  unchecked_cast: 'keyword.operator.cast.flix',
  unsafe: 'keyword.operator.cast.flix',

  forall: 'keyword.other.flix',
  where: 'keyword.other.flix',
  with: 'keyword.other.flix',
  from: 'keyword.other.flix',
  into: 'keyword.other.flix',
  lazy: 'keyword.other.flix',
  force: 'keyword.other.flix',
  discard: 'keyword.other.flix',
  super: 'keyword.other.flix',
  xvar: 'keyword.other.flix',
  // Lexed as a keyword but never consumed by Parser2 — reserved in practice.
  static: 'keyword.other.flix',
};

/** Groups the classified keywords into one alternation rule per scope. */
function keywordRules(): Rule[] {
  const byScope = new Map<ScopeName, string[]>();
  for (const keyword of KEYWORDS) {
    const scope = KEYWORD_SCOPES[keyword];
    const group = byScope.get(scope);
    if (group) group.push(keyword);
    else byScope.set(scope, [keyword]);
  }
  return [...byScope.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([scope, keywords]) => keywordRule(scope, keywords));
}

/**
 * Annotation rule.
 *
 * Deliberately generic. `Lexer.acceptAnnotation` consumes `@` followed by
 * `Lexer.isAnnotationChar`, which is `isLetter` — ASCII letters only, no digits and no
 * underscore. Enumerating annotation names is what left the incumbent grammar without
 * `@Tailrec`, `@Terminates`, `@Export`, and six others, while carrying `@Internal`, which
 * `Weeder2` does not accept. One pattern covers every annotation that exists or will.
 */
const annotations: Record<string, Rule> = {
  annotations: {
    match: '(@)([A-Za-z]+)',
    name: 'storage.type.annotation.flix',
    captures: { '1': { name: 'punctuation.definition.annotation.flix' } },
  },
};

const keywords: Record<string, Rule> = {
  keywords: { patterns: keywordRules() },
};

/**
 * Comment rules.
 *
 * `Lexer.acceptLineOrDocComment` counts the slashes after the leading `//`: exactly one
 * further slash makes a doc comment, anything else is an ordinary line comment. So `///`
 * is documentation but `////` is not — a distinction the previous grammar did not draw at
 * all, folding every `///` line into `comment.line.double-slash`.
 *
 * `Lexer.acceptBlockComment` tracks a nesting `level`, so `/* a /* b *\/ c *\/` is a
 * single comment. TextMate expresses that by having the block rule include itself.
 */
const comments: Record<string, Rule> = {
  comments: {
    patterns: [
      { include: '#block-comment' },
      { include: '#doc-comment' },
      { include: '#line-comment' },
    ],
  },

  'block-comment': {
    comment: 'Nests, per Lexer.acceptBlockComment, via the self-include below.',
    name: 'comment.block.flix',
    begin: '/\\*',
    beginCaptures: { '0': { name: 'punctuation.definition.comment.begin.flix' } },
    end: '\\*/',
    endCaptures: { '0': { name: 'punctuation.definition.comment.end.flix' } },
    patterns: [{ include: '#block-comment' }],
  },

  'doc-comment': {
    comment: 'Exactly three slashes. Lexer.acceptLineOrDocComment, slashCount == 1.',
    match: '(///)(?!/).*$',
    name: 'comment.line.documentation.flix',
    captures: { '1': { name: 'punctuation.definition.comment.flix' } },
  },

  'line-comment': {
    patterns: [
      {
        comment: 'Two slashes not followed by a third.',
        match: '(//)(?!/).*$',
        name: 'comment.line.double-slash.flix',
        captures: { '1': { name: 'punctuation.definition.comment.flix' } },
      },
      {
        comment: 'Four or more slashes: not documentation, per the slash count above.',
        match: '(/{4,}).*$',
        name: 'comment.line.double-slash.flix',
        captures: { '1': { name: 'punctuation.definition.comment.flix' } },
      },
    ],
  },
};

export const flixTmLanguage: TmLanguage = {
  $schema:
    'https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json',
  copyright_notice:
    'Copyright 2020 Stephen Tetley, Magnus Madsen; Copyright 2026 Werner Stein',
  license: 'Apache License, Version 2.0',
  name: 'Flix',
  scopeName: 'source.flix',
  fileTypes: ['flix'],
  // Comments first: a `begin`/`end` rule that opens inside a comment would never close.
  patterns: [
    { include: '#comments' },
    { include: '#annotations' },
    { include: '#keywords' },
  ],
  repository: {
    ...comments,
    ...annotations,
    ...keywords,
  },
};
