// SYNTAX TEST "source.flix"
//
// The Datalog sub-language and the effect separator.
//
// The `.datalog.` scope segment is the grammar's one deliberate departure from the
// standard VS Code taxonomy. It is applied only to forms with no second meaning in Flix.

    let rules = #{ Path(x) :- Edge(x). };
//              ^^ punctuation.section.datalog.begin.flix
//                         ^^ keyword.operator.datalog.flix

    let m = a <+> b
//            ^^^ keyword.operator.datalog.flix

    let lam = #(x) -> x
//            ^^ punctuation.section.datalog.begin.flix

// --- `\` separates a type from its effect set (Type.typeAndEffect). It is not a lambda:
// Flix lambdas are written `x -> e`.

    def f(): Int32 \ IO = 1
//                 ^ keyword.operator.effect.flix

// --- A bare `#` before a lowercase name is a record select, not a Datalog form
// (Parser2: `case TokenKind.Hash if nth(1) == TokenKind.NameLowercase`).

    let r = person#name
//                ^ punctuation.accessor.flix
//                 ^^^^ variable.other.member.flix
//                ^ - punctuation.section.datalog.begin.flix

// --- Tight `->` before a lowercase name is a struct get or put.

    let s = node->value
//              ^^ keyword.operator.accessor.flix
//                ^^^^^ variable.other.member.flix

// --- `#| ... |#` is an extensible type, despite the leading `#`.

    type alias Row = #| A |#
//                   ^^ punctuation.section.extensible.begin.flix
//                        ^^ punctuation.section.extensible.end.flix
