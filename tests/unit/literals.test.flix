// SYNTAX TEST "source.flix"
//
// Literal coverage. Regressions for docs/DEFECTS.md.
//
// Fixture lines are indented four spaces; each holds one construct starting at column 4.
// Cases that must receive NO scope live in scripts/check-unscoped.mjs, because this
// harness compares scopes with exact string equality.

// --- Defect #1: the incumbent includes literal_dec before literal_hex, and both match
// at offset 0 of `0x1F`. TextMate breaks the tie by array order, so hex must come first.
    0x1F
//  ^^^^ constant.numeric.hex.flix

    0xDEAD_BEEF
//  ^^^^^^^^^^^ constant.numeric.hex.flix

    0xFFi64
//  ^^^^^^^ constant.numeric.hex.flix

// --- Defect #3: the incumbent's BigDecimal rule is shadowed by the f32/f64 rule listed
// above it, so the `ff` suffix is left unscoped. The caret run spans the whole literal.
    1.0ff
//  ^^^^^ constant.numeric.flix

    42ii
//  ^^^^ constant.numeric.flix

    7i8
//  ^^^ constant.numeric.flix

    3.14f32
//  ^^^^^^^ constant.numeric.flix

// --- Defect #12: the incumbent has no exponent support at all, so `2.1e4` renders as
// the number `2` followed by an unscoped `.1e4`. Grammar per Lexer.acceptNumber:
// \D([.]\D)?(e([+]|[-])?\D([.]\D)?)?(i8|i16|i32|i64|ii|f32|f64|ff)?
    2.1e4
//  ^^^^^ constant.numeric.flix

    1.5e-3f32
//  ^^^^^^^^^ constant.numeric.flix

    6e+9
//  ^^^^ constant.numeric.flix

    1_000_000i64
//  ^^^^^^^^^^^^ constant.numeric.flix

// --- Defect #8: token classes the incumbent does not scope at all.
    %%ARRAY_LOAD%%
//  ^^^^^^^^^^^^^^ support.function.builtin.flix

    ???
//  ^^^ constant.language.hole.flix

    ?namedHole
//  ^^^^^^^^^^ constant.language.hole.flix

    varHole?
//  ^^^^^^^^ constant.language.hole.flix

// --- Defect #8 continued: regex and debug string literals.

    regex"a*b"
//  ^^^^^ keyword.other.regexp.flix
//       ^ punctuation.definition.string.begin.flix
//        ^^^^ string.regexp.flix
//           ^ punctuation.definition.string.end.flix

    d"debug"
//  ^ keyword.other.debug.flix
//   ^ punctuation.definition.string.begin.flix
//    ^^^^^^ string.quoted.double.flix

// --- Interpolation. Lexer.acceptString requires the `$` to be unescaped, and
// Lexer.acceptStringInterpolation counts nested braces.

    "value: ${x}!"
//  ^ punctuation.definition.string.begin.flix
//          ^ punctuation.definition.template-expression.begin.flix
//           ^ punctuation.definition.template-expression.begin.flix
//            ^ meta.embedded.line.flix
//             ^ punctuation.definition.template-expression.end.flix
//               ^ punctuation.definition.string.end.flix

    "nested ${ {1} } here"
//          ^ punctuation.definition.template-expression.begin.flix
//                 ^ punctuation.definition.template-expression.end.flix
//                  ^^^^^ string.quoted.double.flix

    "escaped \${literal}"
//           ^^ constant.character.escape.flix
//             ^^^^^^^^^ string.quoted.double.flix
//             ^^^^^^^^^ - meta.embedded.line.flix

// --- Defect #10: a delimiter left open must not paint the rest of the file.
// Lexer.acceptString returns UnterminatedString on `\n`, so strings are single-line.

    let s = "unterminated
//          ^ punctuation.definition.string.begin.flix
    def stillHighlighted(): Int32 = 1
//  ^^^ storage.type.flix
//                                  ^ constant.numeric.flix

    let c = 'x
//          ^ punctuation.definition.string.begin.flix
    def alsoHighlighted(): Int32 = 2
//  ^^^ storage.type.flix
//                                 ^ constant.numeric.flix

// --- Defect #11d: escape scopes carry the `.flix` suffix. The incumbent emits a bare
// `constant.character.escape`, which no theme or test can target as Flix.

    "a \n b ÿ c"
//     ^^ constant.character.escape.flix
//        ^^^^^^^ string.quoted.double.flix
//        ^^^^^^^ - constant.character.escape.flix

// --- An apostrophe inside a comment must not open a char literal.

    // don't panic
//  ^^^^^^^^^^^^^^ comment.line.double-slash.flix
//  ^^^^^^^^^^^^^^ - string.quoted.single.flix
