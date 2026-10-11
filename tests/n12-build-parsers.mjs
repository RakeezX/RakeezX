// Copy n12-parsers-package{,-lock}.json to package{,-lock}.json in a local tool
// directory, npm ci there, then: node tests/n12-build-parsers.mjs <tool-directory>.
// No parser packages or remote imports are required at runtime.
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const tools = resolve(root, process.argv[2] || '.n12-tools');
const { build } = await import(pathToFileURL(resolve(tools, 'node_modules/esbuild/lib/main.js')));
await build({
  stdin: { resolveDir: tools, contents: `
    import Papa from './node_modules/papaparse/papaparse.js';
    export { Papa };
    export { readSheet } from './node_modules/read-excel-file/universal/index.js';
    export { unzipSync, strFromU8 } from './node_modules/fflate/esm/browser.js';
  ` },
  bundle: true, format: 'esm', platform: 'browser', minify: true,
  legalComments: 'inline', external: ['stream'],
  outfile: resolve(root, 'src/lib/student-import-parsers.js'),
});
