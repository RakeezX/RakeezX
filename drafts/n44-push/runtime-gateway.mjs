/** INACTIVE Node HTTP composition. No environment, driver, Auth, crypto or sender defaults. */
import { createServer } from 'node:http';
import { performance } from 'node:perf_hooks';
import { createPostgresRepository } from './postgres-repository.mjs';
import { createRegistrationBoundary } from './registration.mjs';
import { createDeliveryBoundary } from './delivery.mjs';
import { principal, id } from './shared.mjs';

const fail = () => { throw Error('n44_unavailable'); };
const fn = f => typeof f === 'function';
function bounded(work, milliseconds, signal) {
  return new Promise((resolve, reject) => {
    let timer, done = false;
    const finish = (callback, value) => {
      if (done) return; done = true;
      clearTimeout(timer); signal?.removeEventListener('abort', abort); callback(value);
    };
    const abort = () => finish(reject, Error('n44_unavailable'));
    if (signal?.aborted) { abort(); return; }
    signal?.addEventListener('abort', abort, { once: true });
    timer = setTimeout(abort, milliseconds);
    Promise.resolve().then(work).then(value => finish(resolve, value), error => finish(reject, error));
  });
}
const origin = s => {
  try { const u = new URL(s); return u.protocol === 'https:' && u.origin === s && !u.username && !u.password; }
  catch { return false; }
};
// One fixed-code, secret-free preflight result. A supplied port is a trusted server
// capability, never evidence that its implementation has actually been audited.
export function preflight(config = {}, ports = {}) {
  const missing = [];
  if (config.enabled !== true) missing.push('runtime_disabled');
  if (!Array.isArray(config.applicationOrigins) || !config.applicationOrigins.length || !config.applicationOrigins.every(origin)) missing.push('application_origins');
  if (!Array.isArray(config.providerOrigins) || !config.providerOrigins.length || !config.providerOrigins.every(origin)) missing.push('provider_origins');
  if (!Number.isInteger(config.requestDeadlineMs) || config.requestDeadlineMs < 20 || config.requestDeadlineMs > 15000) missing.push('request_deadline');
  for (const [code, value] of [['postgres_acquire', ports.acquire], ['current_session_verifier', ports.verifySession],
    ['audited_protector', ports.protect], ['ingress_limiter', ports.ingress?.take],
    ['authoritative_recompute', ports.authoritative?.recompute], ['private_schedule_batch', ports.schedule?.batch],
    ['private_cleanup_batch', ports.schedule?.owners], ['resource_close', ports.close]]) if (!fn(value)) missing.push(code);
  if (ports.authoritative?.serializedWriters !== true) missing.push('serialized_current_state_writers');
  if (config.deliveryEnabled !== true) missing.push('delivery_disabled');
  if (!fn(ports.sender?.send)) missing.push('audited_sender');
  return Object.freeze({ status: missing.length ? 'disabled' : 'configured', missing: Object.freeze(missing) });
}

// Parse JSON grammar AND decoded member uniqueness, including escaped aliases and
// nested objects. Bounded bytes/depth prevent adversarial parser work. JSON.parse
// alone accepts duplicate names and would silently replace registration identity.
export function parseBody(text) {
  if (typeof text !== 'string' || Buffer.byteLength(text) > 12288) fail();
  let i = 0;
  const ws = () => { while (/[\x20\x09\x0a\x0d]/.test(text[i] ?? 'x')) i++; };
  function string() {
    const start = i++;
    while (i < text.length) {
      const c = text[i++];
      if (c === '\\') i++;
      else if (c === '"') return JSON.parse(text.slice(start, i));
    }
    fail();
  }
  function value(depth) {
    if (depth > 12) fail();
    ws();
    if (text[i] === '"') { string(); return; }
    const open = text[i];
    if (open === '{' || open === '[') {
      i++; ws(); const end = open === '{' ? '}' : ']'; const keys = new Set();
      if (text[i] === end) { i++; return; }
      for (;;) {
        if (open === '{') {
          if (text[i] !== '"') fail();
          const key = string(); if (keys.has(key)) fail(); keys.add(key);
          ws(); if (text[i++] !== ':') fail();
        }
        value(depth + 1); ws();
        if (text[i] === end) { i++; return; }
        if (text[i++] !== ',') fail(); ws();
      }
    }
    const token = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(i));
    if (!token) fail(); i += token[0].length;
  }
  value(0); ws(); if (i !== text.length) fail();
  return JSON.parse(text);
}

