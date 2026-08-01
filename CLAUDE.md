# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A TextMate grammar for [Flix](https://flix.dev), authored in TypeScript and emitted as
`syntaxes/flix.tmLanguage.json`. It is a **drop-in replacement** for the grammar at
https://github.com/flix/textmate, which GitHub Linguist vendors as the provider of
`source.flix`. Preserve the file name, the `scopeName`, and the non-standard
`copyright_notice` / `license` keys — those are what make the artifact upstreamable.

Note that the official VS Code extension (`flix/vscode-flix`) declares `"grammars": []` and
highlights via LSP semantic tokens only. This grammar is the base layer under that, and the
only highlighting available on github.com, in Shiki-rendered docs, and before the LSP boots.

## Commands

```bash
npm run build        # TypeScript -> syntaxes/flix.tmLanguage.json
npm run verify       # typecheck + lint + check:build + every test suite
npm run check:build  # rebuild and fail if the committed JSON changed
npm run fmt          # prettier --write, then eslint --fix
npm run test:unit    # inline scope assertions
npm run test:unscoped # identifiers that must receive no scope at all
npm run test:scripts # node --test over tests/scripts/, the gates' own tests
npm run test:snap    # full-tokenization snapshots
npm run update:snap  # rewrite snapshots (review the diff!)

# These read $FLIX_SOURCE / $TREE_SITTER_FLIX, or take --flix-source / --corpus /
# --tree-sitter. There is no default path; see scripts/external-checkout.mjs.
npm run extract:lexicon
npm run audit
npm run check:boundaries
npm run docs:mapping
```

The last three need a local Flix or tree-sitter-flix checkout, so CI does not run them. Run
`audit` after any rule change and commit the refreshed `tests/corpus-baseline.json` with it.

Run `npm run fmt && npm run verify` before every commit.

`syntaxes/flix.tmLanguage.json` is generated **and committed**. CI runs `check:build`, so a
grammar edit that is not rebuilt fails rather than shipping stale JSON. Never hand-edit the
JSON.

## Source of truth

