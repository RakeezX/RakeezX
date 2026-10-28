// drafts/n44-push/web-protocol.mjs
var FORWARDED = Object.freeze(["authorization", "origin", "content-type", "x-n44-csrf", "sec-fetch-site"]);
var hex = (bytes) => Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
async function sha(bytes) {
  return hex(await crypto.subtle.digest("SHA-256", bytes));
}
async function mac(key, value) {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(value)));
}
async function readBytes(stream, max = 12288, signal) {
  if (!stream) return new Uint8Array();
  const reader = stream.getReader();
  let total = 0;
  const parts = [];
  const cancel = () => {
    void reader.cancel().catch(() => {
    });
  };
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    for (; ; ) {
      if (signal?.aborted) throw Error("n44_deadline");
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > max) throw Error("n44_body_limit");
      parts.push(value);
    }
    const bytes = new Uint8Array(total);
    let at = 0;
    for (const p of parts) {
      bytes.set(p, at);
      at += p.length;
    }
    return bytes;
  } finally {
    signal?.removeEventListener("abort", cancel);
    void reader.cancel().catch(() => {
    });
    reader.releaseLock();
  }
}
var PRIVATE_WEB_HEADERS = Object.freeze({
  "cache-control": "no-store, private",
  "referrer-policy": "no-referrer",
  "x-robots-tag": "noindex, nofollow, noarchive",
  "x-content-type-options": "nosniff",
  vary: "Origin",
  "content-type": "application/json; charset=utf-8"
});
var privateResponse = (status = 503) => new Response('{"error":"unavailable"}', { status, headers: PRIVATE_WEB_HEADERS });

// drafts/n44-push/scheduler-entry.mjs
async function signedScheduleRequest(url, key, body, now = Date.now) {
  const bytes = new TextEncoder().encode(JSON.stringify(body)), time = String(Math.floor(now() / 1e3)), nonce = crypto.randomUUID(), source = await mac(key, "n44-private-scheduler");
  const u = new URL(url), signature = await mac(key, JSON.stringify(["n44-scheduler-v1", u.origin, u.pathname, await sha(bytes), time, nonce, source]));
  return new Request(url, { method: "POST", headers: { "content-type": "application/json", "x-n44-time": time, "x-n44-nonce": nonce, "x-n44-source": source, "x-n44-signature": signature }, body: bytes });
}
async function runScheduled(env, { fetch: send = globalThis.fetch } = {}) {
  if (env?.N44_ENABLED !== "true" || env.N44_SCHEDULER_ENABLED !== "true") return { status: "disabled" };
  const abort = new AbortController(), timer = setTimeout(() => abort.abort(), 45e3);
  try {
    const url = new URL(env.N44_EDGE_URL);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/functions/v1/n44-notifications") throw Error();
    if (!/^[a-f0-9]{64}$/.test(env.N44_SCHEDULER_KEY ?? "")) throw Error();
    const key = Uint8Array.from(env.N44_SCHEDULER_KEY.match(/../g), (x) => parseInt(x, 16));
    const invoke = async (body) => {
      const request = await signedScheduleRequest(url.href + "/schedule", key, body);
      const response = await send(request, { signal: abort.signal, redirect: "error", cache: "no-store" });
      if (!response.ok) throw Error();
      return JSON.parse(new TextDecoder().decode(await readBytes(response.body, 8192, abort.signal)));
    };
    if (env.N44_FINITE_SCHEDULER === "true") return await invoke({ operation: "finite-due", cursor: null, limit: 1 });
    let cursor = null;
    for (let page = 0; page < 4; page++) {
      const r = await invoke({ operation: "due", cursor, limit: 25 });
      if (r.status !== "completed") throw Error();
      cursor = r.cursor;
      if (!cursor) break;
    }
    await invoke({ operation: "cleanup", cursor: null, limit: 25 });
    return { status: "completed" };
  } catch {
    return { status: "unavailable" };
  } finally {
    clearTimeout(timer);
    abort.abort();
  }
}
var scheduler_entry_default = { scheduled(_event, env, ctx) {
  ctx.waitUntil(runScheduled(env));
}, fetch: () => privateResponse() };
export {
  scheduler_entry_default as default,
  runScheduled,
  signedScheduleRequest
};
