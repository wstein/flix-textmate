# Defects in the incumbent `source.flix` grammar

Findings against
[`flix/textmate@befa883`](https://github.com/flix/textmate/blob/master/syntaxes/flix.tmLanguage.json)
(360 lines, last changed 2025-09-10), measured against the reference compiler in
`flix-fork/main/src/ca/uwaterloo/flix/language/`.

That grammar is what GitHub Linguist vendors — `.gitmodules` maps
`vendor/grammars/textmate` to `https://github.com/flix/textmate.git`, and `grammars.yml`
records it as the sole provider of `source.flix`. So these defects are what renders Flix on
github.com and in every Shiki-based documentation site.

Each entry names the rule that fixes it once implemented, and each has a regression test.

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

`Lexer.Keywords` is a 78-entry prefix tree (Lexer.scala:49–137). Against it:

**Declared but nonexistent (7).** Verified absent — `grep -c '("<kw>",' Lexer.scala` returns
0 for each:

`dbg`, `typematch`, `resume`, `branch`, `jumpto`, `without`, `opaque`

**Present in the lexer but unscoped (11):**

`Static`, `Univ`, `open_variant`, `open_variant_as`, `restrictable`, `rvadd`, `rvand`,
`rvnot`, `rvsub`, `super`, `xor`

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
