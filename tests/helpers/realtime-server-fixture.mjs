// Transactional stand-in ONLY. This does not prove the Supabase Realtime
// authorization service, WebSocket delivery, or its replication integration.
export async function installRealtimeFixture(pg) {
  await pg.exec(`create schema realtime;
    create table realtime.messages(id bigint generated always as identity,
      topic text, extension text, payload jsonb, event text, private boolean);
    alter table realtime.messages enable row level security;
    grant usage on schema realtime to authenticated, anon;
    grant select, insert on realtime.messages to authenticated, anon;
    create function realtime.topic() returns text language sql stable as
      $$select current_setting('test.realtime_topic',true)$$;
    create function realtime.send(payload jsonb,event text,topic text,private boolean)
      returns void language sql as $$insert into realtime.messages(topic,extension,payload,event,private)
        values(topic,'broadcast',payload,event,private)$$;`);
}
