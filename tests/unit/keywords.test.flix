// SYNTAX TEST "source.flix"
//
// Keyword, modifier, and annotation coverage. Regressions for docs/DEFECTS.md.
//
// Fixture lines are indented four spaces so an assertion line's own `//` prefix does
// not overlap the columns it points at. Each fixture holds one construct starting at
// column 4, so every caret run below it spans the whole token.
//
// Negative assertions live in scripts/check-unscoped.mjs, not here: this harness
// compares scopes with exact string equality, so `- keyword` would pass against a token
// scoped `keyword.control.flix` and assert nothing. That script checks the real
// property -- the token carries `source.flix` and nothing else -- and covers the seven
// phantom keywords the incumbent grammar declares.

// --- Keywords the incumbent grammar never scoped (16).
    Array#
//  ^^^^^^ keyword.operator.new.flix

    List#
//  ^^^^^ keyword.operator.new.flix

    Map#
//  ^^^^ keyword.operator.new.flix

    Set#
//  ^^^^ keyword.operator.new.flix

    Vector#
//  ^^^^^^^ keyword.operator.new.flix

    Static
//  ^^^^^^ support.type.builtin.flix

    Univ
//  ^^^^ support.type.builtin.flix

    open_variant
//  ^^^^^^^^^^^^ keyword.operator.word.flix

    open_variant_as
//  ^^^^^^^^^^^^^^^ keyword.operator.word.flix

    restrictable
//  ^^^^^^^^^^^^ storage.type.flix

    rvadd
//  ^^^^^ keyword.operator.word.flix

    rvand
//  ^^^^^ keyword.operator.word.flix

    rvnot
//  ^^^^^ keyword.operator.word.flix

    rvsub
//  ^^^^^ keyword.operator.word.flix

    super
//  ^^^^^ keyword.other.flix

    xor
//  ^^^ keyword.operator.logical.flix

// --- Longest-alternative-first: a prefix keyword must not truncate a longer one.
    choose
//  ^^^^^^ keyword.control.flix

    choose*
//  ^^^^^^^ keyword.control.flix

    forall
//  ^^^^^^ keyword.other.flix

    forA
//  ^^^^ keyword.control.flix

    foreach
//  ^^^^^^^ keyword.control.flix

    instance
//  ^^^^^^^^ storage.type.flix

    instanceof
//  ^^^^^^^^^^ keyword.operator.word.flix

    solve
//  ^^^^^ keyword.control.datalog.flix

    psolve
//  ^^^^^^ keyword.control.datalog.flix

// --- Annotations are matched generically: `@` plus ASCII letters, per
// Lexer.acceptAnnotation and Lexer.isAnnotationChar. Enumerating names is what left the
// incumbent grammar without @Tailrec, @Terminates, and seven others -- and carrying
// @Internal, which Weeder2 does not accept. The last case is deliberately invented: a
// future annotation must be scoped without a grammar change.
    @Tailrec
//  ^^^^^^^^ storage.type.annotation.flix

    @Terminates
//  ^^^^^^^^^^^ storage.type.annotation.flix

    @Export
//  ^^^^^^^ storage.type.annotation.flix

    @Inline
//  ^^^^^^^ storage.type.annotation.flix

    @DontInline
//  ^^^^^^^^^^^ storage.type.annotation.flix

    @CompileTest
//  ^^^^^^^^^^^^ storage.type.annotation.flix

    @DefaultHandler
//  ^^^^^^^^^^^^^^^ storage.type.annotation.flix

    @LoweringTargetDatalog
//  ^^^^^^^^^^^^^^^^^^^^^^ storage.type.annotation.flix

    @LoweringTargetChannel
//  ^^^^^^^^^^^^^^^^^^^^^^ storage.type.annotation.flix

    @NotYetInvented
//  ^^^^^^^^^^^^^^^ storage.type.annotation.flix

// --- `select` stays out of the `.datalog.` bucket: Flix also uses it for channel
// select, so tinting it as Datalog would be wrong more often than right.
    select
//  ^^^^^^ keyword.control.flix
//  ^^^^^^ - keyword.control.datalog.flix
