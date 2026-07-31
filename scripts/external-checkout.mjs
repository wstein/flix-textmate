/**
 * Resolves paths to external checkouts that some scripts need.
 *
 * Several gates here compare the grammar against sources that are not vendored: the Flix
 * compiler (for the lexical inventory) and `tree-sitter-flix` (as an independent oracle for
 * token boundaries). Those live wherever the person running the script keeps them, so the
 * location is always supplied — by flag or environment variable — and never guessed.
 *
 * There is deliberately no default. A hardcoded fallback works on exactly one machine and
 * fails confusingly everywhere else, and it leaks whoever wrote it into the repository.
 */

import { statSync } from 'node:fs';

/**
 * Returns the directory named by `--flag` or `$ENV_VAR`, or exits with guidance.
 *
 * @param {object} options
 * @param {string} options.flag        Command-line flag, e.g. `--corpus`.
 * @param {string} options.env         Environment variable, e.g. `FLIX_SOURCE`.
 * @param {string} options.what        Human description used in the error message.
 * @param {string} options.repository  Upstream URL, so the message says where to get it.
 * @param {string[]} [options.argv]    Defaults to `process.argv`.
 */
export function resolveCheckout({ flag, env, what, repository, argv = process.argv }) {
  const index = argv.indexOf(flag);
  const fromFlag = index !== -1 ? argv[index + 1] : undefined;
  const path = fromFlag ?? process.env[env];

  if (!path) {
    console.error(`This check needs a local checkout of ${what}.\n`);
    console.error(`  ${flag} <path>      or      ${env}=<path>\n`);
    console.error(`Clone it from ${repository}`);
    process.exit(2);
  }

  if (!statSync(path, { throwIfNoEntry: false })?.isDirectory()) {
    console.error(`Not a directory: ${path}`);
    console.error(`Expected a checkout of ${what} (${repository}).`);
    process.exit(2);
  }

  return path;
}

/** The Flix compiler, the source of truth for every token class in the grammar. */
export const FLIX_COMPILER = {
  what: 'the Flix compiler',
  repository: 'https://github.com/flix/flix',
};

/** The sibling tree-sitter grammar, used as an independent tokenization oracle. */
export const TREE_SITTER_FLIX = {
  what: 'tree-sitter-flix',
  repository: 'https://github.com/wstein/tree-sitter-flix',
};
