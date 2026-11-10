/** Checks the committed lexicon against the same authority as the external oracle. */
import { readFileSync } from 'node:fs';
import { URL, pathToFileURL } from 'node:url';
import { FLIX_COMPILER } from './external-checkout.mjs';

export function checkLexiconPin(lexicon, revision) {
  if (typeof revision !== 'string' || !/^[0-9a-f]{40}$/.test(revision)) {
    throw new Error('Flix authority must be a full lowercase 40-character commit SHA.');
  }
  const stamps = lexicon.split(/\r?\n/).filter((line) => line.startsWith('// Source:'));
  if (stamps.length !== 1) {
    throw new Error('Lexicon must carry exactly one source stamp.');
  }
  const match = /^\/\/ Source: flix\/flix @ ([0-9a-f]{40})$/.exec(stamps[0]);
  if (!match) {
    throw new Error('Lexicon source stamp must name a full flix/flix commit.');
  }
  if (match[1] !== revision) {
    throw new Error(`Lexicon revision mismatch: expected ${revision}, got ${match[1]}.`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    checkLexiconPin(
      readFileSync(
        new URL('../src/typescript/lexicon.generated.ts', import.meta.url),
        'utf8',
      ),
      FLIX_COMPILER.revision,
    );
    console.log(`OK: lexicon source matches Flix ${FLIX_COMPILER.revision}.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
