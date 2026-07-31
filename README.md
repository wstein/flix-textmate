# flix-tm-grammar

A TextMate grammar for the [Flix](https://flix.dev) programming language, authored in
TypeScript and emitted as `syntaxes/flix.tmLanguage.json`.

## Why this exists

Flix has two independent highlighting paths, and neither covers the TextMate surface well:

- The official VS Code extension, [`flix/vscode-flix`](https://github.com/flix/vscode-flix),
  declares `"grammars": []`. It highlights entirely through LSP semantic tokens, so a
  `.flix` file has no colour until the compiler starts, and none at all if it fails.
- [`flix/textmate`](https://github.com/flix/textmate) provides the `source.flix` grammar
  that GitHub Linguist vendors, and therefore what colours Flix on github.com and in every
  Shiki-based documentation site. It has drifted from the compiler — see
  [`docs/DEFECTS.md`](docs/DEFECTS.md).

This project is a drop-in replacement for the latter: same file name, same `scopeName`,
same non-standard `copyright_notice` / `license` keys, so the emitted JSON can be
contributed upstream unchanged.

## Source of truth

Nothing in the grammar is written from memory. Every token class is derived from the
reference compiler:

| File                           | What it decides                                              |
| ------------------------------ | ------------------------------------------------------------ |
| `language/phase/Lexer.scala`   | tokenization: literals, escapes, comments, character classes |
| `language/ast/TokenKind.scala` | the exhaustive token list                                    |
| `language/phase/Parser2.scala` | where a name may appear, and in which case                   |
| `language/phase/Weeder2.scala` | the annotation table                                         |

The grammar follows the **lexer**, not the weeder. Flix deliberately lexes more than it
accepts and rejects the remainder later; staying permissive is what keeps highlighting
stable in a file that does not yet compile.

## Development

```bash
npm install
npm run build        # TypeScript -> syntaxes/flix.tmLanguage.json
npm run verify       # typecheck + lint + build-is-current + unit + snapshot tests
```

Individual steps:

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # eslint, then the structural grammar lint
npm run fmt          # prettier --write, then eslint --fix
npm run check:build  # rebuild and fail if the committed JSON changed
npm run test:unit    # inline scope assertions, tests/unit/**
npm run test:unscoped # identifiers that must receive no scope at all
npm run test:snap    # full-tokenization snapshots, tests/snap/**
npm run update:snap  # rewrite snapshots (review the diff!)
```

Against a Flix source tree (not vendored, so CI does not run these):

```bash
npm run audit -- --corpus ~/github.com/wstein/flix-fork
npm run docs:mapping -- --tree-sitter ~/github.com/wstein/tree-sitter-flix
```

`audit` enforces two things: no file may end with a rule still open (a hard gate — currently
zero across 890 files), and scope coverage may not fall below `tests/corpus-baseline.json`.
Coverage is a **ratchet, not a target**: this grammar deliberately leaves expression-position
identifiers bare, so chasing the number would mean inventing the heuristics it refuses to
ship.

Keywords, operators, and annotation names are not written by hand. They are extracted from
the compiler into `src/typescript/lexicon.generated.ts`, which is committed so CI needs no
compiler checkout:

```bash
npm run extract:lexicon -- --flix-source ~/github.com/wstein/flix-fork
```

The grammar maps that manifest with `Record<Keyword, ScopeName>`, so a keyword added to or
removed from Flix becomes a **type error** until it is classified. Combined with
`ScopeName` being `` `${string}.flix` ``, three classes of defect are unrepresentable:
a keyword that does not exist, a keyword left unscoped, and a scope missing its language
suffix.

`syntaxes/flix.tmLanguage.json` is generated **and committed**. CI runs `check:build`, so a
grammar edit that is not rebuilt fails the build rather than shipping stale JSON.

### Writing tests

Two complementary suites:

- `tests/unit/*.test.flix` — intent. Each file opens with `// SYNTAX TEST "source.flix"`
  and asserts scopes with caret lines. These encode _why_ a rule exists; most of them are
  regressions for a specific defect in the previous grammar.
- `tests/snap/*.test.flix` — ground truth. `npm run update:snap` records the complete
  tokenization, which is also the fastest way to discover the exact column of a token when
  writing a unit assertion.

Fixture lines are indented by four spaces so an assertion line's own `//` prefix does not
overlap the columns it points at.

## Documentation

- [`docs/SCOPES.md`](docs/SCOPES.md) — every scope, and why it is what it is.
- [`docs/SCOPE-MAPPING.md`](docs/SCOPE-MAPPING.md) — correspondence with `tree-sitter-flix`.
- [`docs/DEFECTS.md`](docs/DEFECTS.md) — what is wrong with the grammar this replaces.

## Licence

Apache License 2.0. The grammar carries forward the copyright notice of the upstream
`flix/textmate` grammar it replaces.
