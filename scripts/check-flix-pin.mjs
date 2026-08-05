#!/usr/bin/env node
/**
 * Asserts the committed lexicon was scraped from the Flix this repository declares in
 * `flix-pin.json`, and — when a `flix-spec` checkout is available — that the declaration still
 * agrees with what `flix-spec` pins.
 *
 * Two different drifts, and only the first is already covered.
 *
 * `scripts/extract-lexicon.mjs` stamps the source checkout's commit into
 * `src/typescript/lexicon.generated.ts`, so regenerating against a different compiler changes the
 * file and CI's `git diff --exit-code` fires. That protects the file against its own generator.
 *
 * It says nothing about *which* Flix that ought to be. This repository, `flix-spec`,
 * `tree-sitter-flix` and `flix-jetbrains-plugin` are only comparable while they describe the same
 * compiler, and a lexicon quietly regenerated against a newer Flix would colour syntax the shared
 * fixtures do not describe — with every gate here still green, because every gate here is internal.
 * `flix-jetbrains-plugin` holds the same lock from the other side by reading `pin.json` out of the
 * flix-spec artifact and failing when it disagrees with the Flix it tests against.
 *
 * The declaration is vendored rather than fetched because CI has no Flix checkout and no network
 * dependency worth adding for forty bytes. That makes it advertisement, and this script is what
 * turns advertisement into a check: run with a flix-spec checkout to verify the advertisement
 * itself, which is the step a pin bump must not skip.
 *
 *   node scripts/check-flix-pin.mjs                       # lexicon vs flix-pin.json
 *   node scripts/check-flix-pin.mjs --flix-spec <path>    # ...and flix-pin.json vs flix-spec
 *   FLIX_SPEC=<path> node scripts/check-flix-pin.mjs
 */

import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const pin = JSON.parse(readFileSync(join(repoRoot, 'flix-pin.json'), 'utf8'));
const declared = pin.upstream.commit;
const declaredTag = pin.upstream.tag;

if (!/^[0-9a-f]{40}$/.test(declared)) {
  console.error(
    `flix-pin.json: upstream.commit is not a full 40-character SHA: ${declared}`,
  );
  process.exit(1);
}

// The generator writes `// Source: flix/flix @ <short>` as the third line.
const lexicon = readFileSync(
  join(repoRoot, 'src/typescript/lexicon.generated.ts'),
  'utf8',
);
const stamp = /^\/\/ Source: flix\/flix @ ([0-9a-f]+)$/m.exec(lexicon);

if (!stamp) {
  console.error(
    'src/typescript/lexicon.generated.ts carries no "// Source: flix/flix @ <commit>" stamp.',
  );
  console.error('Regenerate it with `npm run extract:lexicon -- --flix-source <path>`.');
  process.exit(1);
}

const stamped = stamp[1];

if (!declared.startsWith(stamped)) {
  console.error(
    `The committed lexicon was scraped from Flix ${stamped}, but flix-pin.json declares ${declared}.`,
  );
  console.error('');
  console.error('One of them must move, and which one is a decision rather than a fix:');
  console.error('  - regenerate the lexicon from the declared pin, or');
  console.error("  - bump flix-pin.json, together with flix-spec's own pin.json.");
  process.exit(1);
}

// Optional second half: the declaration itself, against the repository that owns the pin.
const flagIndex = process.argv.indexOf('--flix-spec');
const specPath =
  (flagIndex !== -1 ? process.argv[flagIndex + 1] : undefined) ?? process.env.FLIX_SPEC;

if (!specPath) {
  console.log(
    `OK: lexicon scraped from Flix ${stamped}, matching flix-pin.json (${declaredTag}).`,
  );
  console.log(
    '     flix-pin.json itself was not checked — pass --flix-spec <path> or set FLIX_SPEC to verify it.',
  );
  process.exit(0);
}

if (!statSync(specPath, { throwIfNoEntry: false })?.isDirectory()) {
  console.error(`Not a directory: ${specPath}`);
  console.error('Expected a checkout of https://github.com/wstein/flix-spec.');
  process.exit(2);
}

const specPin = JSON.parse(readFileSync(join(specPath, 'pin.json'), 'utf8'));

if (specPin.upstream.commit !== declared) {
  console.error('This repository and flix-spec describe different compilers.');
  console.error(`  flix-textmate flix-pin.json : ${declaredTag} ${declared}`);
  console.error(
    `  flix-spec     pin.json      : ${specPin.upstream.tag} ${specPin.upstream.commit}`,
  );
  console.error('');
  console.error(
    'Nothing measured against the shared fixtures is comparable while these disagree.',
  );
  process.exit(1);
}

console.log(
  `OK: lexicon, flix-pin.json and flix-spec all describe Flix ${declaredTag} (${stamped}).`,
);
