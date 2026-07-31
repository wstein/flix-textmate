/**
 * Emits `syntaxes/flix.tmLanguage.json` from the TypeScript grammar source.
 *
 * The emitted file is committed. `npm run check:build` re-runs this and fails if the
 * working tree differs, so the JSON can never drift from the TypeScript that produced it.
 *
 * Two deliberate differences from the equivalent script in `scala/vscode-scala-syntax`,
 * which this project otherwise follows:
 *
 *  1. Validation failure exits non-zero. The Scala version logs the AJV errors and then
 *     exits 0, so a shell redirect (`... > Scala.tmLanguage.json`) truncates the output
 *     file on a failed build.
 *  2. The file is written in-process after validation succeeds, rather than piped through
 *     stdout, so a failed build leaves the previous artifact untouched.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Ajv, type AnySchemaObject } from 'ajv';
import draft06 from 'ajv/dist/refs/json-schema-draft-06.json' with { type: 'json' };

import { flixTmLanguage } from './FlixTmLanguage.ts';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const schemaPath = join(repoRoot, 'src', 'schemas', 'tmlanguage.json');
const outputPath = join(repoRoot, 'syntaxes', 'flix.tmLanguage.json');

const ajv = new Ajv({ allErrors: true, verbose: true, strict: false });
ajv.addMetaSchema(draft06);

const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as AnySchemaObject;
const validate = ajv.compile(schema);

if (!validate(flixTmLanguage)) {
  console.error('Grammar failed validation against src/schemas/tmlanguage.json:\n');
  for (const error of validate.errors ?? []) {
    console.error(`  ${error.instancePath || '/'} ${error.message ?? ''}`);
  }
  process.exit(1);
}

// Two-space indent with a trailing newline. Key order follows the authoring order in
// FlixTmLanguage.ts, which keeps the JSON diff a mirror of the TypeScript diff.
writeFileSync(outputPath, `${JSON.stringify(flixTmLanguage, null, 2)}\n`, 'utf8');
console.log(`Wrote ${outputPath}`);
