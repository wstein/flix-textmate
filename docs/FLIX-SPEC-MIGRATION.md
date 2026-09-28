# Migrating to Flix v0.77.0 and the current flix-spec

Status: **not started.** `flix-pin.json` declares Flix v0.75.2 (`40949531...`), two releases behind.

This repository is the lexical consumer: no trees, no projection map, no conformance lanes. Most of
what follows therefore does not apply — but the one thing that does is the single most dangerous
change in this release for a TextMate grammar.

## What changed in Flix

This repository is pinned to Flix **v0.75.2** (`40949531`). The reference has moved twice since.

### v0.75.2 → v0.76.0

- Effects accept type parameters. Generic *operations* remain invalid and now report
  `IllegalOperationTypeParams` rather than `IllegalEffectTypeParams`.
- Malformed `match` and `ematch` expressions retain the match node and the scrutinee through
  ordinary recovery instead of collapsing.
- **Vocabulary unchanged**: 191 TreeKinds and 158 TokenKinds, same names, same digests.

### v0.76.0 → v0.77.0

- **`+UsesOrImports.Package`** (TreeKind 191 → 192). `use` now recognises a package path:
  `use flixball::Game.Board` and `use flixball::{Game, Board}`.
- **`+ColonColonTight`** (TokenKind 158 → 159). `::` written **without surrounding whitespace** lexes
  as a distinct token. Tight `::` is the package-path separator; spaced `::` remains list cons.
  Writing the separator with whitespace is now a `Malformed` error.
- Nothing was removed or re-parented. Both releases are additive at the vocabulary level.
- Internally, Flix deleted its `Reader` phase and `shared.Input`. That broke `flix-spec`'s own
  adapter and is fixed there; it does not reach consumers.

> **`ColonColonTight` is the one that bites quietly.** Upstream left `("::", ColonColon)` in the
> lexer's operator table and decides tightness in hand-written dispatch outside every table. Nothing
> that scrapes or reflects over that table sees a change. A rule matching `ColonColon` today simply
> stops matching `a::b`, with no error anywhere.

## What changed in flix-spec

Beyond the pin, the release you are moving to changes four things that affect consumers.

**1. The transparency contract is stated per occurrence, and is much larger.**
It used to admit a kind only if *every* occurrence had at most one child. It now fires per
occurrence — dropped when empty, replaced when singular, kept when branching — which admitted four
kinds every structural consumer was already eliding for itself: `Expr.Expr`, `Pattern.Pattern`,
`QName`, `UsesOrImports.UseOrImportList`. A third rule, `elide-empty`, drops empty `AnnotationList`
and `ModifierList` without splicing their tokens.

Normalisation now removes **2285 of 4449 nodes (51.4%)**, up from 753 of 4398 (17.1%). Canonical
trees are substantially smaller and every baseline is stale.

Because the rules fire per occurrence, an elided kind is **not always absent**: `QName` survives
wherever a name is qualified (23 occurrences), and `ModifierList` wherever it holds a modifier (12).
Mappings onto those are legitimate, and `validateProjectionMap` now decides that by measuring
`fixtures/expected` rather than inferring it from the rule name.

**2. A fourth lane: `diagnostic_conformance`.**
It compares whether the same units are **rejected**, and whether each carries the same gated
`kind`/`line`. Accept/reject needs no tree, no projection map and no shared vocabulary. If your
diagnostic names are your own, declare `diagnosticMappings` in your projection map; without it the
lane compares accept/reject alone and says so. A consumer that emits no diagnostics at all is
`not-applicable`, not failed.

**3. Depth is published and can be gated.**
Reports now carry `nodesExpected` and `depthPercent` beside `nodesCompared`, and the CLI accepts
`--depth-floor` / `--recovery-depth-floor`. Report `schemaVersion` is **7**. A version-6 report's
depth was computed against the walk rather than the expectation — it read *highest* for the maps
that skipped most — so old and new depth figures are not comparable.

**4. `source_invariants` gained `token-positions`.**
Token `start`/`end` were schema-required and read by nothing. The lane now checks that each token's
text is what its source holds at those offsets, that tokens advance in order, and that what lies
between them is only whitespace or the `$` escape. It stands down for consumers that emit no tokens.

New projection-map keys, both optional: `dropWhenEmpty` (the consumer-side counterpart of
`elide-empty`) and `diagnosticMappings`.

## What this repository must do

### 1. `ColonColonTight` — the change that is invisible to every gate you have

This is the whole migration for this repository, and nothing currently in CI can detect it.

`::` written without surrounding whitespace is now a distinct token. Tight `::` is the **package-path
separator** (`flixball::Game.Board`); spaced `::` remains **list cons**. Today
`src/typescript/FlixTmLanguage.ts:806` flattens both into one rule:

```ts
{ match: ':::|::|:', name: 'punctuation.separator.colon.flix' }
```

Three independent reasons why nothing here would tell you:

