import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

// Observation only in the owned HTTP fixture; no source file or guard changes.
export async function startHost({ port = 43173, instrument = false } = {}) {
  const lines = [];
  const replace = (source, from, to) => {
    if (!source.includes(from)) throw Error(`Missing instrumentation boundary: ${from}`);
    return source.replace(from, to);
  };
  const server = await createServer({
    root: fileURLToPath(new URL('../../', import.meta.url)), configFile: false,
    server: { host: '127.0.0.1', port, strictPort: true, hmr: false },
    customLogger: { info: m => lines.push(m), warn: m => lines.push(m), warnOnce: m => lines.push(m), error: m => lines.push(m), clearScreen() {}, hasErrorLogged: () => false, hasWarned: false },
    plugins: instrument ? [{ name: 'n72-observe-init', enforce: 'pre', transform(source, id) {
      if (id.endsWith('/src/app.js')) {
        for (const [label, expression] of [['registry.close', 'registry.close()'], ['seedDemoWorkspace', 'seedDemoWorkspace({ force: demoPreparing })'], ['store.init', 'store.init()']]) {
          source = replace(source, `await ${expression};`, `await globalThis.__n72Trace('${label}', () => ${expression});`);
        }
        source = replace(source, 'await resolve();\n  if (isDemoWorkspace()', "await resolve();\n  globalThis.__n72Finish('ready');\n  if (isDemoWorkspace()");
      }
      if (id.endsWith('/src/lib/demo-workspace.js')) source = replace(source, "await db.writeAll(snapshot, 'replace');", "await globalThis.__n72Trace('db.writeAll', () => db.writeAll(snapshot, 'replace'));");
      if (id.endsWith('/src/lib/db.js')) {
        source = replace(source, 'r.onupgradeneeded = () => upgrade(r.result);', "r.onupgradeneeded = () => { globalThis.__n72Stages.push({stage:'db.upgrade',status:'begin'}); upgrade(r.result); globalThis.__n72Stages.push({stage:'db.upgrade',status:'end',stores:r.result.objectStoreNames.length}); };");
        source = replace(source, '_db = r.result;', "globalThis.__n72Stages.push({stage:'db.open',status:'end',version:r.result.version}); _db = r.result;");
        source = replace(source, "const tx = db.transaction(STORES, 'readwrite');", "const tx = db.transaction(STORES, 'readwrite'); globalThis.__n72Stages.push({stage:'db.transaction',status:'begin'}); for (const event of ['complete','error','abort']) tx.addEventListener(event, () => globalThis.__n72Stages.push({stage:'db.transaction',status:event}));");
        source = replace(source, "const read = tx.objectStore('device').get('device');", "const read = tx.objectStore('device').get('device'); globalThis.__n72Stages.push({stage:'db.guard.device',status:'begin'}); for (const event of ['success','error']) read.addEventListener(event, () => globalThis.__n72Stages.push({stage:'db.guard.device',status:event,hasDevice:Boolean(read.result)}));");
        source = replace(source, '} else run(read.result);', "} else { globalThis.__n72Stages.push({stage:'db.guard.run',status:'begin'}); run(read.result); globalThis.__n72Stages.push({stage:'db.guard.run',status:'end'}); }");
        const start = source.indexOf('export async function writeAll('), end = source.indexOf('export async function applyBatch(');
        let writeAll = source.slice(start, end);
        writeAll = replace(writeAll, 'let written = 0;', 'let written = 0; globalThis.__n72Counts = {put:0,putSuccess:0,clear:0,clearSuccess:0,errors:0};');
        writeAll = writeAll.replaceAll('tx.objectStore(name).clear();', "globalThis.__n72Counts.clear++; const clear = tx.objectStore(name).clear(); clear.addEventListener('success',()=>globalThis.__n72Counts.clearSuccess++);");
        writeAll = writeAll.replaceAll('os.put(r);', "globalThis.__n72Counts.put++; const put = os.put(r); put.addEventListener('success',()=>globalThis.__n72Counts.putSuccess++); put.addEventListener('error',()=>globalThis.__n72Counts.errors++);");
        source = source.slice(0, start) + writeAll + source.slice(end);
      }
      return source;
    } }] : [],
  });
  await server.listen();
  return { origin: `http://127.0.0.1:${port}`, lines, close: () => server.close() };
}
