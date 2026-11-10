# Lexical source contract

The Flix 0.79.0 compiler at `36d923ca325dc466b28c63419667e6026a80f920`
is the source of the committed lexical inventory. `FLIX_COMPILER.revision` in
`scripts/external-checkout.mjs` is the executable authority; there is no second
`flix-pin.json` declaration to update independently.

`npm run check:pin`, included in lint and verify, checks that the generated
lexicon carries exactly one full source SHA matching that authority. External
source checks also verify the checkout's actual Git HEAD. CI checks out that
exact compiler revision and runs `npm run check:lexicon`, regenerating before
comparing the file. Neither check compiles the compiler. To change the source,
update the authority, regenerate from the matching checkout, and review the
inventory and grammar tests together.

CI also checks the independently maintained `pin.json` from flix-spec commit
`821d89625717e2789118b0fdb34040ddc649d1cc`. Its `upstream.commit` must equal the
compiler authority and the lexicon stamp. The producer revision is a separate
input, not another local compiler declaration; update it deliberately when the
source contract changes. CI fetches only this metadata and runs no spec build.
Locally, `npm run check:pin -- --flix-spec <checkout>` (or `FLIX_SPEC`) preserves
the branch's optional cross-repository check. `--spec-pin <pin.json>` or
`FLIX_SPEC_PIN` accepts a metadata file directly. Without either input, the command
reports that cross-repository equality was not checked; a configured unreadable,
malformed, incomplete, or mismatched pin fails.

## Scope of the vocabulary

The generator reads spelling tables from `Lexer.scala`, annotation names from
`Weeder2.scala`, and primitive type names from `Resolver.scala`. It does not
consume flix-spec inventories or claim tree, token-kind, or diagnostic
conformance. The only flix-spec CI input is its independently pinned source
metadata, which checks compiler identity rather than vocabulary semantics.

The `law` and `lawful` keywords were removed in Flix 0.75.2. Their removal and
the absent `Export` annotation are already reflected in the 0.79 inventory and tests. The annotation rule stays
open: `@` followed by ASCII letters receives annotation scopes, including Java
interop and unknown names. An accepted-name inventory measures coverage and
cannot establish annotation validity.

## Open concepts

The earlier 0.77 analysis proposed consuming digest-pinned flix-spec token-kind,
annotation, and retired-kind inventories. These remain unimplemented concepts;
there is no vocabulary digest gate here. A source SHA identifies inputs, but
does not explain additions, removals, or the repartitioning of an existing kind.
Even an unchanged digest cannot establish unchanged token semantics.

Tight `::` and spaced `::` have different compiler token kinds. The grammar uses
the same colon separator scope for both. Distinguishing their visual roles needs
explicit namespace and list-cons fixtures and a scope design decision; this port
does not claim such a change. Table scraping alone cannot detect dispatch rules
outside the tables, such as tightness distinctions.

If a future consumer emits flix-spec diagnostics, compare lexer/Parser2 errors
only; Weeder validation belongs to a different phase. This grammar currently
emits no diagnostic projection. Any future defect ratchet should record the
source pin it was reviewed against, rather than expire merely as time passes.
