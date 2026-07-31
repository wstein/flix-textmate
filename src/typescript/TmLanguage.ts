/**
 * Hand-rolled TypeScript model of the TextMate language-grammar format.
 *
 * Mirrors `src/schemas/tmlanguage.json`, which the emitter validates against at build
 * time. The schema is the authority on what is *legal*; this file is the authority on
 * what is *ergonomic*, and it adds one constraint the schema cannot express:
 * {@link ScopeName} forces every scope we assign to end in `.flix`.
 *
 * That constraint is not cosmetic. The grammar this project replaces assigns
 * `constant.character.escape` and `entity.name.type` without the language suffix, which
 * makes those two scopes indistinguishable from any other language's in a theme or in a
 * `vscode-tmgrammar-test` assertion. Encoding the rule in the type system means the
 * mistake cannot be reintroduced.
 */

/**
 * A scope assigned by this grammar.
 *
 * The trailing `.flix` is mandatory: TextMate scope selectors match on dot-separated
 * prefixes, so the language suffix is what lets a theme (or a test) target Flix
 * specifically rather than every grammar that happens to use the same base scope.
 */
export type ScopeName = `${string}.flix`;

/** Capture-index keys are stringified integers; `"0"` is the whole match. */
export type CaptureIndex = `${number}`;

/** Attributes assigned to one capture group of a `match`, `begin`, `end`, or `while`. */
export interface Capture {
  /** Scope assigned to the captured text. */
  name?: ScopeName;
  /** Captures may themselves be tokenized further. */
  patterns?: Rule[];
}

export type Captures = Partial<Record<CaptureIndex, Capture>>;

/**
 * A reference to another rule.
 *
 * `$self` re-enters the grammar from the top, `#name` resolves against the repository.
 * Kept as a distinct member of the {@link Rule} union so that an `include` cannot be
 * accidentally combined with `match`/`begin`, which TextMate silently ignores.
 */
export interface IncludeRule {
  include: `#${string}` | '$self' | '$base';
  comment?: string;
}

/** A single-line rule. */
export interface MatchRule {
  /** Oniguruma pattern. Must not span lines. */
  match: string;
  name?: ScopeName;
  captures?: Captures;
  comment?: string;
}

/**
 * A rule delimited by a `begin`/`end` pair.
 *
 * Flix strings, chars, and regexes are all terminated by end-of-line in the reference
 * lexer, so their `end` patterns must offer a line-anchored alternative. The
 * `scripts/lint-grammar.mjs` check enforces that for every rule not on its allowlist —
 * an unterminated delimiter that runs to end-of-file is the single most visible way a
 * TextMate grammar fails.
 */
export interface BeginEndRule {
  begin: string;
  end: string;
  name?: ScopeName;
  /** Scope for the text *between* `begin` and `end`, excluding the delimiters. */
  contentName?: ScopeName;
  beginCaptures?: Captures;
  endCaptures?: Captures;
  /** Shorthand applying the same captures to both `begin` and `end`. */
  captures?: Captures;
  /** Try the `end` pattern only after the nested `patterns` have been tried. */
  applyEndPatternLast?: boolean;
  patterns?: Rule[];
  comment?: string;
}

/** A rule that continues for as long as `while` matches at the start of each line. */
export interface BeginWhileRule {
  begin: string;
  while: string;
  name?: ScopeName;
  contentName?: ScopeName;
  beginCaptures?: Captures;
  whileCaptures?: Captures;
  patterns?: Rule[];
  comment?: string;
}

/** A rule that only groups other rules. */
export interface PatternsRule {
  patterns: Rule[];
  comment?: string;
}

export type Rule = IncludeRule | MatchRule | BeginEndRule | BeginWhileRule | PatternsRule;

export interface TmLanguage {
  /** Root scope. Consumers (Linguist, Shiki, VS Code) key off this exact string. */
  scopeName: ScopeName;
  /** Human-readable grammar name. */
  name?: string;
  fileTypes?: string[];
  firstLineMatch?: string;
  foldingStartMarker?: string;
  foldingStopMarker?: string;
  uuid?: string;
  patterns: Rule[];
  repository?: Record<string, Rule>;
  injectionSelector?: string;
  injections?: Record<string, Rule>;
  /**
   * Non-standard keys carried for drop-in compatibility with the grammar published at
   * https://github.com/flix/textmate, which GitHub Linguist vendors.
   */
  $schema?: string;
  copyright_notice?: string;
  license?: string;
}
