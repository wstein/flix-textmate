# Scopes

The scopes this grammar assigns, and why each one is what it is.

Scope names are a **contract**. Once a theme keys off `keyword.control.datalog.flix`, that
name cannot be changed without breaking it, so precision that nobody needs is not free — it
is API that cannot be withdrawn. The taxonomy below is therefore the mainstream VS Code one,
so a Flix file colours like any other language under a stock theme, with exactly one
deliberate extension.

Every scope ends in `.flix`. That is enforced by the type system, not by review: `ScopeName`
in `src/typescript/TmLanguage.ts` is `` `${string}.flix` ``, so an unsuffixed scope fails to
compile. The grammar this replaces emits a bare `constant.character.escape` and a bare
`entity.name.type`, which no theme or test can target as Flix.

## The one extension: `.datalog.`

Flix's Datalog fragment is a genuine sub-language, and a documentation site may reasonably
want to tint it. Two scopes carry the segment:

| Scope                           | Applies to                                                       |
| ------------------------------- | ---------------------------------------------------------------- |
| `keyword.control.datalog.flix`  | `solve`, `psolve`, `query`, `pquery`, `inject`, `project`, `fix` |
| `keyword.operator.datalog.flix` | `:-`, `<+>`                                                      |

Both fall back to `keyword.control` and `keyword.operator` in themes that do not know the
segment, so the extension costs nothing to anyone who ignores it.

**What is deliberately excluded** matters as much. These read as Datalog but carry a second
meaning, so tinting them would be wrong more often than right:

- `select` — Flix also uses it for channel select.
- `where`, `with` — both appear in trait and instance constraints.
- `from`, `into` — kept neutral for consistency with the above.
- The constraint terminator `.` — indistinguishable from a qualified-name separator without
  tracking whether a constraint is open, which a regex stack machine cannot do.

## Keywords

All 84 keywords in `Lexer.Keywords` are classified in `KEYWORD_SCOPES`, typed
`Record<Keyword, ScopeName>`. A keyword added to or removed from Flix becomes a compile
error until it is classified.

| Scope                              | Keywords                                                                                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `storage.type.flix`                | `def` `redef` `enum` `struct` `trait` `instance` `eff` `law` `type` `alias` `mod` `restrictable` `let`                                           |
| `storage.modifier.flix`            | `pub` `sealed` `lawful` `mut`                                                                                                                    |
| `keyword.control.conditional.flix` | `if` `else`                                                                                                                                      |
| `keyword.control.flix`             | `match` `ematch` `choose` `choose*` `case` `try` `catch` `throw` `yield` `foreach` `forA` `forM` `spawn` `par` `run` `handler` `region` `select` |
| `keyword.control.import.flix`      | `use` `import`                                                                                                                                   |
| `keyword.operator.logical.flix`    | `not` `and` `or` `xor`                                                                                                                           |
| `keyword.operator.word.flix`       | `as` `instanceof` `open_variant` `open_variant_as` `rvadd` `rvand` `rvnot` `rvsub`                                                               |
| `keyword.operator.cast.flix`       | `checked_cast` `checked_ecast` `unchecked_cast` `unsafe`                                                                                         |
| `keyword.operator.new.flix`        | `new` `Array#` `List#` `Map#` `Set#` `Vector#`                                                                                                   |
| `keyword.other.flix`               | `forall` `where` `with` `from` `into` `lazy` `force` `discard` `super` `xvar` `static`                                                           |
| `constant.language.boolean.flix`   | `true` `false`                                                                                                                                   |
| `constant.language.null.flix`      | `null`                                                                                                                                           |
| `support.type.builtin.flix`        | `Static` `Univ`                                                                                                                                  |

Notes on the less obvious placements:

- **`let` is `storage.type`**, not `keyword`. This follows the TypeScript and Rust grammars,
  where `let`/`const` are `storage.type.*`, and it is what makes binders read as declarations
  under a stock theme.
- **`Static` and `Univ` are types.** Both are in `Parser2`'s `NAME_TYPE` / `TYPE_CONSTANT`
  sets. `Static` also appears in expression position (`Parser2.staticExpr`), which TextMate
  cannot distinguish; type is the more common reading.
- **Lowercase `static` is `keyword.other`.** It is in `Lexer.Keywords` but never referenced
  anywhere in `Parser2` — reserved but unused.
- **The collection prefixes are `keyword.operator.new`.** `List#` in `List#{1, 2, 3}` is one
  keyword in the lexer's table, not the type `List` followed by `#`.

## Keyword boundaries

