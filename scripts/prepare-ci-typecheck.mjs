import { readFile, writeFile } from 'node:fs/promises';

async function replaceOnce(path, from, to) {
  const source = await readFile(path, 'utf8');
  if (!source.includes(from)) {
    if (source.includes(to)) return;
    throw new Error(`Expected source text was not found in ${path}`);
  }
  await writeFile(path, source.replace(from, to));
}

await replaceOnce(
  'entrypoints/form.ts',
  "import { defineUnlistedScript } from '#imports';",
  "import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script';",
);
await replaceOnce(
  'src/security/sanitize.ts',
  'max = LIMITS.labelChars,',
  'max: number = LIMITS.labelChars,',
);
await replaceOnce(
  'src/security/sanitize.ts',
  'max = LIMITS.constraintChars,',
  'max: number = LIMITS.constraintChars,',
);
