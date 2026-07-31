// SYNTAX TEST "source.flix"
//
// Declarations, names, types, and operators. Regressions for docs/DEFECTS.md #11a-#11d.
//
// Declaration rules are positional, not heuristic: the scope of a name is fixed by the
// keyword introducing it, which is the same distinction Parser2 makes. Expression-position
// identifiers are deliberately left bare for the LSP's semantic tokens.

// --- Defect #11a: the incumbent has no entity.name.function and no entity.name.type
// for user-declared types.

    pub def add(x: Int32): Int32 = x
//  ^^^ storage.modifier.flix
//      ^^^ storage.type.flix
//          ^^^ entity.name.function.flix
//                 ^^^^^ support.type.primitive.flix

    def >>(f: a): b = f
//  ^^^ storage.type.flix
//      ^^ entity.name.function.flix

    law reflexivity: Bool
//  ^^^ storage.type.flix
//      ^^^^^^^^^^^ entity.name.function.flix

    enum Shape { case Circle }
//  ^^^^ storage.type.flix
//       ^^^^^ entity.name.type.flix

    struct Node[r] { v: Int32 }
//  ^^^^^^ storage.type.flix
//         ^^^^ entity.name.type.flix

    trait Eq[a]
//  ^^^^^ storage.type.flix
//        ^^ entity.name.type.flix

    eff Console
//  ^^^ storage.type.flix
//      ^^^^^^^ entity.name.type.flix

    instance Eq[Shape]
//  ^^^^^^^^ storage.type.flix
//           ^^ entity.name.type.flix

    mod Foo.Bar.Baz
//  ^^^ storage.type.flix
//      ^^^^^^^^^^^ entity.name.namespace.flix

    type alias Grid = Int32
//  ^^^^ storage.type.flix
//       ^^^^^ storage.type.flix
//             ^^^^ entity.name.type.flix

// --- The `->` split is whitespace-sensitive, per Lexer.scanToken: `a->b` is
// ArrowThinRTight (struct field access), every spaced form is ArrowThinRWhitespace
// (the function arrow).

    let p = person->name
//                ^^ keyword.operator.accessor.flix
//                ^^ - keyword.operator.arrow.flix

    let q = person -> name
//                 ^^ keyword.operator.arrow.flix
//                 ^^ - keyword.operator.accessor.flix

// --- Defect #11c: the incumbent scopes `;` as keyword.control.semicolon.

    let x = 1;
//           ^ punctuation.terminator.flix
//           ^ - keyword.control.flix

// --- Math identifiers are ordinary names, per Lexer.isMathNameChar (U+2200-U+22FF).

    let ⊆ = 1
//      ^ variable.other.math.flix

// --- `$name` escapes a name that would otherwise lex as a keyword.

    let $mod = 1
//      ^ punctuation.definition.variable.flix
//       ^^^ variable.other.escaped.flix

    let _ = 1
//      ^ variable.language.wildcard.flix

// --- `/` is TokenKind.Slash, a real operator. Lexer.isUserOp excludes it only so that
// `//` can begin a comment, so it needs a rule of its own.

    let q = a / b
//            ^ keyword.operator.flix

// --- Lexer accepts a fixed operator spelling only when no further operator character
// follows (advanceIfInTree(Operators, c => !isUserOp(c))). A user-defined operator that
// merely starts with a known spelling must not be split.

    a->>b
//   ^^^ keyword.operator.flix
//   ^^^ - keyword.operator.accessor.flix

    x <+>> y
//    ^^^^ keyword.operator.flix
//    ^^^^ - keyword.operator.datalog.flix

// --- A bare `@` is TokenKind.At, the region operator in `new Struct @ rc {}`
// (Parser2.regionName) -- not annotation punctuation.

    new Struct @ rc {}
//             ^ keyword.operator.flix
//             ^ - punctuation.definition.annotation.flix

// --- A leading `_` is part of the hole name: Lexer.scanToken routes `_` followed by a
// name character into acceptName, which returns HoleVariable on the trailing `?`.

    _x?
//  ^^^ constant.language.hole.flix

// --- Lexer.scanToken's `_` case peeks at the next character and routes into acceptName,
// acceptMathName, or acceptUserDefinedOp, so a leading underscore belongs to the token.
// Found by scripts/check-token-boundaries.mjs against tree-sitter-flix.

    def _>==>(x: a): a = x
//      ^^^^^ entity.name.function.flix

    let _⊆ = 1
//      ^^ variable.other.math.flix

// --- `$name` is an escaped name (Lexer.acceptEscapedName). A definition may be named by
// one; Java interop overrides such as `$run` rely on it.

    def $run(): Unit = ()
//      ^^^^ entity.name.function.flix
