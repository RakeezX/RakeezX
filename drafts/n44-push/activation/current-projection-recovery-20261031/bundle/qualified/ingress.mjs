// drafts/n44-push/web-protocol.mjs
var ROUTE = /^\/api\/n44\/(?:context\/(?:read|update)|events\/(?:read|update|authorize)|push\/(?:config|register|revoke))$/;
var FORWARDED = Object.freeze(["authorization", "origin", "content-type", "x-n44-csrf", "sec-fetch-site"]);
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
  return JSON.stringify(["n44-ingress-v1", origin, path, method, FORWARDED.map((n) => headers.get(n) || ""), bodyHash, time, nonce, source]);
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

// drafts/n44-push/cloudflare-entry.mjs
function createCloudflareEntry({ fetch: send = globalThis.fetch, now = Date.now } = {}) {
  return async (request, env) => {
    if (env?.N44_ENABLED !== "true") return privateResponse();
    const abort = new AbortController(), timer = setTimeout(() => abort.abort(), 12e3);
    try {
      const url = new URL(request.url), origin = env.N44_PUBLIC_ORIGIN, upstream = new URL(env.N44_EDGE_URL);
      if (url.origin !== origin || url.protocol !== "https:" || url.search || !ROUTE.test(url.pathname) || request.method !== "POST" || !request.cf || !["TLSv1.2", "TLSv1.3"].includes(request.cf.tlsVersion) || request.headers.has("cf-worker") || upstream.protocol !== "https:" || upstream.username || upstream.password || upstream.search || upstream.hash || !/^\/functions\/v1\/n44-notifications$/.test(upstream.pathname)) return privateResponse(401);
      let ip = request.headers.get("cf-connecting-ip");
      if (!ip || ip.length > 45 || !/^[a-fA-F0-9:.]+$/.test(ip)) return privateResponse(401);
      if (ip.includes(":")) ip = new URL("http://[" + ip + "]/").hostname.toLowerCase();
      else if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(ip) || ip.split(".").some((p) => Number(p) > 255 || String(Number(p)) !== p)) return privateResponse(401);
      const keyText = env.N44_INGRESS_KEY;
      if (!/^[a-f0-9]{64}$/.test(keyText || "")) return privateResponse();
      const key = Uint8Array.from(keyText.match(/../g), (x) => parseInt(x, 16));
      const headers = new Headers();
      for (const n of FORWARDED) {
        const v = request.headers.get(n);
        if (v !== null) headers.set(n, v);
      }
      const bytes = await readBytes(request.body, 12288, abort.signal);
      const time = String(Math.floor(now() / 1e3)), nonce = crypto.randomUUID(), source = await mac(key, JSON.stringify(["source-v1", ip]));
      const signature = await mac(key, signingText({ origin, path: url.pathname, method: request.method, headers, bodyHash: await sha(bytes), time, nonce, source }));
      const wire = new Headers({ "content-type": "application/json" });
      for (const [n, v] of Object.entries({ "x-n44-time": time, "x-n44-nonce": nonce, "x-n44-source": source, "x-n44-signature": signature })) wire.set(n, v);
      const payload = JSON.stringify({ path: url.pathname, method: request.method, headers: FORWARDED.map((n) => headers.get(n) || ""), body: encodeBytes(bytes) });
      if (new TextEncoder().encode(payload).length > 32768) return privateResponse(413);
      const result = await send(upstream.href + "/dispatch", {
        method: "POST",
        headers: wire,
        body: payload,
        signal: abort.signal,
        redirect: "manual",
        cache: "no-store"
      });
      if (result.status >= 300 && result.status < 400) {
        void result.body?.cancel().catch(() => {
        });
        return privateResponse();
      }
      const responseBytes = await readBytes(result.body, 2 * 1024 * 1024, abort.signal);
      if (!result.ok) return privateResponse(result.status === 429 ? 429 : result.status >= 500 ? 503 : 401);
      const reply = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(responseBytes));
      if (!reply || Object.keys(reply).sort().join(",") !== "body,status" || ![200, 400, 401, 413, 429, 503].includes(reply.status)) return privateResponse();
      const out = new Headers(PRIVATE_WEB_HEADERS);
      return new Response(JSON.stringify(reply.body), { status: reply.status, headers: out });
    } catch {
      return privateResponse();
    } finally {
      clearTimeout(timer);
      abort.abort();
    }
  };
}
// AI: constructor-injected region policy; no redirects/retries or signed-envelope changes.
export function indiaInvocationFetch(send){
 return (input,init={})=>{const u=new URL(input);if(u.origin!=='https://xlrubcwjqktzzunrvuns.supabase.co'||u.search||u.hash||!['/functions/v1/n88-student-portal/dispatch','/functions/v1/n44-notifications/dispatch'].includes(u.pathname))throw Error('owned_invocation_target');const headers=new Headers(init.headers);headers.set('x-region','ap-south-1');return send(input,{...init,headers});};
}
export function createIndiaEntry({fetch:send=globalThis.fetch,now=Date.now}={}){return createCloudflareEntry({fetch:indiaInvocationFetch(send),now});}
var cloudflare_entry_default = { fetch: createIndiaEntry() };
export {
  createCloudflareEntry,
  cloudflare_entry_default as default
};
