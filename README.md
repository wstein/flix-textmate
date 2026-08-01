# flix-textmate

[![CI](https://github.com/wstein/flix-textmate/actions/workflows/ci.yml/badge.svg)](https://github.com/wstein/flix-textmate/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE.md)
[![Node](https://img.shields.io/badge/node-%E2%89%A5%2022.18-5FA04E.svg?logo=node.js&logoColor=white)](package.json)
[![Scopes](https://img.shields.io/badge/scopes-64-blue.svg)](docs/SCOPES.md)
[![Corpus coverage](https://img.shields.io/badge/corpus%20coverage-66.32%25-blue.svg)](tests/corpus-baseline.json)
[![Grammar](https://img.shields.io/badge/scopeName-source.flix-blue.svg)](syntaxes/flix.tmLanguage.json)

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

## Using the grammar

The artifact is the single file [`syntaxes/flix.tmLanguage.json`](syntaxes/flix.tmLanguage.json).
It has no runtime dependencies and is not published to npm, so vendor it from a tag:

```bash
curl -fsSLO https://raw.githubusercontent.com/wstein/flix-textmate/v0.1.1/syntaxes/flix.tmLanguage.json
```

A VS Code extension contributes it against the `flix` language identifier:

```json
{
  "contributes": {
    "grammars": [
      {
        "language": "flix",
        "scopeName": "source.flix",
        "path": "./syntaxes/flix.tmLanguage.json"
      }
    ]
  }
}
```

[Shiki](https://shiki.style) — and anything else built on `vscode-textmate`, the engine this
repository's own tests tokenize with — takes it as a language:

```js
import { createHighlighter } from 'shiki';
import flix from './flix.tmLanguage.json' with { type: 'json' };

const highlighter = await createHighlighter({ langs: [flix], themes: ['github-dark'] });
highlighter.codeToHtml(source, { lang: 'flix', theme: 'github-dark' });
```

Every scope the grammar can emit is enumerated in [`docs/SCOPES.md`](docs/SCOPES.md). The
taxonomy is the mainstream VS Code one, so a stock theme needs no configuration.

## Source of truth

Nothing in the grammar is written from memory. Every token class is derived from the
reference compiler, [`flix/flix`](https://github.com/flix/flix), under
`main/src/ca/uwaterloo/flix/language/`:

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
npm run verify       # typecheck + lint + build-is-current + every test suite
```

Individual steps:

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # eslint, the structural grammar lint, then the doc checks
npm run fmt          # prettier --write, then eslint --fix
npm run check:build  # rebuild and fail if the committed JSON changed
npm run check:scopes # fail if the grammar emits a scope docs/SCOPES.md omits
npm run check:badges # fail if a README badge misstates its source file
npm run test:unit    # inline scope assertions, tests/unit/**
npm run test:unscoped # identifiers that must receive no scope at all
npm run test:scripts # unit tests for the check scripts, tests/scripts/**
npm run test:snap    # full-tokenization snapshots, tests/snap/**
npm run update:snap  # rewrite snapshots (review the diff!)
```

Against a Flix source tree (not vendored, so CI does not run these):

```bash
export FLIX_SOURCE=/path/to/flix          # https://github.com/flix/flix
export TREE_SITTER_FLIX=/path/to/tree-sitter-flix

npm run audit
npm run check:boundaries
npm run docs:mapping
```

Each also takes an explicit flag (`--corpus`, `--tree-sitter`, `--flix-source`). There is no
default location: a hardcoded fallback works on one machine and fails confusingly on every
other.

`check:boundaries` is the only gate with an **independent oracle**. It parses the corpus
with [`tree-sitter-flix`](https://github.com/wstein/tree-sitter-flix) and asserts that no
scoped TextMate token covers a strict sub-range of an atomic tree-sitter token — comparing
token _boundaries_, never scope names, since the two taxonomies deliberately differ. Every
other gate answers "does a scope exist"; only this one can answer "is it on the right
characters".

`audit` enforces two things: no file may end with a rule still open (a hard gate — currently
zero across 890 files), and scope coverage may not fall below `tests/corpus-baseline.json`.
Coverage is a **ratchet, not a target**: this grammar deliberately leaves expression-position
identifiers bare, so chasing the number would mean inventing the heuristics it refuses to
ship. That is also why the coverage badge above is a fact, not a goal.

Keywords, operators, and annotation names are not written by hand. They are extracted from
the compiler into `src/typescript/lexicon.generated.ts`, which is committed so CI needs no
compiler checkout:

```bash
npm run extract:lexicon          # reads $FLIX_SOURCE
npm run check:lexicon            # fail if the committed manifest differs from a fresh run
```

`lexicon.generated.ts` is excluded from Prettier. Reformatting a generated file means the
committed copy stops matching what its generator emits, so regenerating always dirties the
tree — `check:lexicon` is what makes that visible.

The grammar maps that manifest with `Record<Keyword, ScopeName>`, so a keyword added to or
removed from Flix becomes a **type error** until it is classified. Combined with
`ScopeName` being `` `${string}.flix` ``, three classes of defect are unrepresentable:
a keyword that does not exist, a keyword left unscoped, and a scope missing its language
suffix.

`syntaxes/flix.tmLanguage.json` is generated **and committed**. CI runs `check:build`, so a
grammar edit that is not rebuilt fails the build rather than shipping stale JSON.

### Writing tests

Three suites, each answering a different question:

- `tests/unit/*.test.flix` — intent. Each file opens with `// SYNTAX TEST "source.flix"`
  and asserts scopes with caret lines. These encode _why_ a rule exists; most of them are
  regressions for a specific defect in the previous grammar.
- `tests/snap/*.test.flix` — ground truth. `npm run update:snap` records the complete
  tokenization, which is also the fastest way to discover the exact column of a token when
  writing a unit assertion.
- `tests/scripts/*.test.mjs` — the gates themselves, run under `node --test`. A gate that
  cannot fail is indistinguishable from no gate, so anything in `scripts/` that decides
  pass or fail gets its failure modes exercised here.

Fixture lines are indented by four spaces so an assertion line's own `//` prefix does not
overlap the columns it points at.

A negative assertion needs care: `vscode-tmgrammar-test` compares scopes by exact string
equality, so `- keyword` passes against `keyword.control.flix` and proves nothing. Cases of
the form "this must _not_ be highlighted" belong in `scripts/check-unscoped.mjs`.

## Contributing

Run `npm run fmt && npm run verify` before every commit, and `npm run audit` after any rule
change — commit the refreshed `tests/corpus-baseline.json` alongside it. Commits follow
[Conventional Commits](https://www.conventionalcommits.org); every defect fixed gets a unit
test that fails before the fix. Adding a scope means documenting it in `docs/SCOPES.md` in
the same change — `npm run check:scopes` enforces that, because requiring it in prose is
what let the incumbent grammar drift. For the same reason `npm run check:badges` re-derives
the numeric badges above from `package.json` and `tests/corpus-baseline.json`, so a stale
one fails the build instead of misinforming the landing page.

Dependency and workflow updates arrive as grouped weekly Dependabot pull requests
([`.github/dependabot.yml`](.github/dependabot.yml)), and run the same CI gates as any
other pull request.

## Documentation

- [`docs/SCOPES.md`](docs/SCOPES.md) — every scope, and why it is what it is.
- [`docs/SCOPE-MAPPING.md`](docs/SCOPE-MAPPING.md) — correspondence with `tree-sitter-flix`.
- [`docs/DEFECTS.md`](docs/DEFECTS.md) — what is wrong with the grammar this replaces.

## Licence

Apache License 2.0. The grammar carries forward the copyright notice of the upstream
`flix/textmate` grammar it replaces.
