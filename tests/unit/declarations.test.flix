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
