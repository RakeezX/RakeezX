// Receive-only Supabase Realtime Broadcast (Phoenix protocol v1).
export function openOwnerInvalidationChannel({ url, apiKey, ownerId, accessToken,
  onRevision, onSubscribed, WebSocketClass = globalThis.WebSocket,
  timers = globalThis }) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ownerId)
      || !accessToken || !WebSocketClass) throw new Error('Authenticated owner required');
  const endpoint = new URL('/realtime/v1/websocket', url);
  endpoint.protocol = endpoint.protocol === 'https:' ? 'wss:' : 'ws:';
  endpoint.searchParams.set('apikey', apiKey);
  endpoint.searchParams.set('vsn', '1.0.0');
  const topic = `realtime:rakeezx-owner:${ownerId}`;
  let stopped = false, socket, retry, heartbeat, deadline, sequence = 0, attempt = 0;
  let joined = false, joinRef, heartbeatRef = null;
  const clear = () => {
    timers.clearTimeout(deadline); timers.clearInterval(heartbeat);
    joined = false; heartbeatRef = null;
  };
  const send = (event, payload, target = topic) => {
    const ref = String(++sequence);
    socket.send(JSON.stringify({ topic: target, event, payload, ref, join_ref: target === 'phoenix' ? null : joinRef }));
    return ref;
  };
  const connect = () => {
    if (stopped) return;
    const current = socket = new WebSocketClass(endpoint.href);
    current.onopen = () => {
      if (stopped || current !== socket) return;
      joinRef = String(++sequence);
      current.send(JSON.stringify({ topic, event: 'phx_join', ref: joinRef, join_ref: joinRef,
        payload: { access_token: accessToken, config: {
          private: true, broadcast: { ack: false, self: false }, postgres_changes: [] } } }));
      deadline = timers.setTimeout(() => current.close(), 10_000);
    };
    current.onmessage = ({ data }) => {
      if (stopped || current !== socket) return;
      let message;
      try { message = JSON.parse(data); } catch { return; }
      if (message.topic === 'phoenix' && message.event === 'phx_reply'
          && message.ref === heartbeatRef) { heartbeatRef = null; return; }
      if (message.topic !== topic) return;
      if (message.event === 'phx_reply' && message.ref === joinRef) {
        if (joined) return;
        if (message.payload?.status !== 'ok') { current.close(); return; }
        timers.clearTimeout(deadline); joined = true; attempt = 0;
        heartbeat = timers.setInterval(() => {
          if (heartbeatRef !== null) { current.close(); return; }
          heartbeatRef = send('heartbeat', {}, 'phoenix');
        }, 25_000);
        onSubscribed?.();
      } else if (message.event === 'phx_error' || message.event === 'phx_close') current.close();
      else if (joined && message.event === 'broadcast' && message.payload?.event === 'invalidate') {
        const revision = message.payload.payload?.revision;
        if (typeof revision === 'string' && /^(0|[1-9][0-9]*)$/.test(revision)) onRevision(revision);
      }
    };
    current.onerror = () => current.close();
    current.onclose = () => {
      if (current !== socket) return;
      clear();
      if (!stopped) retry = timers.setTimeout(connect, Math.min(30_000, 1_000 * 2 ** attempt++));
    };
  };
  connect();
  return () => { stopped = true; timers.clearTimeout(retry); clear(); socket?.close(); };
}