Keyword rules use explicit lookaround over `Lexer.isNameChar` (`[A-Za-z0-9_!$]`), never `\b`.
`Lexer.acceptIfKeyword` accepts a keyword only when the next character is not a name
character, so `let!`, `def$`, and `case_` are each a single name. A `\b` boundary gets this
wrong in both directions, because `!` and `$` are not word characters.

Alternatives within a rule are sorted longest-first: Oniguruma alternation returns the first
match, not the longest, so `choose` before `choose*` would leave the `*` unscoped.

## Comments

`Lexer.acceptLineOrDocComment` counts the slashes after the leading `//`: exactly one more
makes a doc comment, so `///` is documentation but `////` is not. The grammar this replaces
folds every `///` line into `comment.line.double-slash`, which is why a doc comment scope
exists here at all.

| Scope                                       | Applies to                            |
| ------------------------------------------- | ------------------------------------- |
| `comment.line.double-slash.flix`            | `//`, and `////` or longer            |
| `comment.line.documentation.flix`           | exactly `///`                         |
| `comment.block.flix`                        | `/* … */`, which nests                |
| `punctuation.definition.comment.flix`       | the leading slashes of a line comment |
| `punctuation.definition.comment.begin.flix` | `/*`                                  |
| `punctuation.definition.comment.end.flix`   | `*/`                                  |

## Literals

| Scope                            | Applies to                                          |
| -------------------------------- | --------------------------------------------------- |
| `constant.numeric.flix`          | decimal and float literals, all suffixes, exponents |
| `constant.numeric.hex.flix`      | `0x…`, matched **before** the decimal rule          |
| `string.quoted.double.flix`      | `"…"` and `d"…"`                                    |
| `string.quoted.single.flix`      | `'…'`                                               |
| `string.regexp.flix`             | `regex"…"`                                          |
| `constant.character.escape.flix` | `\…`, with `\uXXXX` kept whole                      |
| `support.function.builtin.flix`  | `%%ARRAY_LOAD%%` and the other intrinsics           |
| `constant.language.hole.flix`    | `???`, `?name`, `name?`                             |
| `storage.type.annotation.flix`   | `@` followed by ASCII letters                       |

Annotations are matched generically rather than enumerated. `Lexer.acceptAnnotation` accepts
`@` plus `isAnnotationChar`, and `isAnnotationChar` is `isLetter` — ASCII only, no digits and
no underscore. Enumerating names is what left the previous grammar without `@Tailrec`,
`@Terminates`, `@Export` and six others while carrying `@Internal`, which `Weeder2` rejects.

A literal that the lexer would reject receives **no scope at all** rather than
`invalid.illegal`. `32q` is one erroneous token to the lexer, and painting it red would risk
false positives on valid code that TextMate cannot verify.

## Names and types

| Scope                             | Applies to                                                                                |
| --------------------------------- | ----------------------------------------------------------------------------------------- |
| `entity.name.function.flix`       | the name after `def`, `redef`, `law`                                                      |
| `entity.name.type.flix`           | the name after `enum`, `struct`, `trait`, `eff`, `instance`, `restrictable`, `type alias` |
| `entity.name.namespace.flix`      | the qualified name after `mod`                                                            |
| `support.type.primitive.flix`     | the 21 names in `Resolver`'s `// Basic Types` table                                       |
| `variable.other.member.flix`      | the field in `x#field` and `x->field`                                                     |
| `variable.other.math.flix`        | identifiers in U+2200–U+22FF                                                              |
| `variable.other.escaped.flix`     | `$name`                                                                                   |
| `variable.language.wildcard.flix` | `_`                                                                                       |

**Expression-position identifiers are deliberately left bare.** TextMate cannot tell a call
from a constructor from a variable without a parser, and the LSP's semantic tokens layer over
this grammar to supply exactly that. The corpus audit reports roughly a third of
non-whitespace characters unscoped for this reason; that number is a ratchet, not a target.

Library constructors — `Some`, `None`, `Ok`, `Err`, `Nil`, `LessThan` — are **not** scoped.
The previous grammar marks them `constant.language`, matched in any position, including where
the user has bound the same name. Primitive types are different: `Resolver` resolves them
structurally, before any name lookup, so they cannot be shadowed.

## Operators and punctuation

| Scope                                             | Applies to                                               |
| ------------------------------------------------- | -------------------------------------------------------- |
| `keyword.operator.flix`                           | user-defined operator runs over `Lexer.isUserOp`         |
| `keyword.operator.arrow.flix`                     | `->` with whitespace on either side — the function arrow |
| `keyword.operator.accessor.flix`                  | tight `->` — struct field access                         |
| `keyword.operator.effect.flix`                    | `\`, the type/effect separator                           |
| `punctuation.section.braces/parens/brackets.flix` | `{}`, `()`, `[]`                                         |
| `punctuation.section.datalog.begin.flix`          | `#{`, `#(`                                               |
| `punctuation.section.extensible.begin/end.flix`   | `#\|`, `\|#`                                             |
| `punctuation.separator.comma/colon.flix`          | `,` and the colon family                                 |
| `punctuation.terminator.flix`                     | `;`                                                      |
| `punctuation.accessor.flix`                       | `.` and the `#` of a record select                       |