const publicCodes = new Map([['registered', 200], ['revoked', 200], ['rejected', 400], ['limited', 429], ['unavailable', 503]]);
const respondedSockets = new WeakSet();
const invalidBody = Symbol('invalid_body');
function readBody(req, check, signal) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    const cleanup = () => {
      req.removeListener('data', data); req.removeListener('end', end); req.removeListener('error', error);
      signal.removeEventListener('abort', abort);
    };
    const error = e => { cleanup(); reject(e); };
    const abort = () => error(Error('n44_unavailable'));
    const data = chunk => {
      try {
        check(); size += chunk.length;
        if (size > 12288) { error(invalidBody); return; }
        chunks.push(chunk);
      } catch (e) { error(e); }
    };
    const end = () => { cleanup(); resolve(Buffer.concat(chunks)); };
    if (signal.aborted) { abort(); return; }
    req.on('data', data); req.once('end', end); req.once('error', error);
    signal.addEventListener('abort', abort, { once: true });
  });
}
const reply = (res, status, code) => {
  if (res.destroyed || res.writableEnded) return;
  if (res.socket) respondedSockets.add(res.socket);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', Connection: 'close' });
  res.end(JSON.stringify({ status: code }));
};

export function createRuntime(config = {}, ports = {}) {
  // Freeze configuration so caller mutation cannot enable or widen a running instance.
  config = structuredClone(config);
  const readiness = preflight(config, ports);
  let closed = false;
  const active = new Set();
  const requests = new Set();
  let closing;
  const lifetime = new AbortController();
  const repository = readiness.status === 'configured' ? createPostgresRepository({ acquire: ports.acquire }) : null;
  const clock = () => Date.now();
  const boundedSender = { send(permit) {
    // Invoke immediately after the committed permit; do not insert an await here.
    const controller = new AbortController();
    let timer;
    try {
      const sending = ports.sender.send(permit, { signal: controller.signal, deadlineMs: 10000 });
      return Promise.race([Promise.resolve(sending), new Promise(resolve => {
        timer = setTimeout(() => { controller.abort(); resolve('uncertain'); }, 10000);
      })]).finally(() => clearTimeout(timer));
    } catch { return Promise.resolve('uncertain'); }
  } };
  const delivery = repository && createDeliveryBoundary({ repository, clock,
    recompute: (...args) => ports.authoritative.recompute(...args), sender: boundedSender });

  async function handle(req, res) {
    if (closed || !repository) { reply(res, 503, 'disabled'); req.resume(); return; }
    const deadline = performance.now() + config.requestDeadlineMs;
    const controller = new AbortController();
    requests.add(controller);
    let expired = false, timer;
    const check = () => { if (closed || expired || controller.signal.aborted || performance.now() >= deadline) fail(); };
    const abort = () => { expired = true; controller.abort(); };
    req.once('aborted', abort);
    res.once('close', abort);
    timer = setTimeout(() => { abort(); reply(res, 503, 'unavailable'); req.resume(); }, config.requestDeadlineMs);
    try {
      if (req.method !== 'POST' || !['/n44/push/register', '/n44/push/revoke'].includes(req.url)) {
        reply(res, 404, 'rejected'); return;
      }
      const names = new Set();
      for (let i = 0; i < req.rawHeaders.length; i += 2) {
        const name = req.rawHeaders[i].toLowerCase();
        if (names.has(name)) { reply(res, 400, 'rejected'); return; } names.add(name);
      }
      if (!config.applicationOrigins.includes(req.headers.origin) || req.headers['sec-fetch-site'] === 'cross-site') {
        reply(res, 403, 'rejected'); return;
      }
      if (req.headers['content-type'] !== 'application/json' || req.headers['content-encoding'] ||
          (req.headers['content-length'] && (!/^\d+$/.test(req.headers['content-length']) || Number(req.headers['content-length']) > 12288))) {
        reply(res, 400, 'rejected'); return;
      }
      // Ignore X-Forwarded-For/owner labels. A TLS ingress must provide its own
      // distributed edge limit; socket address here is deliberately the direct peer.
      if (await bounded(() => ports.ingress.take({ kind: 'peer', key: req.socket.remoteAddress, limit: 60, windowMs: 60000, signal: controller.signal }), config.requestDeadlineMs, controller.signal) !== true) {
        check(); reply(res, 429, 'limited'); return;
      }
      check();
      const authorization = req.headers.authorization;
      if (typeof authorization !== 'string' || !/^Bearer [A-Za-z0-9._~-]{1,4096}$/.test(authorization)) { reply(res, 401, 'rejected'); return; }
      const auth = await bounded(() => ports.verifySession(authorization, { signal: controller.signal }), config.requestDeadlineMs, controller.signal);
      check(); if (!principal(auth, clock())) { reply(res, 401, 'rejected'); return; }
      // Snapshot the trusted verifier output; no decoded JWT or request owner.
      const verified = structuredClone(auth);
      if (await bounded(() => ports.ingress.take({ kind: 'owner', key: verified.ownerId, limit: 30, windowMs: 60000, signal: controller.signal }), config.requestDeadlineMs, controller.signal) !== true) {
        check(); reply(res, 429, 'limited'); return;
      }
      check();
      let bytes;
      try { bytes = await readBody(req, check, controller.signal); }
      catch (e) { if (e === invalidBody) { reply(res, 400, 'rejected'); return; } throw e; }
      check();
      let body;
      try { body = parseBody(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
      catch { reply(res, 400, 'rejected'); return; }
      const scoped = { atomic(owner, work) { check(); return repository.atomic(owner, tx => { check(); return work(tx); }); } };
      const registration = createRegistrationBoundary({ repository: scoped, clock,
        verifySession: async () => { check(); return verified; },
        protect: async sub => { check(); const secret = await bounded(() => ports.protect(sub, { signal: controller.signal }), config.requestDeadlineMs, controller.signal); check(); return secret; },
        approvedOrigins: config.providerOrigins });
      const result = await registration[req.url.endsWith('/register') ? 'register' : 'revoke'](null, body);
      check(); const code = publicCodes.has(result?.status) ? result.status : 'unavailable';
      reply(res, publicCodes.get(code), code);
    } catch { reply(res, 503, 'unavailable'); }
    finally { clearTimeout(timer); requests.delete(controller); req.removeListener('aborted', abort); res.removeListener('close', abort); req.resume(); }
  }
  // Only the returned in-process capability can obtain owners/jobs. No HTTP path
  // dispatches these functions; no scheduler key/token is accepted from clients.
  let scheduling = false;
  async function sweep(cleanup) {
    if (closed || !delivery) return { status: 'disabled' };
    if (scheduling) return { status: 'busy' };
    scheduling = true;
    try {
      const batch = await bounded(() => cleanup ? ports.schedule.owners({ limit: 100, signal: lifetime.signal }) : ports.schedule.batch({ limit: 100, signal: lifetime.signal }), 5000, lifetime.signal);
      if (closed || !Array.isArray(batch) || batch.length > 100) fail();
      let count = 0;
      for (const job of batch) {
        if (closed) fail();
        if (cleanup ? !id(job) : !id(job?.ownerId)) fail();
        const result = cleanup ? await delivery.cleanup(job) : await delivery.deliver(job.ownerId, job.registrationId, job.payload);
        if (result.status === 'unavailable') fail(); count++;
      }
      return { status: 'completed', count };
    } catch { return { status: 'unavailable' }; }
    finally { scheduling = false; }
  }
  const track = promise => { active.add(promise); promise.finally(() => active.delete(promise)).catch(() => {}); return promise; };
  return Object.freeze({ preflight: readiness,
    handler(req, res) { return track(handle(req, res)); },
    runDelivery() { return track(sweep(false)); }, runCleanup() { return track(sweep(true)); },
    close() {
      if (closing) return closing;
      closed = true; lifetime.abort(); for (const request of requests) request.abort();
      // Injected driver/Auth/scheduler/crypto resources MUST honor bounded deadlines.
      closing = (async () => {
        try { await bounded(() => Promise.allSettled([...active]), 20000); }
        finally { if (fn(ports.close)) await bounded(() => ports.close(), 5000); }
      })();
      return closing;
    },
  });
}

/** Explicit listener ownership. Caller supplies bind; TLS/edge ingress stays external. */
export async function listenRuntime(runtime, { host, port }) {
  if (typeof host !== 'string' || !host || !Number.isInteger(port) || port < 0 || port > 65535) fail();
  const server = createServer({ maxHeaderSize: 8192 }, runtime.handler);
  server.maxHeadersCount = 32; server.maxRequestsPerSocket = 1;
  server.headersTimeout = 5000; server.requestTimeout = 15000; server.timeout = 15000;
  server.on('clientError', (_error, socket) => {
    // Never append another HTTP response after an early denial on this socket.
    if (respondedSockets.has(socket)) { socket.end(); return; }
    respondedSockets.add(socket);
    socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 21\r\n\r\n{"status":"rejected"}');
  });
  try {
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen({ host, port, exclusive: true }, resolve); });
  } catch { await runtime.close(); fail(); }
  return Object.freeze({ address: server.address(), async close() {
    const stopped = new Promise((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
    server.closeAllConnections(); await runtime.close(); await stopped;
  } });
}