Do not write Flix lexical rules from memory. The reference compiler,
[`flix/flix`](https://github.com/flix/flix), is authoritative — the files below are under
`main/src/ca/uwaterloo/flix/language/`:

| File                  | What to take from it                                         |
| --------------------- | ------------------------------------------------------------ |
| `phase/Lexer.scala`   | tokenization: literals, escapes, comments, character classes |
| `ast/TokenKind.scala` | the exhaustive token list                                    |
| `phase/Parser2.scala` | where a name may appear, and in which case                   |
| `phase/Weeder2.scala` | the annotation table (`visitAnnotation`)                     |

Follow the **lexer**, not the weeder. Flix lexes more than it accepts and rejects the rest
later; permissiveness keeps highlighting stable in a file that does not compile.

The previous grammar's defects almost all trace to violating this: it declares seven
keywords that are not in `Lexer.Keywords` (`dbg`, `typematch`, `resume`, `branch`,
`jumpto`, `without`, `opaque`) and one annotation that is not in `Weeder2.visitAnnotation`
(`@Internal`). See `docs/DEFECTS.md`.

## Architecture

- `src/typescript/TmLanguage.ts` — hand-rolled model of the tmLanguage format. Deliberately
  not a dependency: the types are public schema, and taking a third-party package for the
  _definition_ of our published artifact buys little and risks churn. `ScopeName` is
  `` `${string}.flix` ``, which makes an unsuffixed scope a compile error.
- `src/typescript/lexicon.generated.ts` — keywords, operators, simple tokens, and
  annotation names extracted from the compiler by `scripts/extract-lexicon.mjs`. Committed,
  so CI needs no compiler checkout. Never hand-edit; re-run the extractor. It is excluded
  from Prettier on purpose: reformatting a generated file makes the committed copy stop
  matching what its generator emits, so every regeneration would dirty the tree.
  `npm run check:lexicon` catches that.
- `src/typescript/FlixTmLanguage.ts` — the grammar. The only hand-written rule source. Its
  `KEYWORD_SCOPES` is typed `Record<Keyword, ScopeName>`, so an unclassified, removed, or
  invented keyword is a compile error.
- `scripts/tokenize.mjs` — shared `vscode-textmate` harness; the same engine VS Code uses.
- `scripts/check-unscoped.mjs` — asserts that non-keywords receive _no_ scope. This exists
  because `vscode-tmgrammar-test` compares scopes with exact string equality, so a negative
  assertion of `- keyword` passes against `keyword.control.flix` and proves nothing. Put
  "this must not be highlighted" cases here, never in a unit fixture.
- `src/typescript/GenerateTmLanguageFile.ts` — validates against `src/schemas/tmlanguage.json`
  with AJV, then writes the JSON. Exits non-zero on validation failure and writes only after
  validation succeeds, so a failed build leaves the previous artifact intact.
- `scripts/lint-grammar.mjs` — structural lint over the emitted JSON.
- `scripts/audit-corpus.mjs` — tokenizes a Flix source tree. Hard gate: no file may end with
  a rule still open. Ratchet: coverage may not fall below `tests/corpus-baseline.json`.
  Coverage is **not** a target — raising it by guessing at expression-position identifiers is
  precisely what this grammar refuses to do.
- `scripts/check-token-boundaries.mjs` — differential against `tree-sitter-flix`. The only
  gate with an independent oracle: every other one answers "does a scope exist", never "is
  it on the right characters". Compares token boundaries, never scope names. When it fires,
  suspect the grammar before suspecting the check — it found three real defects on its first
  two runs, including one the 890-file corpus audit and five test suites all missed.
- `scripts/generate-scope-mapping.mjs` — emits `docs/SCOPE-MAPPING.md`. Both inventories are
  read mechanically, so a scope or capture added on either side surfaces as unmapped.
- `scripts/check-badges.mjs` — re-derives the README's numeric badges from `package.json`
  and `tests/corpus-baseline.json`. A Shields static badge hardcodes its value, so the
  scope count and coverage percentage on the landing page are prose restating a committed
  fact — the same drift `check-scopes-documented.mjs` prevents, one file further out. Only
  badges with a value in a committed file belong there; the CI badge is rendered live.
- `tests/scripts/*.test.mjs` — `node --test` unit tests for the gates above. A gate that
  cannot fail is indistinguishable from no gate, so a check script's failure modes are
  exercised directly rather than assumed. Adding a gate means adding its tests here.

### Grammar conventions

- **Rule order is semantics.** TextMate picks the leftmost match and breaks ties by array
  order. The previous grammar lists `literal_dec` before `literal_hex`, so `0x1F` tokenizes
  as `0` plus an unscoped `x1F`. Put the longer/more specific literal rule first.
- **Every `begin` needs a line-anchored `end`.** `Lexer.acceptString` returns
  `UnterminatedString` on `\n`, so strings, chars, and regexes are single-line. A `begin`
  whose `end` never fires paints the rest of the file. `scripts/lint-grammar.mjs` enforces
  this; genuinely multi-line rules go in its `ALLOWED_MULTILINE` map **with a reason**.
- **No call-site heuristics.** TextMate cannot distinguish a function call from a
  constructor from a variable without a parser. Scope declarations, literals, comments, and
  the case-determined name classes that `Parser2` actually mandates; leave expression-position
  identifiers bare for the LSP's semantic tokens to layer over.
- **Standard scope taxonomy.** `keyword.control.*`, `keyword.operator.*`, `storage.type.*`,
  `storage.modifier.*`, `punctuation.*`, `entity.name.*`. One deliberate extension: a
  `.datalog.` segment, because a documentation site plausibly wants to tint the Datalog
  sub-language. Invented segments that no theme keys on are untestable as intent — do not
  add more.
- **Every scope ends in `.flix`.** Enforced by `ScopeName`.

### Relationship to tree-sitter-flix

[`wstein/tree-sitter-flix`](https://github.com/wstein/tree-sitter-flix) is a sibling project
with the same source of truth
and a `queries/highlights.scm`. Do **not** copy that file here — it is coupled to node names
in that repository's `grammar.js` and cannot be validated without its parser. The shared
artifact is the lexicon manifest extracted from `Lexer.scala`; the scope correspondence is
documented in `docs/SCOPE-MAPPING.md`, which reports both inventories mechanically so drift
is visible.

Some things tree-sitter handles with an external C scanner are simply not expressible here:
the `.` trichotomy (qualified-name separator vs. Datalog constraint terminator) needs to
know whether an enclosing constraint is open, which a regex stack machine cannot track.
Nested block comments and interpolated strings _are_ expressible — via self-include and
`begin`/`end` respectively.

## Conventions

- Conventional Commits; the type reflects the primary purpose of the change (`feat` for new
  scope coverage, `fix` for tokenization corrections, `chore`/`ci` for tooling).
- Fixture lines in `tests/unit` and `tests/snap` are indented four spaces so assertion `//`
  prefixes do not overlap the columns they point at.
- Every defect fixed gets a unit test that fails before the fix.
- Scope names are a contract. Adding one is easy; removing one breaks every theme that keys
  on it. Document each in `docs/SCOPES.md` at the same time — `npm run check:scopes`
  enforces this, because requiring it in prose is what let it drift in the first place.
- The README's scope-count and coverage badges restate `tests/corpus-baseline.json`, so a
  changed baseline means changing them too. `npm run check:badges` fails the build if not.
- Dependency and Actions updates arrive as grouped weekly Dependabot pull requests
  (`.github/dependabot.yml`). The CI token is `contents: read`; keep it that way unless a
  job genuinely needs to write.