The `->` split is whitespace-sensitive, from `Lexer.scanToken`: only `a->b` is
`ArrowThinRTight` (field access); `a -> b`, `a ->b`, and `a-> b` are all the function arrow.

`\` is the **effect separator** (`Type.typeAndEffect`, as in `def f(): t \ ef`), not a
lambda — Flix lambdas are written `x -> e`.

`;` is `punctuation.terminator`, not `keyword.control.semicolon` as the previous grammar has
it.

## Structural invariants

Enforced by `scripts/lint-grammar.mjs` and `scripts/audit-corpus.mjs`:

- Every `begin` rule has a line-anchored `end`, except those listed in `ALLOWED_MULTILINE`
  with a reason. `Lexer.acceptString` returns `UnterminatedString` on a newline, so strings
  really are single-line; for chars this is a documented deviation, since honouring the
  lexer's unbounded scan would let one stray apostrophe paint the rest of the file.
- No file in the corpus may end with a rule still open. Currently zero across 890 files.

## Complete scope index

Every scope the grammar emits. `scripts/check-scopes-documented.mjs` fails if one is missing
from this document, because a scope absent from the contract is one a theme author cannot
discover.

| Scope                                                   |
| ------------------------------------------------------- |
| `comment.block.flix`                                    |
| `comment.line.documentation.flix`                       |
| `comment.line.double-slash.flix`                        |
| `constant.character.escape.flix`                        |
| `constant.language.boolean.flix`                        |
| `constant.language.hole.flix`                           |
| `constant.language.null.flix`                           |
| `constant.numeric.flix`                                 |
| `constant.numeric.hex.flix`                             |
| `entity.name.function.flix`                             |
| `entity.name.namespace.flix`                            |
| `entity.name.type.flix`                                 |
| `keyword.control.conditional.flix`                      |
| `keyword.control.datalog.flix`                          |
| `keyword.control.flix`                                  |
| `keyword.control.import.flix`                           |
| `keyword.operator.accessor.flix`                        |
| `keyword.operator.arrow.flix`                           |
| `keyword.operator.cast.flix`                            |
| `keyword.operator.datalog.flix`                         |
| `keyword.operator.effect.flix`                          |
| `keyword.operator.flix`                                 |
| `keyword.operator.logical.flix`                         |
| `keyword.operator.new.flix`                             |
| `keyword.operator.word.flix`                            |
| `keyword.other.debug.flix`                              |
| `keyword.other.flix`                                    |
| `keyword.other.regexp.flix`                             |
| `meta.embedded.line.flix`                               |
| `punctuation.accessor.flix`                             |
| `punctuation.definition.annotation.flix`                |
| `punctuation.definition.builtin.begin.flix`             |
| `punctuation.definition.builtin.end.flix`               |
| `punctuation.definition.comment.begin.flix`             |
| `punctuation.definition.comment.end.flix`               |
| `punctuation.definition.comment.flix`                   |
| `punctuation.definition.infix.flix`                     |
| `punctuation.definition.string.begin.flix`              |
| `punctuation.definition.string.end.flix`                |
| `punctuation.definition.template-expression.begin.flix` |
| `punctuation.definition.template-expression.end.flix`   |
| `punctuation.definition.variable.flix`                  |
| `punctuation.section.braces.flix`                       |
| `punctuation.section.brackets.flix`                     |
| `punctuation.section.datalog.begin.flix`                |
| `punctuation.section.extensible.begin.flix`             |
| `punctuation.section.extensible.end.flix`               |
| `punctuation.section.parens.flix`                       |
| `punctuation.separator.colon.flix`                      |
| `punctuation.separator.comma.flix`                      |
| `punctuation.terminator.flix`                           |
| `storage.modifier.flix`                                 |
| `storage.type.annotation.flix`                          |
| `storage.type.flix`                                     |
| `string.quoted.double.flix`                             |
| `string.quoted.single.flix`                             |
| `string.regexp.flix`                                    |
| `support.function.builtin.flix`                         |
| `support.type.builtin.flix`                             |
| `support.type.primitive.flix`                           |
| `variable.language.wildcard.flix`                       |
| `variable.other.escaped.flix`                           |
| `variable.other.math.flix`                              |
| `variable.other.member.flix`                            |
