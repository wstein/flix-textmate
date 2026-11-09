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

import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';

/**
 * Returns the directory named by `--flag` or `$ENV_VAR`, or exits with guidance.
 *
 * @param {object} options
 * @param {string} options.flag        Command-line flag, e.g. `--corpus`.
 * @param {string} options.env         Environment variable, e.g. `FLIX_SOURCE`.
 * @param {string} options.what        Human description used in the error message.
 * @param {string} options.repository  Upstream URL, so the message says where to get it.
 * @param {string} [options.revision] Exact Git HEAD required for a reproducible oracle.
 * @param {string[]} [options.argv]    Defaults to `process.argv`.
 */
export function resolveCheckout({
  flag,
  env,
  what,
  repository,
  revision,
  argv = process.argv,
}) {
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

  if (revision) {
    let actual;
    try {
      actual = execFileSync('git', ['-C', path, 'rev-parse', 'HEAD'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }).trim();
    } catch {
      console.error(`Cannot read ${what} Git revision at ${path}.`);
      process.exit(2);
    }
    if (actual !== revision) {
      console.error(`${what} revision mismatch: expected ${revision}, got ${actual}.`);
      process.exit(2);
    }
  }

  return path;
}

/** The Flix compiler, the source of truth for every token class in the grammar. */
export const FLIX_COMPILER = {
  what: 'the Flix compiler',
  repository: 'https://github.com/flix/flix',
  revision: '36d923ca325dc466b28c63419667e6026a80f920',
};

/** The sibling tree-sitter grammar, used as an independent tokenization oracle. */
export const TREE_SITTER_FLIX = {
  what: 'tree-sitter-flix',
  repository: 'https://github.com/wstein/tree-sitter-flix',
  revision: 'b120a7ad3072a3d17ac02ac8571e8f42a368aaad',
};
