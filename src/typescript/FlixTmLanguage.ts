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

import type { Rule, TmLanguage } from './TmLanguage.ts';

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
  patterns: [{ include: '#comments' }],
  repository: {
    ...comments,
  },
};
