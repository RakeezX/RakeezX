// drafts/n88-student-portal/web-protocol.mjs
var ROUTE = /^\/api\/n88\/(?:teacher\/class\/(?:list|issue-missing|rotate|revoke|visibility)|student\/(?:claim|read|end))$/;
var FORWARDED = Object.freeze(["authorization", "cookie", "origin", "content-type", "x-n88-csrf", "sec-fetch-site"]);
var encodeBytes = (bytes) => btoa(String.fromCharCode(...bytes));
var hex = (bytes) => Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
async function sha(bytes) {
  return hex(await crypto.subtle.digest("SHA-256", bytes));
}
async function mac(key, value) {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(value)));
}
function signingText({ origin, path, method, headers, bodyHash, time, nonce, source }) {
  return JSON.stringify(["n88-ingress-v1", origin, path, method, FORWARDED.map((n) => headers.get(n) || ""), bodyHash, time, nonce, source]);
}
async function readBytes(stream, max = 4096, signal) {
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
      if (signal?.aborted) throw Error("n88_deadline");
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > max) throw Error("n88_body_limit");
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
  vary: "Cookie",
  "content-type": "application/json; charset=utf-8"
});
var privateResponse = (status = 503) => new Response('{"error":"unavailable"}', { status, headers: PRIVATE_WEB_HEADERS });

// drafts/n88-student-portal/cloudflare-entry.mjs
function createCloudflareEntry({ fetch: send = globalThis.fetch, now = Date.now } = {}) {
  return async (request, env) => {
    if (env?.N88_ENABLED !== "true") return privateResponse();
    const abort = new AbortController(), timer = setTimeout(() => abort.abort(), 12e3);
    try {
      const url = new URL(request.url), origin = env.N88_PUBLIC_ORIGIN, upstream = new URL(env.N88_EDGE_URL);
      if (url.origin !== origin || url.protocol !== "https:" || url.search || !ROUTE.test(url.pathname) || !["GET", "POST"].includes(request.method) || !request.cf || !["TLSv1.2", "TLSv1.3"].includes(request.cf.tlsVersion) || request.headers.has("cf-worker") || upstream.protocol !== "https:" || upstream.username || upstream.password || upstream.search || upstream.hash || !/^\/functions\/v1\/n88-student-portal$/.test(upstream.pathname)) return privateResponse(401);
      let ip = request.headers.get("cf-connecting-ip");
      if (!ip || ip.length > 45 || !/^[a-fA-F0-9:.]+$/.test(ip)) return privateResponse(401);
      if (ip.includes(":")) ip = new URL("http://[" + ip + "]/").hostname.toLowerCase();
      else if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(ip) || ip.split(".").some((p) => Number(p) > 255 || String(Number(p)) !== p)) return privateResponse(401);
      const keyText = env.N88_INGRESS_KEY;
      if (!/^[a-f0-9]{64}$/.test(keyText || "")) return privateResponse();
      const key = Uint8Array.from(keyText.match(/../g), (x) => parseInt(x, 16));
      const headers = new Headers();
      for (const n of FORWARDED) {
        const v = request.headers.get(n);
        if (v !== null) headers.set(n, v);
      }
      const bytes = await readBytes(request.body, 4096, abort.signal);
      const time = String(Math.floor(now() / 1e3)), nonce = crypto.randomUUID(), source = await mac(key, JSON.stringify(["source-v1", ip]));
      const signature = await mac(key, signingText({ origin, path: url.pathname, method: request.method, headers, bodyHash: await sha(bytes), time, nonce, source }));
      const wire = new Headers({ "content-type": "application/json" });
      for (const [n, v] of Object.entries({ "x-n88-time": time, "x-n88-nonce": nonce, "x-n88-source": source, "x-n88-signature": signature })) wire.set(n, v);
      const payload = JSON.stringify({ path: url.pathname, method: request.method, headers: FORWARDED.map((n) => headers.get(n) || ""), body: encodeBytes(bytes) });
      if (new TextEncoder().encode(payload).length > 24576) return privateResponse(413);
      const result = await send(upstream.href + "/dispatch", {
        method: "POST",
        headers: wire,
        body: payload,
        signal: abort.signal,
        redirect: "error",
        cache: "no-store"
      });
      const responseBytes = await readBytes(result.body, 2 * 1024 * 1024, abort.signal);
      if (!result.ok) return privateResponse(result.status >= 500 ? 503 : 401);
      const reply = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(responseBytes));
      if (!reply || Object.keys(reply).sort().join(",") !== "body,cookie,status" || ![200, 400, 401, 409, 413, 429, 503].includes(reply.status) || reply.cookie !== null && (typeof reply.cookie !== "string" || reply.cookie.length > 4096)) return privateResponse();
      const out = new Headers(PRIVATE_WEB_HEADERS);
      if (reply.cookie) out.set("set-cookie", reply.cookie);
      return new Response(JSON.stringify(reply.body), { status: reply.status, headers: out });
    } catch {
      return privateResponse();
    } finally {
      clearTimeout(timer);
      abort.abort();
    }
  };
}
var cloudflare_entry_default = { fetch: createCloudflareEntry() };
export {
  createCloudflareEntry,
  cloudflare_entry_default as default
};