1. **The lexicon cannot see it.** `scripts/extract-lexicon.mjs` parses `("text", TokenKind.Kind)`
   pairs out of the `PrefixTree` tables, and `lexicon.generated.ts` emits **text only** — bare
   string arrays, with `"::"` and `":::"` already present. Upstream left `("::", ColonColon)` in the
   `Operators` table unchanged and decides tightness in hand-written dispatch *outside* every table,
   so regenerating the lexicon at v0.77.0 produces a byte-identical file for `::`.
   (`ArrowThinRTight` was invisible the same way, and is hand-modelled at `Lexer.scala:350-361`.)
2. **The pin gate compares a SHA and nothing else.** `scripts/check-flix-pin.mjs` checks the stamp
   against `flix-pin.json` and `flix-pin.json.upstream.commit` against `flix-spec/pin.json`. Bump
   both and it prints `OK`. It never reads `ast/tokenkind.json` or `tokenKindDigest`.
3. **The CI step meant to protect the lexicon cannot fire.** `.github/workflows/ci.yml`, step
   *"Lexicon manifest is unmodified"*, runs `git diff --exit-code -- src/typescript/lexicon.generated.ts`
   on a clean checkout with **no preceding step that regenerates it**. CI has no Flix source, and
   `npm run check:lexicon` — which does regenerate — is in neither `lint` nor `verify`. The step
   passes unconditionally. That workflow's own comment says *"A gate whose only reachable branch
   cannot fire is decoration."*

**Fix the grammar:** split the `::` rule the same way this repository already splits `a->b` from
`a -> b` (`ArrowThinRTight`, `docs/SCOPES.md:161`, `FlixTmLanguage.ts:658,735`). The tight form
inside a `use` is a namespace separator and should not be scoped as an operator.

### 2. Consume `ast/tokenkind.json` instead of scraping `Lexer.scala`

The premise that this repository already consumes `ast/tokenkind.json` does not hold — grepping for
`tokenkind`/`TokenKind` finds only prose. `extract-lexicon.mjs` scrapes `Lexer.scala`,
`Weeder2.scala` and `Resolver.scala` from a Flix checkout.

flix-spec asks for exactly this in `docs/CONFORMANCE.md`:

> Lexical consumers … Its contract is `ast/tokenkind.json` … That exists so lexical consumers stop
> scraping `Lexer.scala` as text. Text scraping cannot be checked against a digest, breaks silently
> when upstream reformats, and has already produced a committed lexicon in this ecosystem
> provenanced to a fork rather than to the pin.

Assert the 159 names and `pin.json.tokenKindDigest` in `check-flix-pin.mjs`. Then an added or
removed `TokenKind` is a hard CI failure **with a name attached** — `ColonColonTight` would have
been caught by that and by nothing else here.

Note this still would not catch the *re-partitioning* of `ColonColon`'s extension on its own; it
catches the added name, which is the signal you need. The digest cannot see that an existing token
now covers less than it did.

### 2b. `ast/annotation.json` now exists, and it is the other half of that scrape

`extract-lexicon.mjs:80` reads the annotation table straight out of
`Weeder2.visitAnnotation` — it locates `private def visitAnnotation`, scans to the fallthrough case,
and parses the names out of the Scala source. That is the same text scraping as (2), applied to a
second vocabulary, and it breaks the same way: upstream reformats the match, the parse yields a
different set, and nothing compares the result to anything.

flix-spec now publishes those names as `ast/annotation.json`, reflected from the pinned jar and
digest-pinned in `pin.json`. Read them from there and assert the digest, exactly as for
`ast/tokenkind.json`.

Two things worth knowing before you do:

- **The grammar rule does not need them, and should stay generic.** `FlixTmLanguage.ts:206` matches
  `(@)([A-Za-z]+)` deliberately, and the comment above it gives the right reason: enumerating names
  is what left the incumbent grammar missing `@Tailrec`, `@Terminates` and six others while carrying
  `@Internal`, which `Weeder2` does not accept. Keep that. The inventory is for provenance and for
  checks, not for the match.
- **The vocabulary is open, so never reject on it.** Java interop annotations lex identically —
  `@TestJvmAnnotation` appears in the Flix corpus on a method of an anonymous JVM class — and
  upstream models exactly that with `Annotation.Error(name, loc)`. flix-spec measures *coverage*
  against this inventory and never validity, and so should you.

For reference, the current vocabulary is 16 names; 13 of them occur in Flix's own 893-file corpus.

### 3. Fix or remove the inert CI step

Either give CI a Flix checkout and run `npm run check:lexicon`, or delete the step. Leaving a gate
that cannot fire is worse than having none, because it reads as coverage.

### 4. Pin the flix-spec checkout to a ref

`.github/workflows/ci.yml` checks out `wstein/flix-spec` with **no `ref:`**, so it tracks whatever
is on that repository's default branch. `check:pin` exits 1 when the two commits differ — meaning
this repository's CI goes red whenever flix-spec's main moves, in pull requests that have nothing to
do with it. Pin the checkout to the release tag this repository declares, and bump that ref as part
of the adoption commit.

### 5. Move the pin

`flix-pin.json` — to `v0.77.0` / `4a5b60a31ac03bb762f68b554a0fc2b6f4d982b9`, together with (1).
