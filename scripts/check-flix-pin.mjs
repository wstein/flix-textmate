/** Checks the committed lexicon against the same authority as the external oracle. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

/** The producer metadata is independent of this repository's source declaration. */
export function checkSpecPin(pin, revision) {
  const declared = pin?.upstream?.commit;
  if (typeof declared !== 'string' || !/^[0-9a-f]{40}$/.test(declared)) {
    throw new Error(
      'flix-spec upstream.commit must be a full lowercase 40-character SHA.',
    );
  }
  if (declared !== revision) {
    throw new Error(
      `flix-spec revision mismatch: expected ${revision}, got ${declared}.`,
    );
  }
}

/** Preserve the migration branch's checkout flag/env; also accept a metadata file. */
export function resolveSpecPinPath(argv = process.argv.slice(2), env = process.env) {
  const flags = ['--spec-pin', '--flix-spec'];
  const configured = flags.filter((flag) => argv.includes(flag));
  if (configured.length > 1) {
    throw new Error('Use only one of --spec-pin and --flix-spec.');
  }
  if (configured.length === 1) {
    const flag = configured[0];
    const value = argv[argv.indexOf(flag) + 1];
    if (!value || value.startsWith('--')) throw new Error(`${flag} requires a path.`);
    return flag === '--flix-spec' ? join(value, 'pin.json') : value;
  }
  if (env.FLIX_SPEC_PIN) return env.FLIX_SPEC_PIN;
  if (env.FLIX_SPEC) return join(env.FLIX_SPEC, 'pin.json');
  return undefined;
}

function readSpecPin(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read flix-spec pin metadata at ${path}: ${error.message}`, {
      cause: error,
    });
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
    const specPinPath = resolveSpecPinPath();
    if (specPinPath !== undefined) {
      checkSpecPin(readSpecPin(specPinPath), FLIX_COMPILER.revision);
      console.log(
        `OK: lexicon, source authority, and flix-spec match Flix ${FLIX_COMPILER.revision}.`,
      );
    } else {
      console.log(`OK: lexicon source matches Flix ${FLIX_COMPILER.revision}.`);
      console.log(
        'flix-spec equality not checked; pass --flix-spec <checkout> or --spec-pin <pin.json>.',
      );
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
