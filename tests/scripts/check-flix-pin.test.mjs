import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { URL, fileURLToPath } from 'node:url';
import { checkLexiconPin } from '../../scripts/check-flix-pin.mjs';

const revision = '36d923ca325dc466b28c63419667e6026a80f920';
const stamp = `// Source: flix/flix @ ${revision}`;

for (const newline of ['\n', '\r\n']) {
  test(`accepts an exact full source stamp with ${JSON.stringify(newline)}`, () => {
    assert.doesNotThrow(() =>
      checkLexiconPin(`// Generated${newline}${stamp}${newline}`, revision),
    );
  });
}

for (const [name, source, pin, reason] of [
  [
    'different source',
    stamp.replace(revision, '0'.repeat(40)),
    revision,
    /revision mismatch/,
  ],
  ['missing stamp', '// Generated\n', revision, /exactly one source stamp/],
  ['abbreviated stamp', stamp.slice(0, -33), revision, /full flix\/flix commit/],
  [
    'foreign repository',
    stamp.replace('flix/flix', 'fork/flix'),
    revision,
    /full flix\/flix commit/,
  ],
  [
    'uppercase stamp',
    stamp.replace(revision, revision.toUpperCase()),
    revision,
    /full flix\/flix commit/,
  ],
  ['trailing stamp data', `${stamp} extra`, revision, /full flix\/flix commit/],
  ['duplicate stamp', `${stamp}\n${stamp}\n`, revision, /exactly one source stamp/],
  ['short authority', stamp, revision.slice(0, 7), /authority must be a full/],
  ['uppercase authority', stamp, revision.toUpperCase(), /authority must be a full/],
  [
    'nonhex stamp',
    stamp.replace(revision, 'z'.repeat(40)),
    revision,
    /full flix\/flix commit/,
  ],
  ['oversized stamp', `${stamp}0`, revision, /full flix\/flix commit/],
  ['missing authority', stamp, undefined, /authority must be a full/],
]) {
  test(`rejects ${name}`, () => {
    assert.throws(() => checkLexiconPin(source, pin), reason);
  });
}

test('CLI checks the committed lexicon from any working directory', () => {
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL('../../scripts/check-flix-pin.mjs', import.meta.url))],
    { cwd: '/', encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /OK: lexicon source matches/);
});
