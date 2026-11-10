import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { URL, fileURLToPath } from 'node:url';
import {
  checkLexiconPin,
  checkSpecPin,
  resolveSpecPinPath,
} from '../../scripts/check-flix-pin.mjs';

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

for (const [name, pin, reason] of [
  [
    'mismatched spec',
    { upstream: { commit: '0'.repeat(40) } },
    /flix-spec revision mismatch/,
  ],
  ['missing upstream', {}, /flix-spec upstream.commit must be a full/],
  ['missing spec commit', { upstream: {} }, /flix-spec upstream.commit must be a full/],
  [
    'short spec commit',
    { upstream: { commit: revision.slice(0, 7) } },
    /flix-spec upstream.commit must be a full/,
  ],
  [
    'uppercase spec commit',
    { upstream: { commit: revision.toUpperCase() } },
    /flix-spec upstream.commit must be a full/,
  ],
  ['null spec', null, /flix-spec upstream.commit must be a full/],
]) {
  test(`rejects ${name}`, () => assert.throws(() => checkSpecPin(pin, revision), reason));
}
test('accepts spec metadata naming the same full compiler revision', () => {
  assert.doesNotThrow(() => checkSpecPin({ upstream: { commit: revision } }, revision));
});
test('spec checkout flag overrides environment and resolves pin.json', () => {
  assert.equal(
    resolveSpecPinPath(['--flix-spec', '/chosen'], { FLIX_SPEC: '/other' }),
    '/chosen/pin.json',
  );
});
test('legacy spec checkout environment resolves pin.json', () => {
  assert.equal(resolveSpecPinPath([], { FLIX_SPEC: '/spec' }), '/spec/pin.json');
});
test('spec metadata file flag overrides environment', () => {
  assert.equal(
    resolveSpecPinPath(['--spec-pin', '/chosen.json'], { FLIX_SPEC_PIN: '/other.json' }),
    '/chosen.json',
  );
});
test('spec metadata file environment is supported', () => {
  assert.equal(
    resolveSpecPinPath([], { FLIX_SPEC_PIN: '/metadata.json' }),
    '/metadata.json',
  );
});
test('no configured spec input stays optional', () => {
  assert.equal(resolveSpecPinPath([], {}), undefined);
});
for (const flag of ['--flix-spec', '--spec-pin']) {
  test(`rejects missing value for ${flag}`, () => {
    assert.throws(() => resolveSpecPinPath([flag], {}), /requires a path/);
  });
}

test('rejects conflicting spec flags', () => {
  assert.throws(
    () => resolveSpecPinPath(['--spec-pin', '/pin.json', '--flix-spec', '/spec'], {}),
    /Use only one/,
  );
});
test('explicit checkout flag overrides metadata-file environment', () => {
  assert.equal(
    resolveSpecPinPath(['--flix-spec', '/chosen'], { FLIX_SPEC_PIN: '/other.json' }),
    '/chosen/pin.json',
  );
});
test('CLI compares independent metadata and fails on configured invalid inputs', () => {
  const directory = mkdtempSync(join(tmpdir(), 'textmate-spec-pin-'));
  const script = fileURLToPath(
    new URL('../../scripts/check-flix-pin.mjs', import.meta.url),
  );
  const run = (args, extraEnv = {}) =>
    spawnSync(process.execPath, [script, ...args], {
      cwd: '/',
      encoding: 'utf8',
      env: { ...process.env, FLIX_SPEC: '', FLIX_SPEC_PIN: '', ...extraEnv },
    });
  try {
    const metadata = join(directory, 'pin.json');
    writeFileSync(metadata, JSON.stringify({ upstream: { commit: revision } }));
    const good = run(['--flix-spec', directory]);
    assert.equal(good.status, 0, good.stderr);
    assert.match(good.stdout, /lexicon, source authority, and flix-spec match/);
    assert.equal(run([], { FLIX_SPEC_PIN: metadata }).status, 0);
    for (const [contents, reason] of [
      [
        JSON.stringify({ upstream: { commit: '0'.repeat(40) } }),
        /flix-spec revision mismatch/,
      ],
      ['{broken', /Cannot read flix-spec pin metadata/],
      ['{}', /flix-spec upstream.commit must be a full/],
    ]) {
      writeFileSync(metadata, contents);
      const bad = run(['--spec-pin', metadata]);
      assert.equal(bad.status, 1);
      assert.match(bad.stderr, reason);
    }
    const absent = run([], { FLIX_SPEC: join(directory, 'absent') });
    assert.equal(absent.status, 1);
    assert.match(absent.stderr, /Cannot read flix-spec pin metadata/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
