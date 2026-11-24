# Upstream contribution draft (not submitted)

**Status:** local draft for the maintainer. Do **not** open an issue or PR on
[`flix/textmate`](https://github.com/flix/textmate) until you decide to.

This package is shaped as a drop-in replacement for that repository: same path
(`syntaxes/flix.tmLanguage.json`), same `scopeName` (`source.flix`), same
non-standard `copyright_notice` / `license` keys. GitHub Linguist vendors
`flix/textmate`, so a successful upstream swap updates colouring on github.com
and every Shiki consumer that follows Linguist.

## Should we contribute?

**Recommendation: yes, after a fresh defect re-audit against current
`flix/textmate` tip — then open a short issue and a JSON-only PR.**

Reasons to contribute:

- Linguist and Shiki still depend on `flix/textmate`, not this npm package.
- This grammar is generated from the Flix lexer inventory, with regression
  tests, open-rule audit gates, and an independent tree-sitter boundary check.
- The artifact is already upstream-shaped.

Caveats before filing:

- [`docs/DEFECTS.md`](DEFECTS.md) was measured against
  [`flix/textmate@befa883`](https://github.com/flix/textmate/blob/befa883ecec4b0c84e436bdd176dec5475e584ab/syntaxes/flix.tmLanguage.json)
  (2025-09-10). Upstream has since landed keyword resync, function/type
  scoping, and a README (Magnus Madsen, 2026-08-09). Some listed defects may
  already be fixed or narrowed.
- Re-diff `syntaxes/flix.tmLanguage.json` (this repo, v0.1.2) against
  `flix/textmate@master` and refresh the defect table before citing it in an
  issue. Do not paste the September baseline as current fact.
- Prefer a **JSON-only** PR to `flix/textmate` (replace
  `syntaxes/flix.tmLanguage.json`). Keep the TypeScript source and gates here
  unless upstream asks to adopt the generator.

## Issue text (draft)

```markdown
## Summary

Proposal to replace `syntaxes/flix.tmLanguage.json` with a lexer-derived
grammar that keeps the same `scopeName` (`source.flix`) and Linguist-facing
metadata.

## Motivation

`flix/textmate` is what GitHub Linguist vendors for Flix highlighting. The
grammar has drifted from `Lexer.scala` / `TokenKind.scala` in places (hex vs
decimal rule order, nested block comments, missing token classes such as
`regex"…"`, invented or missing keywords historically, annotation hardcoding,
and several scope-hygiene issues). A maintained replacement lives at
https://github.com/wstein/flix-textmate (npm: `flix-textmate`, Apache-2.0).

That project:

- extracts keywords/operators from the pinned Flix compiler
- emits the same file name and non-standard copyright/license keys
- gates open rules on a large Flix corpus and token boundaries against
  tree-sitter-flix

## Proposal

1. Replace `syntaxes/flix.tmLanguage.json` with the published artifact from
   wstein/flix-textmate (pin a release tag such as v0.1.2).
2. Keep maintenance of the TypeScript source in wstein/flix-textmate unless
   you prefer to import the generator here later.
3. Optionally link the replacement from this README under “Keeping it in sync”.

## Defect evidence

See the defect catalogue in the replacement repo (refresh against current
master before merge):
https://github.com/wstein/flix-textmate/blob/main/docs/DEFECTS.md

## Decision

I can open a PR that only updates the JSON if that is welcome.
```

## PR text (draft for `flix/textmate`)

```markdown
## Summary

Replace `syntaxes/flix.tmLanguage.json` with the lexer-derived grammar from
[wstein/flix-textmate@v0.1.2](https://github.com/wstein/flix-textmate/releases/tag/v0.1.2).

Same `scopeName`, file path, and copyright/license keys so Linguist and Shiki
consumers keep working without path changes.

## Why

Fixes remaining drift from `Lexer.scala` (see linked issue and
wstein/flix-textmate `docs/DEFECTS.md`, re-audited against this tip).

## Test plan

- [ ] Spot-check Flix snippets on a Linguist preview / Shiki playground
- [ ] Confirm keywords track current `Lexer.Keywords`
- [ ] Confirm no file-wide paint from unpaired `'` (line-anchored ends)

Closes #<issue>
```

## Checklist before you submit

1. Refresh `docs/DEFECTS.md` (or a short delta) against `flix/textmate` tip.
2. Decide: issue first (preferred) vs drive-by PR.
3. Open the PR from a fork of `flix/textmate` with **only** the JSON (and
   README link if requested).
4. Do not transfer CI, npm packaging, or this repository’s TypeScript tree
   unless upstream asks.
