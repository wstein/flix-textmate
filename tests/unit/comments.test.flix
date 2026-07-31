// SYNTAX TEST "source.flix"
//
// Fixture lines are indented so that an assertion line's own `//` prefix does not
// overlap the columns it points at.
//
// Reference: Lexer.acceptLineOrDocComment counts the slashes following the leading
// `//`; exactly one more makes a doc comment. Lexer.acceptBlockComment tracks a
// nesting level, so block comments nest.

    // a plain line comment
//  ^^ punctuation.definition.comment.flix
//    ^^^^^^^^^^^^^^^^^^^^^ comment.line.double-slash.flix
//    ^^^^^^^^^^^^^^^^^^^^^ - comment.line.documentation.flix

    /// a doc comment
//  ^^^ punctuation.definition.comment.flix
//     ^^^^^^^^^^^^^^ comment.line.documentation.flix
//     ^^^^^^^^^^^^^^ - comment.line.double-slash.flix

    //// four slashes
//  ^^^^ punctuation.definition.comment.flix
//      ^^^^^^^^^^^^^ comment.line.double-slash.flix
//      ^^^^^^^^^^^^^ - comment.line.documentation.flix

    /* a block comment */
//  ^^ punctuation.definition.comment.begin.flix
//    ^^^^^^^^^^^^^^^^^ comment.block.flix
//                     ^^ punctuation.definition.comment.end.flix

    /* outer /* inner */ still outer */
//  ^^ punctuation.definition.comment.begin.flix
//           ^^ punctuation.definition.comment.begin.flix
//                    ^^ punctuation.definition.comment.end.flix
//                        ^^^^^^^^^^^^^ comment.block.flix
//                                   ^^ punctuation.definition.comment.end.flix

    /* a block comment
//  ^^ punctuation.definition.comment.begin.flix
       that spans lines
//     ^^^^^^^^^^^^^^^^ comment.block.flix
       and closes here */
//                     ^^ punctuation.definition.comment.end.flix
