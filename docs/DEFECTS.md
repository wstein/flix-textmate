# Defects in the incumbent `source.flix` grammar

Findings against
[`flix/textmate@befa883`](https://github.com/flix/textmate/blob/master/syntaxes/flix.tmLanguage.json)
(360 lines, last changed 2025-09-10), measured against the reference compiler in
`flix-fork/main/src/ca/uwaterloo/flix/language/`.

That grammar is what GitHub Linguist vendors — `.gitmodules` maps
`vendor/grammars/textmate` to `https://github.com/flix/textmate.git`, and `grammars.yml`
records it as the sole provider of `source.flix`. So these defects are what renders Flix on
github.com and in every Shiki-based documentation site.

Every defect below is addressed in this grammar. The resolution table at the end says how,
and names the test that would catch a regression.

## Tokenization

| #   | Defect                                                                                                                                                         | Evidence                                                                                    |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1   | `literal_dec` is included before `literal_hex`. Both match at offset 0 on `0x1F`; TextMate breaks the tie by array order, so the decimal rule wins.            | `0x1F` renders as numeric `0` followed by an unscoped `x1F`                                 |
| 2   | The unit-constant rule `\b\(\)\b` can never match: `\b` before `(` needs a preceding word character and `\b` after `)` needs a following one.                  | dead rule                                                                                   |
| 3   | The BigDecimal rule `[0-9]…(ff)?` is listed after `[0-9]…(f32\|f64)?`, which matches the same prefix.                                                          | `1.0ff` scopes `1.0`, leaves `ff` bare                                                      |
| 6   | Block comments do not nest — `begin: /\*`, `end: \*/` closes at the first `*/`.                                                                                | `Lexer.acceptBlockComment` tracks a `level` counter                                         |
| 7   | No doc-comment scope; `///` is folded into `comment.line.double-slash`.                                                                                        | `TokenKind.CommentDoc`; `Lexer.acceptLineOrDocComment` returns it for exactly three slashes |
| 10  | `literal_char` opens on `'` and closes only at the next `'`, anywhere in the file. Its escape scope `constant.character.escape` also omits the `.flix` suffix. | an unpaired apostrophe paints the remainder of the file                                     |
| 12  | No exponent support in numeric literals.                                                                                                                       | `Lexer.acceptNumber` documents `\D([.]\D)?(e([+]\|[-])?\D([.]\D)?)?(i8\|…\|ff)?`            |
| 13  | Digit separators are matched as `[0-9](_*[0-9])*`, which accepts `1__2`.                                                                                       | the lexer's `\D` is `[0-9]+(_[0-9]+)*` — a single underscore between groups                 |

## Missing token classes

None of these are scoped at all:

| Construct        | Token                        | Lexer                           |
| ---------------- | ---------------------------- | ------------------------------- |
| `regex"…"`       | `LiteralRegex`               | `acceptRegex`, dispatch at 309  |
| `d"…"`           | `DebugInterpolator`          | dispatch at 309                 |
| `%%BUILTIN%%`    | `BuiltIn`                    | `acceptBuiltIn`, dispatch 325   |
| math identifiers | `NameMath`, U+2200–U+22FF    | `isMathNameChar`                |
| `?x` / `x?`      | `HoleNamed` / `HoleVariable` | `acceptNamedHole`, `acceptName` |

## Keywords

`Lexer.Keywords` is an 84-entry prefix tree (Lexer.scala:49–137). Counts below are
mechanical: the incumbent grammar's `keywords` and `constants` sections were diffed against
the extracted manifest in `src/typescript/lexicon.generated.ts`.

**Declared but nonexistent (7).** Verified absent — `grep -c '("<kw>",' Lexer.scala` returns
0 for each:

`dbg`, `typematch`, `resume`, `branch`, `jumpto`, `without`, `opaque`

**Present in the lexer but unscoped (16):**

`Array#`, `List#`, `Map#`, `Set#`, `Vector#`, `Static`, `Univ`, `open_variant`,
`open_variant_as`, `restrictable`, `rvadd`, `rvand`, `rvnot`, `rvsub`, `super`, `xor`

The five collection-literal prefixes (`List#{1, 2, 3}`) are keywords in the lexer's table,
not type names followed by `#`.

## Annotations

`Weeder2.visitAnnotation` (Weeder2.scala:608–635) is the authoritative table — 17 entries.
The incumbent hardcodes nine `@`-literals.

**Missing (9):** `@CompileTest`, `@DefaultHandler`, `@DontInline`, `@Export`, `@Inline`,
`@LoweringTargetDatalog`, `@LoweringTargetChannel`, `@Tailrec`, `@Terminates`

**Declared but nonexistent (1):** `@Internal`

Enumerating annotation names in the grammar is the underlying mistake, not the specific
omissions. `Lexer.acceptAnnotation` consumes `@` followed by `isAnnotationChar`, and
`isAnnotationChar` is `isLetter` — ASCII letters only, no digits and no underscore. A single
rule matching `@` plus letters covers every annotation that exists or will exist, and the
17-name table becomes test data rather than grammar.

## Scope hygiene

| #   | Defect                                                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 11a | No `entity.name.function` for `def`, no `entity.name.type` for user-defined types — only for the ten builtin types.                                                                                     |
| 11b | No `punctuation.*` scopes at all.                                                                                                                                                                       |
| 11c | `;` is scoped `keyword.control.semicolon.flix`; it is punctuation, not control flow.                                                                                                                    |
| 11d | `constant.character.escape` and `entity.name.type` omit the `.flix` suffix, so no theme or test can target them as Flix.                                                                                |
| 11e | Stdlib enum cases (`Nil`, `Some`, `None`, `Ok`, `Err`, `LessThan`, `EqualTo`, `GreaterThan`) are scoped `constant.language`, matched in any position, including where the user has bound the same name. |

Defect 11d is prevented structurally here: `ScopeName` in `src/typescript/TmLanguage.ts` is
`` `${string}.flix` ``, so an unsuffixed scope fails to compile.

## Resolution

| #           | How it is addressed here                                                                                                                | Regression test                                                      |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1           | `#number-hex` is included before `#number` in `#literals`                                                                               | `tests/unit/literals.test.flix`                                      |
| 2           | The dead `\b\(\)\b` rule is not carried over; `()` is scoped as two parens                                                              | `tests/snap/declarations.test.flix`                                  |
| 3           | One numeric rule with an optional suffix alternation, so no rule shadows another                                                        | `tests/unit/literals.test.flix`                                      |
| 6           | `#block-comment` includes itself                                                                                                        | `tests/unit/comments.test.flix`                                      |
| 7           | `#doc-comment` matches exactly three slashes; four or more fall to `#line-comment`                                                      | `tests/unit/comments.test.flix`                                      |
| 10          | Every `begin` has a line-anchored `end`, enforced by `scripts/lint-grammar.mjs`                                                         | `tests/unit/literals.test.flix`, `scripts/audit-corpus.mjs`          |
| 12          | Exponents follow the grammar documented on `Lexer.acceptNumber`                                                                         | `tests/unit/literals.test.flix`                                      |
| 13          | `DIGITS` is `[0-9]+(_[0-9]+)*`                                                                                                          | `scripts/check-unscoped.mjs` (`1__2`)                                |
| 8           | `regex"…"`, `d"…"`, `%%…%%`, math names, and all three hole forms have rules                                                            | `tests/unit/literals.test.flix`, `tests/unit/declarations.test.flix` |
| Keywords    | Extracted from `Lexer.Keywords` and mapped with `Record<Keyword, ScopeName>`, so an invented or unclassified keyword is a compile error | `tests/unit/keywords.test.flix`, `scripts/check-unscoped.mjs`        |
| Annotations | One generic rule over `@` plus ASCII letters, so the name list is test data rather than grammar                                         | `tests/unit/keywords.test.flix`                                      |
| 11a         | `entity.name.function.flix` and `entity.name.type.flix` are assigned positionally                                                       | `tests/unit/declarations.test.flix`                                  |
| 11b         | A full `punctuation.*` set                                                                                                              | `tests/unit/declarations.test.flix`                                  |
| 11c         | `;` is `punctuation.terminator.flix`                                                                                                    | `tests/unit/declarations.test.flix`                                  |
| 11d         | `ScopeName` is `` `${string}.flix` `` — unsuffixed scopes do not compile                                                                | `npm run typecheck`                                                  |
| 11e         | Library constructors are not scoped at all; only `Resolver`'s structural types are                                                      | `docs/SCOPES.md` records the reasoning                               |

Two further corrections were found while implementing, both verified against `Parser2`:

- The incumbent scopes `\` as `keyword.arrow.function` / struct-arrow handling only, and has
  no rule for the type/effect separator. `\` is the effect separator in
  `Type.typeAndEffect` (`def f(): t \ ef`); Flix lambdas are written `x -> e`, so there is no
  lambda backslash in the language at all.
- `!` and `$` belong to both `Lexer.isUserOp` and `Lexer.isNameChar`. The lexer resolves the
  overlap by position, so `let!` and `def$` are single names while a leading `!` or `$` is an
  operator. Both this grammar and the incumbent would otherwise split them.
